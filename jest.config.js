/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/db/pool.js',
  ],
  coverageReporters: ['lcov', 'text'],
};

module.exports = config;
