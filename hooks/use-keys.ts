"use client"

import { useState, useEffect } from "react"

export interface AppKeys {
  openaiKey: string
  pixazoKey: string
}

const STORAGE_KEY = "s2s:keys"
const EMPTY: AppKeys = { openaiKey: "", pixazoKey: "" }

function load(): AppKeys {
  if (typeof window === "undefined") return EMPTY
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    return { ...EMPTY, ...JSON.parse(raw) }
  } catch {
    return EMPTY
  }
}

export function useKeys() {
  const [keys, setKeysState] = useState<AppKeys>(EMPTY)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setKeysState(load())
    setHydrated(true)
  }, [])

  function setKeys(next: AppKeys) {
    setKeysState(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function clearKeys() {
    setKeysState(EMPTY)
    localStorage.removeItem(STORAGE_KEY)
  }

  const keysReady = hydrated && !!keys.openaiKey.trim() && !!keys.pixazoKey.trim()

  return { keys, setKeys, clearKeys, keysReady, hydrated }
}
