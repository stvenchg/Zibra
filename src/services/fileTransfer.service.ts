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
      
      const knownFileSize = file.size || receivedSize;
      const progress = Math.min(100, Math.floor((receivedSize / knownFileSize) * 100));
      
      console.log(`Progress after applying pending chunks for ${file.name}: ${progress}% (${receivedSize}/${knownFileSize} bytes)`);
      
      // Mettre à jour le fichier avec tous les chunks en attente
      const updatedFiles = [...this.incomingFiles];
      updatedFiles[fileIndex] = {
        ...file,
        chunks: newChunks,
        receivedSize,
        progress
      };
      
      // Mise à jour immédiate de l'état
      this.incomingFiles = updatedFiles;
      
      // Forcer une mise à jour des fichiers pour actualiser l'UI
      setTimeout(() => this.setIncomingFiles([...this.incomingFiles]), 100);
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
      const knownFileSize = targetFile.size || receivedSize; // Si la taille n'est pas connue, utiliser la taille reçue comme approximation
      const progress = Math.min(100, Math.floor((receivedSize / knownFileSize) * 100));
      
      console.log(`Progress update for ${targetFile.name}: ${progress}% (${receivedSize}/${knownFileSize} bytes)`);
      
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
      
      // Forcer une mise à jour de l'état toutes les 10 chunks ou pour les gros fichiers
      if (newChunks.length % 10 === 0 || knownFileSize > 10 * 1024 * 1024) {
        this.setIncomingFiles([...this.incomingFiles]);
      }
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
    
    // Trouver le fichier pour calculer le progrès final
    const fileIndex = this.incomingFiles.findIndex(f => f.id === fileId);
    if (fileIndex !== -1) {
      const file = this.incomingFiles[fileIndex];
      console.log(`Finalisation du fichier ${file.name} avec taille ${file.receivedSize} octets`);
    
      // Vibration de notification pour indiquer la réception complète
      vibrateNotification();
      
      // Mettre à jour le statut du fichier à 100% et marquer comme complété
      this.incomingFiles = this.incomingFiles.map(file => {
        if (file.id === fileId) {
          const updatedFile: IncomingFile = { 
            ...file, 
            status: 'completed' as 'completed',
            progress: 100 // S'assurer que la progression est bien à 100%
          };
          console.log(`Fichier ${file.name} complet et prêt à être téléchargé`);
          return updatedFile;
        }
        return file;
      });
        
      // Forcer une mise à jour de l'interface
      setTimeout(() => {
        this.setIncomingFiles([...this.incomingFiles]);
        // Vérifier et nettoyer les fichiers dupliqués
        this.cleanupDuplicateFiles();
      }, 200);
    } else {
      console.warn(`Fichier ${fileId} non trouvé lors de la finalisation`);
      // Vérifier et nettoyer les fichiers dupliqués quand même
      setTimeout(() => this.cleanupDuplicateFiles(), 200);
    }
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
  
      const updateProgress = (progress: number) => {
        this.fileTransfers = this.fileTransfers.map(t => 
          t.id === transferId ? { ...t, progress, status: 'transferring' } : t
        );
      };
  
      // Fonction pour lire une tranche du fichier
      const readSlice = async (o: number): Promise<boolean> => {
        return new Promise((resolve) => {
          try {
            const slice = file.slice(o, Math.min(o + chunkSize, file.size));
            reader.onload = async (e) => {
              if (!e.target?.result) {
                resolve(false);
                return;
              }
              
              try {
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
                updateProgress(progress);
                
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
        const success = await readSlice(offset);
        if (!success) {
          // Attendre un peu avant de réessayer le même chunk
          await new Promise(r => setTimeout(r, 1000));
          continue; // Réessayer le même chunk
        }
        
        // Ajouter un petit délai entre les chunks pour les gros fichiers
        if (file.size > 10 * 1024 * 1024) { // Plus de 10MB
          await new Promise(r => setTimeout(r, 10));
        }
      }
      
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
      
    } catch (error) {
      console.error('Error sending file:', error);
      // Vibration d'erreur en cas d'échec
      vibrateError();
      
      this.fileTransfers = this.fileTransfers.map(t => 
        t.id === transferId ? { ...t, status: 'failed' } : t
      );
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
} 