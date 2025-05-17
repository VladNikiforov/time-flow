export default function MyApp() {
  return (
    <>
      <nav>
        <h1>TimeFlow - Dashboard</h1>

        <div id="rightNav">
          <select id="viewMode" defaultValue="time">
            <option value="time">time</option>
            <option value="sessions">sessions</option>
          </select>
          {/* Settings SVG by Solar Icons https://www.svgrepo.com/svg/523734/settings */}
          <img id="settingsIcon" src="../assets/settings-icon.svg" />
        </div>
      </nav>
      <main>
        <div id="dayInfo">
          <div style={{ height: '300px', width: '300px', marginRight: '2rem' }}>
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
                {/* Theme SVG by Microsoft https://www.svgrepo.com/svg/310719/dark-theme */}
                <img id="themeIcon" src="../assets/theme-icon.svg" />
              </div>
              <div>
                <label htmlFor="hueSlider">Hue:</label>
                <input type="number" id="hueValue" min="1" max="360" />
                <input type="range" id="hueSlider" min="1" max="360" />
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
