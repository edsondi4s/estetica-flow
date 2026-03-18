import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Theme = 'light' | 'dark';

interface ClinicSettings {
    business_name: string;
    logo_url: string;
    logo_url_dark: string;
    primary_color: string;
}

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    settings: ClinicSettings;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>(() => {
        const saved = localStorage.getItem('theme');
        return (saved as Theme) || 'light';
    });

    const [settings, setSettings] = useState<ClinicSettings>({
        business_name: 'EstéticaFlow',
        logo_url: '',
        logo_url_dark: '',
        primary_color: '#10b981',
    });

    const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                // Try to find any settings row (for public branding)
                // We use .limit(1) and order by created_at to be consistent
                const { data, error } = await supabase
                    .from('settings')
                    .select('*')
                    .order('created_at', { ascending: true })
                    .limit(1)
                    .maybeSingle();

                if (error) {
                    console.warn('Configurações não encontradas ou erro de permissão. Usando padrões.', error.message);
                }

                if (data) {
                    setSettings({
                        business_name: data.business_name || 'EstéticaFlow',
                        logo_url: data.logo_url || '',
                        logo_url_dark: data.logo_url_dark || '',
                        primary_color: data.primary_color || '#10b981',
                    });
                }
            } catch (err) {
                console.error('Falha crítica ao buscar configurações:', err);
            } finally {
                setIsSettingsLoaded(true);
            }
        };
        fetchSettings();
    }, []);

    useEffect(() => {
        const root = window.document.documentElement;

        // Theme (Light/Dark)
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);

        // Dynamic Colors
        const primary = settings.primary_color;

        // Helper to lighten/darken hex colors
        const adjust = (color: string, amount: number) => {
            return '#' + color.replace(/^#/, '').replace(/../g, color => ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
        };

        root.style.setProperty('--primary', primary);
        root.style.setProperty('--primary-dark', adjust(primary, -20));
        root.style.setProperty('--primary-light', adjust(primary, 40));

    }, [theme, settings.primary_color]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, settings }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within a ThemeProvider');
    return context;
};
