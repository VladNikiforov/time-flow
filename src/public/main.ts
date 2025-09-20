/* MIT License Copyright (c) 2024-2025 @VladNikiforov See the LICENSE file */

import { browserAPI, RawData, today } from '../background'
import { initTheme, getFromStorage } from './scripts/theme'
import { getStartDate } from './scripts/date'
import { updateUI, updateChart } from './scripts/ui'

initTheme()

export type WebsiteData = {
  url: string
  time: number | { start: number; end: number }
}

export type FormattedData = {
  [date: string]: WebsiteData[]
}

export function normalizeMessageData(data: RawData[]): FormattedData {
  const normalized: FormattedData = {}
  for (const entry of data) {
    if (!entry.date || !entry.url || entry.time == null) continue
    if (!normalized[entry.date]) normalized[entry.date] = []
    normalized[entry.date].push({ url: entry.url, time: entry.time })
  }
  return normalized
}

export const formattedData: FormattedData = {}
export const rawData: RawData[] = []

browserAPI.runtime.onMessage.addListener((message: any) => {
  if (message.action !== 'sendData') return
  console.log('Received sendData message:', message)

  const incomingData: RawData[] = []
  if (Array.isArray(message.data)) {
    for (const entry of message.data) {
      if (entry && entry.url && entry.time != null && entry.date) incomingData.push(entry)
    }
  } else if (typeof message.data === 'object' && message.data !== null) {
    for (const [date, entries] of Object.entries(message.data)) {
      if (!Array.isArray(entries)) continue
      for (const entry of entries) {
        if (!entry || !entry.url || entry.time == null) continue
        incomingData.push({ ...entry, date })
      }
    }
  }

  console.log('Flattened incomingData:', incomingData)
  rawData.length = 0
  rawData.push(...incomingData)

  const formatted = normalizeMessageData(rawData)
  Object.keys(formattedData).forEach((k) => delete formattedData[k])
  Object.assign(formattedData, formatted)
  console.log('Normalized formattedData:', formatted)

  getFromStorage('uiHue')
  getFromStorage('isDark')
  getStartDate()
  updateUI()
})
;(browserAPI as typeof browser).runtime.sendMessage({ action: 'requestAllData' })

const dataFormatSelect = document.querySelectorAll('input[name="dataMode"]') as NodeListOf<HTMLInputElement>
const exportDataButton = document.getElementById('exportData') as HTMLButtonElement
const importDataButton = document.getElementById('importData') as HTMLButtonElement

type DataMode = 'csv' | 'json'
let dataMode: DataMode = 'json'

dataFormatSelect.forEach((radio) => {
  radio.addEventListener('change', () => {
    dataMode = radio.value as DataMode
  })
})

const importFileInput = document.createElement('input')
importFileInput.type = 'file'
importFileInput.accept = '.json,application/json,.csv,text/csv'
importFileInput.style.display = 'none'
document.body.appendChild(importFileInput)

exportDataButton.addEventListener('click', () => {
  if (dataMode === 'json') {
    const blob = new Blob([JSON.stringify(rawData, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `TimeFlow Export ${today}.json`
    a.click()
    URL.revokeObjectURL(url)
  } else if (dataMode === 'csv') {
    const rows = [['date', 'website', 'time']]
    for (const entry of rawData) {
      if (!entry.date || !entry.url || entry.time == null) continue
      let timeVal: number
      if (typeof entry.time === 'number') {
        timeVal = entry.time
      } else if (typeof entry.time === 'object' && entry.time.start != null && entry.time.end != null) {
        timeVal = Math.floor((entry.time.end - entry.time.start) / 1000)
      } else {
        timeVal = 0
      }
      rows.push([entry.date, entry.url, timeVal.toString()])
    }
    const csvContent = rows.map((r) => r.map((v) => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `TimeFlow Export ${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
})

importDataButton.addEventListener('click', () => importFileInput.click())

importFileInput.addEventListener('change', (event: any) => {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = async (e: any) => {
    try {
      console.log('Importing file:', file.name)
      let imported: any = JSON.parse(e.target.result)
      console.log('Parsed JSON:', imported)

      const incomingData: RawData[] = []

      if (!Array.isArray(imported) && typeof imported === 'object' && imported !== null) {
        for (const [date, entries] of Object.entries(imported)) {
          if (!Array.isArray(entries)) continue
          for (const entry of entries) {
            if (!entry || !entry.url || entry.time == null) continue
            incomingData.push({ ...entry, date, time: entry.time })
          }
        }
      } else if (Array.isArray(imported)) {
        for (const entry of imported) {
          if (!entry || !entry.url || entry.time == null || !entry.date) continue
          incomingData.push({ ...entry, time: entry.time })
        }
      } else {
        throw new Error('Invalid JSON format')
      }

      console.log('Flattened incomingData:', incomingData)

      rawData.length = 0
      rawData.push(...incomingData)

      const settings = await new Promise<{ uiHue?: number; isDark?: boolean }>((resolve) => {
        browserAPI.storage.local.get(['uiHue', 'isDark'], (result: any) => {
          resolve({ uiHue: result.uiHue, isDark: result.isDark })
        })
      })

      const groupedByDate: Record<string, any[]> = {}
      for (const entry of rawData) {
        if (!groupedByDate[entry.date]) groupedByDate[entry.date] = []
        groupedByDate[entry.date].push({ url: entry.url, time: entry.time })
      }
      await browserAPI.storage.local.clear()
      await browserAPI.storage.local.set({ ...groupedByDate, ...settings })

      const formatted = normalizeMessageData(rawData)
      Object.keys(formattedData).forEach((k) => delete formattedData[k])
      Object.assign(formattedData, formatted)
      console.log('Updated formattedData after import:', formattedData)

      updateChart()
      updateUI()
      alert('Data imported successfully!')
    } catch (err) {
      console.error('Import error:', err)
      alert('Failed to import data')
    }
  }
  reader.readAsText(file)
})
