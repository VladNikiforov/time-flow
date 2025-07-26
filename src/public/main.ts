/* MIT License Copyright (c) 2024-2025 @VladNikiforov See the LICENSE file */

import { browserAPI } from '../background'
import { initTheme, getFromStorage } from './scripts/theme'
import { getStartDate } from './scripts/date'
import { mainChart, dayDate, mainChartNav, dayStats, detailChart } from './scripts/ui'

initTheme()

export type WebsiteData = {
  url: string
  website: string
  time: number
}

export type RawData = {
  [date: string]: WebsiteData[]
}

export const rawData: RawData = {}
browserAPI.runtime.onMessage.addListener(receiveData)
function receiveData(message: any) {
  if (message.action !== 'sendData') {
    console.error('Error receiving data from background.js:', message)
  }

  Object.assign(rawData, message.data)
  console.log('Received data from background.js:', rawData)

  getFromStorage('uiHue')
  getFromStorage('isDark')

  getStartDate()

  dayStats.style.display = 'flex'
  detailChart.style.display = 'block'
  mainChart.style.display = 'none'
  mainChartNav.style.display = 'none'
  dayDate.style.display = 'inline'
}

;(browserAPI as typeof browser).runtime.sendMessage({ action: 'requestAllData' })

/*
// Note that this is only sample data
import { toLocalISODate } from './scripts/date'

function generateSampleData() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const isoDate = toLocalISODate(date)

    const websites = ['chatgpt', 'chess', 'github', 'google', 'youtube', 'skool', 'chat.deepseek']
    rawData[isoDate] = Array.from({ length: Math.floor(Math.random() * 5) + 1 }, () => ({
      website: `https://${websites[Math.floor(Math.random() * websites.length)]}.com`,
      time: Math.floor(Math.random() * 3600) + 60,
    }))
  }

  console.log('Generated mock rawData:', rawData)
}
generateSampleData()
*/
