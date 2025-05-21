/* MIT License Copyright (c) 2024-2025 @VladNikiforov See the LICENSE file */

type SettingsProps = {
  popupOpen: boolean
  setPopupOpen: (value: boolean) => void
  themeIconRef: React.RefObject<HTMLImageElement | null>
  handleThemeClick: () => void
  hueInput: number
  handleHueChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleExport: () => void
}

export default function Settings({ popupOpen, setPopupOpen, themeIconRef, handleThemeClick, hueInput, handleHueChange, handleExport }: SettingsProps) {
  return (
    <aside>
      <div id="overlay" style={{ display: popupOpen ? 'block' : 'none' }} onClick={() => setPopupOpen(false)}></div>
      <div id="popup" style={{ display: popupOpen ? 'block' : 'none' }}>
        <h2>Settings</h2>

        <div className="settingSection">
          <h3>Appearance</h3>
          <div className="sectionContent">
            <div>
              <label htmlFor="themeIcon">Theme:</label>
              <img id="themeIcon" src="../assets/theme-icon.svg" alt="Theme Icon" ref={themeIconRef} onClick={handleThemeClick} style={{ cursor: 'pointer' }} />
            </div>
            <div>
              <label htmlFor="hueSlider">Hue:</label>
              <input type="number" id="hueValue" min={1} max={360} value={hueInput} onChange={handleHueChange} />
              <input type="range" id="hueSlider" min={1} max={360} value={hueInput} onChange={handleHueChange} />
            </div>
          </div>
        </div>

        <div className="settingSection">
          <h3>Data</h3>
          <div className="sectionContent">
            <label htmlFor="exportData">JSON:</label>
            <button id="exportData" onClick={handleExport}>
              export
            </button>
          </div>
        </div>

        <button id="closeButton" onClick={() => setPopupOpen(false)}>
          Close
        </button>
      </div>
    </aside>
  )
}
