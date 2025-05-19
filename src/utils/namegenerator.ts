import { uniqueNamesGenerator, adjectives, colors, animals, names } from 'unique-names-generator';
import type { Config } from 'unique-names-generator';

/**
 * Génère un nom d'appareil aléatoire au format "Adjectif Nom"
 * Exemples: "Jubilant Intuition", "Happy Cat", "Brave Tiger"
 */
export const generateDeviceName = (): string => {
  const nameConfig: Config = {
    dictionaries: [adjectives, animals],
    separator: ' ',
    length: 2,
    style: 'capital'
  };
  
  return uniqueNamesGenerator(nameConfig);
};

/**
 * Génère un nom d'appareil aléatoire au format "Couleur Animal"
 * Exemples: "Red Panda", "Blue Dolphin", "Green Elephant"
 */
export const generateColorfulDeviceName = (): string => {
  const nameConfig: Config = {
    dictionaries: [colors, animals],
    separator: ' ',
    length: 2,
    style: 'capital'
  };
  
  return uniqueNamesGenerator(nameConfig);
};

/**
 * Génère un nom d'appareil aléatoire au format "Nom Adjectif"
 * Exemples: "Alice Jubilant", "Bob Brave", "Charlie Happy"
 */
export const generatePersonalDeviceName = (): string => {
  const nameConfig: Config = {
    dictionaries: [names, adjectives],
    separator: ' ',
    length: 2,
    style: 'capital'
  };
  
  return uniqueNamesGenerator(nameConfig);
}; 