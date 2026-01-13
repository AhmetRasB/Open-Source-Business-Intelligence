import { Button } from '@mantine/core'

import { useFilterStore } from '../../../stores/filterStore'
import { useDashboardStore } from '../../../stores/dashboardStore'

export function ButtonWidget({ id, compact = false }: { id: string; compact?: boolean }) {
  const widget = useDashboardStore((s) => s.widgets[id])
  const clearFilters = useFilterStore((s) => s.clear)

  if (!widget || widget.type !== 'button') return null

  const label = widget.config.buttonLabel ?? widget.title ?? 'Button'
  const variant = widget.config.buttonVariant ?? 'filled'
  const color = widget.config.buttonColor ?? 'blue'
  const size = widget.config.buttonSize ?? (compact ? 'xs' : 'sm')
  const action = widget.config.buttonAction ?? 'none'

  return (
    <Button
      variant={variant as any}
      color={color}
      size={size as any}
      onClick={() => {
        if (action === 'clearFilters') clearFilters()
      }}
    >
      {label}
    </Button>
  )
}

