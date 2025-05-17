/**
 * Zibra Configuration File
 * This file contains all configurable settings for the application
 */
import { generateDeviceName } from './utils/namegenerator';

export const AppConfig = {
  // Connection Settings
  connection: {
    maxReconnectAttempts: 5,
    reconnectDelay: 2000, // milliseconds
    signalingServerUrl: import.meta.env.VITE_SERVER_URL || 'http://localhost:3001',
    connectionTimeout: 20000, // milliseconds
  },
  
  // File Transfer Settings
  fileTransfer: {
    maxFileSize: 1024 * 1024 * 500, // 500MB
    maxFilesPerTransfer: 5,
    chunkSize: 16384, // 16KB chunks
    chunkDelay: 20, // milliseconds between chunks
  },
  
  // UI Settings
  ui: {
    defaultDeviceName: generateDeviceName(),
    theme: {
      primary: '#4361ee',
      secondary: '#3f37c9',
      success: '#4cc9f0',
      error: '#f72585',
      background: '#f8f9fa',
      card: '#ffffff',
      text: '#212529',
      textSecondary: '#6c757d',
      border: '#e9ecef',
    }
  },
  
  // ICE Servers for WebRTC
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    {
      urls: 'turn:numb.viagenie.ca',
      username: 'webrtc@live.com',
      credential: 'muazkh'
    },
    {
      urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
      username: 'webrtc',
      credential: 'webrtc'
    }
  ]
};

export default AppConfig; 