/** Subscribe a component to a @hydras/sync Readable value. */
import { useSyncExternalStore } from 'react'
import type { Readable } from '@hydras/sync'

export function useReadable<T>(source: Readable<T>): T {
  return useSyncExternalStore(source.subscribe, source.get, source.get)
}
