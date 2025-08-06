/* MIT License Copyright (c) 2024-2025 @VladNikiforov See the LICENSE file */

import { browserAPI } from '../background'
import { initTheme, getFromStorage } from './scripts/theme'
import { getStartDate } from './scripts/date'
import { updateUI } from './scripts/ui'

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

  updateUI()
}

;(browserAPI as typeof browser).runtime.sendMessage({ action: 'requestAllData' })
