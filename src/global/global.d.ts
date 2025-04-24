export {}

declare global {
  interface Window {
    Chart: any
    chartInstance: any
    detailChartInstance: any
    isFirefox: any
    browserAPI: any
  }
}
