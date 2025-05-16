import { useConnection } from '../hooks/useConnection';

export const ReceivedFiles = () => {
  const { incomingFiles, downloadFile } = useConnection();
  
  if (incomingFiles.length === 0) {
    return null;
  }
  
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  return (
    <div className="received-files-container">
      <h2>Received Files</h2>
      <ul className="received-files-list">
        {incomingFiles.map(file => (
          <li key={file.id} className={`received-file status-${file.status}`}>
            <div className="file-info">
              <span className="file-name">{file.name}</span>
              <span className="file-size">{formatSize(file.size)}</span>
              <span className="file-source">From: {file.from}</span>
            </div>
            
            {file.status === 'receiving' ? (
              <div className="transfer-progress">
                <div 
                  className="progress-bar"
                  style={{ width: `${file.progress}%` }}
                />
                <span className="progress-text">{file.progress}%</span>
              </div>
            ) : file.status === 'completed' ? (
              <button 
                className="download-button"
                onClick={() => downloadFile(file.id)}
              >
                Download
              </button>
            ) : (
              <span className="status-failed">Failed</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}; 