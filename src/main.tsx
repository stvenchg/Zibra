// Définir process.nextTick directement au niveau global
window.process = window.process || {};
window.process.nextTick = function(fn: Function, ...args: any[]) {
  setTimeout(() => fn(...args), 0);
};

// Forcer la vérification du thème au démarrage
(function() {
  const isDark = document.documentElement.classList.contains('dark');
  console.log('main.tsx - Démarrage avec thème:', isDark ? 'sombre' : 'clair');
  
  // Force la suppression du thème sombre si on est en mode clair
  if (!isDark) {
    document.documentElement.classList.remove('dark');
  }
})();

// Polyfills - DOIVENT être importés avant tout autre code
import 'buffer';
import './wrtc-polyfills'; // Nouveaux polyfills spécifiques à WebRTC

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
