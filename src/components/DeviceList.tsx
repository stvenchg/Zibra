import { useState, useCallback, useEffect, useRef } from 'react';
import { useConnection } from '../hooks/useConnection';
import { useToast } from './ui/toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DeviceAvatar } from './DeviceAvatar';
import { Loader2, Share2, RefreshCw, Search, Wifi } from 'lucide-react';
import { vibrateStrong, vibrateError } from '../utils/vibration';

export const DeviceList = () => {
  const { availableDevices, connectToDevice, isConnectedTo, selectedFiles, sendFiles, fileTransfers } = useConnection();
  const { addToast } = useToast();
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState<Record<string, number>>({});
  // State to track devices with active transfers
  const [activeTransferDevices, setActiveTransferDevices] = useState<Record<string, boolean>>({});
  // To store refresh timers
  const transferTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
  
  // Update active transfers state when fileTransfers changes
  useEffect(() => {
    // Find devices with active transfers
    const devicesWithActiveTransfers: Record<string, boolean> = {};
    
    fileTransfers.forEach(transfer => {
      // If transfer is in progress and has a target device
      if (
        (transfer.status === 'transferring' || transfer.status === 'pending') && 
        transfer.targetDevice
      ) {
        devicesWithActiveTransfers[transfer.targetDevice] = true;
        
        // Cancel any existing timer for this device
        if (transferTimersRef.current[transfer.targetDevice]) {
          clearTimeout(transferTimersRef.current[transfer.targetDevice]);
          delete transferTimersRef.current[transfer.targetDevice];
        }
      }
      
      // If the transfer has just completed, add a delay before removing it
      if (
        (transfer.status === 'completed' || transfer.status === 'failed' || transfer.status === 'canceled') &&
        transfer.targetDevice
      ) {
        // Check if this device was previously marked as active
        const wasActive = activeTransferDevices[transfer.targetDevice];
        
        if (wasActive && !devicesWithActiveTransfers[transfer.targetDevice]) {
          // Set up a timer to remove the device after a delay
          if (!transferTimersRef.current[transfer.targetDevice]) {
            transferTimersRef.current[transfer.targetDevice] = setTimeout(() => {
              setActiveTransferDevices(prev => {
                const updated = { ...prev };
                delete updated[transfer.targetDevice!];
                return updated;
              });
              delete transferTimersRef.current[transfer.targetDevice!];
            }, 100); // 100ms delay to allow UI to stabilize
          }
        }
      }
    });
    
    // Update state with devices that have active transfers
    // but preserve those with timers in progress
    setActiveTransferDevices(prev => {
      const newState = { ...prev };
      
      // Add new devices with active transfers
      Object.keys(devicesWithActiveTransfers).forEach(deviceId => {
        newState[deviceId] = true;
      });
      
      // Keep only devices with active transfers or timers in progress
      return Object.keys(newState).reduce((acc, deviceId) => {
        // If device has an active transfer or a timer in progress, keep it
        if (devicesWithActiveTransfers[deviceId] || transferTimersRef.current[deviceId]) {
          acc[deviceId] = true;
        }
        return acc;
      }, {} as Record<string, boolean>);
    });
  }, [fileTransfers]);

  // Clean up timers when component unmounts
  useEffect(() => {
    return () => {
      Object.values(transferTimersRef.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  // Check if a transfer is in progress to a specific device
  const hasActiveTransferTo = useCallback((deviceId: string) => {
    // First check local state for an immediate response
    if (activeTransferDevices[deviceId]) {
      return true;
    }
    
    // Then check the transfers themselves (slower but more thorough approach)
    return fileTransfers.some(
      transfer => 
        transfer.targetDevice === deviceId && 
        (transfer.status === 'transferring' || transfer.status === 'pending')
    );
  }, [fileTransfers, activeTransferDevices]);

  // Handle sending files to selected device
  const handleSendFiles = useCallback((e: React.MouseEvent, deviceId: string) => {
    e.preventDefault();
    console.log('Sending files to device:', deviceId);
    
    if (selectedFiles.length === 0) {
      vibrateError(); // Error vibration if no files selected
      addToast({
        type: 'warning',
        title: 'No files selected',
        description: 'Please select at least one file to transfer.',
        duration: 5000
      });
      return;
    }
    
    vibrateStrong(); // Strong vibration to indicate transfer start
    setConnectingDeviceId(deviceId);
    
    // Immediately mark this device as having an active transfer
    setActiveTransferDevices(prev => ({
      ...prev,
      [deviceId]: true
    }));
    
    // Increment the attempt counter
    setConnectionAttempts(prev => ({
      ...prev,
      [deviceId]: (prev[deviceId] || 0) + 1
    }));
    
    // Send files to the device
    try {      
      sendFiles(selectedFiles, deviceId);
      console.log('File transfer initiated');
      
      // We'll let the timeout handle resetting the state
      // as the transfer progress will be tracked in TransferList
    } catch (error: unknown) {
      console.error('Failed to send files:', error);
      setConnectingDeviceId(null);
      
      // Remove active transfer state in case of error
      setActiveTransferDevices(prev => {
        const updated = { ...prev };
        delete updated[deviceId];
        return updated;
      });
      
      vibrateError(); // Error vibration if transfer fails
      addToast({
        type: 'error',
        title: 'Connection failed',
        description: 'Unable to establish connection with the device.',
        duration: 5000
      });
    }
    
    // Add a timeout to reset the "connecting" state
    // if the connection doesn't establish within 20 seconds
    setTimeout(() => {
      setConnectingDeviceId(prev => {
        if (prev === deviceId) {
          if (!isConnectedTo(deviceId)) {
            vibrateError(); // Error vibration if timeout exceeded
            addToast({
              type: 'error',
              title: 'Connection timeout',
              description: 'The connection took too long. Please try again.',
              duration: 5000
            });
          }
          return null;
        }
        return prev;
      });
    }, 20000);
  }, [connectToDevice, selectedFiles, sendFiles, addToast, isConnectedTo]);
  
  // Determine the connection status of a device
  const getConnectionStatus = useCallback((deviceId: string) => {
    if (isConnectedTo(deviceId)) return 'connected';
    if (connectingDeviceId === deviceId) return 'connecting';
    return 'disconnected';
  }, [isConnectedTo, connectingDeviceId]);
  
  // Get the text to display on the button
  const getButtonText = useCallback((deviceId: string) => {
    // If there's an active transfer to this device, show "Transferring..."
    if (hasActiveTransferTo(deviceId)) {
      return 'Transferring...';
    }
    
    const status = getConnectionStatus(deviceId);
    const attempts = connectionAttempts[deviceId] || 0;
    
    switch (status) {
      case 'connected':
        return 'Transfer';
      case 'connecting':
        return 'Connecting...';
      default:
        return attempts > 0 ? 'Retry' : 'Transfer';
    }
  }, [getConnectionStatus, connectionAttempts, hasActiveTransferTo]);

  // Get appropriate button variant based on status
  const getButtonVariant = useCallback((deviceId: string) => {
    const status = getConnectionStatus(deviceId);
    
    // If there's an active transfer, use a disabled variant
    if (hasActiveTransferTo(deviceId)) {
      return 'outline';
    }
    
    switch (status) {
      case 'connected':
        return 'default';
      case 'connecting':
        return 'outline';
      default:
        return 'default';
    }
  }, [getConnectionStatus, hasActiveTransferTo]);
  
  // Check if button should be disabled
  const isButtonDisabled = useCallback((deviceId: string) => {
    const isConnecting = connectingDeviceId === deviceId;
    const noFilesSelected = selectedFiles.length === 0;
    const isTransfering = hasActiveTransferTo(deviceId);
    
    return isConnecting || noFilesSelected || isTransfering;
  }, [connectingDeviceId, selectedFiles.length, hasActiveTransferTo]);
  
  if (availableDevices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Available devices</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 space-y-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-muted/20 animate-pulse-expand relative">
              <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse opacity-75"></div>
              <Wifi className="h-10 w-10 text-muted-foreground" />
            </div>
          </div>
          <p className="text-muted-foreground mt-4">Searching...</p>
          <p className="text-sm text-muted-foreground flex items-center gap-1 justify-center">
            <span>Devices connected to the same network will appear automatically here.</span>
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Available devices</CardTitle>
        <CardDescription>
          {availableDevices.length} device{availableDevices.length > 1 ? 's' : ''} on your network
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {availableDevices.map(device => {
            const connectionStatus = getConnectionStatus(device.id);
            const isConnected = connectionStatus === 'connected';
            const isConnecting = connectionStatus === 'connecting';
            const isTransfering = hasActiveTransferTo(device.id);
            const buttonText = getButtonText(device.id);
            const buttonVariant = getButtonVariant(device.id) as any;
            const buttonDisabled = isButtonDisabled(device.id);
            
            return (
              <li 
                key={device.id} 
                className="flex items-center justify-between p-3 bg-muted/30 rounded-md hover:bg-muted/40 transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${
                    isConnected ? 'bg-green-500 animate-pulse' : 
                    isConnecting ? 'bg-amber-500 animate-pulse' : 
                    'bg-orange-500'
                  }`} />
                  <DeviceAvatar deviceId={device.id} deviceName={device.name} size={36} />
                  <div>
                    <div className="font-medium">{device.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <span>ID: {device.id.substring(0, 8)}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <Button 
                    variant={buttonVariant}
                    size="sm"
                    onClick={(e) => handleSendFiles(e, device.id)}
                    disabled={buttonDisabled}
                    className={`${isConnecting || isTransfering ? 'animate-pulse' : ''} min-w-[140px] transition-all duration-200`}
                    title={selectedFiles.length === 0 ? "Select a file" : isTransfering ? "Transfer in progress" : ""}
                  >
                    {(isConnecting || isTransfering) && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                    {buttonText}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}; 