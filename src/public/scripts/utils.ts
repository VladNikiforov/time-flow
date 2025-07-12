import { getViewMode, getViewRange } from './ui'
import { RawData, WebsiteData } from '../main'
import { parse as parseDomain } from 'tldts'

export function formatDate(date: string) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const [year, month, day] = date.split('-')
  return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`
}

export function getDomain(url: string): string {
  try {
    const parsed = parseDomain(url)
    if (parsed.domain && parsed.publicSuffix) {
      return parsed.hostname as string
    }
  } catch {}
  return url
}

export function formatKey(key: string): string {
  const domain = getDomain(key)
  return domain.length > 24 ? domain.slice(0, 24) + '...' : domain
}

export function formatValue(value: number) {
  if (getViewMode() === 'time') {
    const h = Math.floor(value / 3600)
    const m = Math.floor((value % 3600) / 60)
    const s = value % 60

    return h ? `${h}h${m ? ` ${m}m` : ''}${s ? ` ${s}s` : ''}` : m ? `${m}m${s ? ` ${s}s` : ''}` : `${s}s`
  } else if (getViewMode() === 'sessions') {
    return `${value} session${value === 1 ? '' : 's'}`
  }
}

export function getValues(dates: string[], data: RawData): number[] {
  return dates.map((date: string) => {
    if (!data[date]) return 0

    if (getViewMode() === 'time') {
      return data[date].reduce((sum: number, entry: WebsiteData) => sum + (entry.time || 0), 0)
    } else {
      return data[date].length
    }
  })
}

export function getTotal(values: number[]) {
  return values.reduce((sum, v) => sum + v, 0)
}

export function formatLabels(dates: string[]): (string | number)[] {
  return dates.map((date: string) => {
    const d = new Date(date)
    return getViewRange() === 'Week' ? `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getDate()}` : d.getDate()
  })
}

export function processAggregatedData(aggregatedData: Record<string, number>) {
  const websites = Object.keys(aggregatedData)
  const values = Object.values(aggregatedData)
  const totalSpentTime = values.reduce((sum, value) => sum + value, 0)
  return { websites, values, totalSpentTime }
}
