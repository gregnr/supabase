import { useMutation, UseMutationOptions, useQueryClient } from '@tanstack/react-query'
import { codeBlock } from 'common-tags'
import { Database, getMetaDb } from '~/lib/db'
import { getDatabasesQueryKey } from './databases-query'

export type DatabaseUpdateVariables = {
  id: string
  name: string | null
  hidden: boolean
}

export const useDatabaseUpdateMutation = ({
  onSuccess,
  onError,
  ...options
}: Omit<UseMutationOptions<Database, Error, DatabaseUpdateVariables>, 'mutationFn'> = {}) => {
  const queryClient = useQueryClient()

  return useMutation<Database, Error, DatabaseUpdateVariables>({
    mutationFn: async ({ id, name, hidden }) => {
      const metaDb = await getMetaDb()

      const {
        rows: [database],
      } = await metaDb.query<Database>(
        codeBlock`
          update databases
          set name = $2, hidden = $3
          where id = $1
          returning id, name, created_at as "createdAt"
        `,
        [id, name, hidden]
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
