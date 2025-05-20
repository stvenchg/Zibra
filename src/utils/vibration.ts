import { enableMainThreadBlocking } from "ios-vibrator-pro-max";
import "ios-vibrator-pro-max";

// Enable main thread blocking for long vibrations
// Disabled by default to avoid blocking the interface
enableMainThreadBlocking(false);

/**
 * Utility functions for vibrations
 * Uses only short and subtle vibrations
 */

// Light vibration for basic interactions
export const vibrateLight = () => {
  navigator.vibrate(50);
};

// Medium vibration for standard actions
export const vibrateMedium = () => {
  navigator.vibrate(100);
};

// Stronger vibration for important actions
export const vibrateStrong = () => {
  navigator.vibrate(200);
};

// Success vibration (pattern)
export const vibrateSuccess = () => {
  navigator.vibrate([50, 50, 100]);
};

// Error vibration (pattern)
export const vibrateError = () => {
  navigator.vibrate([100, 30, 100, 30, 100]);
};

// Notification vibration (more subtle)
export const vibrateNotification = () => {
  navigator.vibrate([30, 50, 30]);
}; 