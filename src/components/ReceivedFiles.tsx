import { useConnection } from '../hooks/useConnection';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Download, Inbox } from 'lucide-react';
import { vibrateMedium } from '../utils/vibration';

export const ReceivedFiles = () => {
  const { incomingFiles, downloadFile } = useConnection();
  
  // Fonction modifiée pour inclure une vibration lors du téléchargement
  const handleDownload = (fileId: string) => {
    vibrateMedium(); // Vibration lors du téléchargement
    downloadFile(fileId);
  };
  
  // Filter files keeping only those with valid data
  const validFiles = incomingFiles.filter(file => {
    // Keep files that have a size and chunks, or that are marked as completed
    return (file.receivedSize > 0 && file.chunks.length > 0) || file.status === 'completed';
  });
  
  if (validFiles.length === 0) {
    return (
      <Card>
        {/* <CardHeader>
          <CardTitle className="text-xl">Fichiers reçus</CardTitle>
          <CardDescription>Fichiers envoyés par d'autres appareils</CardDescription>
        </CardHeader> */}
        <CardContent className="text-center py-8 space-y-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-muted/50">
              <Inbox className="h-10 w-10 text-muted-foreground" />
            </div>
          </div>
          <p className="text-muted-foreground">Aucun fichier reçu</p>
          <p className="text-sm text-muted-foreground flex items-center gap-1 justify-center">
            <span>Les fichiers que vous recevez apparaîtront ici pour téléchargement.</span>
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

  // Format date - using current date as placeholder since we don't have a timestamp yet
  const formatDate = (): string => {
    const date = new Date();
    return date.toLocaleString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <Card>
      {/* <CardHeader>
        <CardTitle className="text-xl">Fichiers reçus</CardTitle>
        <CardDescription>
          {validFiles.length} fichier{validFiles.length > 1 ? 's' : ''} reçu{validFiles.length > 1 ? 's' : ''}
        </CardDescription>
      </CardHeader> */}
      <CardContent>
        <ul className="space-y-3">
          {[...validFiles].reverse().map((file, index) => (
            <li key={`${file.id}-${index}`} className="p-3 bg-muted/30 rounded-md hover:bg-muted/40 transition-all duration-200">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-medium">{file.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatSize(file.size || file.receivedSize)}
                  </div>
                  <div className="text-xs mt-1 flex flex-col gap-0.5">
                    <div><span className="font-medium">De:</span> {file.from}</div>
                    <div><span className="font-medium">Reçu le:</span> {formatDate()}</div>
                  </div>
                </div>
                
                {file.status === 'completed' && (
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(file.id)}
                    aria-label={`Télécharger ${file.name}`}
                    className="gap-1"
                  >
                    <Download size={14} />
                    Télécharger
                  </Button>
                )}
              </div>
              
              {file.status === 'receiving' && (
                <div className="space-y-1">
                  <Progress 
                    value={file.progress} 
                    className="h-2" 
                    animated={true}
                  />
                  <div className="flex justify-end text-xs text-muted-foreground">
                    {file.progress}%
                  </div>
                </div>
              )}
              
              {file.status === 'failed' && (
                <Badge variant="destructive">Échec</Badge>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}; 