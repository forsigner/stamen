import { useState } from 'react'
import equal from 'fast-deep-equal'

import produce from 'immer'
import { useMount, useUnmount, getActionName } from './util'
import {
  Opt,
  Reducers,
  ReducerFn,
  Effects,
  StateSelector,
  ActionSelector,
  Updater,
} from './typings'

function createStore<S, R extends Reducers<S>, E extends Effects>(opt: Opt<S, R, E>) {
  let storeState: S = opt.state
  const updaters: Array<Updater<S>> = []

  function useStore<P>(selector: StateSelector<S, P>) {
    const [state, setState] = useState(() => selector(storeState))

    const update: any = (set: any, oldState: S, nextState: S) => {
      const shouldUpdate = !equal(selector(oldState), selector(nextState))
      if (shouldUpdate) {
        set(() => selector(nextState))
      }
    }

    const updater = {
      update,
      set: setState,
    }

    useMount(() => {
      updaters.push(updater)
    })

    useUnmount(() => {
      updaters.splice(updaters.indexOf(updater), 1)
    })

    return state
  }

  function getState<P>(selector: StateSelector<S, P>) {
    return selector(storeState)
  }

  async function dispatch<K extends any>(
    action: keyof (R & E) | ActionSelector<R, E>,
    payload?: K,
  ) {
    let result: any
    const actionName = getActionName(action)
    if (opt.effects && opt.effects[actionName]) {
      result = await opt.effects[actionName](payload)
      return result
    }
    if (!updaters.length) return

    if (!action) return null

    if (opt.reducers) {
      const reducer: ReducerFn<S> = opt.reducers[actionName]
      if (reducer) {
        const nextState: S = produce<any>(storeState, (draft: S) => {
          result = reducer(draft, payload)
        })
        const oldState = storeState
        storeState = nextState
        updaters.forEach(updater => {
          updater.update(updater.set, oldState, nextState)
        })
      }
      return result
    }
    return
  }

  return { useStore, dispatch, getState }
}

export { createStore }
export * from './typings'
