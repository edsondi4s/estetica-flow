import React, { useState, FormEvent } from 'react';
import { motion } from 'motion/react';
import { Scissors, EyeOff, Eye, Loader2, ShieldCheck, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';

interface LoginProps {
    onLogin: () => void;
}

export const Login = ({ onLogin }: LoginProps) => {
    const { settings, theme } = useTheme();
    const [isSignUp, setIsSignUp] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');

    const handleAuth = async (e: FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            if (isSignUp) {
                const { error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: name,
                        },
                    },
                });
                if (signUpError) throw signUpError;
                toast.success('Verifique seu e-mail para confirmar o cadastro!');
                setIsSignUp(false);
            } else {
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (signInError) throw signInError;
                onLogin();
                toast.success('Acesso concedido. Bem-vindo(a).');
            }
        } catch (err: any) {
            const errorMessage = err.message || 'Falha na autenticação.';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 transition-colors relative overflow-hidden">
            {/* Background Decorations - Soft & Elegant */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-40 dark:opacity-20">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/20 blur-[150px] rounded-full mix-blend-multiply dark:mix-blend-screen" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[var(--color-secondary)]/20 blur-[150px] rounded-full mix-blend-multiply dark:mix-blend-screen" />
                {/* Elegant pattern overlay (optional) */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-[480px] relative z-10"
            >
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-luxury border border-white/50 dark:border-slate-700/50 shadow-2xl overflow-hidden relative">
                    
                    {/* Top elegant accent */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>

                    <div className="p-10 sm:p-14">
                        <div className="flex justify-center mb-8">
                            <motion.div 
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.2, duration: 0.5 }}
                                className="relative"
                            >
                                <div className={`${(theme === 'dark' ? (settings.logo_url_dark || settings.logo_url) : settings.logo_url) ? 'w-full h-24' : 'w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center text-primary border border-primary/20 transition-all'} relative z-10 flex items-center justify-center overflow-hidden shadow-inner`}>
                                    {theme === 'dark' && settings.logo_url_dark ? (
                                        <img src={settings.logo_url_dark} alt="Logo" className="max-w-full max-h-full object-contain drop-shadow-lg" />
                                    ) : settings.logo_url ? (
                                        <img src={settings.logo_url} alt="Logo" className="max-w-full max-h-full object-contain drop-shadow-lg" />
                                    ) : (
                                        <Sparkles className="w-10 h-10 stroke-[1.5]" />
                                    )}
                                </div>
                            </motion.div>
                        </div>

                        <div className="text-center mb-10">
                            <h2 className="text-3xl font-serif text-slate-900 dark:text-white mb-2 font-medium tracking-tight">
                                {isSignUp ? 'Criar Conta' : 'Bem-vindo'}
                            </h2>
                            <p className="text-sm text-slate-500 tracking-wide font-light">
                                {isSignUp ? 'Junte-se a nós para uma experiência premium' : 'Acesse o sistema de gestão exclusiva'}
                            </p>
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="mb-8 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-luxury flex items-start gap-4"
                            >
                                <ShieldCheck className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs font-semibold text-red-800 dark:text-red-300 mb-1">Acesso Negado</p>
                                    <p className="text-sm font-light text-red-600 dark:text-red-200">{error}</p>
                                </div>
                            </motion.div>
                        )}

                        <form className="space-y-5" onSubmit={handleAuth}>
                            {isSignUp && (
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 ml-1">Nome Completo</label>
                                    <input
                                        placeholder="Seu nome"
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-5 py-3.5 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-luxury text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all text-slate-900 dark:text-white placeholder:text-slate-400 font-light"
                                        required
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 ml-1">E-mail</label>
                                <input
                                    placeholder="exemplo@email.com"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-5 py-3.5 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-luxury text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all text-slate-900 dark:text-white placeholder:text-slate-400 font-light"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Senha</label>
                                    {isSignUp ? null : (
                                        <a href="#" className="text-xs text-primary hover:text-primary/80 transition-colors font-light">Esqueceu a senha?</a>
                                    )}
                                </div>
                                <div className="relative">
                                    <input
                                        className="w-full px-5 py-3.5 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-luxury text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all text-slate-900 dark:text-white placeholder:text-slate-400 font-light"
                                        placeholder="••••••••••••"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors p-1"
                                    >
                                        {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full mt-8 bg-primary text-white py-4 rounded-luxury border-none text-sm font-medium shadow-lg shadow-primary/20 luxury-hover group"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <span className="flex items-center gap-3">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Processando...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-3">
                                        {isSignUp ? 'Criar Minha Conta' : 'Acessar Sistema'}
                                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </span>
                                )}
                            </Button>
                        </form>

                        <div className="mt-10 flex justify-center border-t border-slate-100 dark:border-slate-800 pt-8">
                            <button
                                onClick={() => {
                                    setIsSignUp(!isSignUp);
                                    setError(null);
                                }}
                                className="text-sm text-slate-500 hover:text-primary transition-colors flex flex-col items-center gap-1"
                            >
                                <span className="font-light">
                                    {isSignUp ? 'Já possui uma conta?' : 'Novo por aqui?'}
                                </span>
                                <span className="font-medium">
                                    {isSignUp ? 'Fazer Login' : 'Criar Conta'}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-center items-center opacity-50">
                    <span className="text-xs text-slate-500 tracking-wide font-light">Estética Flow © {new Date().getFullYear()}</span>
                </div>
            </motion.div>
        </div>
    );
};
