import fs from 'fs'
import path from 'path'

const browser = process.argv[2]
console.log(`Building for browser: ${browser}`)

if (!browser || (browser !== 'chrome' && browser !== 'firefox')) {
  console.error('Error: Please specify either "chrome" or "firefox"')
  process.exit(1)
}

const manifestFile = browser === 'firefox' ? 'manifest-firefox.json' : 'manifest-chrome.json'

const srcPath = path.join('src', manifestFile)
const distPath = path.join('', 'manifest.json')

if (!fs.existsSync(srcPath)) {
  console.error(`Error: ${srcPath} does not exist.`)
  process.exit(1)
}

fs.copyFileSync(srcPath, distPath)
console.log(`Generated ${manifestFile} file for: ${browser.toUpperCase()}`)
