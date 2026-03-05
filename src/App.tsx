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
        <AppContent />
        <Toaster position="top-right" />
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
