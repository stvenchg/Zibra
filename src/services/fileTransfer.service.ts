import type { FileTransfer, IncomingFile } from '../types/connection.types';

export class FileTransferService {
  private fileTransfers: FileTransfer[] = [];
  private incomingFiles: IncomingFile[] = [];
  private pendingChunksRef: Record<string, Array<ArrayBuffer>> = {};
  private recentlyCreatedFilesRef: Set<string> = new Set();
  private pendingChunkFileIdRef: string | null = null;
  private deviceName: string;
  private peerService: any; // Service pour l'envoi des données via WebRTC

  constructor(deviceName: string, peerService: any) {
    this.deviceName = deviceName;
    this.peerService = peerService;
  }

  // Mettre à jour le nom de l'appareil
  updateDeviceName(name: string) {
    this.deviceName = name;
  }

  // Récupérer la liste des transferts en cours
  getFileTransfers(): FileTransfer[] {
    return this.fileTransfers;
  }

  // Récupérer la liste des fichiers entrants
  getIncomingFiles(): IncomingFile[] {
    return this.incomingFiles;
  }

  // Mettre à jour la liste des transferts
  setFileTransfers(transfers: FileTransfer[]) {
    this.fileTransfers = transfers;
  }

  // Mettre à jour la liste des fichiers entrants
  setIncomingFiles(files: IncomingFile[]) {
    this.incomingFiles = files;
  }

  // Appliquer les chunks en attente pour un fichier
  applyPendingChunks(fileId: string) {
    // Créer une copie locale du tableau de chunks
    const pendingChunksForFile = this.pendingChunksRef[fileId];
    
    // Nettoyage immédiat
    delete this.pendingChunksRef[fileId];
    
    if (!pendingChunksForFile || !Array.isArray(pendingChunksForFile) || pendingChunksForFile.length === 0) {
      console.log(`No pending chunks for file ${fileId} or invalid format`);
      return; // Pas de chunks à appliquer ou format invalide
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
      
      // Ajouter tous les chunks en attente
      for (let i = 0; i < pendingChunksForFile.length; i++) {
        try {
          const chunk = pendingChunksForFile[i];
          if (chunk && chunk.byteLength) {
            newChunks.push(chunk);
            receivedSize += chunk.byteLength;
          }
        } catch (err) {
          console.error(`Erreur lors du traitement d'un chunk pour ${fileId}:`, err);
          // Continuer avec les autres chunks
        }
      }
      
      const progress = Math.min(100, Math.floor((receivedSize / (file.size || receivedSize)) * 100));
      
      // Mettre à jour le fichier avec tous les chunks en attente
      const updatedFiles = [...this.incomingFiles];
      updatedFiles[fileIndex] = {
        ...file,
        chunks: newChunks,
        receivedSize,
        progress
      };
      
      this.incomingFiles = updatedFiles;
    } catch (err) {
      console.error(`Erreur lors de l'application des chunks pour ${fileId}:`, err);
    }
  }

  // Nettoyer les fichiers dupliqués
  cleanupDuplicateFiles() {
    // Regrouper les fichiers par ID
    const filesById = new Map();
    
    // Analyser tous les fichiers
    for (const file of this.incomingFiles) {
      // Si ce fichier existe déjà, fusionner les propriétés
      if (filesById.has(file.id)) {
        const existingFile = filesById.get(file.id);
        
        // Prendre les propriétés non vides du nouveau fichier
        const mergedFile = {
          ...existingFile,
          // Take the non-null file size
          size: file.size || existingFile.size,
          // Take the known sender name if available
          from: file.from !== 'unknown' ? file.from : existingFile.from,
          // Keep the existing chunks if there are more
          chunks: existingFile.chunks.length > file.chunks.length ? 
                 existingFile.chunks : file.chunks,
          // Keep the largest received size
          receivedSize: Math.max(existingFile.receivedSize, file.receivedSize),
          // Keep the completed status if one of them is completed
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

  // Télécharger un fichier reçu
  downloadFile(fileId: string): boolean {
    try {
      const file = this.incomingFiles.find(f => f.id === fileId);
      if (!file) {
        console.error('File not found:', fileId);
        return false;
      }
      
      if (file.status !== 'completed') {
        console.warn('File is not complete yet');
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

  // Gérer les données entrantes reçues via WebRTC
  handleIncomingData(data: any) {
    try {
      // Si data est une chaîne, c'est probablement un message de contrôle (JSON)
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
          
          default:
            console.warn('Unknown message type:', message.type);
        }
      } else {
        // Données binaires (chunk de fichier)
        this.handleBinaryData(data);
      }
    } catch (error) {
      console.error('Error handling incoming data:', error);
    }
  }

  // Gérer les informations d'un nouveau fichier entrant
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
      from: message.from || 'unknown'
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
            progress: f.size ? Math.min(100, Math.floor((f.receivedSize / f.size) * 100)) : f.progress
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

  // Gérer les données binaires (chunks de fichier)
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
        from: 'unknown' // Will be updated when file-info arrives
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
      
      // Add this chunk to the file
      const newChunks = [...targetFile.chunks, data];
      const receivedSize = targetFile.receivedSize + data.byteLength;
      const progress = Math.min(100, Math.floor((receivedSize / (targetFile.size || receivedSize)) * 100));
      
      // Update the file state
      this.incomingFiles = this.incomingFiles.map(file => {
        if (file.id === currentPendingFileId) {
          return {
            ...file,
            chunks: newChunks,
            receivedSize,
            progress
          };
        }
        return file;
      });
    }
  }

  // Gérer la complétion d'un fichier
  private handleFileComplete(fileId: string) {
    // Transfert de fichier terminé, mettre à jour le statut
    console.log('File transfer complete:', fileId);
    
    // Traiter les chunks en attente d'abord
    try {
      const hasPendingChunks = this.pendingChunksRef[fileId] && 
              Array.isArray(this.pendingChunksRef[fileId]) && 
              this.pendingChunksRef[fileId].length > 0;
              
      if (hasPendingChunks) {
        console.log(`Traitement de ${this.pendingChunksRef[fileId].length} chunks en attente avant de finaliser le fichier`);
        this.applyPendingChunks(fileId);
      } else {
        console.log(`Pas de chunks en attente pour le fichier ${fileId}`);
        // Nettoyage au cas où
        delete this.pendingChunksRef[fileId];
      }
    } catch (err) {
      console.error(`Erreur lors du traitement des chunks en attente pour ${fileId}:`, err);
      // Nettoyage en cas d'erreur
      delete this.pendingChunksRef[fileId];
    }
    
    this.pendingChunkFileIdRef = null; // Effacer la référence
    this.recentlyCreatedFilesRef.delete(fileId); // Nettoyer des fichiers récemment créés
    
    // Mettre à jour le statut du fichier
    this.incomingFiles = this.incomingFiles.map(file => {
      if (file.id === fileId) {
        return { ...file, status: 'completed' };
      }
      return file;
    });
      
    // Vérifier et nettoyer les fichiers dupliqués
    setTimeout(() => this.cleanupDuplicateFiles(), 500);
  }

  // Envoyer un fichier à un appareil
  async sendFile(file: File, targetDeviceId: string) {
    const transferId = `${Date.now()}-${file.name}`;
    const newTransfer: FileTransfer = {
      id: transferId,
      fileName: file.name,
      fileSize: file.size,
      progress: 0,
      status: 'pending',
    };

    this.fileTransfers = [...this.fileTransfers, newTransfer];

    // Informer l'autre appareil du fichier à venir
    const fileInfo = {
      type: 'file-info',
      id: transferId,
      name: file.name,
      size: file.size,
      from: this.deviceName // Envoyer le nom de l'appareil au lieu de l'ID
    };
    this.peerService.sendData(targetDeviceId, JSON.stringify(fileInfo));

    // Lire et envoyer le fichier par chunks
    const chunkSize = 16384; // 16KB chunks
    const reader = new FileReader();
    let offset = 0;

    const updateProgress = (progress: number) => {
      this.fileTransfers = this.fileTransfers.map(t => 
        t.id === transferId ? { ...t, progress, status: 'transferring' } : t
      );
    };

    // Ajouter un petit délai entre l'envoi des chunks pour éviter de surcharger la connexion
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const readSlice = async (o: number) => {
      const slice = file.slice(o, o + chunkSize);
      reader.readAsArrayBuffer(slice);
    };

    reader.onload = async (e) => {
      if (!e.target?.result) return;
      
      try {
        // D'abord notifier à quel fichier ce chunk appartient
        this.peerService.sendData(targetDeviceId, JSON.stringify({ 
          type: 'file-chunk', 
          id: transferId
        }));
        
        // Attendre un petit moment pour s'assurer que le message est traité
        await delay(10);
        
        // Envoyer les données binaires
        this.peerService.sendData(targetDeviceId, e.target.result);
        
        offset += (e.target.result as ArrayBuffer).byteLength;
        const progress = Math.min(100, Math.floor((offset / file.size) * 100));
        updateProgress(progress);
        
        if (offset < file.size) {
          // Ajouter un petit délai entre les chunks
          await delay(20);
          await readSlice(offset);
        } else {
          // Transfert terminé
          this.fileTransfers = this.fileTransfers.map(t => 
            t.id === transferId ? { ...t, progress: 100, status: 'completed' } : t
          );
          
          // Ajouter un délai avant d'envoyer le message de complétion
          await delay(50);
          this.peerService.sendData(targetDeviceId, JSON.stringify({ type: 'file-complete', id: transferId }));
        }
      } catch (error) {
        console.error('Error sending file chunk:', error);
        this.fileTransfers = this.fileTransfers.map(t => 
          t.id === transferId ? { ...t, status: 'failed' } : t
        );
      }
    };

    reader.onerror = () => {
      console.error('Error reading file');
      this.fileTransfers = this.fileTransfers.map(t => 
        t.id === transferId ? { ...t, status: 'failed' } : t
      );
    };

    readSlice(0);
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
} 