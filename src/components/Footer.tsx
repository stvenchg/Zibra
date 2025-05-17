import { Heart } from "lucide-react";
import { Link } from "react-router-dom";

export const Footer = () => {
  return (
    <footer className="py-4 border-t border-border bg-card">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>Zibra.io &copy; {new Date().getFullYear()}</span>
          </div>
          
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">Fait avec</span>
            <Heart className="h-4 w-4 fill-red-500 text-red-500 animate-pulse" />
            <span className="text-muted-foreground">par</span>
            <a 
              href="https://stevenching.fr" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Steven Ching
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}; 