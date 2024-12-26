// DarkModeToggle.tsx
import React from 'react';
import { useDarkMode } from '../hooks/use-dark-mode'; // Adjust path if needed
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';

export function DarkModeToggle() {
    const [isDarkMode, setIsDarkMode] = useDarkMode();

    const toggleDarkMode = () => setIsDarkMode((prev) => !prev);

    return (
        <Button variant="outline" onClick={toggleDarkMode} className="flex items-center gap-2">
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
        </Button>
    );
}