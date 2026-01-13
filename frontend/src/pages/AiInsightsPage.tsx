import { Stack } from '@mantine/core'

import { AiChatPanel } from '../components/ai/AiChatPanel'

export function AiInsightsPage() {
  return (
    <Stack style={{ height: 'calc(100vh - 48px - 2rem)' }}>
      <AiChatPanel />
    </Stack>
  )
}


