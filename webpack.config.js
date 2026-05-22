const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

module.exports = (env) => {
  const isChrome = env.browser === 'chrome'

  return {
    mode: 'development',
    entry: {
      background: './src/background.ts',
      popup: './src/popup/popup.ts',
      script: './src/public/script.ts',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: (pathData) => {
        const pathMap = {
          popup: 'popup/popup.js',
          script: 'public/script.js',
          background: 'background.js',
        }
        return pathMap[pathData.chunk.name] || '[name].js'
      },
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    plugins: [
      new CleanWebpackPlugin(),
      new HtmlWebpackPlugin({
        template: './src/public/index.html',
        filename: 'public/index.html',
        inject: 'body',
        chunks: ['script'],
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: 'src/public/style.css', to: 'public/style.css' },
          { from: 'src/assets', to: 'assets' },
          { from: `src/manifest-config/${isChrome ? 'chrome' : 'firefox'}.json`, to: 'manifest.json' },
          { from: 'src/popup/popup.html', to: 'popup/popup.html' },
          { from: 'src/global', to: 'global' },
        ],
      }),
    ],
    devtool: 'source-map',
    stats: {
      children: true,
    },
  }
}
