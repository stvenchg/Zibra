import { Link } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { Button } from '@/components/ui/button';
import { Info, Github } from 'lucide-react';
import { useState, useEffect } from 'react';
import { vibrateLight } from '../utils/vibration';

export const Header = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    };

    // Check on load
    checkDarkMode();

    // Observe changes to the class attribute on the HTML element
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { 
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  // Function to handle click on the About button
  const handleInfoClick = () => {
    vibrateLight(); // Light vibration
    alert('Zibra - WebRTC File Sharing Application\nDeveloped with React, TypeScript and TailwindCSS\n\nMade with ❤️ by Steven Ching');
  };

  return (
    <header className="border-b border-border bg-card sticky top-0 z-50">
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
            title="About"
            onClick={handleInfoClick}
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