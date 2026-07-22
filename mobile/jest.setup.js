/* global jest */

require('react-native-gesture-handler/jestSetup');

const mockStorage = new Map();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(key => Promise.resolve(mockStorage.get(key) ?? null)),
  setItem: jest.fn((key, value) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn(key => {
    mockStorage.delete(key);
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    mockStorage.clear();
    return Promise.resolve();
  }),
}));

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(() => Promise.resolve({didCancel: true})),
}));

jest.mock('react-native-blob-util', () => ({
  fs: {
    dirs: {
      CacheDir: '/tmp',
    },
    exists: jest.fn(() => Promise.resolve(false)),
    ls: jest.fn(() => Promise.resolve([])),
    unlink: jest.fn(() => Promise.resolve()),
  },
  config: jest.fn(() => ({
    fetch: jest.fn(() => ({
      progress: jest.fn(() => Promise.resolve({path: () => '/tmp/mooket_update.apk'})),
    })),
  })),
  android: {
    actionViewIntent: jest.fn(() => Promise.resolve()),
  },
}));
