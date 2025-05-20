import { uniqueNamesGenerator, adjectives, colors, animals, names } from 'unique-names-generator';
import type { Config } from 'unique-names-generator';

/**
 * Generates a random device name in the format "Adjective Name"
 * Examples: "Jubilant Intuition", "Happy Cat", "Brave Tiger"
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
 * Generates a random device name in the format "Color Animal"
 * Examples: "Red Panda", "Blue Dolphin", "Green Elephant"
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
 * Generates a random device name in the format "Name Adjective"
 * Examples: "Alice Jubilant", "Bob Brave", "Charlie Happy"
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