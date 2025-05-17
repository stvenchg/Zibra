import { Link } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { Button } from '@/components/ui/button';
import { Info, Github } from 'lucide-react';
import { useState, useEffect } from 'react';

export const Header = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Détecter le mode sombre
  useEffect(() => {
    const checkDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    };

    // Vérifier au chargement
    checkDarkMode();

    // Observer les changements de classe sur l'élément HTML
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { 
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center">
            <img 
              src="/zibra.svg" 
              alt="Zibra" 
              className={`h-8 transition-all duration-200 ${isDarkMode ? 'invert' : ''}`}
            />
          </Link>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            title="À propos"
            onClick={() => alert('Zibra - Application de partage de fichiers WebRTC\nDéveloppée avec React, TypeScript et TailwindCSS')}
          >
            <Info size={18} />
          </Button>
          
          <a 
            href="https://github.com/stvenchg/zibra" 
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center h-9 w-9 rounded-md text-sm font-medium transition-colors hover:bg-muted hover:text-muted-foreground"
            title="GitHub"
          >
            <Github size={18} />
          </a>
          
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}; 