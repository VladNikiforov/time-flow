const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

module.exports = (env) => {
  const isChrome = env.browser === 'chrome'

  return {
    mode: 'development',
    entry: {
      background: './background.ts',
      popup: './popup/popup.ts',
      script: './public/script.ts',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: (pathData) => {
        if (pathData.chunk.name === 'popup') return 'popup/popup.js'
        if (pathData.chunk.name === 'script') return 'public/script.js'
        if (pathData.chunk.name === 'background') return 'background.js'
        return '[name].js'
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
        template: 'public/index.html',
        filename: 'public/index.html',
        inject: 'body',
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: 'public/style.css', to: 'public/style.css' },
          { from: 'public/assets', to: 'public/assets', noErrorOnMissing: false },
          {
            from: `browser/manifest-${isChrome ? 'chrome' : 'firefox'}.json`,
            to: 'manifest.json',
          },
          {
            from: 'popup/popup.html',
            to: 'popup/popup.html',
          },
          {
            from: 'favicon.png',
            to: 'favicon.png',
          },
          {
            from: 'global',
            to: 'global',
          },
        ],
      }),
    ],
    devtool: 'source-map',
    stats: {
      children: true,
    },
  }
}
