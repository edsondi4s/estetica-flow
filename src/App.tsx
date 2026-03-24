import { useState, useEffect, lazy, Suspense } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/Login';
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Clientes = lazy(() => import('./pages/Clientes').then(m => ({ default: m.Clientes })));
const Agenda = lazy(() => import('./pages/Agenda').then(m => ({ default: m.Agenda })));
const Servicos = lazy(() => import('./pages/Servicos').then(m => ({ default: m.Servicos })));
const Financeiro = lazy(() => import('./pages/Financeiro').then(m => ({ default: m.Financeiro })));
const Configuracoes = lazy(() => import('./pages/Configuracoes').then(m => ({ default: m.Configuracoes })));
const AgentesIA = lazy(() => import('./pages/AgentesIA').then(m => ({ default: m.AgentesIA })));
const Profissionais = lazy(() => import('./pages/Profissionais').then(m => ({ default: m.Profissionais })));
const Chat = lazy(() => import('./pages/Chat').then(m => ({ default: m.Chat })));
const BotFlows = lazy(() => import('./pages/BotFlows').then(m => ({ default: m.BotFlows })));
const Marketing = lazy(() => import('./pages/Marketing').then(m => ({ default: m.Marketing })));
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { Toaster } from 'react-hot-toast';
import { useAppointmentRealtime } from './hooks/useAppointmentRealtime';

export default function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <Toaster
          position="bottom-right"
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

  useAppointmentRealtime();

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

  // Background trigger for Reminders & Sweep (Frontend Cron Fallback)
  useEffect(() => {
    if (!session?.user) return;

    const pingWorker = async () => {
      try {
        await supabase.functions.invoke('reminders_worker');
      } catch (err) {
        console.error('Failed to trigger reminders worker', err);
      }
    };

    // Ping immediately on login
    pingWorker();

    // Ping every 5 minutes to keep it alive
    const interval = setInterval(pingWorker, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [session?.user]);

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
      case 'fluxos': return <BotFlows />;
      case 'marketing': return <Marketing />;
      case 'configuracoes':
        return <Configuracoes onLogout={handleLogout} />;
      case 'agentes_ia':
        return <AgentesIA />;
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
      <Suspense fallback={<div className="flex flex-1 items-center justify-center p-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>}>
        {renderPage()}
      </Suspense>
    </AppLayout>
  );
}
