import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type DashboardFilter =
  | {
      kind: 'db'
      connectionId: string
      sourceTable: string
      column: string
      values: string[]
    }
  | {
      kind: 'dataset'
      datasetId: string
      column: string
      values: string[]
    }

type FilterState = {
  active: DashboardFilter | null
  setActive: (f: DashboardFilter | null) => void
  applyClick: (
    f:
      | { kind: 'db'; connectionId: string; sourceTable: string; column: string; value: string; multi: boolean }
      | { kind: 'dataset'; datasetId: string; column: string; value: string; multi: boolean }
  ) => void
  clear: () => void
}

export const useFilterStore = create<FilterState>()(
  persist(
    (set, get) => ({
      active: null,
      setActive: (f) => set({ active: f }),
      applyClick: (f) => {
        const prev = get().active
        const same =
          prev &&
          ((prev.kind === 'db' &&
            f.kind === 'db' &&
            prev.connectionId === f.connectionId &&
            prev.sourceTable === f.sourceTable &&
            prev.column === f.column) ||
            (prev.kind === 'dataset' && f.kind === 'dataset' && prev.datasetId === f.datasetId && prev.column === f.column))

        const value = String(f.value ?? '').trim()
        if (!value) return

        if (!f.multi) {
          set({ active: { ...(f as any), values: [value] } })
          return
        }

        const nextValues = same ? [...prev!.values] : []
        const idx = nextValues.findIndex((v) => v.toLowerCase() === value.toLowerCase())
        if (idx >= 0) nextValues.splice(idx, 1)
        else nextValues.push(value)

        if (nextValues.length === 0) set({ active: null })
        else set({ active: { ...(f as any), values: nextValues } })
      },
      clear: () => set({ active: null }),
    }),
    { name: 'biapp-filters', storage: createJSONStorage(() => sessionStorage) },
  ),
)

