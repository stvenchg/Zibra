import { useState } from 'react';
import { useConnection } from '../hooks/useConnection';
import { DeviceList } from '../components/DeviceList';
import { TransferList } from '../components/TransferList';
import { ReceivedFiles } from '../components/ReceivedFiles';
import { FileSelection } from '../components/FileSelection';
import { AppConfig } from '../config';

export const HomePage = () => {
  const { deviceName, setDeviceName, deviceId, selectedFiles, clearSelectedFiles } = useConnection();
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
            Share files with other devices on the same network.
            Select up to {AppConfig.fileTransfer.maxFilesPerTransfer} files, then choose a device to send them to.
          </p>
        </div>
      </div>
      
      <FileSelection />
      
      {selectedFiles.length > 0 && (
        <DeviceList />
      )}
      
      <TransferList />
      <ReceivedFiles />
    </div>
  );
}; 