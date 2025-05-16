import { useState } from 'react';
import { useConnection } from '../hooks/useConnection';
import { DeviceList } from '../components/DeviceList';
import { TransferList } from '../components/TransferList';

export const HomePage = () => {
  const { deviceName, setDeviceName, deviceId } = useConnection();
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(deviceName);
  
  const handleNameEdit = () => {
    setEditingName(true);
    setTempName(deviceName);
  };
  
  const handleNameSave = () => {
    if (tempName.trim()) {
      setDeviceName(tempName);
    }
    setEditingName(false);
  };
  
  return (
    <div className="home-page">
      <div className="device-info-panel">
        <div className="device-info">
          <h1>Zibra</h1>
          <h2>Local network file sharing</h2>
          
          <div className="my-device">
            <h3>My device</h3>
            {editingName ? (
              <div className="name-edit">
                <input
                  type="text"
                  value={tempName}
                  onChange={e => setTempName(e.target.value)}
                  autoFocus
                />
                <button onClick={handleNameSave}>Save</button>
              </div>
            ) : (
              <div className="name-display">
                <span>{deviceName}</span>
                <button onClick={handleNameEdit}>Edit</button>
              </div>
            )}
            <div className="device-id">ID: {deviceId.substring(0, 8)}</div>
          </div>
        </div>
        
        <div className="instruction">
          <p>
            Connect to other devices on the same network to share files.
            Devices are detected automatically.
          </p>
        </div>
      </div>
      
      <DeviceList />
      <TransferList />
    </div>
  );
}; 