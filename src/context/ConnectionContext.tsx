import { createContext, useState, useEffect, useCallback } from 'react';
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

interface ConnectionContextType {
  deviceId: string;
  deviceName: string;
  setDeviceName: (name: string) => void;
  availableDevices: Device[];
  connectedDevices: string[]; // ID of connected devices
  connectToDevice: (deviceId: string) => void;
  sendFile: (file: File, targetDeviceId: string) => void;
  fileTransfers: FileTransfer[];
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
  const handleIncomingData = (data: ArrayBuffer) => {
    console.log('Received data of size:', data.byteLength);
    // TODO: implement file reception
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

    const readSlice = (o: number) => {
      const slice = file.slice(o, o + chunkSize);
      reader.readAsArrayBuffer(slice);
    };

    reader.onload = (e) => {
      if (!e.target?.result) return;
      
      try {
        // Send the chunk header
        peer.send(JSON.stringify({ type: 'file-chunk', id: transferId }));
        
        // Send the data
        peer.send(e.target.result);
        
        offset += (e.target.result as ArrayBuffer).byteLength;
        const progress = Math.min(100, Math.floor((offset / file.size) * 100));
        updateProgress(progress);
        
        if (offset < file.size) {
          readSlice(offset);
        } else {
          // Transfer completed
          setFileTransfers(prev => 
            prev.map(t => t.id === transferId ? { ...t, progress: 100, status: 'completed' } : t)
          );
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

  const value = {
    deviceId,
    deviceName,
    setDeviceName,
    availableDevices,
    connectedDevices,
    connectToDevice,
    sendFile,
    fileTransfers,
    isConnectedTo,
  };

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
}; 