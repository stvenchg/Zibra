import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sun, Moon } from 'lucide-react';
import { useToast } from './ui/toast';
import { vibrateLight } from '../utils/vibration';

type Theme = 'light' | 'dark';

export const ThemeToggle = () => {
  const [theme, setTheme] = useState<Theme>('light');
  const { addToast } = useToast();

  // Load the theme when component mounts
  useEffect(() => {
    // Check if dark class is present
    const hasDarkClass = document.documentElement.classList.contains('dark');
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Determine initial theme
    let initialTheme: Theme;
    
    if (storedTheme) {
      // If a theme is stored, use it
      initialTheme = storedTheme as Theme;
    } else if (hasDarkClass) {
      // If dark class is present but no stored preference
      initialTheme = 'dark';
    } else if (prefersDark) {
      // If user prefers dark theme according to their system
      initialTheme = 'dark';
    } else {
      // Default to light theme
      initialTheme = 'light';
    }
    
    console.log('ThemeToggle - detected theme:', initialTheme);
    setTheme(initialTheme);
    
    // Apply theme
    applyTheme(initialTheme);
  }, []);
  
  // Apply the theme
  const applyTheme = (newTheme: Theme) => {
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Verify theme application
    console.log('Classes after application:', document.documentElement.className);
  };
  
  // Change theme
  const toggleTheme = () => {
    vibrateLight(); // Light vibration when changing theme
    
    const newTheme = theme === 'light' ? 'dark' : 'light';
    console.log('Changing theme to:', newTheme);
    
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Apply the change
    applyTheme(newTheme);
  };
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      className="relative overflow-hidden"
    >
      {theme === 'light' ? (
        <Moon size={18} className="transition-transform duration-300" />
      ) : (
        <Sun size={18} className="transition-transform duration-300" />
      )}
      <span className={`absolute inset-0 rounded-md transition-colors duration-300`}></span>
    </Button>
  );
}; 