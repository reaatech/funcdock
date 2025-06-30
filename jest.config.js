export default {
  testEnvironment: 'node',
  transform: {},
  testEnvironmentOptions: {
    experimentalVmModules: true
  },
  testMatch: [
    '**/functions/**/*.test.js',
    '**/functions/**/*.spec.js',
    '**/__tests__/**/*.js'
  ],
  collectCoverageFrom: [
    'functions/**/*.js',
    '!functions/**/node_modules/**',
    '!functions/**/*.test.js',
    '!functions/**/*.spec.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true,
  verbose: true
}; 