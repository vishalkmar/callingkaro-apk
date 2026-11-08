module.exports = {
  preset: '@react-native/jest-preset',
  cacheDirectory: '<rootDir>/.jest-cache',
  transform: { '^.+\\.(js|jsx)$': 'babel-jest' },
  moduleFileExtensions: ['js', 'jsx', 'json'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  // CI runs with --coverage; these floors stop coverage from quietly dropping.
  collectCoverageFrom: ['src/**/*.{js,jsx}', '!src/screens/dev/**', '!src/db/opSqliteAdapter.js'],
  coverageThreshold: { global: { statements: 82, branches: 72, functions: 68, lines: 83 } },
  testMatch: ['**/__tests__/**/*.test.js?(x)'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-async-storage|@react-navigation|@react-native-vector-icons|react-native-.*)/)',
  ],
};
