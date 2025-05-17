import { useState, useCallback } from 'react';
import { useConnection } from '../hooks/useConnection';
import { AppConfig } from '../config';

export const FileSelection = () => {
  const { selectedFiles, addSelectedFile, removeSelectedFile, clearSelectedFiles } = useConnection();
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
        alert(`You can only select up to ${AppConfig.fileTransfer.maxFilesPerTransfer} files at a time.`);
        return;
      }
      
      // Add only as many files as we have slots for
      const filesToAdd = files.slice(0, remainingSlots);
      filesToAdd.forEach(file => addSelectedFile(file));
    }
  }, [addSelectedFile, selectedFiles.length]);
  
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const remainingSlots = AppConfig.fileTransfer.maxFilesPerTransfer - selectedFiles.length;
      
      if (remainingSlots <= 0) {
        alert(`You can only select up to ${AppConfig.fileTransfer.maxFilesPerTransfer} files at a time.`);
        return;
      }
      
      // Add only as many files as we have slots for
      const filesToAdd = files.slice(0, remainingSlots);
      filesToAdd.forEach(file => addSelectedFile(file));
      
      // Reset the input so the same file can be selected again
      e.target.value = '';
    }
  }, [addSelectedFile, selectedFiles.length]);
  
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  return (
    <div className="selected-files-container">
      <h2>File Selection</h2>
      
      {selectedFiles.length > 0 ? (
        <>
          <ul className="selected-files-list">
            {selectedFiles.map(file => (
              <li key={file.id} className="selected-file-item">
                <div className="selected-file-info">
                  <span className="selected-file-name">{file.name}</span>
                  <span className="selected-file-size">{formatSize(file.size)}</span>
                </div>
                <button 
                  className="remove-file-btn"
                  onClick={() => removeSelectedFile(file.id)}
                  aria-label={`Remove ${file.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          
          <div className="file-selection-actions">
            <div>
              {selectedFiles.length >= AppConfig.fileTransfer.maxFilesPerTransfer ? (
                <span className="max-files-notice">
                  Maximum number of files reached ({AppConfig.fileTransfer.maxFilesPerTransfer})
                </span>
              ) : (
                <span className="files-count">
                  {selectedFiles.length} of {AppConfig.fileTransfer.maxFilesPerTransfer} files selected
                </span>
              )}
            </div>
            
            <button 
              onClick={clearSelectedFiles}
              className="clear-files-btn"
            >
              Clear All Files
            </button>
          </div>
          
          {selectedFiles.length < AppConfig.fileTransfer.maxFilesPerTransfer && (
            <div 
              className={`drop-zone ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <p>Add more files by dropping them here</p>
              <p>or</p>
              <label className="file-input-label">
                <input 
                  type="file" 
                  onChange={handleFileSelect} 
                  className="file-input"
                  multiple
                />
                Browse Files
              </label>
            </div>
          )}
        </>
      ) : (
        <div 
          className={`drop-zone ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <p>Drag and drop files here</p>
          <p>or</p>
          <label className="file-input-label">
            <input 
              type="file" 
              onChange={handleFileSelect} 
              className="file-input"
              multiple
            />
            Select Files
          </label>
        </div>
      )}
    </div>
  );
}; 