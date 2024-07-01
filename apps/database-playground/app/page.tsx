'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useDatabaseCreateMutation } from '~/data/databases/database-create-mutation'

export default function Page() {
  const router = useRouter()
  const { mutateAsync: createDatabase } = useDatabaseCreateMutation()

  useEffect(() => {
    async function run() {
      const { id } = await createDatabase()
      router.push(`/d/${id}`)
    }

    run()
  }, [router, createDatabase])

  return null
}
