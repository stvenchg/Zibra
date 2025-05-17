import { useConnection } from '../hooks/useConnection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';

export const ReceivedFiles = () => {
  const { incomingFiles, downloadFile } = useConnection();
  
  // Filter files keeping only those with valid data
  const validFiles = incomingFiles.filter(file => {
    // Keep files that have a size and chunks, or that are marked as completed
    return (file.receivedSize > 0 && file.chunks.length > 0) || file.status === 'completed';
  });
  
  if (validFiles.length === 0) {
    return null;
  }
  
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Fichiers reçus</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {validFiles.map((file, index) => (
            <li key={`${file.id}-${index}`} className="p-3 bg-muted/30 rounded-md">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-medium">{file.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatSize(file.size || file.receivedSize)}
                  </div>
                  <div className="text-xs mt-1">De: {file.from}</div>
                </div>
                
                {file.status === 'completed' && (
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => downloadFile(file.id)}
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
                  <Progress value={file.progress} className="h-2" />
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