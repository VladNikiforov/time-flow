/* MIT License Copyright (c) 2024-2025 @VladNikiforov See the LICENSE file */

import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import Chart from 'chart.js/auto'
import { browserAPI, toLocalISODate, today } from '../background'
import { getStartOfWeek, getDaysInMonth, getStartOfMonth, formatDate, formatKey } from './utils'
import Settings from './Settings'

type WebsiteData = { website: string; time: number }
type RawData = { [date: string]: WebsiteData[] }
type ViewRange = 'Week' | 'Month'
type ViewMode = 'time' | 'sessions'

export default function MyApp(): any {
  const [isDark, setIsDark] = useState(true)
  const [uiHue, setUiHue] = useState(180)
  const [popupOpen, setPopupOpen] = useState(false)

  const [rawData, setRawData] = useState<RawData>({})
  const [viewRange, setViewRange] = useState<ViewRange>('Week')
  const [viewMode, setViewMode] = useState<ViewMode>('time')
  const [currentStartDate, setCurrentStartDate] = useState<Date>(() => (viewRange === 'Week' ? getStartOfWeek(new Date()) : getStartOfMonth(new Date())))
  const [dateRange, setDateRange] = useState<string[]>([])
  const [filledData, setFilledData] = useState<any>({})
  const [mainChartValues, setMainChartValues] = useState<number[]>([])
  const [averageValue, setAverageValue] = useState<number>(0)
  const [currentStatIndex, setCurrentStatIndex] = useState<number>(0)
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    const dr = generateDateRange(viewRange === 'Week' ? getStartOfWeek(new Date()) : getStartOfMonth(new Date()), viewRange)
    return dr.indexOf(today)
  })
  const [detailEntries, setDetailEntries] = useState<WebsiteData[]>([])
  const [detailDate, setDetailDate] = useState<string>(today)
  const [progressData, setProgressData] = useState<any[]>([])
  const [totalSpentTime, setTotalSpentTime] = useState<number>(0)

  const mainChartRef = useRef<HTMLCanvasElement>(null)
  const detailChartRef = useRef<HTMLCanvasElement>(null)
  const mainChartInstance = useRef<any>(null)
  const detailChartInstance = useRef<any>(null)

  const themeIconRef = useRef<HTMLImageElement>(null)
  const settingsIconRef = useRef<HTMLImageElement>(null)

  const [hueInput, setHueInput] = useState<number>(uiHue)

  useEffect(() => {
    browserAPI.storage.local.get(['isDark', 'uiHue'], (result: any) => {
      if (result.isDark === undefined) browserAPI.storage.local.set({ isDark: true })
      if (result.uiHue === undefined) browserAPI.storage.local.set({ uiHue: 180 })
      if (result.isDark !== undefined) setIsDark(result.isDark)
      if (result.uiHue !== undefined) {
        setUiHue(result.uiHue)
        setHueInput(result.uiHue)
      }
    })
    browserAPI.runtime.onMessage.addListener(receiveData)
    // eslint-disable-next-line
  }, [])

  function receiveData(message: any) {
    if (message.action !== 'sendData') {
      console.error('Error receiving data from background.js:', message)
      return
    }
    setRawData((prev: RawData) => ({ ...prev, ...message.data }))
  }

  function saveToStorage(key: string, value: any) {
    browserAPI.storage.local.set({ [key]: value })
  }

  function generateDateRange(startDate: Date, range: ViewRange) {
    let dateRange: string[] = []
    if (range === 'Week') {
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

  function fillMissingDates(data: RawData, dateRange: string[]) {
    const filledData: any = {}
    dateRange.forEach((date: string) => {
      const entries = data[date] || []
      filledData[date] = entries.length > 0 ? entries : []
    })
    return filledData
  }

  function getValues(dates: string[], data: any) {
    return dates.map((date: string) => {
      if (!data[date]) return 0
      if (viewMode === 'time') {
        return data[date].reduce((sum: number, entry: any) => sum + (entry.time || 0), 0)
      } else {
        return data[date].length
      }
    })
  }

  function formatValue(value: number) {
    if (viewMode === 'time') {
      const h = Math.floor(value / 3600)
      const m = Math.floor((value % 3600) / 60)
      const s = value % 60
      return h ? `${h}h${m ? ` ${m}m` : ''}${s ? ` ${s}s` : ''}` : m ? `${m}m${s ? ` ${s}s` : ''}` : `${s}s`
    } else if (viewMode === 'sessions') {
      return `${value} session${value === 1 ? '' : 's'}`
    }
  }

  function colorAlgorithm(color: 'dark' | 'light', index = 0) {
    const hue = (uiHue + index * 20) % 360
    const colorFormula = `${hue}, 48%, 52%`
    return color === 'dark' ? `hsla(${colorFormula}, 0.2)` : `hsl(${colorFormula})`
  }

  useEffect(() => {
    const startDate = viewRange === 'Week' ? getStartOfWeek(currentStartDate) : getStartOfMonth(currentStartDate)
    const dr = generateDateRange(startDate, viewRange)
    setDateRange(dr)
    setFilledData(fillMissingDates(rawData, dr))
    setSelectedDayIndex(dr.indexOf(today))
    // eslint-disable-next-line
  }, [rawData, viewRange, currentStartDate])

  useEffect(() => {
    const values = getValues(dateRange, filledData)
    setMainChartValues(values)
    setAverageValue(values.length ? Math.round(values.reduce((sum, t) => sum + t, 0) / values.length) : 0)
    // eslint-disable-next-line
  }, [dateRange, filledData, viewMode])

  useEffect(() => {
    if (!mainChartRef.current) return
    if (mainChartInstance.current) mainChartInstance.current.destroy()
    mainChartInstance.current = new Chart(mainChartRef.current, {
      type: 'bar',
      data: {
        labels: dateRange.map((date) => {
          const d = new Date(date)
          return viewRange === 'Week' ? `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getDate()}` : d.getDate()
        }),
        datasets: [
          {
            data: mainChartValues,
            borderWidth: 1,
            backgroundColor: dateRange.map((_, i) => colorAlgorithm('dark', i)),
            borderColor: dateRange.map((_, i) => colorAlgorithm('light', i)),
            maxBarThickness: 100,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: false },
          tooltip: {
            callbacks: {
              title: (context: any) => context[0].label,
              label: (context: any) => formatValue(context.raw),
            },
          },
          legend: { display: false },
        },
        scales: {
          x: {
            ticks: { color: isDark ? '#fff' : '#000' },
            grid: { color: isDark ? '#ffffff1a' : '#0000001a' },
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value: any) => formatValue(value),
              color: isDark ? '#fff' : '#000',
            },
            grid: { color: isDark ? '#ffffff1a' : '#0000001a' },
          },
        },
        onClick: (_: any, elements: any) => {
          if (elements.length === 0) return
          setSelectedDayIndex(elements[0].index)
        },
      },
    })
    // eslint-disable-next-line
  }, [mainChartValues, dateRange, isDark, uiHue, viewRange, viewMode])

  useEffect(() => {
    if (!dateRange.length) return
    let idx = selectedDayIndex
    if (idx < 0 || idx >= dateRange.length) idx = 0
    const date = dateRange[idx]
    setDetailDate(date)
    setDetailEntries(filledData[date] || [])
    // eslint-disable-next-line
  }, [selectedDayIndex, dateRange, filledData])

  useEffect(() => {
    if (!detailChartRef.current) return
    if (detailChartInstance.current) detailChartInstance.current.destroy()
    const aggregatedData = (detailEntries || []).reduce((acc: any, entry: any) => {
      const key = entry.website || 'unknown'
      const value = viewMode === 'time' ? entry.time || 0 : 1
      acc[key] = (acc[key] || 0) + value
      return acc
    }, {})
    const sorted = Object.entries(aggregatedData).sort((a: any[], b: any[]) => b[1] - a[1])
    const websites = sorted.map((x) => x[0])
    const values: any = sorted.map((x) => x[1])
    const total: any = values.reduce((sum: any, v: any) => sum + v, 0)
    setTotalSpentTime(total)
    setProgressData(
      websites.map((website, i) => ({
        website,
        value: values[i],
        percentage: total ? Math.round((values[i] / total) * 100) : 0,
        index: i,
      })),
    )
    detailChartInstance.current = new Chart(detailChartRef.current, {
      type: 'doughnut',
      data: {
        labels: websites,
        datasets: [
          {
            data: values,
            borderWidth: 1,
            borderRadius: 8,
            backgroundColor: websites.map((_: any, i: number) => colorAlgorithm('dark', i)),
            borderColor: websites.map((_: any, i: number) => colorAlgorithm('light', i)),
          },
        ],
      },
      options: {
        responsive: true,
        cutout: '40%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context: any) => formatValue(context.raw),
            },
          },
        },
      },
    })
    // eslint-disable-next-line
  }, [detailEntries, viewMode, uiHue])

  useEffect(() => {
    document.documentElement.style.setProperty('--background-color', isDark ? '#222' : '#eee')
    document.documentElement.style.setProperty('--text-color', isDark ? '#fff' : '#000')
    document.documentElement.style.setProperty('--special-color-dark', colorAlgorithm('dark'))
    document.documentElement.style.setProperty('--special-color-light', colorAlgorithm('light'))
    if (themeIconRef.current) {
      themeIconRef.current.style.transform = `rotate(${isDark ? 0 : 180}deg)`
      themeIconRef.current.style.filter = `invert(${+isDark})`
    }
    if (settingsIconRef.current) {
      settingsIconRef.current.style.filter = `invert(${+isDark})`
    }
    // eslint-disable-next-line
  }, [isDark, uiHue])

  function handleViewRangeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setViewRange(e.target.value as ViewRange)
    setCurrentStartDate(e.target.value === 'Week' ? getStartOfWeek(new Date()) : getStartOfMonth(new Date()))
    setCurrentStatIndex(0)
  }

  function handleViewModeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setViewMode(e.target.value as ViewMode)
  }

  function handlePrevButton() {
    if (viewRange === 'Week') {
      setCurrentStartDate((prev) => {
        const d = new Date(prev)
        d.setDate(d.getDate() - 7)
        return d
      })
    } else {
      setCurrentStartDate((prev) => {
        const y = prev.getFullYear()
        const m = prev.getMonth() - 1
        return new Date(y, m, 1)
      })
    }
    setCurrentStatIndex(0)
  }

  function handleNextButton() {
    if (viewRange === 'Week') {
      setCurrentStartDate((prev) => {
        const d = new Date(prev)
        d.setDate(d.getDate() + 7)
        return d
      })
    } else {
      setCurrentStartDate((prev) => {
        const y = prev.getFullYear()
        const m = prev.getMonth() + 1
        return new Date(y, m, 1)
      })
    }
    setCurrentStatIndex(0)
  }

  function handlePrevDay() {
    setSelectedDayIndex((prev) => (prev - 1 + dateRange.length) % dateRange.length)
  }

  function handleNextDay() {
    setSelectedDayIndex((prev) => (prev + 1) % dateRange.length)
  }

  function handleThemeClick() {
    setIsDark((prev) => {
      saveToStorage('isDark', !prev)
      return !prev
    })
  }

  function handleHueChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value)
    setUiHue(val)
    setHueInput(val)
    saveToStorage('uiHue', val)
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(rawData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `TimeFlow Export ${today}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const [showAllProgress, setShowAllProgress] = useState(false)
  const maxItems = 3

  function ProgressContainer() {
    return (
      <div id="progressContainer">
        {progressData.slice(0, showAllProgress ? progressData.length : maxItems).map((entry, i) => (
          <div className="gridDisplay" key={entry.website}>
            <a className="labelText" target="_blank" href={entry.website} rel="noopener noreferrer">
              {formatKey(entry.website)}
            </a>
            <progress
              max={100}
              value={entry.percentage}
              style={{
                // @ts-ignore
                '--progress-bar-background': colorAlgorithm('dark', entry.index),
                '--progress-bar-fill': colorAlgorithm('light', entry.index),
              }}
            />
            <div className="valueText" style={{ textAlign: 'center' }}>
              {formatValue(entry.value)} ({entry.percentage}%)
            </div>
          </div>
        ))}
        {progressData.length > maxItems && !showAllProgress && (
          <button style={{ marginRight: '1rem' }} onClick={() => setShowAllProgress(true)}>
            Show All
          </button>
        )}
      </div>
    )
  }

  function Navigation() {
    return (
      <nav>
        <h1>TimeFlow - Dashboard</h1>
        <div id="rightNav">
          <select id="viewMode" value={viewMode} onChange={handleViewModeChange}>
            <option value="time">time</option>
            <option value="sessions">sessions</option>
          </select>
          <img id="settingsIcon" src="../assets/settings-icon.svg" alt="Settings" ref={settingsIconRef} onClick={() => setPopupOpen(true)} style={{ cursor: 'pointer' }} />
        </div>
      </nav>
    )
  }

  return (
    <>
      <Navigation />

      <main>
        <div id="dayInfo">
          <div style={{ height: 300, width: 300, marginRight: '2rem' }}>
            <div>
              <div className="navButtons">
                <button id="prevDay" onClick={handlePrevDay}>
                  &lt;
                </button>
                <button id="nextDay" onClick={handleNextDay}>
                  &gt;
                </button>
              </div>
              <div id="dayDate">{formatDate(detailDate)}</div>
            </div>
            <canvas id="detailChart" ref={detailChartRef}></canvas>
          </div>

          <div id="dayStats">
            <div id="dayTotal">{formatValue(totalSpentTime)}</div>
            <ProgressContainer />
          </div>
        </div>

        <div>
          <div id="mainChartNav">
            <div className="navButtons">
              <button id="prevButton" onClick={handlePrevButton}>
                &lt;
              </button>
              <button id="nextButton" onClick={handleNextButton}>
                &gt;
              </button>
            </div>
            <select id="viewRange" value={viewRange} onChange={handleViewRangeChange}>
              <option value="Week">Week</option>
              <option value="Month">Month</option>
            </select>
            <div id="averageTime">
              {viewRange} Average: {formatValue(averageValue)}
            </div>
          </div>
          <canvas id="mainChart" ref={mainChartRef}></canvas>
        </div>
      </main>

      <Settings
        popupOpen={popupOpen}
        setPopupOpen={setPopupOpen}
        themeIconRef={themeIconRef}
        handleThemeClick={handleThemeClick}
        hueInput={hueInput}
        handleHueChange={handleHueChange}
        handleExport={handleExport}
      />
    </>
  )
}

createRoot(document.getElementById('root') as HTMLDivElement).render(<MyApp />)
