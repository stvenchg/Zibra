import type { FileTransfer, IncomingFile } from '../types/connection.types';
import { AppConfig } from '../config';
import { vibrateSuccess, vibrateNotification, vibrateError } from '../utils/vibration';

export class FileTransferService {
  private fileTransfers: FileTransfer[] = [];
  private incomingFiles: IncomingFile[] = [];
  private pendingChunksRef: Record<string, Array<ArrayBuffer>> = {};
  private recentlyCreatedFilesRef: Set<string> = new Set();
  private pendingChunkFileIdRef: string | null = null;
  private deviceName: string;
  private peerService: any; // Service for sending data via WebRTC
  private activeTransfers: Set<string> = new Set(); // To track active transfers that can be canceled

  constructor(deviceName: string, peerService: any) {
    this.deviceName = deviceName;
    this.peerService = peerService;
  }

  // Update device name
  updateDeviceName(name: string) {
    this.deviceName = name;
  }

  // Get list of active transfers
  getFileTransfers(): FileTransfer[] {
    return this.fileTransfers;
  }

  // Get list of incoming files
  getIncomingFiles(): IncomingFile[] {
    return this.incomingFiles;
  }

  // Update list of transfers
  setFileTransfers(transfers: FileTransfer[]) {
    this.fileTransfers = transfers;
  }

  // Update list of incoming files
  setIncomingFiles(files: IncomingFile[]) {
    this.incomingFiles = files;
  }

  // Apply pending chunks for a file
  applyPendingChunks(fileId: string) {
    // Create a local copy of the chunk array
    const pendingChunksForFile = this.pendingChunksRef[fileId];
    
    // Immediate cleanup
    delete this.pendingChunksRef[fileId];
    
    if (!pendingChunksForFile || !Array.isArray(pendingChunksForFile) || pendingChunksForFile.length === 0) {
      console.log(`No pending chunks for file ${fileId} or invalid format`);
      return; // No chunks to apply or invalid format
    }
    
    console.log(`Applying ${pendingChunksForFile.length} pending chunks for file ${fileId}`);
    
    const fileIndex = this.incomingFiles.findIndex(f => f.id === fileId);
    if (fileIndex === -1) {
      console.warn(`Cannot apply pending chunks: file ${fileId} not found`);
      return;
    }
    
    try {
      const file = this.incomingFiles[fileIndex];
      let receivedSize = file.receivedSize;
      const newChunks = [...file.chunks];
      
      // Add all pending chunks
      for (let i = 0; i < pendingChunksForFile.length; i++) {
        try {
          const chunk = pendingChunksForFile[i];
          if (chunk && chunk.byteLength) {
            newChunks.push(chunk);
            receivedSize += chunk.byteLength;
          }
        } catch (err) {
          console.error(`Error processing a chunk for ${fileId}:`, err);
          // Continue with other chunks
        }
      }
      
      const knownFileSize = file.size || receivedSize;
      const progress = Math.min(100, Math.floor((receivedSize / knownFileSize) * 100));
      
      console.log(`Progress after applying pending chunks for ${file.name}: ${progress}% (${receivedSize}/${knownFileSize} bytes)`);
      
      // Update the file with all pending chunks
      const updatedFiles = [...this.incomingFiles];
      updatedFiles[fileIndex] = {
        ...file,
        chunks: newChunks,
        receivedSize,
        progress
      };
      
      // Immediate update of state
      this.incomingFiles = updatedFiles;
      
      // Force update of files to refresh UI
      setTimeout(() => this.setIncomingFiles([...this.incomingFiles]), 100);
    } catch (err) {
      console.error(`Error applying chunks for ${fileId}:`, err);
    }
  }

  // Clean up duplicate files
  cleanupDuplicateFiles() {
    // Group files by ID
    const filesById = new Map();
    
    // Analyze all files
    for (const file of this.incomingFiles) {
      // If this file already exists, merge properties
      if (filesById.has(file.id)) {
        const existingFile = filesById.get(file.id);
        
        // Take non-null file size
        const mergedFile = {
          ...existingFile,
          size: file.size || existingFile.size,
          from: file.from !== 'unknown' ? file.from : existingFile.from,
          chunks: existingFile.chunks.length > file.chunks.length ? 
                 existingFile.chunks : file.chunks,
          receivedSize: Math.max(existingFile.receivedSize, file.receivedSize),
          status: existingFile.status === 'completed' || file.status === 'completed' ?
                 'completed' : existingFile.status
        };
        
        filesById.set(file.id, mergedFile);
      } else {
        filesById.set(file.id, file);
      }
    }
    
    // Convert map to array
    this.incomingFiles = Array.from(filesById.values());
  }

  // Download a received file
  downloadFile(fileId: string): boolean {
    try {
      const file = this.incomingFiles.find(f => f.id === fileId);
      if (!file) {
        console.error('File not found:', fileId);
        return false;
      }
      
      // Check if the file is completed
      if (file.status !== 'completed') {
        if (file.status === 'canceled') {
          console.error('Cannot download a canceled file');
          alert('This file was canceled by the sender and cannot be downloaded.');
        } else {
          console.warn('File is not complete yet');
        }
        return false;
      }
      
      if (!file.chunks.length) {
        console.error('File has no data chunks');
        alert('Unable to download file: No data received');
        return false;
      }
      
      // Log some debugging info
      console.log(`Preparing to download file: ${file.name}`);
      console.log(`Number of chunks: ${file.chunks.length}`);
      console.log(`Total received size: ${file.receivedSize} bytes`);
      console.log(`Expected size: ${file.size} bytes`);
      
      // Concatenate all chunks
      const fileBlob = new Blob(file.chunks, { type: 'application/octet-stream' });
      console.log(`Created blob of size: ${fileBlob.size} bytes`);
      
      if (fileBlob.size === 0) {
        console.error('File blob is empty');
        alert('Unable to download file: Generated file is empty');
        return false;
      }
      
      // Create a download link
      const url = URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      console.log('File download initiated:', file.name);
      return true;
    } catch (error: any) {
      console.error('Error downloading file:', error);
      alert(`Error downloading file: ${error.message || 'Unknown error'}`);
      return false;
    }
  }

  // Handle incoming data received via WebRTC
  handleIncomingData(data: any) {
    try {
      // If data is a string, it's probably a control message (JSON)
      if (typeof data === 'string') {
        const message = JSON.parse(data);
        console.log('Received message:', message.type);
        
        switch (message.type) {
          case 'file-info': {
            this.handleFileInfo(message);
            break;
          }
          
          case 'file-chunk': {
            // Set which file is expecting the chunk data
            console.log('Expecting chunk data for file:', message.id);
            this.pendingChunkFileIdRef = message.id;
            break;
          }
          
          case 'file-complete': {
            this.handleFileComplete(message.id);
            break;
          }
          
          case 'file-canceled': {
            this.handleFileCanceled(message.id, message.name);
            break;
          }
          
          default:
            console.warn('Unknown message type:', message.type);
        }
      } else {
        // Binary data (file chunk)
        this.handleBinaryData(data);
      }
    } catch (error) {
      console.error('Error handling incoming data:', error);
    }
  }

  // Handle information of a new incoming file
  private handleFileInfo(message: any) {
    // Initialize a new incoming file
    const newFile: IncomingFile = {
      id: message.id,
      name: message.name,
      size: message.size,
      receivedSize: 0,
      progress: 0,
      status: 'receiving',
      chunks: [],
      from: message.from || 'unknown',
      timestamp: Date.now(), // Add reception timestamp
    };
    console.log('New incoming file:', newFile.name, 'size:', newFile.size);
    
    // Check if the file already exists (case where file-chunk arrived before file-info)
    const fileExists = this.incomingFiles.some(f => f.id === message.id);
    
    if (fileExists) {
      console.log('File entry already exists, updating metadata');
      this.incomingFiles = this.incomingFiles.map(f => {
        if (f.id === message.id) {
          // Keep the chunks and received size but update the metadata
          return { 
            ...newFile, 
            chunks: f.chunks,
            receivedSize: f.receivedSize,
            progress: f.size ? Math.min(100, Math.floor((f.receivedSize / f.size) * 100)) : f.progress,
            timestamp: f.timestamp || Date.now(), // Preserve existing timestamp or create a new one
          };
        }
        return f;
      });
      
      // Clean up duplicate files right after
      setTimeout(() => this.cleanupDuplicateFiles(), 100);
      
      // Apply any pending chunks after updating metadata
      setTimeout(() => this.applyPendingChunks(message.id), 200);
    } else {
      // This is a new file
      console.log('Adding new file:', newFile.name);
      this.incomingFiles = [...this.incomingFiles, newFile];
      
      // Remove from the set of recently created files
      this.recentlyCreatedFilesRef.delete(message.id);
      
      // Apply pending chunks after adding the file
      setTimeout(() => this.applyPendingChunks(message.id), 200);
      
      // Clean up duplicates afterwards
      setTimeout(() => this.cleanupDuplicateFiles(), 500);
    }
  }

  // Handle binary data (file chunks)
  private handleBinaryData(data: ArrayBuffer) {
    const currentPendingFileId = this.pendingChunkFileIdRef;
    
    if (!currentPendingFileId) {
      console.warn('Received binary data but no pending file ID is set');
      return;
    }
    
    // Log reception of the chunk
    console.log(`Received data chunk of size ${data.byteLength} for file ${currentPendingFileId}`);
    
    // Check if the file exists, otherwise create it
    let targetFile = this.incomingFiles.find(f => f.id === currentPendingFileId);
    
    if (!targetFile && !this.recentlyCreatedFilesRef.has(currentPendingFileId)) {
      console.log(`File ${currentPendingFileId} not found, creating a temporary entry`);
      
      // Mark this file as recently created to avoid duplicates
      this.recentlyCreatedFilesRef.add(currentPendingFileId);
      
      // Extract filename from ID (format: timestamp-filename)
      const fileName = currentPendingFileId.split('-').slice(1).join('-') || "unknown_file";
      
      // Create a temporary entry
      const temporaryFile: IncomingFile = {
        id: currentPendingFileId,
        name: fileName,
        size: 0, // Unknown size, will be updated when file-info arrives
        receivedSize: 0,
        progress: 0,
        status: 'receiving',
        chunks: [],
        from: 'unknown', // Will be updated when file-info arrives
        timestamp: Date.now(), // Add reception timestamp
      };
      
      // Add the chunk to the queue while the file is being created
      if (!this.pendingChunksRef[currentPendingFileId]) {
        this.pendingChunksRef[currentPendingFileId] = [];
      }
      
      // Ensure the array is properly initialized
      if (!Array.isArray(this.pendingChunksRef[currentPendingFileId])) {
        this.pendingChunksRef[currentPendingFileId] = [];
      }
      
      this.pendingChunksRef[currentPendingFileId].push(data);
      console.log(`Chunk queued for file ${currentPendingFileId}, total: ${this.pendingChunksRef[currentPendingFileId].length}`);
      
      // Add the temporary file to the state
      this.incomingFiles = [...this.incomingFiles, temporaryFile];
    } else if (!targetFile) {
      // The file is being created, add the chunk to the queue
      console.log(`File ${currentPendingFileId} is being created, adding chunk to queue`);
      if (!this.pendingChunksRef[currentPendingFileId]) {
        this.pendingChunksRef[currentPendingFileId] = [];
      }
      
      // Ensure the array is properly initialized
      if (!Array.isArray(this.pendingChunksRef[currentPendingFileId])) {
        this.pendingChunksRef[currentPendingFileId] = [];
      }
      
      this.pendingChunksRef[currentPendingFileId].push(data);
      console.log(`Chunk queued for file ${currentPendingFileId}, total: ${this.pendingChunksRef[currentPendingFileId].length}`);
    } else {
      // The file exists, add the chunk directly
      console.log(`Adding chunk directly to file ${targetFile.name}`);
      
      // Measure reception time and speed
      const now = Date.now();
      const timeSinceStart = now - targetFile.timestamp;
      const chunkSize = data.byteLength;
      
      // Add this chunk to the file
      const newChunks = [...targetFile.chunks, data];
      const receivedSize = targetFile.receivedSize + chunkSize;
      const knownFileSize = targetFile.size || receivedSize; // If size is unknown, use received size as approximation
      const progress = Math.min(100, Math.floor((receivedSize / knownFileSize) * 100));
      
      // Calculate reception speed (bytes per second)
      const speed = receivedSize / (timeSinceStart / 1000);
      
      // Estimate remaining time
      let estimatedTimeRemaining = 0;
      if (speed > 0 && knownFileSize > receivedSize) {
        estimatedTimeRemaining = ((knownFileSize - receivedSize) / speed) * 1000; // in milliseconds
      }
      
      console.log(`Progress update for ${targetFile.name}: ${progress}% (${receivedSize}/${knownFileSize} bytes), speed: ${speed.toFixed(0)} bytes/s, ETA: ${estimatedTimeRemaining.toFixed(0)}ms`);
      
      // Update the file state with all metrics
      this.incomingFiles = this.incomingFiles.map(file => {
        if (file.id === currentPendingFileId) {
          return {
            ...file,
            chunks: newChunks,
            receivedSize,
            progress,
            speed,
            estimatedTimeRemaining
          };
        }
        return file;
      });
      
      // Force state update every 10 chunks or for large files
      if (newChunks.length % 10 === 0 || knownFileSize > 10 * 1024 * 1024) {
        this.setIncomingFiles([...this.incomingFiles]);
      }
    }
  }

  // Handle file completion
  private handleFileComplete(fileId: string) {
    // File transfer complete, update status
    console.log('File transfer complete:', fileId);
    
    // Process pending chunks first
    try {
      const hasPendingChunks = this.pendingChunksRef[fileId] && 
              Array.isArray(this.pendingChunksRef[fileId]) && 
              this.pendingChunksRef[fileId].length > 0;
              
      if (hasPendingChunks) {
        console.log(`Processing ${this.pendingChunksRef[fileId].length} pending chunks before finalizing the file`);
        this.applyPendingChunks(fileId);
      } else {
        console.log(`No pending chunks for file ${fileId}`);
        // Clean up in case of error
        delete this.pendingChunksRef[fileId];
      }
    } catch (err) {
      console.error(`Error processing pending chunks for ${fileId}:`, err);
      // Clean up in case of error
      delete this.pendingChunksRef[fileId];
    }
    
    this.pendingChunkFileIdRef = null; // Clear reference
    this.recentlyCreatedFilesRef.delete(fileId); // Clean up recently created files
    
    // Find file to calculate final progress
    const fileIndex = this.incomingFiles.findIndex(f => f.id === fileId);
    if (fileIndex !== -1) {
      const file = this.incomingFiles[fileIndex];
      console.log(`Finalizing file ${file.name} with size ${file.receivedSize} bytes`);
      
      // Check if the file hasn't been canceled before marking as completed
      if (file.status !== 'canceled') {
        // Notification vibration to indicate complete reception
        vibrateNotification();
      
        // Update file status to 100% and mark as completed
        this.incomingFiles = this.incomingFiles.map(file => {
          if (file.id === fileId && file.status !== 'canceled') {
            const updatedFile: IncomingFile = { 
              ...file, 
              status: 'completed' as 'completed',
              progress: 100 // Ensure progress is really 100%
            };
            console.log(`File ${file.name} complete and ready to be downloaded`);
            return updatedFile;
          }
          return file;
        });
      } else {
        console.log(`File ${file.name} was canceled, it won't be marked as completed`);
      }
        
      // Force UI update
      setTimeout(() => {
        this.setIncomingFiles([...this.incomingFiles]);
        // Check and clean up duplicate files
        this.cleanupDuplicateFiles();
      }, 200);
    } else {
      console.warn(`File ${fileId} not found during finalization`);
      // Check and clean up duplicate files anyway
      setTimeout(() => this.cleanupDuplicateFiles(), 200);
    }
  }

  // Handle file cancellation by the sender
  private handleFileCanceled(fileId: string, fileName: string) {
    console.log(`Received notification of cancellation for ${fileId} (${fileName})`);
    
    // Notification vibration for user
    vibrateError();
    
    // Find the file being received
    const fileIndex = this.incomingFiles.findIndex(f => f.id === fileId);
    if (fileIndex !== -1) {
      console.log(`Marking file ${fileName} as canceled`);
      
      // Update the file status
      this.incomingFiles = this.incomingFiles.map(file => {
        if (file.id === fileId) {
          return { 
            ...file, 
            status: 'canceled' as 'canceled',
          };
        }
        return file;
      });
      
      // Clean up resources associated with this file
      delete this.pendingChunksRef[fileId];
      this.recentlyCreatedFilesRef.delete(fileId);
      if (this.pendingChunkFileIdRef === fileId) {
        this.pendingChunkFileIdRef = null;
      }
      
      // Force UI update
      setTimeout(() => {
        this.setIncomingFiles([...this.incomingFiles]);
      }, 200);
    }
  }

  // Send a file to a device
  async sendFile(file: File, targetDeviceId: string) {
    // Find target device name if available
    const targetDeviceName = this.peerService?.getDeviceName(targetDeviceId) || 'Unknown device';
    
    const transferId = `${Date.now()}-${file.name}`;
    const timestamp = Date.now();
    
    const newTransfer: FileTransfer = {
      id: transferId,
      fileName: file.name,
      fileSize: file.size,
      progress: 0,
      status: 'pending',
      targetDevice: targetDeviceId,
      targetDeviceName: targetDeviceName,
      timestamp: timestamp,
    };

    this.fileTransfers = [...this.fileTransfers, newTransfer];
    // Ajouter à la liste des transferts actifs
    this.activeTransfers.add(transferId);

    // Variables pour le calcul de la vitesse et du temps restant
    let startTime = Date.now();
    let lastUpdate = startTime;
    let bytesTransferredSinceLastUpdate = 0;
    let currentSpeed = 0;

    // Informer l'autre appareil du fichier à venir
    const fileInfo = {
      type: 'file-info',
      id: transferId,
      name: file.name,
      size: file.size,
      from: this.deviceName // Envoyer le nom de l'appareil au lieu de l'ID
    };
    
    try {
      // Envoyer les informations de fichier avec une tentative de reconnexion
      const infoSent = await this.sendWithRetry(targetDeviceId, JSON.stringify(fileInfo), 3);
      if (!infoSent) {
        throw new Error("Impossible d'envoyer les informations du fichier après plusieurs tentatives");
      }
  
      // Lire et envoyer le fichier par chunks
      const chunkSize = AppConfig.fileTransfer.chunkSize;
      const reader = new FileReader();
      let offset = 0;
  
      const updateProgress = (progress: number, bytesTransferred: number) => {
        // Calculer la vitesse de transfert
        const now = Date.now();
        const timeSinceLastUpdate = now - lastUpdate;
        
        // Mise à jour de la vitesse toutes les 500ms
        if (timeSinceLastUpdate >= 500) {
          currentSpeed = bytesTransferredSinceLastUpdate / (timeSinceLastUpdate / 1000);
          bytesTransferredSinceLastUpdate = 0;
          lastUpdate = now;
          
          // Calculer le temps restant estimé
          const totalTime = now - startTime;
          const estimatedTotalTime = (file.size / (offset || 1)) * totalTime;
          const estimatedTimeRemaining = Math.max(0, estimatedTotalTime - totalTime);
          
          // Mettre à jour le transfert avec les nouvelles informations
          this.fileTransfers = this.fileTransfers.map(t => 
            t.id === transferId ? { 
              ...t, 
              progress, 
              status: 'transferring',
              speed: currentSpeed,
              estimatedTimeRemaining: estimatedTimeRemaining
            } : t
          );
        } else {
          // Simple mise à jour de la progression sans recalcul de la vitesse
          bytesTransferredSinceLastUpdate += bytesTransferred;
          this.fileTransfers = this.fileTransfers.map(t => 
            t.id === transferId ? { ...t, progress, status: 'transferring' } : t
          );
        }
      };
  
      // Fonction pour lire une tranche du fichier
      const readSlice = async (o: number): Promise<boolean> => {
        return new Promise((resolve) => {
          try {
            // Vérifier si le transfert a été annulé
            const transferCanceled = !this.activeTransfers.has(transferId) || 
                                     this.fileTransfers.some(t => t.id === transferId && t.status === 'canceled');
            
            if (transferCanceled) {
              console.log(`Transfert ${transferId} annulé, arrêt de l'envoi des données`);
              resolve(false);
              return;
            }

            const slice = file.slice(o, Math.min(o + chunkSize, file.size));
            reader.onload = async (e) => {
              if (!e.target?.result) {
                resolve(false);
                return;
              }
              
              try {
                // Vérifier de nouveau si l'annulation est survenue pendant la lecture
                if (!this.activeTransfers.has(transferId) || 
                    this.fileTransfers.some(t => t.id === transferId && t.status === 'canceled')) {
                  console.log(`Transfert ${transferId} annulé pendant la lecture, arrêt de l'envoi des données`);
                  resolve(false);
                  return;
                }

                // Notifier à quel fichier ce chunk appartient
                const chunkInfo = JSON.stringify({ 
                  type: 'file-chunk', 
                  id: transferId,
                  index: Math.floor(o / chunkSize), // Ajouter un index pour faciliter la reprise
                  offset: o,
                  size: (e.target.result as ArrayBuffer).byteLength
                });
                
                // Envoyer l'information du chunk, puis le chunk lui-même
                const infoSent = await this.sendWithRetry(targetDeviceId, chunkInfo, 2);
                if (!infoSent) {
                  console.error(`Échec d'envoi d'informations pour le chunk à l'offset ${o}`);
                  resolve(false);
                  return;
                }
                
                // Petit délai pour éviter la saturation
                await new Promise(r => setTimeout(r, 5));
                
                // Vérifier encore une fois si le transfert a été annulé avant d'envoyer le chunk
                if (!this.activeTransfers.has(transferId) || 
                    this.fileTransfers.some(t => t.id === transferId && t.status === 'canceled')) {
                  console.log(`Transfert ${transferId} annulé avant l'envoi du chunk, arrêt`);
                  resolve(false);
                  return;
                }

                // Envoyer les données avec réessais
                const chunkSent = await this.sendWithRetry(
                  targetDeviceId, 
                  e.target.result, 
                  2
                );
                
                if (!chunkSent) {
                  console.error(`Échec d'envoi du chunk à l'offset ${o}`);
                  resolve(false);
                  return;
                }
                
                offset += (e.target.result as ArrayBuffer).byteLength;
                const progress = Math.min(100, Math.floor((offset / file.size) * 100));
                updateProgress(progress, (e.target.result as ArrayBuffer).byteLength);
                
                // Succès pour ce chunk
                resolve(true);
              } catch (error) {
                console.error(`Erreur lors de l'envoi du chunk à l'offset ${o}:`, error);
                resolve(false);
              }
            };
            
            reader.onerror = () => {
              console.error(`Erreur de lecture du fichier à l'offset ${o}`);
              resolve(false);
            };
            
            reader.readAsArrayBuffer(slice);
          } catch (err) {
            console.error(`Erreur lors de la création du slice à l'offset ${o}:`, err);
            resolve(false);
          }
        });
      };
      
      // Envoyer tous les chunks avec gestion d'échec et de reprise
      while (offset < file.size) {
        // Vérifier si le transfert a été annulé avant de lire le prochain chunk
        const transferCanceled = !this.activeTransfers.has(transferId) || 
                               this.fileTransfers.some(t => t.id === transferId && t.status === 'canceled');
        
        if (transferCanceled) {
          console.log(`Transfert ${transferId} annulé, arrêt du processus d'envoi`);
          break;
        }

        const success = await readSlice(offset);
        if (!success) {
          // Vérifier à nouveau si l'annulation est la cause de l'échec
          if (!this.activeTransfers.has(transferId) || 
              this.fileTransfers.some(t => t.id === transferId && t.status === 'canceled')) {
            console.log(`Transfert ${transferId} annulé, pas de réessai`);
            break;
          }

          // Attendre un peu avant de réessayer le même chunk
          await new Promise(r => setTimeout(r, 1000));
          continue; // Réessayer le même chunk
        }
        
        // Ajouter un petit délai entre les chunks pour les gros fichiers
        if (file.size > 10 * 1024 * 1024) { // Plus de 10MB
          await new Promise(r => setTimeout(r, 10));
        }
      }
      
      // Vérifier si le transfert est toujours actif et non annulé avant de le marquer comme terminé
      const transferCanceled = !this.activeTransfers.has(transferId) || 
                             this.fileTransfers.some(t => t.id === transferId && t.status === 'canceled');
      
      if (!transferCanceled && offset >= file.size) {
        // Transfert terminé avec succès
        this.fileTransfers = this.fileTransfers.map(t => 
          t.id === transferId ? { ...t, progress: 100, status: 'completed' } : t
        );
        
        // Vibration de succès quand le transfert est terminé
        vibrateSuccess();
        
        // Informer l'autre appareil que le transfert est terminé
        await this.sendWithRetry(
          targetDeviceId, 
          JSON.stringify({ type: 'file-complete', id: transferId }), 
          5 // Plus de tentatives pour s'assurer que le message de fin passe
        );
      } else if (transferCanceled) {
        console.log(`Le transfert ${transferId} a été annulé, ne pas envoyer de signal de complétion`);
      }
      
      // Nettoyage des ressources
      this.activeTransfers.delete(transferId);
      
    } catch (error) {
      console.error('Error sending file:', error);
      // Vibration d'erreur en cas d'échec
      vibrateError();
      
      this.fileTransfers = this.fileTransfers.map(t => 
        t.id === transferId ? { ...t, status: 'failed' } : t
      );
      
      // Nettoyage des ressources
      this.activeTransfers.delete(transferId);
    }
  }
  
  // Méthode utilitaire pour envoyer des données avec plusieurs tentatives
  private async sendWithRetry(targetDeviceId: string, data: any, maxRetries: number = 3): Promise<boolean> {
    let attempts = 0;
    
    while (attempts < maxRetries) {
      try {
        if (!this.peerService.isConnectedTo(targetDeviceId)) {
          console.log(`La connexion à ${targetDeviceId} a été perdue, tentative de reconnexion...`);
          // Attendre que la reconnexion se fasse
          await new Promise(r => setTimeout(r, 1000 * (attempts + 1)));
          attempts++;
          continue;
        }
        
        const sent = this.peerService.sendData(targetDeviceId, data);
        if (sent) return true;
        
        // Si l'envoi a échoué mais que la connexion est toujours active
        console.log(`Échec d'envoi, tentative ${attempts + 1}/${maxRetries}...`);
        await new Promise(r => setTimeout(r, 500 * (attempts + 1)));
      } catch (err) {
        console.error(`Erreur lors de l'envoi, tentative ${attempts + 1}/${maxRetries}:`, err);
      }
      
      attempts++;
    }
    
    return false;
  }

  // Nettoyer les fichiers de transfert en échec
  cleanupStalledTransfers() {
    // Vérifier les transferts de fichiers entrants bloqués
    this.incomingFiles = this.incomingFiles.map(file => {
      // Si un fichier est en état 'receiving' pendant plus de 30 secondes sans progression
      if (file.status === 'receiving') {
        const transferAge = Date.now() - parseInt(file.id.split('-')[0], 10);
        if (transferAge > 30000 && file.progress < 100) {
          console.log(`File transfer ${file.id} appears stalled, marking as failed`);
          return { ...file, status: 'failed' };
        }
      }
      return file;
    });
  }

  // Annuler un transfert de fichier en cours
  cancelFileTransfer(transferId: string): boolean {
    // Vérifier si le transfert existe
    const transferIndex = this.fileTransfers.findIndex(t => t.id === transferId);
    if (transferIndex === -1) {
      console.warn(`Transfert ${transferId} non trouvé pour annulation`);
      return false;
    }

    const transfer = this.fileTransfers[transferIndex];
    
    // Vérifier si le transfert est annulable (en cours ou en attente)
    if (transfer.status !== 'transferring' && transfer.status !== 'pending') {
      console.warn(`Transfert ${transferId} ne peut pas être annulé (statut: ${transfer.status})`);
      return false;
    }

    // Notifier l'autre appareil de l'annulation
    if (transfer.targetDevice) {
      try {
        console.log(`Envoi notification d'annulation pour ${transferId} à ${transfer.targetDevice}`);
        this.peerService.sendData(
          transfer.targetDevice,
          JSON.stringify({ 
            type: 'file-canceled', 
            id: transferId,
            name: transfer.fileName
          })
        );
      } catch (error) {
        console.error('Erreur lors de la notification d\'annulation:', error);
        // Continuer quand même avec l'annulation locale
      }
    }

    // Supprimer le transfert de la liste des transferts actifs
    this.activeTransfers.delete(transferId);

    // Mettre à jour le statut du transfert
    vibrateError(); // Vibration d'erreur pour indiquer l'annulation
    
    this.fileTransfers = this.fileTransfers.map(t => 
      t.id === transferId ? { ...t, status: 'canceled' } : t
    );

    console.log(`Transfert ${transferId} annulé avec succès`);
    return true;
  }
} 