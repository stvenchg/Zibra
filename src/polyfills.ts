// Import Buffer instead of using require
import { Buffer } from 'buffer';

// Polyfill for Node.js environment in the browser
if (typeof window !== 'undefined') {
  // Global
  (window as any).global = window;
  
  // Process
  (window as any).process = (window as any).process || {};
  (window as any).process.env = (window as any).process.env || {};
  (window as any).process.nextTick = (fn: Function, ...args: any[]) => 
    setTimeout(() => fn(...args), 0);
  
  // Buffer
  if (!window.hasOwnProperty('Buffer')) {
    (window as any).Buffer = Buffer;
  }
} 