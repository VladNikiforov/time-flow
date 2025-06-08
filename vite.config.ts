import { defineConfig } from 'vite'
import { resolve } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

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
      { src: 'src/popup/popup.html', dest: 'popup', rename: 'popup.html' },
      { src: 'src/public/index.html', dest: 'public', rename: 'index.html' },
      { src: 'src/public/style.css', dest: 'public', rename: 'style.css' },
      { src: 'src/global.css', dest: '.' },
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
          script: resolve(__dirname, 'src/public/script.ts'),
          popup: resolve(__dirname, 'src/popup/popup.ts'),
        },
        output: {
          entryFileNames: (chunk: any) => {
            const map: any = {
              background: 'background.js',
              script: 'public/script.js',
              popup: 'popup/popup.js',
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
    plugins: [staticCopyPlugin()],
  }
})
