import { useState } from 'react';
import { useConnection } from '../hooks/useConnection';
import { DeviceList } from '../components/DeviceList';
import { TransferList } from '../components/TransferList';
import { ReceivedFiles } from '../components/ReceivedFiles';
import { FileSelection } from '../components/FileSelection';
import { AppConfig } from '../config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

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
    <div className="container mx-auto px-4 py-8 space-y-8">
      <Card>
        <CardHeader>
          <img src="/zibra.svg" alt="Zibra" className="w-50" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Mon appareil</h3>
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={tempName}
                  onChange={e => setTempName(e.target.value)}
                  autoFocus
                  className="flex-1"
                />
                <Button onClick={handleNameSave} size="sm">Enregistrer</Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-semibold text-lg">{deviceName}</span>
                <Button onClick={handleNameEdit} variant="outline" size="sm">Modifier</Button>
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1">ID: {deviceId.substring(0, 8)}</div>
          </div>
          
          <div className="bg-muted/50 p-4 rounded-lg text-sm">
            <p>
              Partagez des fichiers avec d'autres appareils sur le même réseau.
              Sélectionnez jusqu'à {AppConfig.fileTransfer.maxFilesPerTransfer} fichiers, puis choisissez un appareil destinataire.
            </p>
          </div>
        </CardContent>
      </Card>
      
      <FileSelection />
      
      {selectedFiles.length > 0 && (
        <DeviceList />
      )}
      
      <TransferList />
      <ReceivedFiles />
    </div>
  );
}; 