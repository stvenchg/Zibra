import { useConnection } from '../hooks/useConnection';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Send, ArrowUpDown, XCircle, X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { vibrateMedium } from '../utils/vibration';
import type { FileTransfer } from '../types/connection.types';
import { useEffect, useState } from 'react';

export const TransferList = () => {
  const { fileTransfers, cancelFileTransfer } = useConnection();
  const [now, setNow] = useState<number>(Date.now());
  
  // Mettre à jour le temps actuel toutes les secondes pour les estimations
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  if (fileTransfers.length === 0) {
    return (
      <Card>
        {/* <CardHeader>
          <CardTitle className="text-xl">Transferts</CardTitle>
          <CardDescription>Historique des fichiers envoyés</CardDescription>
        </CardHeader> */}
        <CardContent className="text-center py-8 space-y-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-muted/50">
              <ArrowUpDown className="h-10 w-10 text-muted-foreground/70" />
            </div>
          </div>
          <p className="text-muted-foreground">Aucun transfert</p>
          <p className="text-sm text-muted-foreground flex items-center gap-1 justify-center">
            <span>Les fichiers que vous envoyez apparaîtront ici avec leur état.</span>
          </p>
        </CardContent>
      </Card>
    );
  }
  
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit',
      hour: '2-digit', 
      minute: '2-digit'
    });
  };
  
  const formatTimeRemaining = (ms?: number): string => {
    if (!ms) return '...';
    
    // Convertir les millisecondes en secondes
    const seconds = Math.floor(ms / 1000);
    
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const remainingMinutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${remainingMinutes}m`;
    }
  };
  
  const formatSpeed = (bytesPerSecond?: number): string => {
    if (!bytesPerSecond) return '';
    
    if (bytesPerSecond < 1024) {
      return `${bytesPerSecond.toFixed(0)} o/s`;
    } else if (bytesPerSecond < 1024 * 1024) {
      return `${(bytesPerSecond / 1024).toFixed(1)} Ko/s`;
    } else {
      return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} Mo/s`;
    }
  };

  const handleCancelTransfer = (transferId: string) => {
    vibrateMedium();
    cancelFileTransfer(transferId);
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'completed':
        return <Badge variant="default">Terminé</Badge>;
      case 'failed':
        return <Badge variant="destructive">Échec</Badge>;
      case 'pending':
        return <Badge variant="secondary">En attente</Badge>;
      case 'canceled':
        return <Badge variant="canceled">Annulé</Badge>;
      default:
        return <Badge variant="outline">Envoi</Badge>;
    }
  };
  
  const showProgressBar = (transfer: FileTransfer): boolean => {
    return transfer.status !== 'canceled' && transfer.status !== 'failed' && transfer.status !== 'completed';
  };

  return (
    <Card>
      {/* <CardHeader>
        <CardTitle className="text-xl">Transferts</CardTitle>
        <CardDescription>
          {fileTransfers.length} fichier{fileTransfers.length > 1 ? 's' : ''} dans l'historique
        </CardDescription>
      </CardHeader> */}
      <CardContent>
        <ul className="space-y-3">
          {[...fileTransfers].reverse().map(transfer => (
            <li key={transfer.id} className="p-3 bg-muted/30 rounded-md hover:bg-muted/40 transition-all duration-200">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-medium">{transfer.fileName}</div>
                  <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
                    <div>{formatSize(transfer.fileSize)}</div>
                    <div className="text-xs">À: {transfer.targetDeviceName || 'Appareil inconnu'}</div>
                    <div className="text-xs">Le: {formatDate(transfer.timestamp)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(transfer.status === 'transferring' || transfer.status === 'pending') && (
                    <Button
                      variant="ghost" 
                      size="sm"
                      className="hover:bg-red-50 transition-colors flex items-center gap-1.5"
                      onClick={() => handleCancelTransfer(transfer.id)}
                      title="Annuler le transfert"
                    >
                      <span className="text-xs">Annuler</span>
                    </Button>
                  )}
                  {getStatusBadge(transfer.status)}
                </div>
              </div>
              
              {showProgressBar(transfer) && (
                <div className="space-y-1">
                  <Progress 
                    value={transfer.progress} 
                    className="h-2" 
                    animated={transfer.status === 'transferring'} 
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      {transfer.status === 'transferring' && transfer.estimatedTimeRemaining && (
                        <>
                          <Clock className="h-3 w-3" />
                          <span>{formatTimeRemaining(transfer.estimatedTimeRemaining)}</span>
                          {transfer.speed && <span className="ml-2">{formatSpeed(transfer.speed)}</span>}
                        </>
                      )}
                    </div>
                    <div>
                      {transfer.status === 'completed' 
                        ? 'Terminé' 
                        : transfer.status === 'failed'
                          ? 'Échec'
                          : transfer.status === 'canceled'
                            ? 'Annulé'
                            : `${transfer.progress}%`}
                    </div>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}; 