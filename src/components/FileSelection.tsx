import { useState, useCallback } from 'react';
import { useConnection } from '../hooks/useConnection';
import { useToast } from './ui/toast';
import { AppConfig } from '../config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { X, Upload, FileIcon, AlertCircle } from 'lucide-react';
import { vibrateLight, vibrateMedium, vibrateError } from '../utils/vibration';

export const FileSelection = () => {
  const { selectedFiles, addSelectedFile, removeSelectedFile, clearSelectedFiles } = useConnection();
  const { addToast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  
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
      const files = Array.from(e.dataTransfer.files);
      const remainingSlots = AppConfig.fileTransfer.maxFilesPerTransfer - selectedFiles.length;
      
      if (remainingSlots <= 0) {
        vibrateError();
        addToast({
          type: 'warning',
          title: 'Maximum number of files reached',
          description: `You can select up to ${AppConfig.fileTransfer.maxFilesPerTransfer} files at once.`,
          duration: 5000
        });
        return;
      }
      
      // Add only as many files as we have slots for
      const filesToAdd = files.slice(0, remainingSlots);
      let addedCount = 0;
      let oversizedCount = 0;
      
      filesToAdd.forEach(file => {
        if (file.size > AppConfig.fileTransfer.maxFileSize) {
          oversizedCount++;
        } else {
          addSelectedFile(file);
          addedCount++;
        }
      });
      
      if (oversizedCount > 0) {
        vibrateError();
        addToast({
          type: 'error',
          title: 'Files too large',
          description: `${oversizedCount} file(s) exceed the maximum size of ${(AppConfig.fileTransfer.maxFileSize / (1024 * 1024)).toFixed(0)} MB.`,
          duration: 5000
        });
      }
      
      if (addedCount > 0) {
        vibrateMedium();
      }
    }
  }, [addSelectedFile, selectedFiles.length, addToast]);
  
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const remainingSlots = AppConfig.fileTransfer.maxFilesPerTransfer - selectedFiles.length;
      
      if (remainingSlots <= 0) {
        vibrateError();
        addToast({
          type: 'warning',
          title: 'Maximum number of files reached',
          description: `You can select up to ${AppConfig.fileTransfer.maxFilesPerTransfer} files at once.`,
          duration: 5000
        });
        return;
      }
      
      // Add only as many files as we have slots for
      const filesToAdd = files.slice(0, remainingSlots);
      let addedCount = 0;
      let oversizedCount = 0;
      
      filesToAdd.forEach(file => {
        if (file.size > AppConfig.fileTransfer.maxFileSize) {
          oversizedCount++;
        } else {
          addSelectedFile(file);
          addedCount++;
        }
      });
      
      if (oversizedCount > 0) {
        vibrateError();
        addToast({
          type: 'error',
          title: 'Files too large',
          description: `${oversizedCount} file(s) exceed the maximum size of ${(AppConfig.fileTransfer.maxFileSize / (1024 * 1024)).toFixed(0)} MB.`,
          duration: 5000
        });
      }
      
      if (addedCount > 0) {
        vibrateMedium();
      }
      
      // Reset the input so the same file can be selected again
      e.target.value = '';
    }
  }, [addSelectedFile, selectedFiles.length, addToast]);
  
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  const handleRemoveFile = (fileId: string) => {
    vibrateLight();
    removeSelectedFile(fileId);
  };
  
  const handleClearFiles = () => {
    vibrateMedium();
    clearSelectedFiles();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">File Selection</CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {selectedFiles.length > 0 ? (
          <>
            <ul className="space-y-2">
              {selectedFiles.map(file => (
                <li 
                  key={file.id} 
                  className="flex items-center justify-between bg-muted/40 p-2 rounded-md hover:bg-muted/60 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileIcon className="shrink-0 h-5 w-5 text-muted-foreground mr-1" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{file.name}</div>
                      <div className="text-xs text-muted-foreground">{formatSize(file.size)}</div>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 rounded-full transition-colors"
                    onClick={() => handleRemoveFile(file.id)}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X size={16} />
                  </Button>
                </li>
              ))}
            </ul>
            
            <div className="flex items-center justify-between">
              <div>
                {selectedFiles.length >= AppConfig.fileTransfer.maxFilesPerTransfer ? (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200">
                    Maximum reached ({AppConfig.fileTransfer.maxFilesPerTransfer})
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    {selectedFiles.length} / {AppConfig.fileTransfer.maxFilesPerTransfer} files
                  </Badge>
                )}
              </div>
              
              <Button 
                onClick={handleClearFiles}
                variant="destructive"
                size="sm"
                className="!hover:bg-red-200 transition-colors"
              >
                Remove all
              </Button>
            </div>
            
            {selectedFiles.length < AppConfig.fileTransfer.maxFilesPerTransfer && (
              <div 
                className={`mt-4 border-2 border-dashed rounded-lg p-6 text-center ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                } transition-colors`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-10 w-10 text-muted-foreground/70" />
                  <p className="text-sm text-muted-foreground">Drag more files here</p>
                  <p className="text-xs text-muted-foreground">or</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="relative"
                    onClick={() => document.getElementById('add-more-files')?.click()}
                  >
                    Browse
                    <input 
                      id="add-more-files"
                      type="file" 
                      onChange={handleFileSelect} 
                      className="sr-only"
                      multiple
                    />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div 
            className={`border-2 border-dashed rounded-lg p-10 text-center ${
              isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            } transition-colors`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 rounded-full bg-muted/50">
                <Upload className="h-10 w-10 text-muted-foreground/70" />
              </div>
              <p className="text-muted-foreground">Drag and drop your files here</p>
              <p className="text-xs text-muted-foreground">or</p>
              <Button
                variant="outline"
                className="relative"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                Select files
                <input 
                  id="file-upload"
                  type="file" 
                  onChange={handleFileSelect} 
                  className="sr-only"
                  multiple
                />
              </Button>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <AlertCircle size={14} />
                <span>Max size {(AppConfig.fileTransfer.maxFileSize / (1024 * 1024 * 1024)).toFixed(1)} GB per file</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 