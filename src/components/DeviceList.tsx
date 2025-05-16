import { useConnection } from '../hooks/useConnection';

export const DeviceList = () => {
  const { availableDevices, connectToDevice } = useConnection();

  if (availableDevices.length === 0) {
    return (
      <div className="device-list empty">
        <p>No device found on the network.</p>
        <p>Devices connected to the same network will appear here automatically.</p>
      </div>
    );
  }

  return (
    <div className="device-list">
      <h2>Available devices</h2>
      <ul>
        {availableDevices.map(device => (
          <li key={device.id} className="device-item">
            <div className="device-info">
              <span className="device-name">{device.name}</span>
              <span className="device-id">{device.id.substring(0, 8)}</span>
            </div>
            <button 
              className="connect-button"
              onClick={() => connectToDevice(device.id)}
            >
              Connect
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}; 