import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '@supabase/supabase-js';

interface AppLayoutProps {
    children: ReactNode;
    currentPage: string;
    onPageChange: (id: string) => void;
    user: User;
    onLogout: () => Promise<void>;
}

export const AppLayout = ({ children, currentPage, onPageChange, user, onLogout }: AppLayoutProps) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 transition-colors overflow-hidden relative">
            <Sidebar
                currentPage={currentPage}
                onPageChange={(id) => {
                    onPageChange(id);
                    setIsMobileMenuOpen(false);
                }}
                user={user}
                onLogout={onLogout}
                isMobileOpen={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
            />

            <main className="flex-1 flex flex-col overflow-hidden">
                <Navbar
                    currentPageId={currentPage}
                    user={user}
                    onMenuClick={() => setIsMobileMenuOpen(true)}
                    onPageChange={onPageChange}
                />

                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentPage}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="max-w-7xl mx-auto w-full"
                        >
                            {children}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
};
