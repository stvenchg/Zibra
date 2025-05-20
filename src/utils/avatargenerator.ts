import { createAvatar } from '@dicebear/core';
import { avataaars, bottts, lorelei, miniavs, personas, glass } from '@dicebear/collection';

export type AvatarStyle = 'avataaars' | 'bottts' | 'lorelei' | 'miniavs' | 'personas' | 'glass';

/**
 * Generates a random avatar based on an identifier and style
 * @param seed - Identifier used to generate a deterministic avatar (e.g., device ID)
 * @param style - Avatar style to use
 * @returns Data URL of the SVG avatar
 */
export const generateAvatar = (seed: string, style: AvatarStyle = 'personas'): string => {
  // Ensure we always have a valid seed
  const validSeed = seed?.trim() ? seed : 'default-' + Math.random().toString(36).substring(2, 7);
  
  let avatar;
  
  switch (style) {
    case 'avataaars':
      avatar = createAvatar(avataaars, { seed: validSeed });
      break;
    case 'bottts':
      avatar = createAvatar(bottts, { seed: validSeed });
      break;
    case 'lorelei':
      avatar = createAvatar(lorelei, { seed: validSeed });
      break;
    case 'miniavs':
      avatar = createAvatar(miniavs, { seed: validSeed });
      break;
    case 'glass':
      avatar = createAvatar(glass, { seed: validSeed });
      break;
    case 'personas':
    default:
      avatar = createAvatar(personas, { seed: validSeed });
      break;
  }
  
  return avatar.toDataUri();
};

/**
 * Generates a random avatar based on a specified style
 * @param style - Avatar style to use
 * @returns Data URL of the SVG avatar
 */
export const generateRandomAvatar = (style: AvatarStyle = 'personas'): string => {
  // Create a random seed
  const randomSeed = Math.random().toString(36).substring(2, 15);
  return generateAvatar(randomSeed, style);
}; 