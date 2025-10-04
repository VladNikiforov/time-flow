import { FullData } from '../main'
import { getViewRange, updateChart } from './ui'
import { toLocalISODate } from '../../background'

let currentStartDate: Date
export function getStartDate() {
  const now = new Date()
  currentStartDate = (getViewRange() === 'Week' ? getStartOfWeek : getStartOfMonth)(now)
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
export function generateDateRange(startDate: Date) {
  let dateRange: string[] = []
  if (getViewRange() === 'Week') {
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      dateRange.push(toLocalISODate(date))
    }
  } else {
    const daysInMonth = getDaysInMonth(startDate)
    for (let i = 0; i < daysInMonth; i++) {
      const date = new Date(startDate.getFullYear(), startDate.getMonth(), i + 1)
      dateRange.push(toLocalISODate(date))
    }
  }
  return dateRange
}

export function fillMissingDates(data: FullData, dateRange: string[]) {
  const filledData: FullData = {}

  dateRange.forEach((date: string) => {
    const entries = data[date] || []
    filledData[date] = entries.length > 0 ? entries : []
  })

  return filledData
}

export function getPreviousPeriodRange(currentStartDate: Date): string[] {
  let prevStart: Date
  if (getViewRange() === 'Week') {
    prevStart = new Date(currentStartDate)
    prevStart.setDate(currentStartDate.getDate() - 7)
    return generateDateRange(prevStart)
  } else {
    prevStart = new Date(currentStartDate.getFullYear(), currentStartDate.getMonth() - 1, 1)
    return generateDateRange(prevStart)
  }
}
