import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AiChatRole = 'user' | 'assistant'

export type AiChatMessage = {
  id: string
  role: AiChatRole
  /** Final content (after typing completes) */
  content: string
  /** When set, UI should type this out into `content` */
  pendingFullContent?: string
}

type AiChatState = {
  connectionId: string | null
  messages: AiChatMessage[]

  setConnectionId: (id: string | null) => void
  resetChat: () => void
  pushUser: (text: string) => void
  pushAssistantTyping: (fullText: string) => string
  setMessageContent: (id: string, content: string) => void
  clearPending: (id: string) => void
}

function id() {
  return crypto.randomUUID()
}

const initialMessages: AiChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      'Merhaba! İstediğin raporu birlikte çıkaralım. Bir tabloyu @ ile etiketleyebilirsin (ör: @dbo.SalesOrderHeader). Hangi KPI / kırılımı istiyorsun?',
  },
]

export const useAiChatStore = create<AiChatState>()(
  persist(
    (set) => ({
      connectionId: null,
      messages: initialMessages,

      setConnectionId: (connectionId) => set({ connectionId }),

      resetChat: () => set({ messages: initialMessages }),

      pushUser: (text) =>
        set((s) => ({
          messages: [...s.messages, { id: id(), role: 'user', content: text }],
        })),

      pushAssistantTyping: (fullText) => {
        const msgId = id()
        set((s) => ({
          messages: [
            ...s.messages,
            { id: msgId, role: 'assistant', content: '', pendingFullContent: fullText },
          ],
        }))
        return msgId
      },

      setMessageContent: (messageId, content) =>
        set((s) => ({
          messages: s.messages.map((m) => (m.id === messageId ? { ...m, content } : m)),
        })),

      clearPending: (messageId) =>
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === messageId ? { ...m, pendingFullContent: undefined } : m,
          ),
        })),
    }),
    {
      name: 'biapp-ai-chat',
      partialize: (s) => ({ connectionId: s.connectionId, messages: s.messages }),
    },
  ),
)


