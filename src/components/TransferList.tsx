import { useConnection } from '../hooks/useConnection';

export const TransferList = () => {
  const { fileTransfers } = useConnection();
  
  if (fileTransfers.length === 0) {
    return null;
  }
  
  return (
    <div className="transfers-container">
      <h2>Transfers</h2>
      <ul className="transfer-list">
        {fileTransfers.map(transfer => (
          <li key={transfer.id} className={`transfer-item status-${transfer.status}`}>
            <div className="transfer-info">
              <span className="file-name">{transfer.fileName}</span>
              <span className="file-size">
                {(transfer.fileSize / (1024 * 1024)).toFixed(2)} MB
              </span>
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