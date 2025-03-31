import { Chart } from 'chart.js'

declare global {
  interface Window {
    chartInstance: any
    detailChartInstance: any
  }
}
