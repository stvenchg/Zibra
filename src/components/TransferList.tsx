import { useConnection } from '../hooks/useConnection';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Send, ArrowUpDown } from 'lucide-react';

export const TransferList = () => {
  const { fileTransfers } = useConnection();
  
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

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'completed':
        return <Badge variant="default">Terminé</Badge>;
      case 'failed':
        return <Badge variant="destructive">Échec</Badge>;
      case 'pending':
        return <Badge variant="secondary">En attente</Badge>;
      default:
        return <Badge variant="outline">Envoi</Badge>;
    }
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
                  <div className="text-sm text-muted-foreground">
                    {formatSize(transfer.fileSize)}
                  </div>
                </div>
                <div>
                  {getStatusBadge(transfer.status)}
                </div>
              </div>
              
              <div className="space-y-1">
                <Progress 
                  value={transfer.progress} 
                  className="h-2" 
                  animated={transfer.status === 'transferring'} 
                />
                <div className="flex justify-end text-xs text-muted-foreground">
                  {transfer.status === 'completed' 
                    ? 'Terminé' 
                    : transfer.status === 'failed'
                      ? 'Échec'
                      : `${transfer.progress}%`}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}; 