// Polyfill pour l'objet global utilisé par simple-peer
if (typeof window !== 'undefined' && !window.global) {
  (window as any).global = window;
}

// Autres polyfills potentiellement nécessaires pour simple-peer
if (typeof window !== 'undefined') {
  (window as any).process = { env: {} };
} 