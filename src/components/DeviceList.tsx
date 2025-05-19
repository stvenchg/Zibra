import { useState, useCallback, useEffect } from 'react';
import { useConnection } from '../hooks/useConnection';
import { useToast } from './ui/toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DeviceAvatar } from './DeviceAvatar';
import { Loader2, Share2, RefreshCw } from 'lucide-react';
import { vibrateStrong, vibrateError } from '../utils/vibration';

export const DeviceList = () => {
  const { availableDevices, connectToDevice, isConnectedTo, selectedFiles, sendFiles } = useConnection();
  const { addToast } = useToast();
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState<Record<string, number>>({});
  
  // Handle sending files to selected device
  const handleSendFiles = useCallback((e: React.MouseEvent, deviceId: string) => {
    e.preventDefault();
    console.log('Envoi de fichiers vers l\'appareil:', deviceId);
    
    if (selectedFiles.length === 0) {
      vibrateError(); // Vibration d'erreur si aucun fichier sélectionné
      addToast({
        type: 'warning',
        title: 'Aucun fichier sélectionné',
        description: 'Veuillez sélectionner au moins un fichier à transférer.',
        duration: 5000
      });
      return;
    }
    
    vibrateStrong(); // Vibration forte pour indiquer le début du transfert
    setConnectingDeviceId(deviceId);
    
    // Increment the attempt counter
    setConnectionAttempts(prev => ({
      ...prev,
      [deviceId]: (prev[deviceId] || 0) + 1
    }));
    
    // Send files to the device
    try {      
      sendFiles(selectedFiles, deviceId);
      console.log('Transfert de fichier initié');
      
      // We'll let the timeout handle resetting the state
      // as the transfer progress will be tracked in TransferList
    } catch (error: unknown) {
      console.error('Échec de l\'envoi des fichiers:', error);
      setConnectingDeviceId(null);
      
      vibrateError(); // Vibration d'erreur si échec du transfert
      addToast({
        type: 'error',
        title: 'Échec de connexion',
        description: 'Impossible d\'établir la connexion avec l\'appareil.',
        duration: 5000
      });
    }
    
    // Add a timeout to reset the "connecting" state
    // if the connection doesn't establish within 20 seconds
    setTimeout(() => {
      setConnectingDeviceId(prev => {
        if (prev === deviceId) {
          if (!isConnectedTo(deviceId)) {
            vibrateError(); // Vibration d'erreur si délai dépassé
            addToast({
              type: 'error',
              title: 'Délai d\'attente dépassé',
              description: 'La connexion a pris trop de temps. Veuillez réessayer.',
              duration: 5000
            });
          }
          return null;
        }
        return prev;
      });
    }, 20000);
  }, [connectToDevice, selectedFiles, sendFiles, addToast, isConnectedTo]);
  
  // Determine the connection status of a device
  const getConnectionStatus = useCallback((deviceId: string) => {
    if (isConnectedTo(deviceId)) return 'connected';
    if (connectingDeviceId === deviceId) return 'connecting';
    return 'disconnected';
  }, [isConnectedTo, connectingDeviceId]);
  
  // Get the text to display on the button
  const getButtonText = useCallback((deviceId: string) => {
    const status = getConnectionStatus(deviceId);
    const attempts = connectionAttempts[deviceId] || 0;
    
    switch (status) {
      case 'connected':
        return 'Tranférer';
      case 'connecting':
        return 'Connexion...';
      default:
        return attempts > 0 ? 'Réessayer' : 'Tranférer';
    }
  }, [getConnectionStatus, connectionAttempts]);

  // Get appropriate button variant based on status
  const getButtonVariant = useCallback((deviceId: string) => {
    const status = getConnectionStatus(deviceId);
    
    switch (status) {
      case 'connected':
        return 'default';
      case 'connecting':
        return 'outline';
      default:
        return 'default';
    }
  }, [getConnectionStatus]);
  
  if (availableDevices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Appareils disponibles</CardTitle>
          <CardDescription>Aucun appareil trouvé sur votre réseau</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8 space-y-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-muted/50">
              <Share2 className="h-10 w-10 text-muted-foreground" />
            </div>
          </div>
          <p className="text-muted-foreground">Aucun appareil trouvé</p>
          <p className="text-sm text-muted-foreground flex items-center gap-1 justify-center">
            <span>Les appareils connectés au même réseau apparaîtront automatiquement ici.</span>
          </p>
          <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground mt-4">
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>Recherche en cours...</span>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Appareils disponibles</CardTitle>
        <CardDescription>
          {availableDevices.length} appareil{availableDevices.length > 1 ? 's' : ''} sur votre réseau
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {availableDevices.map(device => {
            const connectionStatus = getConnectionStatus(device.id);
            const isConnected = connectionStatus === 'connected';
            const isConnecting = connectionStatus === 'connecting';
            const buttonText = getButtonText(device.id);
            const buttonVariant = getButtonVariant(device.id) as any;
            const noFilesSelected = selectedFiles.length === 0;
            
            return (
              <li 
                key={device.id} 
                className="flex items-center justify-between p-3 bg-muted/30 rounded-md hover:bg-muted/40 transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${
                    isConnected ? 'bg-green-500 animate-pulse' : 
                    isConnecting ? 'bg-amber-500 animate-pulse' : 
                    'bg-orange-500'
                  }`} />
                  <DeviceAvatar deviceId={device.id} size={36} />
                  <div>
                    <div className="font-medium">{device.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <span>ID: {device.id.substring(0, 8)}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <Button 
                    variant={buttonVariant}
                    size="sm"
                    onClick={(e) => handleSendFiles(e, device.id)}
                    disabled={isConnecting || noFilesSelected}
                    className={`${isConnecting ? 'animate-pulse' : ''} min-w-[140px] transition-all duration-200`}
                    title={noFilesSelected ? "Sélectionnez un fichier" : ""}
                  >
                    {isConnecting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                    {buttonText}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}; 