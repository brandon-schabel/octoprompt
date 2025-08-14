/**
 * fp-ts compatibility layer for Effect-TS
 * Provides fp-ts-like APIs using Effect under the hood
 * This allows gradual migration while maintaining compatibility
 */

import { Either as EffectEither, Effect, pipe as effectPipe } from 'effect'

// Re-export Effect's pipe as is
export { pipe } from 'effect'

// Either compatibility
export namespace E {
  export type Either<E, A> = EffectEither.Either<A, E>

  export const left = <E>(e: E): Either<E, never> => EffectEither.left(e)
  export const right = <A>(a: A): Either<never, A> => EffectEither.right(a)

  export const isLeft = <E, A>(e: Either<E, A>): e is EffectEither.Left<E, never> => EffectEither.isLeft(e)

  export const isRight = <E, A>(e: Either<E, A>): e is EffectEither.Right<never, A> => EffectEither.isRight(e)

  export const fold =
    <E, A, B>(onLeft: (e: E) => B, onRight: (a: A) => B) =>
    (e: Either<E, A>): B =>
      EffectEither.match(e, { onLeft, onRight })

  export const map =
    <A, B>(f: (a: A) => B) =>
    <E>(e: Either<E, A>): Either<E, B> =>
      EffectEither.map(e, f)

  export const chain =
    <E, A, B>(f: (a: A) => Either<E, B>) =>
    (e: Either<E, A>): Either<E, B> =>
      EffectEither.flatMap(e, f)

  export const fromNullable =
    <E>(onNullable: E) =>
    <A>(a: A | null | undefined): Either<E, A> =>
      a == null ? left(onNullable) : right(a)

  export const tryCatch = <E, A>(f: () => A, onError: (e: unknown) => E): Either<E, A> => {
    try {
      return right(f())
    } catch (e) {
      return left(onError(e))
    }
  }
}

// TaskEither compatibility using Effect
export namespace TE {
  export interface TaskEither<E, A> {
    (): Promise<E.Either<E, A>>
  }

  export const of =
    <A>(a: A): TaskEither<never, A> =>
    () =>
      Promise.resolve(E.right(a))

  export const left =
    <E>(e: E): TaskEither<E, never> =>
    () =>
      Promise.resolve(E.left(e))

  export const right =
    <A>(a: A): TaskEither<never, A> =>
    () =>
      Promise.resolve(E.right(a))

  export const tryCatch =
    <E, A>(f: () => Promise<A>, onError: (e: unknown) => E): TaskEither<E, A> =>
    async () => {
      try {
        const result = await f()
        return E.right(result)
      } catch (e) {
        return E.left(onError(e))
      }
    }

  export const fromEither =
    <E, A>(e: E.Either<E, A>): TaskEither<E, A> =>
    () =>
      Promise.resolve(e)

  export const chain =
    <E, A, B>(f: (a: A) => TaskEither<E, B>) =>
    (te: TaskEither<E, A>): TaskEither<E, B> =>
    async () => {
      const result = await te()
      if (E.isLeft(result)) {
        return result
      }
      return f(result.right)()
    }

  export const map =
    <A, B>(f: (a: A) => B) =>
    <E>(te: TaskEither<E, A>): TaskEither<E, B> =>
    async () => {
      const result = await te()
      return E.map(f)(result)
    }

  export const fold =
    <E, A, B>(onLeft: (e: E) => B, onRight: (a: A) => B) =>
    (te: TaskEither<E, A>): Promise<B> =>
      te().then(E.fold(onLeft, onRight))

  export const orElse =
    <E, A, M>(onLeft: (e: E) => TaskEither<M, A>) =>
    (te: TaskEither<E, A>): TaskEither<M, A> =>
    async () => {
      const result = await te()
      if (E.isLeft(result)) {
        return onLeft(result.left)()
      }
      return result as E.Either<M, A>
    }
}

// Option compatibility
export namespace O {
  export type Option<A> = A | null | undefined

  export const none: Option<never> = undefined
  export const some = <A>(a: A): Option<A> => a

  export const isNone = <A>(o: Option<A>): o is null | undefined => o == null

  export const isSome = <A>(o: Option<A>): o is A => o != null

  export const fromNullable = <A>(a: A | null | undefined): Option<A> => a

  export const fromPredicate =
    <A>(predicate: (a: A) => boolean) =>
    (a: A): Option<A> =>
      predicate(a) ? a : none

  export const map =
    <A, B>(f: (a: A) => B) =>
    (o: Option<A>): Option<B> =>
      isSome(o) ? f(o) : none

  export const chain =
    <A, B>(f: (a: A) => Option<B>) =>
    (o: Option<A>): Option<B> =>
      isSome(o) ? f(o) : none

  export const fold =
    <A, B>(onNone: () => B, onSome: (a: A) => B) =>
    (o: Option<A>): B =>
      isSome(o) ? onSome(o) : onNone()
}

// Reader compatibility (simplified)
export namespace R {
  export interface Reader<R, A> {
    (r: R): A
  }

  export const of =
    <R, A>(a: A): Reader<R, A> =>
    () =>
      a

  export const ask =
    <R>(): Reader<R, R> =>
    (r) =>
      r

  export const map =
    <A, B>(f: (a: A) => B) =>
    <R>(ra: Reader<R, A>): Reader<R, B> =>
    (r) =>
      f(ra(r))

  export const chain =
    <R, A, B>(f: (a: A) => Reader<R, B>) =>
    (ra: Reader<R, A>): Reader<R, B> =>
    (r) =>
      f(ra(r))(r)
}

// ReaderTaskEither compatibility (simplified)
export namespace RTE {
  export interface ReaderTaskEither<R, E, A> {
    (r: R): TE.TaskEither<E, A>
  }

  export const ask =
    <R, E = never>(): ReaderTaskEither<R, E, R> =>
    (r) =>
      TE.of(r)

  export const fromTaskEither =
    <E, A, R = unknown>(te: TE.TaskEither<E, A>): ReaderTaskEither<R, E, A> =>
    () =>
      te

  export const chain =
    <R, E, A, B>(f: (a: A) => ReaderTaskEither<R, E, B>) =>
    (rte: ReaderTaskEither<R, E, A>): ReaderTaskEither<R, E, B> =>
    (r) =>
      TE.chain((a: A) => f(a)(r))(rte(r))
}
