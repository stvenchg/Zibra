import { useState, useCallback } from 'react';
import { useConnection } from '../hooks/useConnection';

export const FileTransfer = ({ targetDeviceId }: { targetDeviceId: string }) => {
  const { sendFile, availableDevices } = useConnection();
  const [isDragging, setIsDragging] = useState(false);
  
  const targetDevice = availableDevices.find(device => device.id === targetDeviceId);
  
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      sendFile(file, targetDeviceId);
    }
  }, [sendFile, targetDeviceId]);
  
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      sendFile(file, targetDeviceId);
    }
  }, [sendFile, targetDeviceId]);
  
  if (!targetDevice) {
    return <p>Device not available</p>;
  }
  
  return (
    <div className="file-transfer-container">
      <h2>Send to {targetDevice.name}</h2>
      
      <div 
        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <p>Drag and drop a file here</p>
        <p>or</p>
        <label className="file-input-label">
          <input 
            type="file" 
            onChange={handleFileSelect} 
            className="file-input"
          />
          Select a file
        </label>
      </div>
    </div>
  );
}; 