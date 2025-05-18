import { WebRTCConnection } from '../utils/WebRTCConnection';
import type { Device } from '../types/connection.types';

// Configuration des serveurs STUN/TURN
const DEFAULT_ICE_SERVERS = [
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
];

export class PeerConnectionService {
  private peers: Record<string, WebRTCConnection> = {};
  private socket: any;
  private connectedDevicesCallback: (devices: string[]) => void;
  private dataCallback: (data: any) => void;
  private deviceName: string;
  private connectionAttempts: Record<string, number> = {}; // Compte les tentatives de connexion
  private maxRetries = 2; // Nombre maximum de tentatives

  constructor(
    socket: any,
    deviceName: string,
    connectedDevicesCallback: (devices: string[]) => void,
    dataCallback: (data: any) => void
  ) {
    this.socket = socket;
    this.deviceName = deviceName;
    this.connectedDevicesCallback = connectedDevicesCallback;
    this.dataCallback = dataCallback;
  }

  // Mise à jour du nom de l'appareil
  updateDeviceName(name: string) {
    this.deviceName = name;
  }

  // Vérifier si on est connecté à un appareil spécifique
  isConnectedTo(deviceId: string): boolean {
    return this.peers[deviceId]?.isConnected() || false;
  }

  // Récupérer tous les appareils connectés
  getConnectedDevices(): string[] {
    return Object.keys(this.peers).filter(id => this.peers[id].isConnected());
  }

  // Initialiser un timer pour nettoyer les connexions qui n'aboutissent pas
  private resetConnectionTimeout(deviceId: string, timeout = 15000): NodeJS.Timeout {
    return setTimeout(() => {
      const peer = this.peers[deviceId];
      if (peer && !peer.isConnected()) {
        console.log(`Connection to ${deviceId} timed out, resetting...`);
        this.handleConnectionFailure(deviceId, 'timeout');
      }
    }, timeout);
  }

  // Gestion de l'échec de connexion
  private handleConnectionFailure(deviceId: string, reason: string) {
    console.log(`Connection failed to ${deviceId}, reason: ${reason}`);
    
    // Récupérer le nombre de tentatives déjà effectuées
    const attempts = this.connectionAttempts[deviceId] || 0;
    
    // Fermer la connexion existante
    if (this.peers[deviceId]) {
      this.peers[deviceId].close();
      delete this.peers[deviceId];
    }
    
    // Si on a fait moins de tentatives que le maximum, on réessaie
    if (attempts < this.maxRetries) {
      console.log(`Retrying connection to ${deviceId}, attempt ${attempts + 1}/${this.maxRetries}`);
      this.connectionAttempts[deviceId] = attempts + 1;
      
      // Attendre un court délai avant de réessayer
      setTimeout(() => {
        this.connectToDevice(deviceId);
      }, 2000);
    } else {
      console.log(`Connection failed after ${attempts} attempts, giving up`);
      this.connectionAttempts[deviceId] = 0;
      this.updateConnectedDevices();
    }
  }

  // Créer une connexion entrante (réception d'une offre)
  async handleIncomingConnection(from: string, signal: any) {
    console.log('Received offer from:', from);
    try {
      // Si on a déjà une connexion avec cet appareil, on la ferme
      if (this.peers[from]) {
        console.log('Closing existing connection before accepting offer');
        this.peers[from].close();
        delete this.peers[from];
      }
      
      // Réinitialiser le compteur de tentatives
      this.connectionAttempts[from] = 0;
      
      const peer = new WebRTCConnection(false);
      
      // Timer pour nettoyer la connexion si elle n'aboutit pas
      const timeoutId = this.resetConnectionTimeout(from);
      
      peer.on('signal', data => {
        console.log('Sending answer to:', from);
        this.socket.emit('signal:answer', { to: from, signal: data });
      });
      
      peer.on('ice', data => {
        console.log('Sending ICE candidate to:', from);
        this.socket.emit('signal:ice', { to: from, candidate: data });
      });
      
      peer.on('connect', () => {
        console.log('Connected to', from);
        clearTimeout(timeoutId); // Annuler le timer
        this.connectionAttempts[from] = 0; // Réinitialiser les tentatives
        this.updateConnectedDevices();
      });
      
      peer.on('close', () => {
        console.log('Disconnected from', from);
        this.updateConnectedDevices();
      });
      
      peer.on('error', (err) => {
        console.error('Connection error:', err);
        this.handleConnectionFailure(from, 'error: ' + err.message);
      });
      
      peer.on('data', this.dataCallback);
      
      // Accepter l'offre de connexion
      await peer.signal(signal);
      
      this.peers[from] = peer;
    } catch (error) {
      console.error('Error handling offer:', error);
      this.handleConnectionFailure(from, 'error handling offer');
    }
  }

  // Traiter une réponse reçue
  handleAnswer(from: string, signal: any) {
    console.log('Received answer from:', from);
    const peer = this.peers[from];
    if (peer) {
      try {
        peer.signal(signal);
      } catch (error) {
        console.error('Error handling answer:', error);
        this.handleConnectionFailure(from, 'error handling answer');
      }
    } else {
      console.warn('Received answer for unknown peer:', from);
    }
  }

  // Traiter un candidat ICE reçu
  handleIce(from: string, candidate: any) {
    console.log('Received ICE candidate from:', from);
    const peer = this.peers[from];
    if (peer) {
      try {
        peer.signal(candidate);
      } catch (error) {
        console.error('Error handling ICE candidate:', error);
        this.handleConnectionFailure(from, 'error handling ICE candidate');
      }
    } else {
      console.warn('Received ICE candidate for unknown peer:', from);
    }
  }

  // Mettre à jour la liste des appareils connectés
  private updateConnectedDevices() {
    const connected = this.getConnectedDevices();
    this.connectedDevicesCallback(connected);
  }

  // Initier une connexion vers un appareil
  connectToDevice(targetDeviceId: string) {
    if (!this.socket) {
      console.error('Socket not initialized');
      return;
    }

    // Si on est déjà connecté, ne rien faire
    if (this.peers[targetDeviceId]?.isConnected()) {
      console.log('Already connected to', targetDeviceId);
      return;
    }

    // Si on a déjà une connexion avec cet appareil, la fermer
    if (this.peers[targetDeviceId]) {
      console.log('Closing existing connection to', targetDeviceId);
      this.peers[targetDeviceId].close();
      delete this.peers[targetDeviceId];
      
      // Forcer un court délai avant de recréer la connexion
      // pour s'assurer que les ressources sont libérées
      setTimeout(() => this.initiateNewConnection(targetDeviceId), 500);
    } else {
      this.initiateNewConnection(targetDeviceId);
    }
  }
  
  // Créer une nouvelle connexion
  private initiateNewConnection(targetDeviceId: string) {
    console.log('Connecting to device:', targetDeviceId);
    try {
      const peer = new WebRTCConnection(true);
      
      // Timer pour nettoyer la connexion si elle n'aboutit pas
      const timeoutId = this.resetConnectionTimeout(targetDeviceId);
      
      peer.on('signal', data => {
        console.log('Sending offer to:', targetDeviceId);
        this.socket.emit('signal:offer', { to: targetDeviceId, signal: data });
      });
      
      peer.on('ice', data => {
        console.log('Sending ICE candidate to:', targetDeviceId);
        this.socket.emit('signal:ice', { to: targetDeviceId, candidate: data });
      });
      
      peer.on('connect', () => {
        console.log('Connected to', targetDeviceId);
        clearTimeout(timeoutId); // Annuler le timer
        this.connectionAttempts[targetDeviceId] = 0; // Réinitialiser les tentatives
        this.updateConnectedDevices();
      });
      
      peer.on('close', () => {
        console.log('Disconnected from', targetDeviceId);
        this.updateConnectedDevices();
      });
      
      peer.on('error', (err) => {
        console.error('Connection error:', err);
        this.handleConnectionFailure(targetDeviceId, 'error: ' + (err.message || String(err)));
      });
      
      peer.on('data', this.dataCallback);
      
      this.peers[targetDeviceId] = peer;
      
      // Initier la connexion
      peer.createOffer();
    } catch (error) {
      console.error('Error connecting to device:', error);
      this.handleConnectionFailure(targetDeviceId, 'error creating connection');
    }
  }

  // Envoyer des données à un appareil connecté
  sendData(targetDeviceId: string, data: any): boolean {
    const peer = this.peers[targetDeviceId];
    if (!peer || !peer.isConnected()) {
      console.warn('Cannot send data: device not connected');
      return false;
    }
    
    try {
      // Pour les gros messages binaires, vérifier s'ils sont trop volumineux
      if (data instanceof ArrayBuffer && data.byteLength > 262144) {
        console.warn(`Message trop volumineux (${data.byteLength} octets), fragmentation conseillée`);
      }
      
      peer.send(data);
      return true;
    } catch (error) {
      console.error('Error sending data:', error);
      return false;
    }
  }

  // Fermer toutes les connexions
  closeAll() {
    for (const id in this.peers) {
      try {
        this.peers[id].close();
      } catch (e) {
        console.error(`Error closing connection to ${id}:`, e);
      }
    }
    this.peers = {};
    this.connectionAttempts = {}; // Réinitialiser les compteurs de tentatives
  }
} 