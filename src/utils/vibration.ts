import { enableMainThreadBlocking } from "ios-vibrator-pro-max";
import "ios-vibrator-pro-max";

// Activer le blocage du thread principal pour les vibrations longues
// Désactivé par défaut pour éviter de bloquer l'interface
enableMainThreadBlocking(false);

/**
 * Fonctions utilitaires pour les vibrations
 * Utilise uniquement des vibrations courtes et subtiles
 */

// Vibration légère pour les interactions de base
export const vibrateLight = () => {
  navigator.vibrate(50);
};

// Vibration moyenne pour les actions standard
export const vibrateMedium = () => {
  navigator.vibrate(100);
};

// Vibration plus forte pour les actions importantes
export const vibrateStrong = () => {
  navigator.vibrate(200);
};

// Vibration de succès (pattern)
export const vibrateSuccess = () => {
  navigator.vibrate([50, 50, 100]);
};

// Vibration d'erreur (pattern)
export const vibrateError = () => {
  navigator.vibrate([100, 30, 100, 30, 100]);
};

// Vibration de notification (plus subtile)
export const vibrateNotification = () => {
  navigator.vibrate([30, 50, 30]);
}; 