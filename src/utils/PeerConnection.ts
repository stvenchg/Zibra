import { EventEmitter } from 'events';
import SimplePeer from 'simple-peer';

// Classe personnalisée pour gérer les connexions WebRTC
export class PeerConnection extends EventEmitter {
  private peer: SimplePeer.Instance | null = null;
  private connected = false;
  private destroyed = false;

  constructor(initiator: boolean = false) {
    super();
    
    try {
      // Création de l'instance simple-peer
      this.peer = new SimplePeer({
        initiator,
        trickle: false,
      });

      // Gestion des événements
      this.peer.on('signal', data => {
        this.emit('signal', data);
      });

      this.peer.on('connect', () => {
        this.connected = true;
        this.emit('connect');
      });

      this.peer.on('data', data => {
        this.emit('data', data);
      });

      this.peer.on('error', err => {
        console.error('Peer error:', err);
        this.emit('error', err);
      });

      this.peer.on('close', () => {
        this.connected = false;
        this.emit('close');
      });
    } catch (error) {
      console.error('Error creating peer:', error);
      this.emit('error', error);
    }
  }

  // Envoyer un signal pour établir la connexion
  signal(data: any): void {
    if (this.peer && !this.destroyed) {
      try {
        this.peer.signal(data);
      } catch (error) {
        console.error('Error signaling:', error);
        this.emit('error', error);
      }
    }
  }

  // Envoyer des données
  send(data: string | ArrayBuffer): void {
    if (this.peer && this.connected && !this.destroyed) {
      try {
        this.peer.send(data);
      } catch (error) {
        console.error('Error sending data:', error);
        this.emit('error', error);
      }
    } else {
      console.warn('Tried to send data but peer is not connected');
    }
  }

  // Fermer la connexion
  destroy(): void {
    if (this.peer && !this.destroyed) {
      this.destroyed = true;
      try {
        this.peer.destroy();
      } catch (error) {
        console.error('Error destroying peer:', error);
      }
    }
  }

  // Vérifier si la connexion est établie
  isConnected(): boolean {
    return this.connected;
  }
} 