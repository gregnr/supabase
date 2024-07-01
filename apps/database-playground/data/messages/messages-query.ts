import { UseQueryOptions, useQuery } from '@tanstack/react-query'
import { Message } from 'ai'
import { getMetaDb } from '~/lib/db'

export const useMessagesQuery = (
  databaseId: string,
  options: Omit<UseQueryOptions<Message[], Error>, 'queryKey' | 'queryFn'> = {}
) =>
  useQuery<Message[], Error>({
    ...options,
    queryKey: getMessagesQueryKey(databaseId),
    queryFn: async () => {
      const metaDb = await getMetaDb()
      const { rows: messages } = await metaDb.query<Message>(
        'select * from messages where database_id = $1',
        [databaseId]
      )
      return messages
    },
    staleTime: Infinity,
  })

export const getMessagesQueryKey = (databaseId: string) => ['messages', { databaseId }]
