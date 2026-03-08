import { useState, useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Clientes } from './pages/Clientes';
import { Agenda } from './pages/Agenda';
import { Servicos } from './pages/Servicos';
import { Financeiro } from './pages/Financeiro';
import { Configuracoes } from './pages/Configuracoes';
import { Profissionais } from './pages/Profissionais';
import { Chat } from './pages/Chat';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { Toaster } from 'react-hot-toast';

export default function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              zIndex: 99999,
            },
          }}
        />
        <AppContent />
      </NotificationProvider>
    </ThemeProvider>
  );
}

function AppContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Fetch and Apply SEO Settings
    const applySEO = async () => {
      try {
        const { data } = await supabase.from('settings').select('seo_title, seo_description, seo_keywords, favicon_url, favicon_url_dark').single();
        if (data) {
          if (data.seo_title) document.title = data.seo_title;

          if (data.seo_description) {
            let descMeta = document.querySelector('meta[name="description"]');
            if (!descMeta) {
              descMeta = document.createElement('meta');
              descMeta.setAttribute('name', 'description');
              document.head.appendChild(descMeta);
            }
            descMeta.setAttribute('content', data.seo_description);
          }

          if (data.seo_keywords) {
            let keyMeta = document.querySelector('meta[name="keywords"]');
            if (!keyMeta) {
              keyMeta = document.createElement('meta');
              keyMeta.setAttribute('name', 'keywords');
              document.head.appendChild(keyMeta);
            }
            keyMeta.setAttribute('content', data.seo_keywords);
          }

          const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
          let currentFavicon = isDark && data.favicon_url_dark ? data.favicon_url_dark : data.favicon_url;
          if (currentFavicon) {
            let link = document.querySelector('link[rel="icon"]') || document.querySelector('link[rel="shortcut icon"]');
            if (!link) {
              link = document.createElement('link');
              link.setAttribute('rel', 'icon');
              document.head.appendChild(link);
            }
            link.setAttribute('href', currentFavicon);
          }
        }
      } catch (e) {
        console.error('Failed to apply SEO', e);
      }
    };
    applySEO();

    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return <Login onLogin={() => { }} />;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard onPageChange={setCurrentPage} />;
      case 'clientes': return <Clientes />;
      case 'agenda': return <Agenda />;
      case 'servicos': return <Servicos />;
      case 'profissionais': return <Profissionais />;
      case 'financeiro': return <Financeiro />;
      case 'chat': return <Chat />;
      case 'configuracoes': return <Configuracoes onLogout={handleLogout} />;
      default: return <Dashboard onPageChange={setCurrentPage} />;
    }
  };

  return (
    <AppLayout
      currentPage={currentPage}
      onPageChange={setCurrentPage}
      user={session.user}
      onLogout={handleLogout}
    >
      {renderPage()}
    </AppLayout>
  );
}
