import { useState } from 'react';
import { useConnection } from '../hooks/useConnection';
import { useNavigate } from 'react-router-dom';

export const DeviceList = () => {
  const { availableDevices, connectToDevice, isConnectedTo } = useConnection();
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Gérer la connexion et prévenir le rechargement de la page
  const handleConnect = (e: React.MouseEvent, deviceId: string) => {
    e.preventDefault(); // Empêcher le comportement par défaut
    console.log('Attempting to connect to', deviceId);
    setConnectingDeviceId(deviceId);
    connectToDevice(deviceId);
  };

  // Naviguer vers la page de transfert
  const goToTransfer = (deviceId: string) => {
    navigate(`/transfer/${deviceId}`);
  };

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
          const isConnected = isConnectedTo(device.id);
          const isConnecting = connectingDeviceId === device.id && !isConnected;
          
          return (
            <li 
              key={device.id} 
              className={`device-item ${isConnected ? 'connected' : ''}`}
            >
              <div className="device-info">
                <span className="status-indicator 
                  ${isConnected ? 'online' : isConnecting ? 'connecting' : 'offline'}" 
                />
                <span className="device-name">{device.name}</span>
                <span className="device-id">{device.id.substring(0, 8)}</span>
              </div>
              {isConnected ? (
                <button 
                  className="transfer-button"
                  onClick={() => goToTransfer(device.id)}
                >
                  Transfer
                </button>
              ) : (
                <button 
                  className={`connect-button ${isConnecting ? 'connecting' : ''}`}
                  onClick={(e) => handleConnect(e, device.id)}
                  disabled={isConnecting}
                >
                  {isConnecting ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}; 