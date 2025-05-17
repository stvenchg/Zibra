import { useContext, useEffect, useRef, useState } from 'react';
import { ConnectionContext } from '../context/ConnectionContext';
import type { ConnectionServices } from '../types/connection.types';

// Hook qui donne accès aux services sous-jacents pour des opérations avancées
export const useConnectionService = () => {
  const context = useContext(ConnectionContext);
  const [services, setServices] = useState<ConnectionServices | null>(null);
  
  if (context === null) {
    throw new Error('useConnectionService must be used within a ConnectionProvider.');
  }
  
  // Obtenir les références aux services depuis le contexte parent
  useEffect(() => {
    // Utiliser la méthode getServices maintenant exposée par le contexte
    const connectionServices = context.getServices();
    setServices(connectionServices);
  }, [context]);
  
  return {
    ...context,
    // Services avancés pour des opérations spécifiques
    services
  };
}; 