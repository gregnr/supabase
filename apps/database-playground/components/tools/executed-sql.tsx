import { ToolInvocation } from '~/lib/tools'
import CodeAccordion from '../code-accordion'

export type ExecutedSqlProps = {
  toolInvocation: ToolInvocation<'executeSql'>
}

export default function ExecutedSql({ toolInvocation }: ExecutedSqlProps) {
  if (!('result' in toolInvocation)) {
    return null
  }

  if (!toolInvocation.result.success) {
    return <div className="bg-destructive-300 px-6 py-4 rounded-md">Error executing SQL</div>
  }

  const { sql } = toolInvocation.args

  return <CodeAccordion title="Executed SQL" language="sql" code={sql} />
}
