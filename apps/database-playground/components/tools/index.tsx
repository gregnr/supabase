import { ToolInvocation } from '~/lib/tools'
import CsvExport from './csv-export'
import CsvImport from './csv-import'
import CsvRequest from './csv-request'
import ExecutedSql from './executed-sql'
import GeneratedChart from './generated-chart'

export type ToolUiProps = {
  toolInvocation: ToolInvocation
}

export function ToolUi({ toolInvocation }: ToolUiProps) {
  switch (toolInvocation.toolName) {
    case 'executeSql':
      return <ExecutedSql toolInvocation={toolInvocation} />
    case 'generateChart':
      return <GeneratedChart toolInvocation={toolInvocation} />
    case 'requestCsv':
      return <CsvRequest toolInvocation={toolInvocation} />
    case 'importCsv':
      return <CsvImport toolInvocation={toolInvocation} />
    case 'exportCsv':
      return <CsvExport toolInvocation={toolInvocation} />
  }
  return null
}
