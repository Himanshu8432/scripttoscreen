// AsyncLocalStorage-based API key context.
// Pipeline functions call getApiKeys() to get the keys for the current request.
// The route handler wraps the entire pipeline in runWithKeys() so concurrent
// requests never bleed into each other's key context.

import { AsyncLocalStorage } from "async_hooks"

export interface ApiKeys {
  openaiKey: string
  pixazoKey: string
  blobToken: string
}

const storage = new AsyncLocalStorage<ApiKeys>()

export function getApiKeys(): ApiKeys {
  const keys = storage.getStore()
  if (keys) return keys
  return { openaiKey: "", pixazoKey: "", blobToken: "" }
}

export async function runWithKeys<T>(keys: ApiKeys, fn: () => Promise<T>): Promise<T> {
  return storage.run(keys, fn)
}
