// Types pour le contexte de connexion
import type { SocketService } from '../services/socket.service';
import type { PeerConnectionService } from '../services/peerConnection.service';
import type { FileTransferService } from '../services/fileTransfer.service';

export interface Device {
  id: string;
  name: string;
}

export interface FileTransfer {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'pending' | 'transferring' | 'completed' | 'failed' | 'canceled';
  targetDevice?: string; // ID of the device receiving the file
  targetDeviceName?: string; // Nom de l'appareil destinataire
  timestamp: number; // Horodatage de début du transfert
  estimatedTimeRemaining?: number; // Temps restant estimé en millisecondes
  speed?: number; // Vitesse de transfert en octets par seconde
}

export interface IncomingFile {
  id: string;
  name: string;
  size: number;
  receivedSize: number;
  progress: number;
  status: 'receiving' | 'completed' | 'failed' | 'canceled';
  chunks: ArrayBuffer[];
  from: string;
  timestamp: number; // Horodatage de début de réception
  estimatedTimeRemaining?: number; // Temps restant estimé en millisecondes
  speed?: number; // Vitesse de réception en octets par seconde
}

export interface SelectedFile {
  id: string;
  file: File;
  name: string;
  size: number;
}

export interface ConnectionServices {
  socketService: SocketService | null;
  peerService: PeerConnectionService | null;
  fileTransferService: FileTransferService | null;
}

export interface ConnectionContextType {
  deviceId: string;
  deviceName: string;
  setDeviceName: (name: string) => void;
  availableDevices: Device[];
  connectedDevices: string[]; // ID of connected devices
  connectToDevice: (deviceId: string) => void;
  sendFile: (file: File, targetDeviceId: string) => void;
  sendFiles: (files: SelectedFile[], targetDeviceId: string) => void;
  fileTransfers: FileTransfer[];
  incomingFiles: IncomingFile[];
  downloadFile: (fileId: string) => void;
  isConnectedTo: (deviceId: string) => boolean;
  selectedFiles: SelectedFile[];
  addSelectedFile: (file: File) => void;
  removeSelectedFile: (fileId: string) => void;
  clearSelectedFiles: () => void;
  getServices: () => ConnectionServices;
  cancelFileTransfer: (transferId: string) => void;
} 