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
  status: 'pending' | 'transferring' | 'completed' | 'failed';
}

export interface IncomingFile {
  id: string;
  name: string;
  size: number;
  receivedSize: number;
  progress: number;
  status: 'receiving' | 'completed' | 'failed';
  chunks: ArrayBuffer[];
  from: string;
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
  fileTransfers: FileTransfer[];
  incomingFiles: IncomingFile[];
  downloadFile: (fileId: string) => void;
  isConnectedTo: (deviceId: string) => boolean;
  getServices: () => ConnectionServices;
} 