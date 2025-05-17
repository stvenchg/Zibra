import { io, Socket } from 'socket.io-client';
import type { Device } from '../types/connection.types';

export class SocketService {
  private socket: Socket | null = null;
  private deviceName: string;
  private availableDevicesCallback: (devices: Device[]) => void;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000; // 2 secondes entre chaque tentative
  private serverUrl = '';

  constructor(
    deviceName: string,
    availableDevicesCallback: (devices: Device[]) => void
  ) {
    this.deviceName = deviceName;
    this.availableDevicesCallback = availableDevicesCallback;
  }

  // Récupérer l'ID de l'appareil
  getDeviceId(): string {
    return this.socket?.id || '';
  }

  // Mettre à jour le nom de l'appareil
  updateDeviceName(name: string) {
    this.deviceName = name;
    if (this.socket?.connected) {
      this.socket.emit('device:announce', { name });
    }
  }

  // Se connecter au serveur de signalisation
  connect(url: string): Promise<Socket> {
    this.serverUrl = url;
    return this.attemptConnection();
  }
  
  // Tentative de connexion avec gestion de reconnexion
  private attemptConnection(): Promise<Socket> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Connecting to signaling server: ${this.serverUrl} (attempt ${this.reconnectAttempts + 1})`);
        
        // Options améliorées pour Socket.IO
        const socketIo = io(this.serverUrl, {
          reconnectionAttempts: 3,  // Socket.IO essaiera de se reconnecter 3 fois
          reconnectionDelay: 1000,  // 1 seconde entre chaque tentative intégrée
          timeout: 10000,          // 10 secondes de timeout pour la connexion
          forceNew: this.reconnectAttempts > 0  // Forcer une nouvelle connexion lors des tentatives de reconnexion
        });
        
        this.socket = socketIo;
        
        socketIo.on('connect', () => {
          console.log('Connected to signaling server with ID:', socketIo.id);
          
          // Réinitialiser le compteur de tentatives
          this.reconnectAttempts = 0;
          
          // Annoncer notre présence
          socketIo.emit('device:announce', { name: this.deviceName });
          
          resolve(socketIo);
        });
        
        socketIo.on('connect_error', (error) => {
          console.error('Connection error:', error);
          this.handleConnectionError(error, reject);
        });
        
        socketIo.on('disconnect', (reason) => {
          console.log('Disconnected from server, reason:', reason);
          
          // Tenter de se reconnecter si la déconnexion est due à une erreur réseau
          if (reason === 'io server disconnect' || reason === 'transport close' || reason === 'transport error') {
            this.handleReconnection();
          }
        });
        
        socketIo.on('devices:list', (devices: Device[]) => {
          console.log('Received devices list:', devices);
          // Filtrer notre propre appareil de la liste
          const filteredDevices = devices.filter(device => device.id !== socketIo.id);
          this.availableDevicesCallback(filteredDevices);
        });
      } catch (error) {
        console.error('Error connecting to server:', error);
        this.handleConnectionError(error, reject);
      }
    });
  }
  
  // Gérer les erreurs de connexion
  private handleConnectionError(error: any, reject: (reason?: any) => void) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Connection attempt ${this.reconnectAttempts} failed, retrying in ${this.reconnectDelay}ms...`);
      
      setTimeout(() => {
        this.attemptConnection()
          .then((socket) => {
            console.log('Reconnection successful');
          })
          .catch((error) => {
            console.error('Reconnection failed:', error);
          });
      }, this.reconnectDelay);
    } else {
      console.error(`Failed to connect after ${this.maxReconnectAttempts} attempts`);
      reject(error);
    }
  }
  
  // Tenter une reconnexion manuelle
  private handleReconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnection attempt ${this.reconnectAttempts}, retrying in ${this.reconnectDelay}ms...`);
      
      setTimeout(() => {
        this.attemptConnection()
          .then((socket) => {
            console.log('Reconnection successful');
          })
          .catch((error) => {
            console.error('Reconnection failed:', error);
          });
      }, this.reconnectDelay);
    } else {
      console.error(`Failed to reconnect after ${this.maxReconnectAttempts} attempts`);
    }
  }
  
  // Forcer une reconnexion manuelle
  forceReconnect(): Promise<Socket> {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.reconnectAttempts = 0;
    return this.attemptConnection();
  }

  // Se déconnecter du serveur
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    // Réinitialiser les tentatives de reconnexion
    this.reconnectAttempts = 0;
  }

  // Récupérer l'instance socket
  getSocket(): Socket | null {
    return this.socket;
  }
} 