import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { ConnectionContextType, Device, FileTransfer, IncomingFile, SelectedFile } from '../types/connection.types';
import { SocketService } from '../services/socket.service';
import { PeerConnectionService } from '../services/peerConnection.service';
import { FileTransferService } from '../services/fileTransfer.service';
import { AppConfig } from '../config';

export const ConnectionContext = createContext<ConnectionContextType | null>(null);

export const ConnectionProvider = ({ children }: { children: ReactNode }) => {
  const [deviceId, setDeviceId] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>(AppConfig.ui.defaultDeviceName);
  const [availableDevices, setAvailableDevices] = useState<Device[]>([]);
  const [fileTransfers, setFileTransfers] = useState<FileTransfer[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<string[]>([]);
  const [incomingFiles, setIncomingFiles] = useState<IncomingFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  
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
    socketService.connect(AppConfig.connection.signalingServerUrl)
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

  // Ajouter un fichier à la liste des fichiers sélectionnés
  const addSelectedFile = (file: File) => {
    if (selectedFiles.length >= AppConfig.fileTransfer.maxFilesPerTransfer) {
      console.warn(`Maximum number of files (${AppConfig.fileTransfer.maxFilesPerTransfer}) already selected`);
      return;
    }
    
    if (file.size > AppConfig.fileTransfer.maxFileSize) {
      console.warn(`File ${file.name} exceeds maximum size of ${AppConfig.fileTransfer.maxFileSize / (1024 * 1024)}MB`);
      return;
    }
    
    const newFile: SelectedFile = {
      id: `${Date.now()}-${file.name}`,
      file,
      name: file.name,
      size: file.size
    };
    
    setSelectedFiles(prev => [...prev, newFile]);
  };
  
  // Supprimer un fichier de la liste des fichiers sélectionnés
  const removeSelectedFile = (fileId: string) => {
    setSelectedFiles(prev => prev.filter(file => file.id !== fileId));
  };
  
  // Vider la liste des fichiers sélectionnés
  const clearSelectedFiles = () => {
    setSelectedFiles([]);
  };

  // Envoyer un fichier
  const sendFile = async (file: File, targetDeviceId: string) => {
    if (fileTransferServiceRef.current) {
      if (!isConnectedTo(targetDeviceId)) {
        console.log('Connecting to device before sending file');
        connectToDevice(targetDeviceId);
        
        // Attendre que la connexion soit établie
        const waitForConnection = async (): Promise<boolean> => {
          return new Promise(resolve => {
            let attempts = 0;
            const maxAttempts = 10;
            const checkInterval = setInterval(() => {
              if (isConnectedTo(targetDeviceId)) {
                clearInterval(checkInterval);
                resolve(true);
              } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                resolve(false);
              }
              attempts++;
            }, 1000);
          });
        };
        
        const connected = await waitForConnection();
        if (!connected) {
          console.error('Failed to connect to device');
          return;
        }
      }
      
      await fileTransferServiceRef.current.sendFile(file, targetDeviceId);
      setFileTransfers(fileTransferServiceRef.current.getFileTransfers());
    }
  };
  
  // Envoyer plusieurs fichiers
  const sendFiles = async (files: SelectedFile[], targetDeviceId: string) => {
    if (files.length === 0) return;
    
    if (!isConnectedTo(targetDeviceId)) {
      console.log('Connecting to device before sending files');
      connectToDevice(targetDeviceId);
      
      // Attendre que la connexion soit établie
      const waitForConnection = async (): Promise<boolean> => {
        return new Promise(resolve => {
          let attempts = 0;
          const maxAttempts = 10;
          const checkInterval = setInterval(() => {
            if (isConnectedTo(targetDeviceId)) {
              clearInterval(checkInterval);
              resolve(true);
            } else if (attempts >= maxAttempts) {
              clearInterval(checkInterval);
              resolve(false);
            }
            attempts++;
          }, 1000);
        });
      };
      
      const connected = await waitForConnection();
      if (!connected) {
        console.error('Failed to connect to device');
        return;
      }
    }
    
    // Envoyer chaque fichier séquentiellement
    for (const selectedFile of files) {
      if (fileTransferServiceRef.current) {
        await fileTransferServiceRef.current.sendFile(selectedFile.file, targetDeviceId);
        setFileTransfers(fileTransferServiceRef.current.getFileTransfers());
      }
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
    sendFiles,
    fileTransfers,
    incomingFiles,
    downloadFile,
    isConnectedTo,
    selectedFiles,
    addSelectedFile,
    removeSelectedFile,
    clearSelectedFiles,
    getServices
  };

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
}; 