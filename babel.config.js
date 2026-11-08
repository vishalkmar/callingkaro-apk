module.exports = {
  // Release builds: strip console.* (logger is already silent, this removes any stray logs).
  env: { production: { plugins: ['transform-remove-console'] } },
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: ['.js', '.jsx', '.json'],
        alias: {
          '@app': './src/app',
          '@components': './src/components',
          '@screens': './src/screens',
          '@navigation': './src/navigation',
          '@services': './src/services',
          '@store': './src/store',
          '@utils': './src/utils',
          '@theme': './src/theme',
          '@db': './src/db',
          '@hooks': './src/hooks',
          '@constants': './src/constants',
          '@assets': './src/assets',
          '@i18n': './src/i18n',
        },
      },
    ],
    // Must stay LAST (Reanimated 4 / worklets)
    'react-native-worklets/plugin',
  ],
};
