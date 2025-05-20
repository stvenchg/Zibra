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
    // Determine which seed to use for avatar generation
    let seed = '';
    
    // If we want to use the name as the primary seed
    if (useNameAsSeed) {
      if (deviceName) {
        // Use the device name provided as prop
        seed = deviceName;
      } else if (deviceId && !deviceName) {
        // No name provided, try to get the name associated with this ID
        // For now, use the ID as fallback
        seed = deviceId;
      } else {
        // If no ID or name provided and we're on the current device
        seed = currentDeviceName;
      }
    } else {
      // Legacy mode: use only the ID as seed
      seed = deviceId || currentDeviceName;
    }
    
    // Generate avatar if we have a valid seed
    if (seed) {
      setAvatar(generateAvatar(seed, style));
    }
  }, [deviceId, deviceName, style, useNameAsSeed, currentDeviceName]);
  
  // Generate a descriptive alt text for better accessibility and SEO
  const altText = deviceName 
    ? `Avatar for ${deviceName}` 
    : deviceId 
      ? `Device avatar for ID ${deviceId.substring(0, 8)}` 
      : `Device avatar`;
  
  if (!avatar) {
    // Display a placeholder during loading
    return (
      <div 
        className={`bg-muted rounded-full flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
        aria-label={altText}
        role="img"
      >
        <span className="text-xs text-muted-foreground">...</span>
      </div>
    );
  }
  
  return (
    <img
      src={avatar}
      alt={altText}
      className={`rounded-full ${className}`}
      style={{ width: size, height: size }}
    />
  );
}; 