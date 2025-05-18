import { createRoot } from 'react-dom/client'

export default function MyApp(): any {
  return (
    <>
      <nav>
        <h1>TimeFlow - Dashboard</h1>
        <div id="rightNav">
          <select id="viewMode" defaultValue="time">
            <option value="time">time</option>
            <option value="sessions">sessions</option>
          </select>
          <img id="settingsIcon" src="../assets/settings-icon.svg" alt="Settings" />
        </div>
      </nav>

      <main>
        <div id="dayInfo">
          <div style={{ height: 300, width: 300, marginRight: '2rem' }}>
            <div>
              <div className="navButtons">
                <button id="prevDay">&lt;</button>
                <button id="nextDay">&gt;</button>
              </div>
              <div id="dayDate"></div>
            </div>
            <canvas id="detailChart"></canvas>
          </div>

          <div id="dayStats">
            <div id="dayTotal"></div>
            <div id="progressContainer"></div>
          </div>
        </div>

        <div>
          <div id="mainChartNav">
            <div className="navButtons">
              <button id="prevButton">&lt;</button>
              <button id="nextButton">&gt;</button>
            </div>
            <select id="viewRange" defaultValue="Week">
              <option value="Week">Week</option>
              <option value="Month">Month</option>
            </select>
            <div id="averageTime"></div>
          </div>
          <canvas id="mainChart"></canvas>
        </div>
      </main>

      <aside>
        <div id="overlay"></div>
        <div id="popup">
          <h2>Settings</h2>

          <div className="settingSection">
            <h3>Appearance</h3>
            <div className="sectionContent">
              <div>
                <label htmlFor="themeIcon">Theme:</label>
                <img id="themeIcon" src="../assets/theme-icon.svg" alt="Theme Icon" />
              </div>
              <div>
                <label htmlFor="hueSlider">Hue:</label>
                <input type="number" id="hueValue" min={1} max={360} />
                <input type="range" id="hueSlider" min={1} max={360} />
              </div>
            </div>
          </div>

          <div className="settingSection">
            <h3>Data</h3>
            <div className="sectionContent">
              <label htmlFor="exportData">JSON:</label>
              <button id="exportData">export</button>
            </div>
          </div>

          <button id="closeButton">Close</button>
        </div>
      </aside>
    </>
  )
}

createRoot(document.getElementById('root') as HTMLDivElement).render(<MyApp />)
