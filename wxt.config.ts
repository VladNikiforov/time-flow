import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
    srcDir: '.',
    manifest: {
        name: 'TimeFlow - Time Tracker',
        description: 'Focus on what matters by keeping track of your time on the web',
        permissions: ['storage', 'tabs'],
    action: {
      default_icon: {
        '16': 'favicon/16.png',
        '48': 'favicon/48.png',
        '128': 'favicon/128.png',
      },
    },
    icons: {
      '16': 'favicon/16.png',
      '48': 'favicon/48.png',
      '128': 'favicon/128.png',
    },
    },
    vite: () => ({
        plugins: [tailwindcss()],
    }),
});
