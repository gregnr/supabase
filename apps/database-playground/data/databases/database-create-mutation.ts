import { useMutation, UseMutationOptions, useQueryClient } from '@tanstack/react-query'
import { generateId } from 'ai'
import { codeBlock } from 'common-tags'
import { Database, getMetaDb } from '~/lib/db'
import { getDatabasesQueryKey } from './databases-query'

export const useDatabaseCreateMutation = ({
  onSuccess,
  onError,
  ...options
}: Omit<UseMutationOptions<Database, Error>, 'mutationFn'> = {}) => {
  const queryClient = useQueryClient()

  return useMutation<Database, Error>({
    mutationFn: async () => {
      const metaDb = await getMetaDb()

      const id = generateId()

      const {
        rows: [database],
      } = await metaDb.query<Database>(
        codeBlock`
          insert into databases (id)
          values ($1)
          returning id, name, created_at as "createdAt"
        `,
        [id]
      )

      return database
    },
    async onSuccess(data, variables, context) {
      await Promise.all([queryClient.invalidateQueries({ queryKey: getDatabasesQueryKey() })])
      return onSuccess?.(data, variables, context)
    },
    ...options,
  })
}
