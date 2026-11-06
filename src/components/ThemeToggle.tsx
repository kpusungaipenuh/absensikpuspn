import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  showLabel = false
}) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex items-center gap-1.5 p-2 rounded-xl transition-all cursor-pointer ${
        isDark
          ? 'bg-slate-800 text-amber-300 hover:bg-slate-700 border border-slate-700 shadow-xs'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 shadow-2xs'
      } ${className}`}
      title={isDark ? 'Ganti ke Mode Terang (Light Mode)' : 'Ganti ke Mode Gelap (Dark Mode)'}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className="w-4 h-4 transition-transform duration-300 rotate-0 scale-100" />
      ) : (
        <Moon className="w-4 h-4 transition-transform duration-300 rotate-0 scale-100 text-slate-700" />
      )}
      {showLabel && (
        <span className="text-xs font-semibold">
          {isDark ? 'Mode Gelap' : 'Mode Terang'}
        </span>
      )}
    </button>
  );
};
