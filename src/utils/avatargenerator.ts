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
  // S'assurer qu'on a toujours une seed valide
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
 * Génère un avatar aléatoire basé sur un style spécifié
 * @param style - Style d'avatar à utiliser
 * @returns URL de données de l'avatar SVG
 */
export const generateRandomAvatar = (style: AvatarStyle = 'personas'): string => {
  // Créer un seed aléatoire
  const randomSeed = Math.random().toString(36).substring(2, 15);
  return generateAvatar(randomSeed, style);
}; 