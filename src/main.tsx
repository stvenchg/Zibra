// Define process.nextTick directly at the global level
window.process = window.process || {};
window.process.nextTick = function(fn: Function, ...args: any[]) {
  setTimeout(() => fn(...args), 0);
};

// Force theme check at startup
(function() {
  const isDark = document.documentElement.classList.contains('dark');
  console.log('main.tsx - Starting with theme:', isDark ? 'dark' : 'light');
  
  // Force dark theme removal if we're in light mode
  if (!isDark) {
    document.documentElement.classList.remove('dark');
  }
})();

// Polyfills - MUST be imported before any other code
import 'buffer';
import './wrtc-polyfills'; // New WebRTC-specific polyfills

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
