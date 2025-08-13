// recent changes: created minimal fp compat; added Either/TaskEither; added pipe; added TE.tryCatch/fromEither; added E.of/chain/isLeft

export type Left<E> = { _tag: 'Left'; left: E }
export type Right<A> = { _tag: 'Right'; right: A }
export type Either<E, A> = Left<E> | Right<A>

export const E = {
  left: <E>(e: E): Left<E> => ({ _tag: 'Left', left: e }),
  right: <A>(a: A): Right<A> => ({ _tag: 'Right', right: a }),
  of: <A>(a: A): Right<A> => ({ _tag: 'Right', right: a }),
  isLeft: <E, A>(ea: Either<E, A>): ea is Left<E> => ea._tag === 'Left',
  isRight: <E, A>(ea: Either<E, A>): ea is Right<A> => ea._tag === 'Right',
  chain:
    <E, A, B>(f: (a: A) => Either<E, B>) =>
    (ea: Either<E, A>): Either<E, B> =>
      ea._tag === 'Left' ? ea : f(ea.right)
}

export namespace E {
  export type Either<E, A> = import('./fp').Either<E, A>
  export type Left<E> = import('./fp').Left<E>
  export type Right<A> = import('./fp').Right<A>
}

export type TaskEither<E, A> = () => Promise<Either<E, A>>

export const TE = {
  tryCatch:
    <E, A>(thunk: () => Promise<A>, onError: (e: unknown) => E): TaskEither<E, A> =>
    async () => {
      try {
        return E.right(await thunk())
      } catch (err) {
        return E.left(onError(err))
      }
    },
  fromEither:
    <E, A>(ea: Either<E, A>): TaskEither<E, A> =>
    async () =>
      ea,
  sequenceArray: async <E, A>(arr: TaskEither<E, A>[]): Promise<Either<E, A[]>> => {
    const out: A[] = []
    for (const t of arr) {
      const r = await t()
      if (E.isLeft(r)) return r
      out.push(r.right)
    }
    return E.right(out)
  }
}

export namespace TE {
  export type TaskEither<E, A> = import('./fp').TaskEither<E, A>
}

export const A = {
  mapWithIndex:
    <A, B>(f: (i: number, a: A) => B) =>
    (as: A[]): B[] =>
      as.map((a, i) => f(i, a))
}

export const O = {
  fromPredicate:
    <A>(pred: (a: A) => boolean) =>
    (a: A) =>
      pred(a) ? { _tag: 'Some', value: a } : { _tag: 'None' as const },
  isSome: <A>(o: { _tag: 'Some'; value: A } | { _tag: 'None' }): o is { _tag: 'Some'; value: A } => o._tag === 'Some'
}

export const pipe = <A>(a: A, ...fns: Array<(a: any) => any>) => fns.reduce((v, f) => f(v), a)
