export default {
  testEnvironment: 'node',
  testMatch: [
    '**/functions/**/*.test.js',
    '**/functions/**/*.test.mjs',
    '**/functions/**/*.spec.js',
    '**/__tests__/**/*.js',
  ],
  collectCoverageFrom: [
    'functions/**/*.js',
    '!functions/**/node_modules/**',
    '!functions/**/*.test.js',
    '!functions/**/*.test.mjs',
    '!functions/**/*.spec.js',
    '!functions/**/*.spec.mjs',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleFileExtensions: ['js', 'mjs', 'json'],
  moduleNameMapper: {
    '^stripe$': '<rootDir>/test/__mocks__/stripe.mjs',
  },
  setupFilesAfterEnv: ['./test/setup.mjs'],
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true,
  verbose: true,
};
