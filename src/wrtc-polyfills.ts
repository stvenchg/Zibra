import { Buffer } from 'buffer';

// Polyfills for WebRTC and simple-peer
if (typeof window !== 'undefined') {
  // Define globalThis as global
  if (!window.hasOwnProperty('global')) {
    Object.defineProperty(window, 'global', {
      get: () => window
    });
  }

  // Polyfills for process.nextTick and process.env
  if (!window.hasOwnProperty('process')) {
    Object.defineProperty(window, 'process', {
      value: {
        env: {},
        nextTick: (fn: Function, ...args: any[]) => setTimeout(() => fn(...args), 0)
      }
    });
  }

  // Polyfill for Buffer
  if (!window.hasOwnProperty('Buffer')) {
    Object.defineProperty(window, 'Buffer', {
      get: () => Buffer
    });
  }
} 