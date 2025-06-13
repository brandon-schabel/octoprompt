/**
 * Read-Write Lock implementation for storage concurrency control
 * Allows multiple concurrent reads but exclusive writes
 */

export interface Lock {
  acquire(): Promise<void>
  release(): void
  isLocked(): boolean
}

export interface ReadWriteLock {
  readLock(): Lock
  writeLock(): Lock
  isReadLocked(): boolean
  isWriteLocked(): boolean
  readerCount(): number
}

interface LockWaiter {
  resolve: () => void
  reject: (error: Error) => void
  timeout?: NodeJS.Timeout
}

export class ReadWriteLockImpl implements ReadWriteLock {
  private readers = 0
  private writer = false
  private readWaiters: LockWaiter[] = []
  private writeWaiters: LockWaiter[] = []
  private lockTimeout: number
  
  constructor(lockTimeout = 30000) {
    this.lockTimeout = lockTimeout
  }
  
  readLock(): Lock {
    return new ReadLockImpl(this)
  }
  
  writeLock(): Lock {
    return new WriteLockImpl(this)
  }
  
  isReadLocked(): boolean {
    return this.readers > 0
  }
  
  isWriteLocked(): boolean {
    return this.writer
  }
  
  readerCount(): number {
    return this.readers
  }
  
  async acquireReadLock(): Promise<void> {
    // If no writer and no waiting writers, acquire immediately
    if (!this.writer && this.writeWaiters.length === 0) {
      this.readers++
      return
    }
    
    // Wait for writer to finish
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.readWaiters.findIndex(w => w.resolve === resolve)
        if (index >= 0) {
          this.readWaiters.splice(index, 1)
        }
        reject(new Error('Read lock acquisition timeout'))
      }, this.lockTimeout)
      
      this.readWaiters.push({ resolve, reject, timeout })
    })
  }
  
  releaseReadLock(): void {
    if (this.readers <= 0) {
      throw new Error('No read lock to release')
    }
    
    this.readers--
    
    // If no more readers, wake up waiting writers
    if (this.readers === 0 && this.writeWaiters.length > 0) {
      const waiter = this.writeWaiters.shift()!
      if (waiter.timeout) clearTimeout(waiter.timeout)
      this.writer = true
      waiter.resolve()
    }
  }
  
  async acquireWriteLock(): Promise<void> {
    // If no readers and no writer, acquire immediately
    if (this.readers === 0 && !this.writer) {
      this.writer = true
      return
    }
    
    // Wait for readers and writers to finish
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.writeWaiters.findIndex(w => w.resolve === resolve)
        if (index >= 0) {
          this.writeWaiters.splice(index, 1)
        }
        reject(new Error('Write lock acquisition timeout'))
      }, this.lockTimeout)
      
      this.writeWaiters.push({ resolve, reject, timeout })
    })
  }
  
  releaseWriteLock(): void {
    if (!this.writer) {
      throw new Error('No write lock to release')
    }
    
    this.writer = false
    
    // Prioritize waiting writers over readers to prevent writer starvation
    if (this.writeWaiters.length > 0) {
      const waiter = this.writeWaiters.shift()!
      if (waiter.timeout) clearTimeout(waiter.timeout)
      this.writer = true
      waiter.resolve()
    } else {
      // Wake up all waiting readers
      const waiters = this.readWaiters.splice(0)
      this.readers = waiters.length
      
      for (const waiter of waiters) {
        if (waiter.timeout) clearTimeout(waiter.timeout)
        waiter.resolve()
      }
    }
  }
}

class ReadLockImpl implements Lock {
  private locked = false
  
  constructor(private rwLock: ReadWriteLockImpl) {}
  
  async acquire(): Promise<void> {
    if (this.locked) {
      throw new Error('Read lock already acquired')
    }
    
    await this.rwLock.acquireReadLock()
    this.locked = true
  }
  
  release(): void {
    if (!this.locked) {
      throw new Error('Read lock not acquired')
    }
    
    this.rwLock.releaseReadLock()
    this.locked = false
  }
  
  isLocked(): boolean {
    return this.locked
  }
}

class WriteLockImpl implements Lock {
  private locked = false
  
  constructor(private rwLock: ReadWriteLockImpl) {}
  
  async acquire(): Promise<void> {
    if (this.locked) {
      throw new Error('Write lock already acquired')
    }
    
    await this.rwLock.acquireWriteLock()
    this.locked = true
  }
  
  release(): void {
    if (!this.locked) {
      throw new Error('Write lock not acquired')
    }
    
    this.rwLock.releaseWriteLock()
    this.locked = false
  }
  
  isLocked(): boolean {
    return this.locked
  }
}

/**
 * Lock manager for managing locks across different resources
 */
export class LockManager {
  private locks = new Map<string, ReadWriteLockImpl>()
  private lockTimeout: number
  
  constructor(lockTimeout = 30000) {
    this.lockTimeout = lockTimeout
  }
  
  getLock(resource: string): ReadWriteLock {
    if (!this.locks.has(resource)) {
      this.locks.set(resource, new ReadWriteLockImpl(this.lockTimeout))
    }
    return this.locks.get(resource)!
  }
  
  // Utility methods for common operations
  async withReadLock<T>(resource: string, operation: () => Promise<T>): Promise<T> {
    const lock = this.getLock(resource).readLock()
    await lock.acquire()
    
    try {
      return await operation()
    } finally {
      lock.release()
    }
  }
  
  async withWriteLock<T>(resource: string, operation: () => Promise<T>): Promise<T> {
    const lock = this.getLock(resource).writeLock()
    await lock.acquire()
    
    try {
      return await operation()
    } finally {
      lock.release()
    }
  }
  
  // Get lock statistics
  getLockStats(resource: string) {
    const lock = this.locks.get(resource)
    if (!lock) {
      return {
        exists: false,
        readers: 0,
        writer: false
      }
    }
    
    return {
      exists: true,
      readers: lock.readerCount(),
      writer: lock.isWriteLocked()
    }
  }
  
  // Clean up unused locks
  cleanup(): void {
    for (const [resource, lock] of this.locks.entries()) {
      if (!lock.isReadLocked() && !lock.isWriteLocked()) {
        this.locks.delete(resource)
      }
    }
  }
}

// Global lock manager instance
export const globalLockManager = new LockManager()

/**
 * Decorator for automatic locking
 */
export function withLock(resource: string, type: 'read' | 'write' = 'write') {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    
    descriptor.value = async function (...args: any[]) {
      const lockManager = globalLockManager
      
      if (type === 'read') {
        return lockManager.withReadLock(resource, () => originalMethod.apply(this, args))
      } else {
        return lockManager.withWriteLock(resource, () => originalMethod.apply(this, args))
      }
    }
    
    return descriptor
  }
}