import { createAvatar } from '@dicebear/core';
import { avataaars, bottts, lorelei, miniavs, personas, glass } from '@dicebear/collection';

export type AvatarStyle = 'avataaars' | 'bottts' | 'lorelei' | 'miniavs' | 'personas' | 'glass';

/**
 * Génère un avatar aléatoire basé sur un identifiant et un style
 * @param seed - Identifiant utilisé pour générer un avatar déterministe (ex: ID d'appareil)
 * @param style - Style d'avatar à utiliser
 * @returns URL de données de l'avatar SVG
 */
export const generateAvatar = (seed: string, style: AvatarStyle = 'personas'): string => {
  let avatar;
  
  switch (style) {
    case 'avataaars':
      avatar = createAvatar(avataaars, { seed });
      break;
    case 'bottts':
      avatar = createAvatar(bottts, { seed });
      break;
    case 'lorelei':
      avatar = createAvatar(lorelei, { seed });
      break;
    case 'miniavs':
      avatar = createAvatar(miniavs, { seed });
      break;
    case 'glass':
      avatar = createAvatar(glass, { seed });
      break;
    case 'personas':
    default:
      avatar = createAvatar(personas, { seed });
      break;
  }
  
  return avatar.toDataUri();
};

/**
 * Génère un avatar aléatoire basé sur un style spécifié
 * @param style - Style d'avatar à utiliser
 * @returns URL de données de l'avatar SVG
 */
export const generateRandomAvatar = (style: AvatarStyle = 'personas'): string => {
  // Créer un seed aléatoire
  const randomSeed = Math.random().toString(36).substring(2, 15);
  return generateAvatar(randomSeed, style);
}; 