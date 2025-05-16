import { createContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import SimplePeer from 'simple-peer';

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
  connectToDevice: (deviceId: string) => void;
  sendFile: (file: File, targetDeviceId: string) => void;
  fileTransfers: FileTransfer[];
}

export const ConnectionContext = createContext<ConnectionContextType | null>(null);

const SIGNALING_SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export const ConnectionProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>(`Device-${Math.floor(Math.random() * 1000)}`);
  const [availableDevices, setAvailableDevices] = useState<Device[]>([]);
  const [peers, setPeers] = useState<Record<string, SimplePeer.Instance>>({});
  const [fileTransfers, setFileTransfers] = useState<FileTransfer[]>([]);

  // Initialize Socket.IO connection
  useEffect(() => {
    const socketIo = io(SIGNALING_SERVER_URL);
    
    socketIo.on('connect', () => {
      setDeviceId(socketIo.id || '');
      
      // Announce our presence
      socketIo.emit('device:announce', { name: deviceName });
    });
    
    socketIo.on('devices:list', (devices: Device[]) => {
      // Filter out our own device from the list
      setAvailableDevices(devices.filter(device => device.id !== socketIo.id));
    });
    
    socketIo.on('signal:offer', async ({ from, signal }) => {
      const peer = new SimplePeer({ trickle: false });
      
      peer.on('signal', data => {
        socketIo.emit('signal:answer', { to: from, signal: data });
      });
      
      peer.on('data', handleIncomingData);
      
      // Accept the connection offer
      peer.signal(signal);
      
      setPeers(prev => ({ ...prev, [from]: peer }));
    });
    
    setSocket(socketIo);
    
    return () => {
      socketIo.disconnect();
    };
  }, [deviceName]);

  // Function to connect to a device
  const connectToDevice = (targetDeviceId: string) => {
    if (!socket) return;

    const peer = new SimplePeer({ initiator: true, trickle: false });
    
    peer.on('signal', data => {
      socket.emit('signal:offer', { to: targetDeviceId, signal: data });
    });
    
    socket.on('signal:answer', ({ from, signal }) => {
      if (from === targetDeviceId) {
        peer.signal(signal);
      }
    });
    
    peer.on('connect', () => {
      console.log('Connecté à', targetDeviceId);
    });
    
    peer.on('data', handleIncomingData);
    
    setPeers(prev => ({ ...prev, [targetDeviceId]: peer }));
  };

  // Handle incoming data
  const handleIncomingData = (data: ArrayBuffer) => {
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
      
      const chunk = {
        type: 'file-chunk',
        id: transferId,
        data: e.target.result,
      };
      
      peer.send(JSON.stringify({ type: 'file-chunk', id: transferId }));
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
    };

    readSlice(0);
  };

  const value = {
    deviceId,
    deviceName,
    setDeviceName,
    availableDevices,
    connectToDevice,
    sendFile,
    fileTransfers,
  };

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
}; 