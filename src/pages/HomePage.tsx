import { useState, useEffect } from 'react';
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
import { Helmet } from 'react-helmet-async';

export const HomePage = () => {
  const { deviceName, setDeviceName, deviceId, selectedFiles, clearSelectedFiles } = useConnection();
  const { addToast } = useToast();
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(deviceName);
  
  // SEO: Update document title with dynamic device name
  useEffect(() => {
    document.title = `${deviceName} | Zibra - Fast & Secure Local Network File Transfer`;
  }, [deviceName]);
  
  const handleNameEdit = () => {
    setEditingName(true);
    setTempName(deviceName);
  };
  
  const handleNameSave = () => {
    if (tempName.trim()) {
      setDeviceName(tempName);
      addToast({
        type: 'success',
        title: 'Name changed',
        description: `Your device now displays as "${tempName}". This name is saved for your future connections.`,
        duration: 3000
      });
    }
    setEditingName(false);
  };
  
  return (
    <>
      <Helmet>
        <title>{deviceName} | Zibra - Fast & Secure Local Network File Transfer</title>
        <meta name="description" content="Transfer files directly between devices on your local network with Zibra. No file size limitations, completely peer-to-peer." />
      </Helmet>
      
      <section className="container mx-auto p-4 py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-6">
          <div className="md:col-span-3 space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">
                  <h1 className="text-xl font-semibold">Your device</h1>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <DeviceAvatar deviceId={deviceId} deviceName={deviceName} size={56} />
                  
                  {editingName ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="text"
                        value={tempName}
                        onChange={e => setTempName(e.target.value)}
                        autoFocus
                        className="flex-1"
                        aria-label="Device name"
                      />
                      <Button onClick={handleNameSave} size="sm">Save</Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between flex-1">
                      <div className="space-y-1">
                        <div className="font-semibold text-lg">{deviceName}</div>
                        <div className="text-xs text-muted-foreground">ID: {deviceId.substring(0, 8)}</div>
                      </div>
                      <Button onClick={handleNameEdit} variant="outline" size="sm">Edit</Button>
                    </div>
                  )}
                </div>
                
                <div className="text-sm text-muted-foreground">
                  Share files with other devices on the same network.
                  Select up to {AppConfig.fileTransfer.maxFilesPerTransfer} files, then choose a target device.
                </div>
              </CardContent>
            </Card>
            
            <FileSelection />
          </div>
          
          <div className="md:col-span-4 space-y-6">
            <DeviceList />
            
            <Tabs defaultValue="transfers" className="w-full">
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="transfers">Transfers</TabsTrigger>
                <TabsTrigger value="received">Received files</TabsTrigger>
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
      </section>
    </>
  );
}; 