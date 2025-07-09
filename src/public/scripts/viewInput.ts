import { getStartDate } from './date'
import { updateChart } from '../main'

const viewRangeElement = document.querySelectorAll('input[name="viewRange"]') as NodeListOf<HTMLInputElement>
const viewModeElement = document.querySelectorAll('input[name="viewMode"]') as NodeListOf<HTMLInputElement>

type ViewRange = 'Week' | 'Month'
export let viewRange: ViewRange = 'Week'

type ViewMode = 'time' | 'sessions'
let viewMode: ViewMode = 'time'

viewRangeElement.forEach((radio: HTMLInputElement) => {
  radio.addEventListener('change', () => {
    viewRange = radio.value as ViewRange
    getStartDate()
  })
})

viewModeElement.forEach((radio: HTMLInputElement) => {
  radio.addEventListener('change', () => {
    viewMode = radio.value as ViewMode
    updateChart()
  })
})

export function getViewRange(): ViewRange {
  return viewRange
}

export function getViewMode(): ViewMode {
  return viewMode
}
