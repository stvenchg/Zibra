import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { WebRTCConnection } from '../utils/WebRTCConnection';

interface Device {
  id: string;
  name: string;
}

interface FileTransfer {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'pending' | 'transferring' | 'completed' | 'failed';
}

// Add additional interfaces for incoming files
interface IncomingFile {
  id: string;
  name: string;
  size: number;
  receivedSize: number;
  progress: number;
  status: 'receiving' | 'completed' | 'failed';
  chunks: ArrayBuffer[];
  from: string;
}

interface ConnectionContextType {
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
}

export const ConnectionContext = createContext<ConnectionContextType | null>(null);

const SIGNALING_SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export const ConnectionProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>(`Appareil-${Math.floor(Math.random() * 1000)}`);
  const [availableDevices, setAvailableDevices] = useState<Device[]>([]);
  const [peers, setPeers] = useState<Record<string, WebRTCConnection>>({});
  const [fileTransfers, setFileTransfers] = useState<FileTransfer[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<string[]>([]);
  const [incomingFiles, setIncomingFiles] = useState<IncomingFile[]>([]);
  const [pendingChunkFileId, setPendingChunkFileId] = useState<string | null>(null);

  // Cleanup function for connections that don't establish within a timeout
  const resetConnectionTimeout = useCallback((deviceId: string, timeout = 15000) => {
    return setTimeout(() => {
      const peer = peers[deviceId];
      if (peer && !peer.isConnected()) {
        console.log(`Connection to ${deviceId} timed out, resetting...`);
        peer.close();
        setPeers(prev => {
          const newPeers = { ...prev };
          delete newPeers[deviceId];
          return newPeers;
        });
      }
    }, timeout);
  }, [peers]);

  // Use a ref for pending chunk file ID to avoid async state issues
  const pendingChunkFileIdRef = useRef<string | null>(null);
  // Use a ref to track recently created files to avoid duplicates
  const recentlyCreatedFilesRef = useRef<Set<string>>(new Set());
  // Queue for pending chunks
  const pendingChunksRef = useRef<Record<string, Array<ArrayBuffer>>>({});
  
  // Apply queued chunks for a file
  const applyPendingChunks = useCallback((fileId: string) => {
    // Créer une copie locale du tableau de chunks dès le début pour éviter les problèmes de référence
    const pendingChunksForFile = pendingChunksRef.current[fileId];
    
    // Nettoyage immédiat pour éviter de retraiter les mêmes chunks
    delete pendingChunksRef.current[fileId];
    
    if (!pendingChunksForFile || !Array.isArray(pendingChunksForFile) || pendingChunksForFile.length === 0) {
      console.log(`Pas de chunks en attente pour le fichier ${fileId} ou format invalide`);
      return; // No chunks to apply or invalid format
    }
    
    console.log(`Applying ${pendingChunksForFile.length} pending chunks for file ${fileId}`);
    
    setIncomingFiles(prev => {
      const fileIndex = prev.findIndex(f => f.id === fileId);
      if (fileIndex === -1) {
        console.warn(`Cannot apply pending chunks: file ${fileId} not found`);
        return prev;
      }
      
      try {
        const file = prev[fileIndex];
        let receivedSize = file.receivedSize;
        const newChunks = [...file.chunks];
        
        // Add all pending chunks - with safe access and error handling
        for (let i = 0; i < pendingChunksForFile.length; i++) {
          try {
            const chunk = pendingChunksForFile[i];
            if (chunk && chunk.byteLength) {
              newChunks.push(chunk);
              receivedSize += chunk.byteLength;
            }
          } catch (err) {
            console.error(`Erreur lors du traitement d'un chunk pour ${fileId}:`, err);
            // Continue avec les autres chunks
          }
        }
        
        const progress = Math.min(100, Math.floor((receivedSize / (file.size || receivedSize)) * 100));
        
        // Update the file with all pending chunks
        const updatedFiles = [...prev];
        updatedFiles[fileIndex] = {
          ...file,
          chunks: newChunks,
          receivedSize,
          progress
        };
        
        return updatedFiles;
      } catch (err) {
        console.error(`Erreur lors de l'application des chunks pour ${fileId}:`, err);
        return prev; // Retourne l'état inchangé en cas d'erreur
      }
    });
  }, []);

  // Initialize Socket.IO connection
  useEffect(() => {
    const socketIo = io(SIGNALING_SERVER_URL);
    
    socketIo.on('connect', () => {
      console.log('Connected to signaling server');
      setDeviceId(socketIo.id || '');
      
      // Announce our presence
      socketIo.emit('device:announce', { name: deviceName });
    });
    
    socketIo.on('devices:list', (devices: Device[]) => {
      console.log('Received devices list:', devices);
      // Filter out our own device from the list
      setAvailableDevices(devices.filter(device => device.id !== socketIo.id));
    });
    
    setSocket(socketIo);
    
    return () => {
      socketIo.disconnect();
    };
  }, [deviceName]);

  // Update event handlers when receiving an offer, answer, or ICE candidate
  useEffect(() => {
    if (!socket) return;
    
    const handleOffer = async ({ from, signal }: { from: string, signal: any }) => {
      console.log('Received offer from:', from);
      try {
        // If we already have a peer for this device, close it first
        if (peers[from]) {
          console.log('Closing existing connection before accepting offer');
          peers[from].close();
          setPeers(prev => {
            const newPeers = { ...prev };
            delete newPeers[from];
            return newPeers;
          });
        }
        
        const peer = new WebRTCConnection(false);
        
        // Set a timeout to reset the connection if it doesn't establish
        const timeoutId = resetConnectionTimeout(from);
        
        peer.on('signal', data => {
          console.log('Sending answer to:', from);
          socket.emit('signal:answer', { to: from, signal: data });
        });
        
        peer.on('ice', data => {
          console.log('Sending ICE candidate to:', from);
          socket.emit('signal:ice', { to: from, candidate: data });
        });
        
        peer.on('connect', () => {
          console.log('Connected to', from);
          clearTimeout(timeoutId); // Clear the timeout since we're connected
          setConnectedDevices(prev => {
            if (!prev.includes(from)) {
              return [...prev, from];
            }
            return prev;
          });
        });
        
        peer.on('close', () => {
          console.log('Disconnected from', from);
          setConnectedDevices(prev => prev.filter(id => id !== from));
        });
        
        peer.on('error', (err) => {
          console.error('Connection error:', err);
        });
        
        peer.on('data', handleIncomingData);
        
        // Accept the connection offer
        await peer.signal(signal);
        
        setPeers(prev => ({ ...prev, [from]: peer }));
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    };
    
    const handleAnswer = ({ from, signal }: { from: string, signal: any }) => {
      console.log('Received answer from:', from);
      const peer = peers[from];
      if (peer) {
        try {
          peer.signal(signal);
        } catch (error) {
          console.error('Error handling answer:', error);
        }
      } else {
        console.warn('Received answer for unknown peer:', from);
      }
    };
    
    const handleIce = ({ from, candidate }: { from: string, candidate: any }) => {
      console.log('Received ICE candidate from:', from);
      const peer = peers[from];
      if (peer) {
        try {
          peer.signal(candidate);
        } catch (error) {
          console.error('Error handling ICE candidate:', error);
        }
      } else {
        console.warn('Received ICE candidate for unknown peer:', from);
      }
    };
    
    socket.on('signal:offer', handleOffer);
    socket.on('signal:answer', handleAnswer);
    socket.on('signal:ice', handleIce);
    
    return () => {
      socket.off('signal:offer', handleOffer);
      socket.off('signal:answer', handleAnswer);
      socket.off('signal:ice', handleIce);
    };
  }, [socket, peers, resetConnectionTimeout]);

  // Function to connect to a device
  const connectToDevice = (targetDeviceId: string) => {
    if (!socket) {
      console.error('Socket not initialized');
      return;
    }

    // If we already have a peer for this device, close it first
    if (peers[targetDeviceId]) {
      console.log('Closing existing connection to', targetDeviceId);
      peers[targetDeviceId].close();
    }

    console.log('Connecting to device:', targetDeviceId);
    try {
      const peer = new WebRTCConnection(true);
      
      // Set a timeout to reset the connection if it doesn't establish
      const timeoutId = resetConnectionTimeout(targetDeviceId);
      
      peer.on('signal', data => {
        console.log('Sending offer to:', targetDeviceId);
        socket.emit('signal:offer', { to: targetDeviceId, signal: data });
      });
      
      peer.on('ice', data => {
        console.log('Sending ICE candidate to:', targetDeviceId);
        socket.emit('signal:ice', { to: targetDeviceId, candidate: data });
      });
      
      peer.on('connect', () => {
        console.log('Connected to', targetDeviceId);
        clearTimeout(timeoutId); // Clear the timeout since we're connected
        setConnectedDevices(prev => {
          if (!prev.includes(targetDeviceId)) {
            return [...prev, targetDeviceId];
          }
          return prev;
        });
      });
      
      peer.on('close', () => {
        console.log('Disconnected from', targetDeviceId);
        setConnectedDevices(prev => prev.filter(id => id !== targetDeviceId));
      });
      
      peer.on('error', (err) => {
        console.error('Connection error:', err);
      });
      
      peer.on('data', handleIncomingData);
      
      setPeers(prev => ({ ...prev, [targetDeviceId]: peer }));
      
      // Initiate the connection
      peer.createOffer();
    } catch (error) {
      console.error('Error connecting to device:', error);
    }
  };

  // Handle incoming data
  const handleIncomingData = (data: any) => {
    try {
      // If data is a string, it's likely a control message (JSON)
      if (typeof data === 'string') {
        const message = JSON.parse(data);
        console.log('Received message:', message.type);
        
        switch (message.type) {
          case 'file-info': {
            // Initialize a new incoming file
            const newFile: IncomingFile = {
              id: message.id,
              name: message.name,
              size: message.size,
              receivedSize: 0,
              progress: 0,
              status: 'receiving',
              chunks: [],
              from: message.from || 'unknown'
            };
            console.log('New incoming file:', newFile.name, 'size:', newFile.size);
            
            // Vérifier si le fichier existe déjà (cas où file-chunk est arrivé avant file-info)
            setIncomingFiles(prev => {
              const fileIndex = prev.findIndex(f => f.id === message.id);
              if (fileIndex !== -1) {
                console.log('File entry already exists, updating metadata');
                // Preserve existing chunks and sizes, but update metadata
                const existingFile = prev[fileIndex];
                const updatedFile = { 
                  ...newFile, 
                  chunks: existingFile.chunks,
                  receivedSize: existingFile.receivedSize,
                  progress: existingFile.progress
                };
                
                const updatedFiles = [...prev];
                updatedFiles[fileIndex] = updatedFile;
                
                // Apply any pending chunks after updating metadata
                setTimeout(() => applyPendingChunks(message.id), 0);
                
                return updatedFiles;
              }
              
              // It's a new file, remove from recently created set
              recentlyCreatedFilesRef.current.delete(message.id);
              
              // Apply any pending chunks after adding the file
              setTimeout(() => applyPendingChunks(message.id), 0);
              
              return [...prev, newFile];
            });
            break;
          }
          
          case 'file-chunk': {
            // Set which file is expecting the chunk data using ref for immediate access
            console.log('Expecting chunk data for file:', message.id);
            pendingChunkFileIdRef.current = message.id;
            setPendingChunkFileId(message.id); // Keep this for React state
            break;
          }
          
          case 'file-complete': {
            // File transfer is complete, update status
            console.log('File transfer complete:', message.id);
            
            // Process any remaining pending chunks first
            try {
              const hasPendingChunks = pendingChunksRef.current[message.id] && 
                      Array.isArray(pendingChunksRef.current[message.id]) && 
                      pendingChunksRef.current[message.id].length > 0;
                      
              if (hasPendingChunks) {
                console.log(`Traitement de ${pendingChunksRef.current[message.id].length} chunks en attente avant de finaliser le fichier`);
                applyPendingChunks(message.id);
              } else {
                console.log(`Pas de chunks en attente pour le fichier ${message.id}`);
                // Nettoyage au cas où
                delete pendingChunksRef.current[message.id];
              }
            } catch (err) {
              console.error(`Erreur lors du traitement des chunks en attente pour ${message.id}:`, err);
              // Nettoyage en cas d'erreur
              delete pendingChunksRef.current[message.id];
            }
            
            pendingChunkFileIdRef.current = null; // Clear ref
            setPendingChunkFileId(null); // Clear state
            recentlyCreatedFilesRef.current.delete(message.id); // Clean up from recently created
            
            // Mettre à jour le statut du fichier
            setIncomingFiles(prev => 
              prev.map(file => {
                if (file.id === message.id) {
                  return { ...file, status: 'completed' };
                }
                return file;
              }));
            break;
          }
          
          default:
            console.warn('Unknown message type:', message.type);
        }
      } else {
        // Binary data (file chunk)
        const currentPendingFileId = pendingChunkFileIdRef.current;
        
        if (!currentPendingFileId) {
          console.warn('Received binary data but no pending file ID is set');
          return;
        }
        
        // Log chunk reception
        console.log(`Received data chunk of size ${data.byteLength} for file ${currentPendingFileId}`);
        
        // Vérifier si le fichier existe, sinon le créer
        let targetFile = incomingFiles.find(f => f.id === currentPendingFileId);
        
        if (!targetFile && !recentlyCreatedFilesRef.current.has(currentPendingFileId)) {
          console.log(`Fichier ${currentPendingFileId} non trouvé, création d'une entrée temporaire`);
          
          // Marquer ce fichier comme récemment créé pour éviter les doublons
          recentlyCreatedFilesRef.current.add(currentPendingFileId);
          
          // Extraire le nom du fichier à partir de l'ID (format: timestamp-filename)
          const fileName = currentPendingFileId.split('-').slice(1).join('-') || "unknown_file";
          
          // Créer une entrée temporaire
          const temporaryFile: IncomingFile = {
            id: currentPendingFileId,
            name: fileName,
            size: 0, // Taille inconnue, sera mise à jour quand file-info arrivera
            receivedSize: 0,
            progress: 0,
            status: 'receiving',
            chunks: [],
            from: 'unknown' // Sera mis à jour quand file-info arrivera
          };
          
          // Ajouter le chunk à la file d'attente pendant la création du fichier
          if (!pendingChunksRef.current[currentPendingFileId]) {
            pendingChunksRef.current[currentPendingFileId] = [];
          }
          
          // S'assurer que le tableau est correctement initialisé
          if (!Array.isArray(pendingChunksRef.current[currentPendingFileId])) {
            pendingChunksRef.current[currentPendingFileId] = [];
          }
          
          pendingChunksRef.current[currentPendingFileId].push(data);
          console.log(`Chunk mis en file d'attente pour le fichier ${currentPendingFileId}, total: ${pendingChunksRef.current[currentPendingFileId].length}`);
          
          // Ajouter le fichier temporaire à l'état
          setIncomingFiles(prev => [...prev, temporaryFile]);
        } else if (!targetFile) {
          // Le fichier est en cours de création, ajouter le chunk à la file d'attente
          console.log(`Fichier ${currentPendingFileId} en cours de création, ajout du chunk à la file d'attente`);
          if (!pendingChunksRef.current[currentPendingFileId]) {
            pendingChunksRef.current[currentPendingFileId] = [];
          }
          
          // S'assurer que le tableau est correctement initialisé
          if (!Array.isArray(pendingChunksRef.current[currentPendingFileId])) {
            pendingChunksRef.current[currentPendingFileId] = [];
          }
          
          pendingChunksRef.current[currentPendingFileId].push(data);
          console.log(`Chunk mis en file d'attente pour le fichier ${currentPendingFileId}, total: ${pendingChunksRef.current[currentPendingFileId].length}`);
        } else {
          // Le fichier existe, ajouter directement le chunk
          console.log(`Ajout direct du chunk au fichier ${targetFile.name}`);
          
          // Add this chunk to the file
          const newChunks = [...targetFile.chunks, data];
          const receivedSize = targetFile.receivedSize + data.byteLength;
          const progress = Math.min(100, Math.floor((receivedSize / (targetFile.size || receivedSize)) * 100));
          
          // Update the file state
          setIncomingFiles(prev => 
            prev.map(file => {
              if (file.id === currentPendingFileId) {
                return {
                  ...file,
                  chunks: newChunks,
                  receivedSize,
                  progress
                };
              }
              return file;
            })
          );
        }
      }
    } catch (error) {
      console.error('Error handling incoming data:', error);
    }
  };
  
  // Function to download a completed file
  const downloadFile = (fileId: string) => {
    try {
      const file = incomingFiles.find(f => f.id === fileId);
      if (!file) {
        console.error('File not found:', fileId);
        return;
      }
      
      if (file.status !== 'completed') {
        console.warn('File is not complete yet');
        return;
      }
      
      if (!file.chunks.length) {
        console.error('File has no data chunks');
        alert('Unable to download file: No data received');
        return;
      }
      
      // Log some debugging info
      console.log(`Preparing to download file: ${file.name}`);
      console.log(`Number of chunks: ${file.chunks.length}`);
      console.log(`Total received size: ${file.receivedSize} bytes`);
      console.log(`Expected size: ${file.size} bytes`);
      
      // Concatenate all chunks
      const fileBlob = new Blob(file.chunks, { type: 'application/octet-stream' });
      console.log(`Created blob of size: ${fileBlob.size} bytes`);
      
      if (fileBlob.size === 0) {
        console.error('File blob is empty');
        alert('Unable to download file: Generated file is empty');
        return;
      }
      
      // Create a download link
      const url = URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      console.log('File download initiated:', file.name);
    } catch (error: any) {
      console.error('Error downloading file:', error);
      alert(`Error downloading file: ${error.message || 'Unknown error'}`);
    }
  };

  // Send a file to a device
  const sendFile = async (file: File, targetDeviceId: string) => {
    const peer = peers[targetDeviceId];
    if (!peer) {
      console.error('No connection with this device');
      return;
    }

    const transferId = `${Date.now()}-${file.name}`;
    const newTransfer: FileTransfer = {
      id: transferId,
      fileName: file.name,
      fileSize: file.size,
      progress: 0,
      status: 'pending',
    };

    setFileTransfers(prev => [...prev, newTransfer]);

    // Inform the other device of the upcoming file
    const fileInfo = {
      type: 'file-info',
      id: transferId,
      name: file.name,
      size: file.size,
      from: deviceName // Send device name instead of ID for better UX
    };
    peer.send(JSON.stringify(fileInfo));

    // Read and send the file in chunks
    const chunkSize = 16384; // 16KB chunks
    const reader = new FileReader();
    let offset = 0;

    const updateProgress = (progress: number) => {
      setFileTransfers(prev => 
        prev.map(t => t.id === transferId ? { ...t, progress, status: 'transferring' } : t)
      );
    };

    // Add a small delay between chunk sends to avoid overwhelming the connection
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const readSlice = async (o: number) => {
      const slice = file.slice(o, o + chunkSize);
      reader.readAsArrayBuffer(slice);
    };

    reader.onload = async (e) => {
      if (!e.target?.result) return;
      
      try {
        // First notify which file this chunk belongs to
        peer.send(JSON.stringify({ 
          type: 'file-chunk', 
          id: transferId
        }));
        
        // Wait a small amount of time to ensure the message is processed
        await delay(10);
        
        // Send the binary data
        peer.send(e.target.result);
        
        offset += (e.target.result as ArrayBuffer).byteLength;
        const progress = Math.min(100, Math.floor((offset / file.size) * 100));
        updateProgress(progress);
        
        if (offset < file.size) {
          // Add a small delay between chunks
          await delay(20);
          await readSlice(offset);
        } else {
          // Transfer completed
          setFileTransfers(prev => 
            prev.map(t => t.id === transferId ? { ...t, progress: 100, status: 'completed' } : t)
          );
          
          // Add delay before sending completion message
          await delay(50);
          peer.send(JSON.stringify({ type: 'file-complete', id: transferId }));
        }
      } catch (error) {
        console.error('Error sending file chunk:', error);
        setFileTransfers(prev => 
          prev.map(t => t.id === transferId ? { ...t, status: 'failed' } : t)
        );
      }
    };

    reader.onerror = () => {
      console.error('Error reading file');
      setFileTransfers(prev => 
        prev.map(t => t.id === transferId ? { ...t, status: 'failed' } : t)
      );
    };

    readSlice(0);
  };

  // Function to check if we are connected to a specific device
  const isConnectedTo = (deviceId: string): boolean => {
    return connectedDevices.includes(deviceId);
  };

  // Handle file reception timeouts
  useEffect(() => {
    // Check for stalled incoming file transfers
    const interval = setInterval(() => {
      setIncomingFiles(prev => 
        prev.map(file => {
          // If a file has been in 'receiving' state for more than 30 seconds without progress
          if (file.status === 'receiving') {
            const transferAge = Date.now() - parseInt(file.id.split('-')[0], 10);
            if (transferAge > 30000 && file.progress < 100) {
              console.log(`File transfer ${file.id} appears stalled, marking as failed`);
              return { ...file, status: 'failed' };
            }
          }
          return file;
        })
      );
    }, 10000); // Check every 10 seconds
    
    return () => clearInterval(interval);
  }, []);

  const value = {
    deviceId,
    deviceName,
    setDeviceName,
    availableDevices,
    connectedDevices,
    connectToDevice,
    sendFile,
    fileTransfers,
    incomingFiles,
    downloadFile,
    isConnectedTo,
  };

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
}; 