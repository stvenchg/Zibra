import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sun, Moon } from 'lucide-react';
import { useToast } from './ui/toast';

type Theme = 'light' | 'dark';

export const ThemeToggle = () => {
  const [theme, setTheme] = useState<Theme>('light');
  const { addToast } = useToast();

  // Charger le thème au montage du composant
  useEffect(() => {
    // Vérifier si la classe dark est présente
    const hasDarkClass = document.documentElement.classList.contains('dark');
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Déterminer le thème initial
    let initialTheme: Theme;
    
    if (storedTheme) {
      // Si un thème est stocké, l'utiliser
      initialTheme = storedTheme as Theme;
    } else if (hasDarkClass) {
      // Si la classe dark est présente mais pas de préférence stockée
      initialTheme = 'dark';
    } else if (prefersDark) {
      // Si l'utilisateur préfère le thème sombre selon son système
      initialTheme = 'dark';
    } else {
      // Par défaut, utiliser le thème clair
      initialTheme = 'light';
    }
    
    console.log('ThemeToggle - thème détecté:', initialTheme);
    setTheme(initialTheme);
    
    // Appliquer le thème
    applyTheme(initialTheme);
  }, []);
  
  // Appliquer le thème
  const applyTheme = (newTheme: Theme) => {
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Vérifier l'application du thème
    console.log('Classes après application:', document.documentElement.className);
  };
  
  // Changer le thème
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    console.log('Changement de thème vers:', newTheme);
    
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Appliquer le changement
    applyTheme(newTheme);
  };
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={`Basculer vers le thème ${theme === 'light' ? 'sombre' : 'clair'}`}
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