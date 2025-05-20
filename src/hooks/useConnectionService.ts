import { useContext, useEffect, useRef, useState } from 'react';
import { ConnectionContext } from '../context/ConnectionContext';
import type { ConnectionServices } from '../types/connection.types';

// Hook that provides access to underlying services for advanced operations
export const useConnectionService = () => {
  const context = useContext(ConnectionContext);
  const [services, setServices] = useState<ConnectionServices | null>(null);
  
  if (context === null) {
    throw new Error('useConnectionService must be used within a ConnectionProvider.');
  }
  
  // Get references to services from parent context
  useEffect(() => {
    // Use the getServices method now exposed by the context
    const connectionServices = context.getServices();
    setServices(connectionServices);
  }, [context]);
  
  return {
    ...context,
    // Advanced services for specific operations
    services
  };
}; 