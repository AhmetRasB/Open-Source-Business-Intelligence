import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type DesignerUiState = {
  leftWidth: number
  rightWidth: number
  leftCollapsed: boolean
  rightCollapsed: boolean
  setLeftWidth: (w: number) => void
  setRightWidth: (w: number) => void
  toggleLeft: () => void
  toggleRight: () => void
}

export const useDesignerUiStore = create<DesignerUiState>()(
  persist(
    (set) => ({
      leftWidth: 300,
      rightWidth: 440,
      leftCollapsed: false,
      rightCollapsed: false,
      setLeftWidth: (w) => set({ leftWidth: Math.max(220, Math.min(520, w)) }),
      setRightWidth: (w) => set({ rightWidth: Math.max(300, Math.min(720, w)) }),
      toggleLeft: () => set((s) => ({ leftCollapsed: !s.leftCollapsed })),
      toggleRight: () => set((s) => ({ rightCollapsed: !s.rightCollapsed })),
    }),
    { name: 'biapp-designer-ui' },
  ),
)

