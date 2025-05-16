import { useParams, useNavigate } from 'react-router-dom';
import { useConnection } from '../hooks/useConnection';
import { FileTransfer } from '../components/FileTransfer';
import { TransferList } from '../components/TransferList';
import { ReceivedFiles } from '../components/ReceivedFiles';

export const TransferPage = () => {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const { availableDevices } = useConnection();
  
  const targetDevice = availableDevices.find(device => device.id === deviceId);
  
  if (!deviceId) {
    return <div>Device ID not specified</div>;
  }
  
  return (
    <div className="transfer-page">
      <div className="header">
        <button 
          className="back-button"
          onClick={() => navigate('/')}
        >
          ← Back
        </button>
        <h1>
          File transfer 
          {targetDevice ? ` to ${targetDevice.name}` : ''}
        </h1>
      </div>
      
      <FileTransfer targetDeviceId={deviceId} />
      <TransferList />
      <ReceivedFiles />
    </div>
  );
}; 