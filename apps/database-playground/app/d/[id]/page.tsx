'use client'

import Workspace from '~/components/workspace'

export default function Page({ params }: { params: { id: string } }) {
  const databaseId = params.id
  return <Workspace databaseId={databaseId} />
}
