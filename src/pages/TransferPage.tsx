import { useParams, useNavigate } from 'react-router-dom';
import { useConnection } from '../hooks/useConnection';
import { FileTransfer } from '../components/FileTransfer';
import { TransferList } from '../components/TransferList';
import { ReceivedFiles } from '../components/ReceivedFiles';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const TransferPage = () => {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const { availableDevices } = useConnection();
  
  const targetDevice = availableDevices.find(device => device.id === deviceId);
  
  if (!deviceId) {
    return <div className="container mx-auto px-4 py-8 text-center">Identifiant d'appareil non spécifié</div>;
  }
  
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-4">
        <Button 
          variant="outline"
          size="icon"
          onClick={() => navigate('/')}
          className="h-10 w-10"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">
          Transfert de fichiers 
          {targetDevice ? ` vers ${targetDevice.name}` : ''}
        </h1>
      </div>
      
      <FileTransfer targetDeviceId={deviceId} />
      <TransferList />
      <ReceivedFiles />
    </div>
  );
}; 