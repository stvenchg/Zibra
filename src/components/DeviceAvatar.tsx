import { useEffect, useState } from 'react';
import { generateAvatar } from '../utils/avatargenerator';
import type { AvatarStyle } from '../utils/avatargenerator';
import { useConnection } from '../hooks/useConnection';

interface DeviceAvatarProps {
  deviceId?: string;
  deviceName?: string;
  style?: AvatarStyle;
  size?: number;
  className?: string;
  useNameAsSeed?: boolean;
}

export const DeviceAvatar = ({ 
  deviceId, 
  deviceName, 
  style = 'glass', 
  size = 40, 
  className = '',
  useNameAsSeed = true
}: DeviceAvatarProps) => {
  const [avatar, setAvatar] = useState<string>('');
  const { deviceName: currentDeviceName } = useConnection();
  
  useEffect(() => {
    // Déterminer quelle seed utiliser pour générer l'avatar
    let seed = '';
    
    // Si on veut utiliser le nom comme seed principale
    if (useNameAsSeed) {
      if (deviceName) {
        // Utiliser le nom d'appareil fourni en prop
        seed = deviceName;
      } else if (deviceId && !deviceName) {
        // Pas de nom fourni, on essaie de récupérer le nom associé à cet ID
        // Pour l'instant on utilise l'ID comme fallback
        seed = deviceId;
      } else {
        // Si aucun ID ni nom fourni et qu'on est sur l'appareil courant
        seed = currentDeviceName;
      }
    } else {
      // Mode legacy : utiliser seulement l'ID comme seed
      seed = deviceId || currentDeviceName;
    }
    
    // Générer l'avatar si on a une seed valide
    if (seed) {
      setAvatar(generateAvatar(seed, style));
    }
  }, [deviceId, deviceName, style, useNameAsSeed, currentDeviceName]);
  
  if (!avatar) {
    // Afficher un placeholder pendant le chargement
    return (
      <div 
        className={`bg-muted rounded-full flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-xs text-muted-foreground">...</span>
      </div>
    );
  }
  
  return (
    <img
      src={avatar}
      alt="Avatar de l'appareil"
      className={`rounded-full ${className}`}
      style={{ width: size, height: size }}
    />
  );
}; 