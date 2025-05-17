import { useState, useCallback } from 'react';
import { useConnection } from '../hooks/useConnection';

export const DeviceList = () => {
  const { availableDevices, connectToDevice, isConnectedTo, selectedFiles, sendFiles } = useConnection();
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState<Record<string, number>>({});
  
  // Handle sending files to selected device
  const handleSendFiles = useCallback((e: React.MouseEvent, deviceId: string) => {
    e.preventDefault();
    console.log('Sending files to device:', deviceId);
    
    if (selectedFiles.length === 0) {
      alert('Please select at least one file to transfer.');
      return;
    }
    
    setConnectingDeviceId(deviceId);
    
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
    }
    
    // Add a timeout to reset the "connecting" state
    // if the connection doesn't establish within 20 seconds
    setTimeout(() => {
      setConnectingDeviceId(prev => prev === deviceId ? null : prev);
    }, 20000);
  }, [connectToDevice, selectedFiles, sendFiles]);
  
  // Determine the connection status of a device
  const getConnectionStatus = useCallback((deviceId: string) => {
    if (isConnectedTo(deviceId)) return 'connected';
    if (connectingDeviceId === deviceId) return 'connecting';
    return 'disconnected';
  }, [isConnectedTo, connectingDeviceId]);
  
  // Get the text to display on the button
  const getButtonText = useCallback((deviceId: string) => {
    const status = getConnectionStatus(deviceId);
    const attempts = connectionAttempts[deviceId] || 0;
    
    switch (status) {
      case 'connected':
        return 'Send Files';
      case 'connecting':
        return attempts > 1 ? `Connecting (Retry ${attempts})...` : 'Connecting...';
      default:
        return attempts > 0 ? 'Retry Send' : 'Send Files';
    }
  }, [getConnectionStatus, connectionAttempts]);
  
  if (availableDevices.length === 0) {
    return (
      <div className="device-list empty">
        <p>No devices detected on the network.</p>
        <p>Devices connected to the same network will appear here automatically.</p>
      </div>
    );
  }
  
  return (
    <div className="device-list">
      <h2>Available devices</h2>
      <ul>
        {availableDevices.map(device => {
          const connectionStatus = getConnectionStatus(device.id);
          const isConnected = connectionStatus === 'connected';
          const isConnecting = connectionStatus === 'connecting';
          const buttonText = getButtonText(device.id);
          
          return (
            <li 
              key={device.id} 
              className={`device-item ${connectionStatus}`}
            >
              <div className="device-info">
                <span className={`status-indicator ${connectionStatus}`} />
                <span className="device-name">{device.name}</span>
                <span className="device-id">{device.id.substring(0, 8)}</span>
              </div>
              <div className="connection-info">
                {isConnecting && (
                  <span className="connection-status">
                    Establishing connection...
                  </span>
                )}
                <button 
                  className={`${isConnected ? 'transfer-button' : 'connect-button'} ${isConnecting ? 'connecting' : ''}`}
                  onClick={(e) => handleSendFiles(e, device.id)}
                  disabled={isConnecting}
                >
                  {buttonText}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}; 