import { useState, useCallback } from 'react';
import { useConnection } from '../hooks/useConnection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

export const FileTransfer = ({ targetDeviceId }: { targetDeviceId: string }) => {
  const { sendFile, availableDevices } = useConnection();
  const [isDragging, setIsDragging] = useState(false);
  
  const targetDevice = availableDevices.find(device => device.id === targetDeviceId);
  
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      sendFile(file, targetDeviceId);
    }
  }, [sendFile, targetDeviceId]);
  
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      sendFile(file, targetDeviceId);
    }
  }, [sendFile, targetDeviceId]);
  
  if (!targetDevice) {
    return (
      <Card className="text-center p-4">
        <CardContent>
          <p className="text-muted-foreground">Appareil non disponible</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Envoyer à {targetDevice.name}</CardTitle>
      </CardHeader>
      
      <CardContent>
        <div 
          className={`border-2 border-dashed rounded-lg p-10 text-center ${
            isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center gap-3">
            <Upload className="h-12 w-12 text-muted-foreground/70" />
            <p className="text-muted-foreground">Glissez et déposez un fichier ici</p>
            <p className="text-xs text-muted-foreground">ou</p>
            <Button
              variant="outline"
              className="relative"
              onClick={() => document.getElementById('file-select')?.click()}
            >
              Sélectionner un fichier
              <input 
                id="file-select"
                type="file" 
                onChange={handleFileSelect} 
                className="sr-only"
              />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}; 