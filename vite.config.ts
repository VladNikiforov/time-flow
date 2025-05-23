import { defineConfig } from 'vite'
import { resolve } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import react from '@vitejs/plugin-react'

const isChrome = process.env.BROWSER === 'chrome'

const staticCopyPlugin = () => {
  return viteStaticCopy({
    targets: [
      { src: 'src/assets/favicon/**/*', dest: 'assets/favicon' },
      { src: ['src/assets/*.png', 'src/assets/*.svg'], dest: 'assets' },
      {
        src: resolve(__dirname, `src/manifest/${isChrome ? 'chrome.json' : 'firefox.json'}`),
        dest: './',
        rename: 'manifest.json',
      },
      { src: 'src/global.css', dest: './' },
      { src: 'src/popup/popup.html', dest: 'popup'},
      { src: 'src/public/index.html', dest: 'public' },
      { src: 'src/public/style.css', dest: 'public' },
    ],
    watch: {
      reloadPageOnChange: true,
    },
  })
}

export default defineConfig(({ mode }): any => {
  const isDev = mode === 'development'

  return {
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          background: resolve(__dirname, 'src/background.ts'),
          popup: resolve(__dirname, 'src/popup/popup.ts'),
          utils: resolve(__dirname, 'src/public/utils.ts'),
          myapp: resolve(__dirname, 'src/public/MyApp.tsx'),
          settings: resolve(__dirname, 'src/public/Settings.tsx'),
        },
        output: {
          entryFileNames: (chunk: any) => {
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
