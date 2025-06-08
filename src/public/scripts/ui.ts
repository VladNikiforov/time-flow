import { updateChart, getStartDate } from '../script'

const viewRangeElement = document.getElementById('viewRange') as HTMLSelectElement
const viewModeElement = document.getElementById('viewMode') as HTMLSelectElement

type ViewRange = 'Week' | 'Month'
let viewRange: ViewRange = viewRangeElement.value as ViewRange

type ViewMode = 'time' | 'sessions'
let viewMode: ViewMode = viewModeElement.value as ViewMode

viewRangeElement.addEventListener('change', () => {
  viewRange = viewRangeElement.value as ViewRange
  getStartDate()
})

viewModeElement.addEventListener('change', () => {
  viewMode = viewModeElement.value as ViewMode
  updateChart()
})

export function getViewRange() {
  return viewRange
}

export function getViewMode() {
  return viewMode
}
