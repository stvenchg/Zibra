import { useConnection } from '../hooks/useConnection';

export const TransferList = () => {
  const { fileTransfers } = useConnection();
  
  if (fileTransfers.length === 0) {
    return null;
  }
  
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  return (
    <div className="transfers-container">
      <h2>Active Transfers</h2>
      <ul className="transfer-list">
        {fileTransfers.map(transfer => (
          <li key={transfer.id} className={`transfer-item status-${transfer.status}`}>
            <div className="transfer-info">
              <div className="transfer-file-info">
                <span className="file-name">{transfer.fileName}</span>
                <span className="file-size">
                  {formatSize(transfer.fileSize)}
                </span>
              </div>
              <div className="transfer-status-info">
                <span className={`status-badge status-${transfer.status}`}>
                  {transfer.status === 'completed' 
                    ? 'Completed' 
                    : transfer.status === 'failed'
                      ? 'Failed'
                      : transfer.status === 'pending'
                        ? 'Pending'
                        : 'Sending'}
                </span>
              </div>
            </div>
            
            <div className="transfer-progress">
              <div 
                className="progress-bar"
                style={{ width: `${transfer.progress}%` }}
              />
              <span className="progress-text">
                {transfer.status === 'completed' 
                  ? 'Completed' 
                  : transfer.status === 'failed'
                    ? 'Failed'
                    : `${transfer.progress}%`}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}; 