import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock do console para evitar poluição nos testes
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

// Mock do crypto para ambientes de teste
Object.defineProperty(global, 'crypto', {
  value: {
    ...global.crypto,
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
  },
  writable: true,
  configurable: true
});

// Mock do localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock;