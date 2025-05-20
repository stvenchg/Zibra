import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { ConnectionContextType, Device, FileTransfer, IncomingFile, SelectedFile } from '../types/connection.types';
import { SocketService } from '../services/socket.service';
import { PeerConnectionService } from '../services/peerConnection.service';
import { FileTransferService } from '../services/fileTransfer.service';
import { AppConfig } from '../config';
import { generateDeviceName } from '../utils/namegenerator';

export const ConnectionContext = createContext<ConnectionContextType | null>(null);

// Constant for device name storage key
const DEVICE_NAME_STORAGE_KEY = 'zibra_device_name';

// Function to retrieve the stored device name or generate a new one
const getInitialDeviceName = (): string => {
  // Check if a name already exists in localStorage
  const savedName = localStorage.getItem(DEVICE_NAME_STORAGE_KEY);
  
  if (savedName) {
    console.log('Device name retrieved from localStorage:', savedName);
    return savedName;
  }
  
  // Generate a new random name
  const newName = generateDeviceName();
  console.log('New device name generated:', newName);
  
  // Save in localStorage for future visits
  localStorage.setItem(DEVICE_NAME_STORAGE_KEY, newName);
  
  return newName;
};

export const ConnectionProvider = ({ children }: { children: ReactNode }) => {
  const [deviceId, setDeviceId] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>(getInitialDeviceName());
  const [availableDevices, setAvailableDevices] = useState<Device[]>([]);
  const [fileTransfers, setFileTransfers] = useState<FileTransfer[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<string[]>([]);
  const [incomingFiles, setIncomingFiles] = useState<IncomingFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  
  // References to services
  const socketServiceRef = useRef<SocketService | null>(null);
  const peerServiceRef = useRef<PeerConnectionService | null>(null);
  const fileTransferServiceRef = useRef<FileTransferService | null>(null);

  // Initialize services
  useEffect(() => {
    // Function to handle available devices
    const handleAvailableDevices = (devices: Device[]) => {
      setAvailableDevices(devices);
    };
    
    // Create socket service
    const socketService = new SocketService(deviceName, handleAvailableDevices);
    socketServiceRef.current = socketService;
    
    // Connect to signaling server
    socketService.connect(AppConfig.connection.signalingServerUrl)
      .then((socket) => {
        console.log('Socket connected successfully');
        setDeviceId(socketService.getDeviceId());
        
        // Function to handle connected devices
        const handleConnectedDevices = (devices: string[]) => {
          setConnectedDevices(devices);
        };
        
        // Function to handle incoming data
        const handleIncomingData = (data: any) => {
          if (fileTransferServiceRef.current) {
            fileTransferServiceRef.current.handleIncomingData(data);
            
            // Update state with service data
            setFileTransfers(fileTransferServiceRef.current.getFileTransfers());
            setIncomingFiles(fileTransferServiceRef.current.getIncomingFiles());
          }
        };
        
        // Create P2P connection service
        const peerService = new PeerConnectionService(
          socket,
          deviceName,
          handleConnectedDevices,
          handleIncomingData
        );
        peerServiceRef.current = peerService;
        
        // Set up event handlers for signaling
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
        
        // Create file transfer service
        const fileTransferService = new FileTransferService(deviceName, peerService);
        fileTransferServiceRef.current = fileTransferService;
      })
      .catch(error => {
        console.error('Failed to connect to socket server:', error);
      });
    
    // Clean up services when unmounting
    return () => {
      peerServiceRef.current?.closeAll();
      socketServiceRef.current?.disconnect();
    };
  }, [deviceName]);

  // Update device name
  const handleDeviceNameChange = (name: string) => {
    setDeviceName(name);
    socketServiceRef.current?.updateDeviceName(name);
    peerServiceRef.current?.updateDeviceName(name);
    fileTransferServiceRef.current?.updateDeviceName(name);
    
    // Save the new name in localStorage
    localStorage.setItem(DEVICE_NAME_STORAGE_KEY, name);
  };

  // Connect to a device
  const connectToDevice = (deviceId: string) => {
    peerServiceRef.current?.connectToDevice(deviceId);
  };

  // Check if connected to a device
  const isConnectedTo = (deviceId: string): boolean => {
    return peerServiceRef.current?.isConnectedTo(deviceId) || false;
  };

  // Add a file to the list of selected files
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
  
  // Remove a file from the list of selected files
  const removeSelectedFile = (fileId: string) => {
    setSelectedFiles(prev => prev.filter(file => file.id !== fileId));
  };
  
  // Clear the list of selected files
  const clearSelectedFiles = () => {
    setSelectedFiles([]);
  };

  // Send a file
  const sendFile = async (file: File, targetDeviceId: string) => {
    if (fileTransferServiceRef.current) {
      if (!isConnectedTo(targetDeviceId)) {
        console.log('Connecting to device before sending file');
        connectToDevice(targetDeviceId);
        
        // Wait for the connection to be established
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
  
  // Send multiple files
  const sendFiles = async (files: SelectedFile[], targetDeviceId: string) => {
    if (files.length === 0) return;
    
    if (!isConnectedTo(targetDeviceId)) {
      console.log('Connecting to device before sending files');
      connectToDevice(targetDeviceId);
      
      // Wait for the connection to be established
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
    
    // Process files sequentially one by one
    for (const selectedFile of files) {
      if (fileTransferServiceRef.current) {
        console.log(`Sequential sending of ${selectedFile.name} (${selectedFile.size} bytes)`);
        
        try {
          // Send the current file
          await fileTransferServiceRef.current.sendFile(selectedFile.file, targetDeviceId);
          
          // Update the interface after each file
          setFileTransfers(fileTransferServiceRef.current.getFileTransfers());
          
          // Wait a short moment between each file to stabilize the connection
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          console.error(`Error sending ${selectedFile.name}:`, err);
        }
      }
    }
  };

  // Download a file
  const downloadFile = (fileId: string) => {
    if (fileTransferServiceRef.current) {
      fileTransferServiceRef.current.downloadFile(fileId);
    }
  };

  // Cancel a file transfer
  const cancelFileTransfer = (transferId: string) => {
    if (fileTransferServiceRef.current) {
      fileTransferServiceRef.current.cancelFileTransfer(transferId);
      // Update state with service data
      setFileTransfers(fileTransferServiceRef.current.getFileTransfers());
    }
  };

  // Synchronize states with services
  useEffect(() => {
    const updateInterval = setInterval(() => {
      if (fileTransferServiceRef.current) {
        // Apply periodic cleanup of duplicate files
        fileTransferServiceRef.current.cleanupDuplicateFiles();
        
        // Check for failed file transfers
        fileTransferServiceRef.current.cleanupStalledTransfers();
        
        // Update states
        setFileTransfers(fileTransferServiceRef.current.getFileTransfers());
        setIncomingFiles(fileTransferServiceRef.current.getIncomingFiles());
      }
    }, 2000);
    
    return () => clearInterval(updateInterval);
  }, []);

  // Method to expose services to advanced hooks
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
    getServices,
    cancelFileTransfer
  };

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
}; 