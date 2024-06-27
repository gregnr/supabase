import { PGliteWorker } from '@electric-sql/pglite/worker'
import { generateId } from 'ai'

// React's `useEffect` double-rendering in dev mode causes pglite errors
// Temp: storing singleton instance in module scope
// TODO: get working in WebWorkers
export let db: PGliteWorker
export let currentDbId: string = getDbId()

loadDb(currentDbId)

export async function loadDb(id: string) {
  db = new PGliteWorker(`idb://${id}`)
  await db.waitReady
  return db
}

// TODO: find a way to delete more elegantly via PGlite
export async function resetDb() {
  await db.close()
  indexedDB.deleteDatabase(`/pglite/${currentDbId}`)
  currentDbId = newDbId()
  return loadDb(currentDbId)
}

export function getDbId() {
  if (typeof window === 'undefined') {
    return newDbId()
  }

  const dbId = window.localStorage.getItem('current-db-id')
  return dbId ?? newDbId()
}

export function newDbId() {
  const dbId = generateId()

  if (typeof window !== 'undefined') {
    window.localStorage.setItem('current-db-id', dbId)
  }

  return dbId
}
