'use client';

import {useCallback, useContext} from 'react';
import {Moon, Sun} from 'lucide-react';
import {SettingsContext} from '@/app/contexts/settings';
import {Button} from '@/components/ui/button';

const ThemeToggle = ({className = ''}: {className?: string}) => {
  const settings = useContext(SettingsContext);
  const theme = settings.theme === 'light' ? 'light' : 'dark';

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    settings.handleUpdate({theme: next});
    const root = document.querySelector(':root');
    root && root.classList.remove('light', 'dark');
    root && root.classList.add(next);
  }, [settings, theme]);

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      onClick={toggleTheme}
      className={`gap-2 border border-[color:var(--hairline)] bg-screen-foreground text-primary ${className}`}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      {theme === 'dark' ? 'Light' : 'Dark'}
    </Button>
  );
};

export default ThemeToggle;
