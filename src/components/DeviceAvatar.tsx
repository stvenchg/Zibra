import { useEffect, useState } from 'react';
import { generateAvatar } from '../utils/avatargenerator';
import type { AvatarStyle } from '../utils/avatargenerator';

interface DeviceAvatarProps {
  deviceId: string;
  style?: AvatarStyle;
  size?: number;
  className?: string;
}

export const DeviceAvatar = ({ deviceId, style = 'lorelei', size = 40, className = '' }: DeviceAvatarProps) => {
  const [avatar, setAvatar] = useState<string>('');
  
  useEffect(() => {
    // Générer l'avatar uniquement au montage du composant ou quand deviceId/style change
    if (deviceId) {
      setAvatar(generateAvatar(deviceId, style));
    }
  }, [deviceId, style]);
  
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