import type { WidgetType } from '../stores/dashboardStore'

export function createDefaultEChartsOverridesJson(type: WidgetType) {
  // A verbose, "kitchen-sink" template to expose A-to-Z knobs.
  // Users can delete what they don't need.
  const base: any = {
    title: {
      show: true,
      text: 'BarChart',
      left: 'center',
      top: 0,
      textStyle: { fontSize: 14, fontWeight: 600 },
    },
    legend: {
      show: true,
      top: 28,
      type: 'scroll',
    },
    toolbox: {
      show: true,
      right: 8,
      feature: {
        dataZoom: { yAxisIndex: 'none' },
        restore: {},
        saveAsImage: {},
      },
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0 },
      { type: 'slider', xAxisIndex: 0, height: 16, bottom: 6 },
    ],
    tooltip: {
      show: true,
      trigger: type === 'pie' ? 'item' : 'axis',
      axisPointer: { type: 'shadow' },
    },
    grid: {
      left: 40,
      right: 16,
      top: 56,
      bottom: 30,
      containLabel: true,
    },
    xAxis:
      type === 'pie'
        ? undefined
        : {
            type: 'category',
            axisLine: { show: true },
            axisTick: { show: true },
            axisLabel: { rotate: 0 },
            splitLine: { show: false },
          },
    yAxis:
      type === 'pie'
        ? undefined
        : {
            type: 'value',
            axisLine: { show: true },
            splitLine: { show: true },
            axisLabel: { formatter: '{value}' },
          },
    animation: true,
    animationDuration: 500,
    animationEasing: 'cubicOut',
    // IMPORTANT: we only include series *style* here (no name/data), so defaults still render.
    series:
      type === 'pie'
        ? [
            {
              type: 'pie',
              radius: ['35%', '70%'],
              label: { show: true, formatter: '{b}: {c}' },
              emphasis: { scale: true, scaleSize: 6 },
            },
          ]
        : [
            {
              type: type === 'line' || type === 'area' ? 'line' : 'bar',
              stack: undefined,
              smooth: type === 'line' || type === 'area',
              areaStyle: type === 'area' ? {} : undefined,
              barWidth: undefined,
              label: { show: false },
              emphasis: { focus: 'series' },
            },
          ],
  }

  // Remove undefined keys for clean JSON
  function stripUndefined(v: any): any {
    if (Array.isArray(v)) return v.map(stripUndefined).filter((x) => x !== undefined)
    if (v && typeof v === 'object') {
      const out: any = {}
      for (const [k, val] of Object.entries(v)) {
        const next = stripUndefined(val)
        if (next !== undefined) out[k] = next
      }
      return out
    }
    return v
  }

  const cleaned = stripUndefined(base)
  return JSON.stringify(cleaned, null, 2)
}


