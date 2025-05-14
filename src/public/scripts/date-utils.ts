export function toLocalISODate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const today = toLocalISODate(new Date())

export function getStartOfWeek(date: Date) {
  const day = date.getDay()
  const difference = date.getDate() - (day === 0 ? 6 : day - 1)
  const startOfWeek = new Date(date)
  startOfWeek.setDate(difference)
  startOfWeek.setHours(0, 0, 0, 0)
  return startOfWeek
}

export function getStartOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function getDaysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}
