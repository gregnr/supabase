import { UseQueryOptions, useQuery } from '@tanstack/react-query'
import { Database, getMetaDb } from '~/lib/db'

export const useDatabasesQuery = (
  options: Omit<UseQueryOptions<Database[], Error>, 'queryKey' | 'queryFn'> = {}
) =>
  useQuery<Database[], Error>({
    ...options,
    queryKey: getDatabasesQueryKey(),
    queryFn: async () => {
      const metaDb = await getMetaDb()

      const { rows: databases } = await metaDb.query<Database>(
        'select id, name, created_at as "createdAt" from databases'
      )

      return databases
    },
    staleTime: Infinity,
  })

export const getDatabasesQueryKey = () => ['databases']
