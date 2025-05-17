import { useConnection } from '../hooks/useConnection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

export const TransferList = () => {
  const { fileTransfers } = useConnection();
  
  if (fileTransfers.length === 0) {
    return null;
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
      <CardHeader>
        <CardTitle className="text-xl">Transferts actifs</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {fileTransfers.map(transfer => (
            <li key={transfer.id} className="p-3 bg-muted/30 rounded-md">
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
                <Progress value={transfer.progress} className="h-2" />
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