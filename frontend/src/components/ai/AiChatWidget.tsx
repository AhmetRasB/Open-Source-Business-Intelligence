import { useState } from 'react'
import { Affix, Button, Drawer } from '@mantine/core'

import { AiChatPanel } from './AiChatPanel'

export function AiChatWidget() {
  const [opened, setOpened] = useState(false)

  return (
    <>
      <Drawer
        opened={opened}
        onClose={() => setOpened(false)}
        title="AI Assistant"
        position="right"
        size={420}
      >
        <div style={{ height: 'calc(100vh - 120px)' }}>
          <AiChatPanel showHeader={false} />
        </div>
      </Drawer>

      <Affix position={{ bottom: 20, right: 20 }}>
        <Button onClick={() => setOpened(true)} variant="filled">
          AI
        </Button>
      </Affix>
    </>
  )
}


