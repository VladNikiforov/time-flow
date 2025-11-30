/* TimeFlow - browser extension; (c) 2024 VladNikiforov; GPLv3, see LICENSE file */

import { browserAPI, RawData, today } from '../background'
import { initTheme, getFromStorage } from './scripts/theme'
import { getStartDate } from './scripts/date'
import { updateUI, updateChart } from './scripts/ui'

initTheme()

export type FullData = {
  [date: string]: RawData[]
}

export const fullData: FullData = {}

browserAPI.runtime.onMessage.addListener((message: any) => {
  if (message.action !== 'sendData') return
  console.log('Received sendData message:', message)

  Object.assign(fullData, message.data)
  getFromStorage('uiHue')
  getFromStorage('theme')
  getStartDate()
  updateUI()
})
;(browserAPI as typeof browser).runtime.sendMessage({ action: 'requestAllData' })

let resizeTimer: number | undefined
window.addEventListener('resize', () => {
  if (resizeTimer) window.clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(() => {
    try {
      location.reload()
    } catch (e) {
      console.error('Error reloading after resize:', e)
    }
  }, 300)
})

const exportDataButton = document.getElementById('exportData') as HTMLButtonElement
const importDataButton = document.getElementById('importData') as HTMLButtonElement

const importFileInput = document.createElement('input')
importFileInput.type = 'file'
importFileInput.accept = '.json,application/json,text/json'
importFileInput.style.display = 'none'
document.body.appendChild(importFileInput)

exportDataButton.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `TimeFlow Export ${today}.json`
  a.click()
  URL.revokeObjectURL(url)
})

importDataButton.addEventListener('click', () => importFileInput.click())
importFileInput.addEventListener('change', (event: any) => {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = async (e: any) => {
    try {
      console.log('Importing file:', file.name)
      const imported: FullData = JSON.parse(e.target.result)
      console.log('Parsed JSON:', imported)

      for (const [date, entries] of Object.entries(imported)) {
        if (!Array.isArray(entries)) continue
        if (!fullData[date]) fullData[date] = []
        for (const entry of entries) {
          if (!entry?.website || entry.time == null) continue
          fullData[date].push(entry)
        }
      }

      const settings = await new Promise<{ uiHue?: number; theme?: string }>((resolve) => {
        browserAPI.storage.local.get(['uiHue', 'theme'], (result: any) => resolve(result))
      })
      await browserAPI.storage.local.clear()
      await browserAPI.storage.local.set({ ...fullData, ...settings })

      console.log('Updated fullData after import:', fullData)
      updateChart()
      updateUI()
      alert('Data imported successfully!')
      location.reload()
    } catch (err) {
      console.error('Import error:', err)
      alert('Failed to import data')
    }
  }
  reader.readAsText(file)
})
