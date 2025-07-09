import { updateChart } from '../main'
import { getViewMode, getViewRange } from './viewInput'

let currentStartDate: Date
export function getStartDate() {
  const now = new Date()
  currentStartDate = (getViewRange() === 'Week' ? getStartOfWeek : getStartOfMonth)(now)
  updateChart()
}

function getStartOfWeek(date: Date) {
  const day = date.getDay()
  const difference = date.getDate() - (day === 0 ? 6 : day - 1)
  const startOfWeek = new Date(date)
  startOfWeek.setDate(difference)
  startOfWeek.setHours(0, 0, 0, 0)
  return startOfWeek
}

function getStartOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function getDaysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

export function navigateChart(direction: number) {
  if (getViewRange() === 'Week') {
    const date = currentStartDate.getDate()
    currentStartDate.setDate(date + direction * 7)
  } else {
    const year = currentStartDate.getFullYear()
    const month = currentStartDate.getMonth() + direction
    currentStartDate = new Date(year, month, 1)
  }
  updateChart()
}

export function getCurrentStartDate() {
  return currentStartDate
}