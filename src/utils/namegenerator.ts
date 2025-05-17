import { uniqueNamesGenerator, adjectives, colors, animals, names } from 'unique-names-generator';
import type { Config } from 'unique-names-generator';

/**
 * Génère un nom d'appareil aléatoire au format "adjectif-nom"
 * Exemples: "jubilant-intuition", "happy-cat", "brave-tiger"
 */
export const generateDeviceName = (): string => {
  const nameConfig: Config = {
    dictionaries: [adjectives, animals],
    separator: '-',
    length: 2,
    style: 'lowerCase'
  };
  
  return uniqueNamesGenerator(nameConfig);
};

/**
 * Génère un nom d'appareil aléatoire au format "couleur-animal"
 * Exemples: "red-panda", "blue-dolphin", "green-elephant"
 */
export const generateColorfulDeviceName = (): string => {
  const nameConfig: Config = {
    dictionaries: [colors, animals],
    separator: '-',
    length: 2,
    style: 'lowerCase'
  };
  
  return uniqueNamesGenerator(nameConfig);
};

/**
 * Génère un nom d'appareil aléatoire au format "nom-adjectif"
 * Exemples: "alice-jubilant", "bob-brave", "charlie-happy"
 */
export const generatePersonalDeviceName = (): string => {
  const nameConfig: Config = {
    dictionaries: [names, adjectives],
    separator: '-',
    length: 2,
    style: 'lowerCase'
  };
  
  return uniqueNamesGenerator(nameConfig);
}; 