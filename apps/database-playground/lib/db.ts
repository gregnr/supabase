import { PGliteWorker } from '@electric-sql/pglite/worker'
import { generateId } from 'ai'
import { codeBlock } from 'common-tags'

export type Database = {
  id: string
  name: string | null
  createdAt: Date
}

const prefix = 'playground'

let metaDbPromise: Promise<PGliteWorker>
const databaseConnections = new Map<string, Promise<PGliteWorker> | undefined>()

export async function getMetaDb() {
  if (metaDbPromise) {
    return await metaDbPromise
  }

  async function run() {
    const metaDb = new PGliteWorker(`idb://meta`)
    await metaDb.waitReady
    await runMigrations(metaDb, metaMigrations)
    return metaDb
  }

  metaDbPromise = run()

  return await metaDbPromise
}

// TODO: move into react query
export async function deleteDatabase(id: string) {
  const metaDb = await getMetaDb()

  await metaDb.query<Database>(
    codeBlock`
      delete from databases
      where id = $1
    `,
    [id]
  )

  await closeDatabase(id)
  indexedDB.deleteDatabase(`/pglite/${prefix}-${id}`)
}

export async function getDatabase(id: string) {
  const openDatabasePromise = databaseConnections.get(id)

  if (openDatabasePromise) {
    return await openDatabasePromise
  }

  async function run() {
    const metaDb = await getMetaDb()
    const {
      rows: [database],
    } = await metaDb.query<Database>('select * from databases where id = $1', [id])

    if (!database) {
      throw new Error(`Database with ID '${id}' doesn't exist`)
    }

    const db = new PGliteWorker(`idb://${prefix}-${id}`)
    await db.waitReady
    await runMigrations(db, migrations)

    return db
  }

  const promise = run()

  databaseConnections.set(id, promise)

  return await promise
}

export async function closeDatabase(id: string) {
  let db = await databaseConnections.get(id)

  if (db) {
    await db.close()
    databaseConnections.delete(id)
  }
}

// Transaction isn't actually a PGliteWorker, but it's the closest type for now
type Transaction = PGliteWorker

type Migration = {
  version: string
  name?: string
  sql: string
}

const metaMigrations: Migration[] = [
  {
    version: '202406300001',
    name: 'databases',
    sql: codeBlock`
      create table databases (
        id text primary key,
        created_at timestamptz not null default now(),
        name text
      );
    `,
  },
  {
    version: '202406300002',
    name: 'messages',
    sql: codeBlock`
      create table messages (
        id text primary key,
        database_id text not null references databases(id),
        created_at timestamptz not null default now(),
        content text not null,
        role text not null check (role in ('user', 'assistant', 'tool')),
        tool_invocations jsonb
      );
    `,
  },
].sort()

// TODO: migrations per database
const migrations: Migration[] = [].sort()

export async function runMigrations(db: PGliteWorker, migrations: Migration[]) {
  await db.exec(codeBlock`
    create schema if not exists meta;

    create table if not exists meta.migrations (
      version text primary key,
      name text,
      applied_at timestamptz not null default now()
    );
  `)

  const { rows: appliedMigrations } = await db.query<{ version: string }>(
    'select version from meta.migrations order by version asc'
  )

  await db.transaction(async (tx: Transaction) => {
    for (let i = 0; i < migrations.length; i++) {
      const migration = migrations[i]
      const appliedMigration = appliedMigrations[i]

      if (appliedMigration) {
        if (migration.version === appliedMigration.version) {
          continue
        } else {
          throw new Error(
            `A previously applied migration was removed or new migration was added with a version less than the latest`
          )
        }
      }

      await tx.query('insert into meta.migrations (version, name) values ($1, $2)', [
        migration.version,
        migration.name,
      ])

      await tx.exec(migration.sql)
    }
  })
}
