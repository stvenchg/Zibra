import { useState, useCallback, useEffect, useRef } from 'react';
import { useConnection } from '../hooks/useConnection';
import { useToast } from './ui/toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DeviceAvatar } from './DeviceAvatar';
import { Loader2, Share2, RefreshCw, Search, Wifi } from 'lucide-react';
import { vibrateStrong, vibrateError } from '../utils/vibration';

export const DeviceList = () => {
  const { availableDevices, connectToDevice, isConnectedTo, selectedFiles, sendFiles, fileTransfers } = useConnection();
  const { addToast } = useToast();
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState<Record<string, number>>({});
  // État pour suivre les appareils vers lesquels il y a des transferts actifs
  const [activeTransferDevices, setActiveTransferDevices] = useState<Record<string, boolean>>({});
  // Pour stocker les timers de rafraîchissement
  const transferTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
  
  // Mettre à jour l'état des transferts actifs quand fileTransfers change
  useEffect(() => {
    // Trouver les appareils avec des transferts actifs
    const devicesWithActiveTransfers: Record<string, boolean> = {};
    
    fileTransfers.forEach(transfer => {
      // Si le transfert est en cours et a un appareil cible
      if (
        (transfer.status === 'transferring' || transfer.status === 'pending') && 
        transfer.targetDevice
      ) {
        devicesWithActiveTransfers[transfer.targetDevice] = true;
        
        // Annuler tout timer existant pour cet appareil
        if (transferTimersRef.current[transfer.targetDevice]) {
          clearTimeout(transferTimersRef.current[transfer.targetDevice]);
          delete transferTimersRef.current[transfer.targetDevice];
        }
      }
      
      // Si le transfert vient de se terminer, ajouter un délai avant de le retirer
      if (
        (transfer.status === 'completed' || transfer.status === 'failed' || transfer.status === 'canceled') &&
        transfer.targetDevice
      ) {
        // Vérifier si ce dispositif était précédemment marqué comme actif
        const wasActive = activeTransferDevices[transfer.targetDevice];
        
        if (wasActive && !devicesWithActiveTransfers[transfer.targetDevice]) {
          // Configurer un timer pour retirer l'appareil après un délai
          if (!transferTimersRef.current[transfer.targetDevice]) {
            transferTimersRef.current[transfer.targetDevice] = setTimeout(() => {
              setActiveTransferDevices(prev => {
                const updated = { ...prev };
                delete updated[transfer.targetDevice!];
                return updated;
              });
              delete transferTimersRef.current[transfer.targetDevice!];
            }, 100); // Délai de 100ms pour laisser le temps à l'UI de se stabiliser
          }
        }
      }
    });
    
    // Mettre à jour l'état avec les appareils qui ont des transferts actifs
    // mais préserver ceux qui ont des timers en cours
    setActiveTransferDevices(prev => {
      const newState = { ...prev };
      
      // Ajouter les nouveaux appareils avec transferts actifs
      Object.keys(devicesWithActiveTransfers).forEach(deviceId => {
        newState[deviceId] = true;
      });
      
      // Conserver uniquement les appareils avec des transferts actifs ou des timers en cours
      return Object.keys(newState).reduce((acc, deviceId) => {
        // Si l'appareil a un transfert actif ou un timer en cours, le conserver
        if (devicesWithActiveTransfers[deviceId] || transferTimersRef.current[deviceId]) {
          acc[deviceId] = true;
        }
        return acc;
      }, {} as Record<string, boolean>);
    });
  }, [fileTransfers]);

  // Nettoyer les timers lors du démontage du composant
  useEffect(() => {
    return () => {
      Object.values(transferTimersRef.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  // Vérifier si un transfert est en cours vers un appareil spécifique
  const hasActiveTransferTo = useCallback((deviceId: string) => {
    // Vérifier d'abord l'état local pour une réponse immédiate
    if (activeTransferDevices[deviceId]) {
      return true;
    }
    
    // Vérifier ensuite les transferts eux-mêmes (approche plus lente mais complète)
    return fileTransfers.some(
      transfer => 
        transfer.targetDevice === deviceId && 
        (transfer.status === 'transferring' || transfer.status === 'pending')
    );
  }, [fileTransfers, activeTransferDevices]);

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
    
    // Marquer immédiatement cet appareil comme ayant un transfert actif
    setActiveTransferDevices(prev => ({
      ...prev,
      [deviceId]: true
    }));
    
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
      
      // Supprimer l'état de transfert actif en cas d'erreur
      setActiveTransferDevices(prev => {
        const updated = { ...prev };
        delete updated[deviceId];
        return updated;
      });
      
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
    // Si un transfert est actif vers cet appareil, afficher "Transfert..."
    if (hasActiveTransferTo(deviceId)) {
      return 'Transfert...';
    }
    
    const status = getConnectionStatus(deviceId);
    const attempts = connectionAttempts[deviceId] || 0;
    
    switch (status) {
      case 'connected':
        return 'Transférer';
      case 'connecting':
        return 'Connexion...';
      default:
        return attempts > 0 ? 'Réessayer' : 'Transférer';
    }
  }, [getConnectionStatus, connectionAttempts, hasActiveTransferTo]);

  // Get appropriate button variant based on status
  const getButtonVariant = useCallback((deviceId: string) => {
    const status = getConnectionStatus(deviceId);
    
    // Si un transfert est actif, utiliser une variante désactivée
    if (hasActiveTransferTo(deviceId)) {
      return 'outline';
    }
    
    switch (status) {
      case 'connected':
        return 'default';
      case 'connecting':
        return 'outline';
      default:
        return 'default';
    }
  }, [getConnectionStatus, hasActiveTransferTo]);
  
  // Vérifier si le bouton doit être désactivé
  const isButtonDisabled = useCallback((deviceId: string) => {
    const isConnecting = connectingDeviceId === deviceId;
    const noFilesSelected = selectedFiles.length === 0;
    const isTransfering = hasActiveTransferTo(deviceId);
    
    return isConnecting || noFilesSelected || isTransfering;
  }, [connectingDeviceId, selectedFiles.length, hasActiveTransferTo]);
  
  if (availableDevices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Appareils disponibles</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 space-y-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-muted/20 animate-pulse-expand relative">
              <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse opacity-75"></div>
              <Wifi className="h-10 w-10 text-muted-foreground" />
            </div>
          </div>
          <p className="text-muted-foreground mt-4">Recherche en cours</p>
          <p className="text-sm text-muted-foreground flex items-center gap-1 justify-center">
            <span>Les appareils connectés au même réseau apparaîtront automatiquement ici.</span>
          </p>
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
            const isTransfering = hasActiveTransferTo(device.id);
            const buttonText = getButtonText(device.id);
            const buttonVariant = getButtonVariant(device.id) as any;
            const buttonDisabled = isButtonDisabled(device.id);
            
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
                  <DeviceAvatar deviceId={device.id} deviceName={device.name} size={36} />
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
                    disabled={buttonDisabled}
                    className={`${isConnecting || isTransfering ? 'animate-pulse' : ''} min-w-[140px] transition-all duration-200`}
                    title={selectedFiles.length === 0 ? "Sélectionnez un fichier" : isTransfering ? "Transfert en cours" : ""}
                  >
                    {(isConnecting || isTransfering) && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
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