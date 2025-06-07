import { defineConfig } from 'vite'
import { resolve, join } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import react from '@vitejs/plugin-react'
import * as fs from 'fs'

const isChrome = process.env.BROWSER === 'chrome'

const staticCopyPlugin = () => {
  return viteStaticCopy({
    targets: [
      { src: 'src/assets/favicon/**/*', dest: 'assets/favicon' },
      { src: ['src/assets/*.png', 'src/assets/*.svg'], dest: 'assets' },
      {
        src: `src/manifest/${isChrome ? 'chrome.json' : 'firefox.json'}`,
        dest: '.',
        rename: 'manifest.json',
      },
      { src: 'src/global.css', dest: './' },
      { src: 'src/popup/popup.html', dest: 'popup' },
      { src: 'src/public/index.html', dest: 'public' },
      { src: 'src/public/style.css', dest: 'public' },
    ],
    watch: {
      reloadPageOnChange: true,
    },
  })
}

function getTsxEntries(dir: string, outPrefix: string) {
  const absDir = resolve(__dirname, dir)
  if (!fs.existsSync(absDir)) return {}
  const files = fs.readdirSync(absDir)
  return files
    .filter(f => f.endsWith('.tsx'))
    .reduce((acc, file) => {
      const name = file.replace(/\.tsx$/, '')
      acc[`${outPrefix}${name}`] = join(absDir, file)
      return acc
    }, {} as Record<string, string>)
}

export default defineConfig(({ mode }): any => {
  const isDev = mode === 'development'

  const componentEntries = getTsxEntries('src/public/components', 'public/components/')

  return {
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          background: resolve(__dirname, 'src/background.ts'),
          popup: resolve(__dirname, 'src/popup/popup.ts'),
          utils: resolve(__dirname, 'src/public/utils.ts'),
          myapp: resolve(__dirname, 'src/public/MyApp.tsx'),
          ...componentEntries,
        },
        output: {
          entryFileNames: (chunk: any) => {
            if (chunk.name.startsWith('public/components/')) {
              return `public/components/${chunk.name.replace(/^public\/components\//, '').replace(/\.tsx?$/, '').replace(/([A-Z])/g, '-$1').toLowerCase()}.js`
            }
            if (chunk.name.startsWith('public/')) {
              return `public/${chunk.name.replace(/^public\//, '').replace(/\.tsx?$/, '').replace(/([A-Z])/g, '-$1').toLowerCase()}.js`
            }
            const map: any = {
              background: 'background.js',
              popup: 'popup/popup.js',
              utils: 'public/utils.js',
              myapp: 'public/my-app.js',
              settings: 'public/settings.js',
            }
            return map[chunk.name]
          },
          assetFileNames: 'assets/[name].[ext]',
          format: 'esm',
        },
      },
      sourcemap: true,
      emptyOutDir: true,
      target: 'esnext',
      minify: !isDev,
      watch: isDev,
    },
    plugins: [staticCopyPlugin(), react()],
  }
})
