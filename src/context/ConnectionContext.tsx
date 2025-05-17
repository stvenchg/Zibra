import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { ConnectionContextType, Device, FileTransfer, IncomingFile } from '../types/connection.types';
import { SocketService } from '../services/socket.service';
import { PeerConnectionService } from '../services/peerConnection.service';
import { FileTransferService } from '../services/fileTransfer.service';

export const ConnectionContext = createContext<ConnectionContextType | null>(null);

const SIGNALING_SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export const ConnectionProvider = ({ children }: { children: ReactNode }) => {
  const [deviceId, setDeviceId] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>(`Appareil-${Math.floor(Math.random() * 1000)}`);
  const [availableDevices, setAvailableDevices] = useState<Device[]>([]);
  const [fileTransfers, setFileTransfers] = useState<FileTransfer[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<string[]>([]);
  const [incomingFiles, setIncomingFiles] = useState<IncomingFile[]>([]);
  
  // Références aux services
  const socketServiceRef = useRef<SocketService | null>(null);
  const peerServiceRef = useRef<PeerConnectionService | null>(null);
  const fileTransferServiceRef = useRef<FileTransferService | null>(null);

  // Initialiser les services
  useEffect(() => {
    // Fonction pour gérer les appareils disponibles
    const handleAvailableDevices = (devices: Device[]) => {
      setAvailableDevices(devices);
    };
    
    // Créer le service socket
    const socketService = new SocketService(deviceName, handleAvailableDevices);
    socketServiceRef.current = socketService;
    
    // Se connecter au serveur de signalisation
    socketService.connect(SIGNALING_SERVER_URL)
      .then((socket) => {
        console.log('Socket connected successfully');
        setDeviceId(socketService.getDeviceId());
        
        // Fonction pour gérer les appareils connectés
        const handleConnectedDevices = (devices: string[]) => {
          setConnectedDevices(devices);
        };
        
        // Fonction pour gérer les données entrantes
        const handleIncomingData = (data: any) => {
          if (fileTransferServiceRef.current) {
            fileTransferServiceRef.current.handleIncomingData(data);
            
            // Mettre à jour l'état avec les données du service
            setFileTransfers(fileTransferServiceRef.current.getFileTransfers());
            setIncomingFiles(fileTransferServiceRef.current.getIncomingFiles());
          }
        };
        
        // Créer le service de connexion P2P
        const peerService = new PeerConnectionService(
          socket,
          deviceName,
          handleConnectedDevices,
          handleIncomingData
        );
        peerServiceRef.current = peerService;
        
        // Configurer les gestionnaires d'événements pour la signalisation
        socket.on('signal:offer', ({ from, signal }: { from: string, signal: any }) => {
          console.log('Relaying offer from server to peer service');
          peerService.handleIncomingConnection(from, signal);
        });

        socket.on('signal:answer', ({ from, signal }: { from: string, signal: any }) => {
          console.log('Relaying answer from server to peer service');
          peerService.handleAnswer(from, signal);
        });

        socket.on('signal:ice', ({ from, candidate }: { from: string, candidate: any }) => {
          console.log('Relaying ICE candidate from server to peer service');
          peerService.handleIce(from, candidate);
        });
        
        // Créer le service de transfert de fichiers
        const fileTransferService = new FileTransferService(deviceName, peerService);
        fileTransferServiceRef.current = fileTransferService;
      })
      .catch(error => {
        console.error('Failed to connect to socket server:', error);
      });
    
    // Nettoyer les services lors du démontage
    return () => {
      peerServiceRef.current?.closeAll();
      socketServiceRef.current?.disconnect();
    };
  }, [deviceName]);

  // Mettre à jour le nom de l'appareil
  const handleDeviceNameChange = (name: string) => {
    setDeviceName(name);
    socketServiceRef.current?.updateDeviceName(name);
    peerServiceRef.current?.updateDeviceName(name);
    fileTransferServiceRef.current?.updateDeviceName(name);
  };

  // Se connecter à un appareil
  const connectToDevice = (deviceId: string) => {
    peerServiceRef.current?.connectToDevice(deviceId);
  };

  // Vérifier si on est connecté à un appareil
  const isConnectedTo = (deviceId: string): boolean => {
    return peerServiceRef.current?.isConnectedTo(deviceId) || false;
  };

  // Envoyer un fichier
  const sendFile = async (file: File, targetDeviceId: string) => {
    if (fileTransferServiceRef.current) {
      await fileTransferServiceRef.current.sendFile(file, targetDeviceId);
      setFileTransfers(fileTransferServiceRef.current.getFileTransfers());
    }
  };

  // Télécharger un fichier
  const downloadFile = (fileId: string) => {
    if (fileTransferServiceRef.current) {
      fileTransferServiceRef.current.downloadFile(fileId);
    }
  };

  // Synchroniser les états avec les services
  useEffect(() => {
    const updateInterval = setInterval(() => {
      if (fileTransferServiceRef.current) {
        // Appliquer le nettoyage périodique des fichiers dupliqués
        fileTransferServiceRef.current.cleanupDuplicateFiles();
        
        // Vérifier les transferts de fichiers en échec
        fileTransferServiceRef.current.cleanupStalledTransfers();
        
        // Mettre à jour les états
        setFileTransfers(fileTransferServiceRef.current.getFileTransfers());
        setIncomingFiles(fileTransferServiceRef.current.getIncomingFiles());
      }
    }, 2000);
    
    return () => clearInterval(updateInterval);
  }, []);

  // Méthode pour exposer les services aux hooks avancés
  const getServices = useCallback(() => {
    return {
      socketService: socketServiceRef.current,
      peerService: peerServiceRef.current,
      fileTransferService: fileTransferServiceRef.current
    };
  }, []);

  const value = {
    deviceId,
    deviceName,
    setDeviceName: handleDeviceNameChange,
    availableDevices,
    connectedDevices,
    connectToDevice,
    sendFile,
    fileTransfers,
    incomingFiles,
    downloadFile,
    isConnectedTo,
    getServices
  };

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
}; 