import { useState } from 'react';
import { useConnection } from '../hooks/useConnection';
import { DeviceList } from '../components/DeviceList';
import { TransferList } from '../components/TransferList';
import { ReceivedFiles } from '../components/ReceivedFiles';
import { FileSelection } from '../components/FileSelection';
import { DeviceAvatar } from '../components/DeviceAvatar';
import { AppConfig } from '../config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '../components/ui/toast';

export const HomePage = () => {
  const { deviceName, setDeviceName, deviceId, selectedFiles, clearSelectedFiles } = useConnection();
  const { addToast } = useToast();
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(deviceName);
  
  const handleNameEdit = () => {
    setEditingName(true);
    setTempName(deviceName);
  };
  
  const handleNameSave = () => {
    if (tempName.trim()) {
      setDeviceName(tempName);
      addToast({
        type: 'success',
        title: 'Nom modifié',
        description: `Votre appareil s'affiche maintenant comme "${tempName}".`,
        duration: 3000
      });
    }
    setEditingName(false);
  };
  
  return (
    <div className="container mx-auto p-4 py-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-7 gap-6">
        <div className="md:col-span-3 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">Votre appareil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <DeviceAvatar deviceId={deviceId} size={56} />
                
                {editingName ? (
                  <div className="flex items-center gap-2 flex-1">
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
                  <div className="flex items-center justify-between flex-1">
                    <div className="space-y-1">
                      <div className="font-semibold text-lg">{deviceName}</div>
                      <div className="text-xs text-muted-foreground">ID: {deviceId.substring(0, 8)}</div>
                    </div>
                    <Button onClick={handleNameEdit} variant="outline" size="sm">Modifier</Button>
                  </div>
                )}
              </div>
              
              <div className="text-sm text-muted-foreground">
                Partagez des fichiers avec d'autres appareils sur le même réseau.
                Sélectionnez jusqu'à {AppConfig.fileTransfer.maxFilesPerTransfer} fichiers, puis choisissez un appareil destinataire.
              </div>
            </CardContent>
          </Card>
          
          <FileSelection />
        </div>
        
        <div className="md:col-span-4 space-y-6">
          <DeviceList />
          
          <Tabs defaultValue="transfers" className="w-full">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="transfers">Transferts</TabsTrigger>
              <TabsTrigger value="received">Fichiers reçus</TabsTrigger>
            </TabsList>
            <TabsContent value="transfers" className="mt-4">
              <TransferList />
              <div className="h-4"></div>
            </TabsContent>
            <TabsContent value="received" className="mt-4">
              <ReceivedFiles />
              <div className="h-4"></div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}; 