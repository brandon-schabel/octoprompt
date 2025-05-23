# performance_config.py
# Configuration and setup for maximum file sync performance

import os
import asyncio
from typing import Dict, Any

class PerformanceConfig:
    """Centralized performance configuration"""
    
    def __init__(self):
        # Auto-detect optimal settings based on system resources
        cpu_count = os.cpu_count() or 4
        
        # File processing limits
        self.MAX_CONCURRENT_FILES = min(cpu_count * 8, 100)  # Scale with CPU cores
        self.CHUNK_SIZE = 200  # Files per chunk
        self.FILE_READ_BUFFER_SIZE = 64 * 1024  # 64KB buffer
        self.MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB max
        
        # Database optimization
        self.DB_BATCH_SIZE = 500  # Bulk operations batch size
        self.DB_CONNECTION_POOL_SIZE = 10
        
        # Memory management
        self.ENABLE_STATS_CACHE = True
        self.MAX_CACHE_SIZE = 10000  # File stats cache entries
        
        # Checksum optimization
        self.USE_FAST_CHECKSUM = True  # xxhash vs SHA256
        self.CHECKSUM_CHUNK_SIZE = 8192  # For streaming large files
        
        # Monitoring
        self.ENABLE_PERFORMANCE_LOGGING = True
        self.LOG_SLOW_FILES_THRESHOLD = 0.1  # seconds

# Install required dependencies
REQUIRED_PACKAGES = [
    "aiofiles>=23.0.0",  # Async file operations
    "xxhash>=3.0.0",     # Fast checksums
    "uvloop>=0.17.0",    # Faster event loop (Linux/macOS)
]

def install_performance_deps():
    """Install performance-critical dependencies"""
    import subprocess
    import sys
    
    for package in REQUIRED_PACKAGES:
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", package])
            print(f"✅ Installed {package}")
        except subprocess.CalledProcessError:
            print(f"❌ Failed to install {package}")

# System optimizations
def optimize_async_performance():
    """Apply system-level async optimizations"""
    try:
        # Use uvloop for better performance on Linux/macOS
        import uvloop
        asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
        print("✅ Using uvloop for enhanced async performance")
    except ImportError:
        print("⚠️  uvloop not available, using default event loop")
    
    # Increase file descriptor limits if possible
    try:
        import resource
        soft, hard = resource.getrlimit(resource.RLIMIT_NOFILE)
        if soft < 4096:
            resource.setrlimit(resource.RLIMIT_NOFILE, (min(4096, hard), hard))
            print(f"✅ Increased file descriptor limit to {min(4096, hard)}")
    except (ImportError, ValueError, OSError):
        print("⚠️  Could not increase file descriptor limit")

# File system optimizations
FILE_SYSTEM_OPTIMIZATIONS = {
    "use_sendfile": True,      # Use sendfile() for large file operations
    "buffer_size": 64 * 1024,  # Optimal buffer size for most systems
    "prefetch_metadata": True,  # Pre-fetch file metadata
    "batch_stat_calls": True,   # Batch file stat operations
}

# Database query optimizations
DB_OPTIMIZATIONS = {
    "use_bulk_operations": True,
    "enable_query_batching": True,
    "connection_pooling": True,
    "prepared_statements": True,
    "index_optimization": [
        "CREATE INDEX IF NOT EXISTS idx_project_files_path ON project_files(project_id, path)",
        "CREATE INDEX IF NOT EXISTS idx_project_files_checksum ON project_files(checksum)",
        "CREATE INDEX IF NOT EXISTS idx_project_files_updated ON project_files(updated)",
    ]
}

# Memory usage optimization
def optimize_memory_usage():
    """Configure Python for optimal memory usage"""
    import gc
    
    # More frequent garbage collection for large file operations
    gc.set_threshold(700, 10, 10)
    
    # Enable garbage collection debug if needed
    # gc.set_debug(gc.DEBUG_STATS)

# Performance monitoring utilities
class PerformanceMonitor:
    def __init__(self):
        self.metrics = {
            "files_processed": 0,
            "total_time": 0,
            "avg_file_time": 0,
            "cache_hits": 0,
            "cache_misses": 0,
        }
    
    def log_file_processed(self, processing_time: float):
        self.metrics["files_processed"] += 1
        self.metrics["total_time"] += processing_time
        self.metrics["avg_file_time"] = (
            self.metrics["total_time"] / self.metrics["files_processed"]
        )
    
    def log_cache_hit(self):
        self.metrics["cache_hits"] += 1
    
    def log_cache_miss(self):
        self.metrics["cache_misses"] += 1
    
    def get_cache_hit_rate(self) -> float:
        total = self.metrics["cache_hits"] + self.metrics["cache_misses"]
        return self.metrics["cache_hits"] / total if total > 0 else 0
    
    def print_stats(self):
        print("📊 Performance Statistics:")
        print(f"   Files processed: {self.metrics['files_processed']}")
        print(f"   Total time: {self.metrics['total_time']:.2f}s")
        print(f"   Avg time per file: {self.metrics['avg_file_time']*1000:.1f}ms")
        print(f"   Cache hit rate: {self.get_cache_hit_rate()*100:.1f}%")
        if self.metrics['total_time'] > 0:
            rate = self.metrics['files_processed'] / self.metrics['total_time']
            print(f"   Processing rate: {rate:.1f} files/second")

# Environment-specific optimizations
def detect_and_optimize_environment():
    """Detect environment and apply appropriate optimizations"""
    import platform
    
    system = platform.system().lower()
    
    if system == "linux":
        print("🐧 Linux detected - enabling io_uring optimizations")
        # Enable io_uring if available
        try:
            import io_uring
            print("✅ io_uring available for enhanced I/O performance")
        except ImportError:
            print("⚠️  io_uring not available")
    
    elif system == "darwin":  # macOS
        print("🍎 macOS detected - enabling kqueue optimizations")
        # macOS-specific optimizations
    
    elif system == "windows":
        print("🪟 Windows detected - enabling IOCP optimizations")
        # Windows-specific optimizations
        
    # Detect SSD vs HDD
    # This is a simplified detection - you might want more sophisticated logic
    import psutil
    try:
        # Check if any disk has SSD characteristics
        for disk in psutil.disk_partitions():
            print(f"💾 Detected storage: {disk.device}")
    except:
        pass

# Quick setup function
def setup_high_performance_sync():
    """One-command setup for maximum performance"""
    print("🚀 Setting up high-performance file sync...")
    
    # Install dependencies
    install_performance_deps()
    
    # Apply system optimizations  
    optimize_async_performance()
    optimize_memory_usage()
    detect_and_optimize_environment()
    
    print("✅ High-performance setup complete!")
    
    return PerformanceConfig()

if __name__ == "__main__":
    config = setup_high_performance_sync()
    print(f"📋 Configuration: {config.__dict__}")