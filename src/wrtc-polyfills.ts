import { Buffer } from 'buffer';

// Polyfills pour WebRTC et simple-peer
if (typeof window !== 'undefined') {
  // Définir globalThis comme global
  if (!window.hasOwnProperty('global')) {
    Object.defineProperty(window, 'global', {
      get: () => window
    });
  }

  // Polyfills pour process.nextTick et process.env
  if (!window.hasOwnProperty('process')) {
    Object.defineProperty(window, 'process', {
      value: {
        env: {},
        nextTick: (fn: Function, ...args: any[]) => setTimeout(() => fn(...args), 0)
      }
    });
  }

  // Polyfill pour Buffer
  if (!window.hasOwnProperty('Buffer')) {
    Object.defineProperty(window, 'Buffer', {
      get: () => Buffer
    });
  }
} 