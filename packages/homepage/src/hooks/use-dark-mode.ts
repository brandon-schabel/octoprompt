import { useEffect, useState } from 'react';

export function useDarkMode(): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            // Load initial state from localStorage if available
            const stored = window.localStorage.getItem('darkMode');
            return stored ? JSON.parse(stored) : false;
        }
        return false;
    });

    useEffect(() => {
        // Sync class on document root
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        // Persist to localStorage
        window.localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    }, [isDarkMode]);

    return [isDarkMode, setIsDarkMode];
}