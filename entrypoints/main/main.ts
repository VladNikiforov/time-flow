/* TimeFlow - browser extension; (c) 2024 VladNikiforov; GPLv3, see LICENSE file */

import '../../assets/style.css'
import { RawData, FullData } from '../../utils/types'

// @ts-ignore
initTheme()

browser.runtime.onMessage.addListener((message: any) => {
  if (message.action !== 'sendData') return
  console.log('Received sendData message:', message)

  // @ts-ignore
  Object.assign(fullData, message.data)
  // @ts-ignore
  getFromStorage('uiHue')
  // @ts-ignore
  getFromStorage('theme')
  // @ts-ignore
  getStartDate()
  // @ts-ignore
  updateUI()
})
browser.runtime.sendMessage({ action: 'requestAllData' })

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

if (exportDataButton) {
  exportDataButton.addEventListener('click', () => {
    // @ts-ignore
    const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // @ts-ignore
    a.download = `TimeFlow Export ${today}.json`
    a.click()
    URL.revokeObjectURL(url)
  })
}

if (importDataButton) {
  importDataButton.addEventListener('click', () => importFileInput.click())
}

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
        // @ts-ignore
        if (!fullData[date]) fullData[date] = []
        for (const entry of entries) {
          if (!entry?.website || entry.time == null) continue
          // @ts-ignore
          fullData[date].push(entry)
        }
      }

      const settings = await browser.storage.local.get(['uiHue', 'theme'])
      await browser.storage.local.clear()
      // @ts-ignore
      await browser.storage.local.set({ ...fullData, ...settings })

      // @ts-ignore
      console.log('Updated fullData after import:', fullData)
      // @ts-ignore
      updateChart()
      // @ts-ignore
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
