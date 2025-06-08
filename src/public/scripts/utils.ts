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

export function formatDate(date: string) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const [year, month, day] = date.split('-')
  return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`
}

export function formatKey(key: string) {
  key = key
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
  return key.length > 24 ? key.slice(0, 24) + '...' : key
}
