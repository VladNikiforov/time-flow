/* MIT License Copyright (c) 2024-2025 @VladNikiforov See the LICENSE file */

import { browserAPI } from '../background'
import { initTheme, getFromStorage } from './scripts/theme'
import { getStartDate } from './scripts/date'
import { updateUI } from './scripts/ui'

initTheme()

export type WebsiteData = {
  url: string
  time: number
}

export type RawData = {
  [date: string]: WebsiteData[]
}

export function normalizeMessageData(data: Record<string, any[]>): Record<string, any[]> {
  const normalized: Record<string, any[]> = {}

  for (const [date, entries] of Object.entries(data)) {
    if (!Array.isArray(entries)) continue

    normalized[date] = entries.map(entry => {
      if (entry && typeof entry.time === 'object' && entry.time !== null) {
        if (typeof entry.time.start === 'number' && typeof entry.time.end === 'number') {
          const diff = Math.floor((entry.time.end - entry.time.start) / 1000)
          return { ...entry, time: diff > 0 ? diff : 0 }
        }
      }
      return entry
    })
  }

  return normalized
}

export const rawData: RawData = {}
export const properData: any = {}
browserAPI.runtime.onMessage.addListener(receiveData)
function receiveData(message: any) {
  if (message.action !== 'sendData') {
    console.error('Error receiving data from background.js:', message)
  }

  const filtered = normalizeMessageData(message.data)
  Object.assign(rawData, filtered)
  Object.assign(properData, message.data)
  console.log('Received data from background.js:', rawData)

  getFromStorage('uiHue')
  getFromStorage('isDark')

  getStartDate()

  updateUI()
}

;(browserAPI as typeof browser).runtime.sendMessage({ action: 'requestAllData' })
