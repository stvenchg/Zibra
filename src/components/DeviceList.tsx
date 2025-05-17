import { useState, useCallback } from 'react';
import { useConnection } from '../hooks/useConnection';
import { useNavigate } from 'react-router-dom';

export const DeviceList = () => {
  const { availableDevices, connectToDevice, isConnectedTo } = useConnection();
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState<Record<string, number>>({});
  const navigate = useNavigate();

  // Gérer la connexion et prévenir le rechargement de la page
  const handleConnect = useCallback((e: React.MouseEvent, deviceId: string) => {
    e.preventDefault(); // Empêcher le comportement par défaut
    console.log('Attempting to connect to', deviceId);
    setConnectingDeviceId(deviceId);
    
    // Incrémenter le compteur de tentatives
    setConnectionAttempts(prev => ({
      ...prev,
      [deviceId]: (prev[deviceId] || 0) + 1
    }));
    
    connectToDevice(deviceId);
    
    // Ajouter un timeout après 20 secondes pour réinitialiser l'état "connecting"
    // si la connexion ne s'établit pas
    setTimeout(() => {
      setConnectingDeviceId(prev => prev === deviceId ? null : prev);
    }, 20000);
  }, [connectToDevice]);

  // Naviguer vers la page de transfert
  const goToTransfer = useCallback((deviceId: string) => {
    navigate(`/transfer/${deviceId}`);
  }, [navigate]);

  // Déterminer le statut de connexion d'un appareil
  const getConnectionStatus = useCallback((deviceId: string) => {
    if (isConnectedTo(deviceId)) return 'connected';
    if (connectingDeviceId === deviceId) return 'connecting';
    return 'disconnected';
  }, [isConnectedTo, connectingDeviceId]);

  // Obtenir le texte à afficher sur le bouton
  const getButtonText = useCallback((deviceId: string) => {
    const status = getConnectionStatus(deviceId);
    const attempts = connectionAttempts[deviceId] || 0;
    
    switch (status) {
      case 'connected':
        return 'Transfer';
      case 'connecting':
        return attempts > 1 ? `Connecting (Retry ${attempts})...` : 'Connecting...';
      default:
        return attempts > 0 ? 'Retry Connect' : 'Connect';
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
                  onClick={(e) => isConnected ? goToTransfer(device.id) : handleConnect(e, device.id)}
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