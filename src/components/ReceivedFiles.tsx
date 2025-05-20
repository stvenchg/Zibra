import { useConnection } from '../hooks/useConnection';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Download, Inbox, Clock } from 'lucide-react';
import { vibrateMedium } from '../utils/vibration';
import { useState, useEffect } from 'react';

export const ReceivedFiles = () => {
  const { incomingFiles, downloadFile } = useConnection();
  const [now, setNow] = useState<number>(Date.now());
  
  // Update current time every second for estimates
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Modified function to include vibration when downloading
  const handleDownload = (fileId: string) => {
    vibrateMedium(); // Vibration when downloading
    downloadFile(fileId);
  };
  
  // Filter files keeping only those with valid data
  const validFiles = incomingFiles.filter(file => {
    // Keep files that have a size and chunks, or that are marked as completed
    return (file.receivedSize > 0 && file.chunks.length > 0) || 
           file.status === 'completed' || file.status === 'canceled';
  });
  
  if (validFiles.length === 0) {
    return (
      <Card>
        {/* <CardHeader>
          <CardTitle className="text-xl">Received Files</CardTitle>
          <CardDescription>Files sent by other devices</CardDescription>
        </CardHeader> */}
        <CardContent className="text-center py-8 space-y-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-muted/50">
              <Inbox className="h-10 w-10 text-muted-foreground/70" />
            </div>
          </div>
          <p className="text-muted-foreground">No files received</p>
          <p className="text-sm text-muted-foreground flex items-center gap-1 justify-center">
            <span>Files you receive will appear here for download.</span>
          </p>
        </CardContent>
      </Card>
    );
  }
  
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  const formatSizeProgress = (receivedSize: number, totalSize: number): string => {
    if (totalSize === 0) return formatSize(receivedSize);
    
    if (totalSize < 1024 * 1024) {
      // Display in KB
      const receivedKo = (receivedSize / 1024).toFixed(1);
      const totalKo = (totalSize / 1024).toFixed(1);
      return `${receivedKo} / ${totalKo} KB`;
    } else {
      // Display in MB
      const receivedMo = (receivedSize / (1024 * 1024)).toFixed(1);
      const totalMo = (totalSize / (1024 * 1024)).toFixed(1);
      return `${receivedMo} / ${totalMo} MB`;
    }
  };
  
  const formatTimeRemaining = (ms?: number): string => {
    if (!ms) return '...';
    
    // Convert milliseconds to seconds
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
      return `${bytesPerSecond.toFixed(0)} B/s`;
    } else if (bytesPerSecond < 1024 * 1024) {
      return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    } else {
      return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
    }
  };

  // Format date - using current date as placeholder since we don't have a timestamp yet
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', { 
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
        <CardTitle className="text-xl">Received Files</CardTitle>
        <CardDescription>
          {validFiles.length} file{validFiles.length > 1 ? 's' : ''} received
        </CardDescription>
      </CardHeader> */}
      <CardContent>
        <ul className="space-y-3">
          {[...validFiles].reverse().map((file, index) => (
            <li key={`${file.id}-${index}`} className={`p-3 bg-muted/30 rounded-md hover:bg-muted/40 transition-all duration-200 ${
              file.status === 'canceled' ? 'opacity-75' : ''
            }`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-medium">{file.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {file.status === 'receiving' 
                      ? formatSizeProgress(file.receivedSize, file.size || 0) 
                      : formatSize(file.size || file.receivedSize)}
                  </div>
                  <div className="text-xs mt-1 flex flex-col gap-0.5">
                    <div><span className="font-medium">From:</span> {file.from}</div>
                    <div><span className="font-medium">Received:</span> {formatDate(file.timestamp)}</div>
                  </div>
                </div>
                
                {file.status === 'completed' && (
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(file.id)}
                    aria-label={`Download ${file.name}`}
                    className="gap-1"
                  >
                    <Download size={14} />
                    Download
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
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      {file.estimatedTimeRemaining && (
                        <>
                          <Clock className="h-3 w-3" />
                          <span>{formatTimeRemaining(file.estimatedTimeRemaining)}</span>
                          {file.speed && <span className="ml-2">{formatSpeed(file.speed)}</span>}
                        </>
                      )}
                    </div>
                    <div>
                      {file.progress}%
                    </div>
                  </div>
                </div>
              )}
              
              {file.status === 'failed' && (
                <Badge variant="destructive">Failed</Badge>
              )}

              {file.status === 'canceled' && (
                <Badge variant="canceled">Canceled by sender</Badge>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}; 