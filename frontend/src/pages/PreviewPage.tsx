import { useMemo } from 'react'
import { Paper } from '@mantine/core'

import { DashboardFrame } from '../components/dashboard/DashboardFrame'

export function PreviewPage() {
  const gridSettings = useMemo(
    () => ({
      cols: 12,
      rowHeight: 30,
      margin: [10, 10] as const,
      containerPadding: [10, 10] as const,
    }),
    [],
  )

  return (
    <Paper p={0} withBorder h="calc(100vh - 48px)" style={{ overflow: 'hidden' }}>
      <DashboardFrame interactive={false} gridSettings={gridSettings} />
    </Paper>
  )
}


