// Sof mantiq testlari (utils, api qatlam, RBAC) — node muhitida, RN render'siz.
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      { tsconfig: { jsx: 'react-jsx', esModuleInterop: true, types: ['jest', 'node'] } },
    ],
  },
  moduleNameMapper: {
    // Expo modullari node testlarida stub bilan almashtiriladi
    '^expo-secure-store$': '<rootDir>/tests/stub/expo-secure-store.ts',
    '^@react-native-async-storage/async-storage$': '<rootDir>/tests/stub/async-storage.ts',
  },
};
