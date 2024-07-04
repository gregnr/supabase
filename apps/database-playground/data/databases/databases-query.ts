import { UseQueryOptions, useQuery } from '@tanstack/react-query'
import { codeBlock } from 'common-tags'
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
        codeBlock`
          select id, name, created_at as "createdAt", hidden as "isHidden"
          from databases
          where hidden = false
        `
      )

      return databases
    },
    staleTime: Infinity,
  })

export const getDatabasesQueryKey = () => ['databases']
