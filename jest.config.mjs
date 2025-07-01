export default {
  testEnvironment: 'node',
  testEnvironmentOptions: {
    experimentalVmModules: true
  },
  testMatch: [
    '**/functions/**/*.test.js',
    '**/functions/**/*.test.mjs',
    '**/functions/**/*.spec.js',
    '**/__tests__/**/*.js'
  ],
  collectCoverageFrom: [
    'functions/**/*.js',
    '!functions/**/node_modules/**',
    '!functions/**/*.test.js',
    '!functions/**/*.test.mjs',
    '!functions/**/*.spec.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['./test/setup.mjs'],
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true,
  verbose: true
}; 