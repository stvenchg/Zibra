import { useState, useCallback } from 'react';
import { useConnection } from '../hooks/useConnection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const DeviceList = () => {
  const { availableDevices, connectToDevice, isConnectedTo, selectedFiles, sendFiles } = useConnection();
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState<Record<string, number>>({});
  
  // Handle sending files to selected device
  const handleSendFiles = useCallback((e: React.MouseEvent, deviceId: string) => {
    e.preventDefault();
    console.log('Envoi de fichiers vers l\'appareil:', deviceId);
    
    if (selectedFiles.length === 0) {
      alert('Veuillez sélectionner au moins un fichier à transférer.');
      return;
    }
    
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
    }
    
    // Add a timeout to reset the "connecting" state
    // if the connection doesn't establish within 20 seconds
    setTimeout(() => {
      setConnectingDeviceId(prev => prev === deviceId ? null : prev);
    }, 20000);
  }, [connectToDevice, selectedFiles, sendFiles]);
  
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
        return 'Envoyer les fichiers';
      case 'connecting':
        return attempts > 1 ? `Connexion (Essai ${attempts})...` : 'Connexion...';
      default:
        return attempts > 0 ? 'Réessayer' : 'Envoyer les fichiers';
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
        return 'secondary';
    }
  }, [getConnectionStatus]);
  
  if (availableDevices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Appareils disponibles</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">Aucun appareil détecté sur le réseau.</p>
          <p className="text-muted-foreground text-sm mt-1">Les appareils connectés au même réseau apparaîtront automatiquement ici.</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Appareils disponibles</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {availableDevices.map(device => {
            const connectionStatus = getConnectionStatus(device.id);
            const isConnected = connectionStatus === 'connected';
            const isConnecting = connectionStatus === 'connecting';
            const buttonText = getButtonText(device.id);
            const buttonVariant = getButtonVariant(device.id) as any;
            
            return (
              <li 
                key={device.id} 
                className="flex items-center justify-between p-3 bg-muted/30 rounded-md"
              >
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${
                    isConnected ? 'bg-green-500' : 
                    isConnecting ? 'bg-amber-500' : 
                    'bg-muted-foreground/50'
                  }`} />
                  <div>
                    <div className="font-medium">{device.name}</div>
                    <div className="text-xs text-muted-foreground">ID: {device.id.substring(0, 8)}</div>
                  </div>
                </div>
                
                <div>
                  {isConnecting && (
                    <div className="text-xs text-muted-foreground mb-1 text-right">
                      Établissement de la connexion...
                    </div>
                  )}
                  <Button 
                    variant={buttonVariant}
                    size="sm"
                    onClick={(e) => handleSendFiles(e, device.id)}
                    disabled={isConnecting}
                    className={isConnecting ? 'animate-pulse' : ''}
                  >
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