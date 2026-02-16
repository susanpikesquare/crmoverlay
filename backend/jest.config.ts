import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  clearMocks: true,
  collectCoverageFrom: [
    'src/services/**/*.ts',
    'src/routes/**/*.ts',
    '!src/**/__tests__/**',
  ],
};

export default config;
