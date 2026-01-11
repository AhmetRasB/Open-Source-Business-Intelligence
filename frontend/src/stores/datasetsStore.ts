import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type Dataset = {
  id: string
  name: string
  columns: string[]
  rows: Record<string, unknown>[]
  createdAtUtc: string
}

type DatasetState = {
  datasets: Dataset[]
  addDataset: (d: Omit<Dataset, 'id' | 'createdAtUtc'>) => string
  deleteDataset: (id: string) => void
  getById: (id: string) => Dataset | undefined
}

function newId() {
  return `ds_${(globalThis.crypto as any)?.randomUUID?.() ?? `${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`}`
}

export const useDatasetsStore = create<DatasetState>()(
  persist(
    (set, get) => ({
      datasets: [],
      addDataset: (d) => {
        const id = newId()
        const next = {
          id,
          createdAtUtc: new Date().toISOString(),
          ...d,
        }
        set((s) => ({ datasets: [next, ...s.datasets] }))
        return id
      },
      deleteDataset: (id) => set((s) => ({ datasets: s.datasets.filter((x) => x.id !== id) })),
      getById: (id) => get().datasets.find((d) => d.id === id),
    }),
    { name: 'biapp-datasets', storage: createJSONStorage(() => sessionStorage) },
  ),
)

