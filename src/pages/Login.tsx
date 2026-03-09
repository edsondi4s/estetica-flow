import React, { useState, FormEvent } from 'react';
import { motion } from 'motion/react';
import { Scissors, EyeOff, Eye, Loader2, ShieldCheck, ChevronRight, Terminal } from 'lucide-react';
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
                toast.success('Acesso concedido. Bem-vindo(a) à matriz.');
            }
        } catch (err: any) {
            const errorMessage = err.message || 'Falha na autenticação do ativo.';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 transition-colors relative overflow-hidden">
            {/* Background Decorations - Silk & Steel */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20 dark:opacity-40">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-slate-400 dark:bg-slate-800 blur-[120px] rounded-full" />
                {/* Technical Lines */}
                <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent" />
                <div className="absolute top-0 left-1/2 w-[1px] h-full bg-gradient-to-b from-transparent via-slate-200 dark:via-slate-800 to-transparent" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-[480px] relative z-10"
            >

                <div className="bg-white dark:bg-slate-950 rounded-sm border-2 border-slate-100 dark:border-white/10 shadow-[20px_20px_60px_rgba(0,0,0,0.1)] dark:shadow-[0_0_50px_rgba(0,0,0,0.3)] overflow-hidden">
                    <div className="p-10 sm:p-14">
                        <div className="flex justify-center mb-10">
                            <div className="relative group">
                                <div className="absolute -inset-4 bg-primary/20 rounded-full blur-xl group-hover:bg-primary/40 transition-all opacity-0 group-hover:opacity-100" />
                                <div className={`${(theme === 'dark' ? (settings.logo_url_dark || settings.logo_url) : settings.logo_url) ? 'w-full h-24' : 'w-20 h-20 bg-slate-950 rounded-sm flex items-center justify-center text-primary border-2 border-primary/20 transition-all'} relative z-10 flex items-center justify-center overflow-hidden`}>
                                    {theme === 'dark' && settings.logo_url_dark ? (
                                        <img src={settings.logo_url_dark} alt="Logo" className="max-w-full max-h-full object-contain" />
                                    ) : settings.logo_url ? (
                                        <img src={settings.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
                                    ) : (
                                        <Scissors className="w-12 h-12 stroke-[2.5]" />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-black text-slate-950 dark:text-white uppercase tracking-tighter leading-none mb-3">
                                {isSignUp ? 'CRIAR' : 'ACESSAR'} <span className="text-primary">{isSignUp ? 'CONTA' : 'SISTEMA'}</span>
                            </h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Gestão Inteligente para Estética</p>
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="mb-8 p-6 bg-red-50 dark:bg-red-500/5 border-l-4 border-red-500 rounded-none flex items-start gap-4"
                            >
                                <ShieldCheck className="w-5 h-5 text-red-500 shrink-0" />
                                <div>
                                    <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-1">ERRO DE SEGURANÇA</p>
                                    <p className="text-xs font-bold text-red-900 dark:text-red-200">{error}</p>
                                </div>
                            </motion.div>
                        )}

                        <form className="space-y-6" onSubmit={handleAuth}>
                            {isSignUp && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-950 dark:text-white uppercase tracking-widest px-1">Identificação Completa</label>
                                    <input
                                        placeholder="Seu nome aqui"
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-none text-xs font-black uppercase tracking-widest outline-none focus:border-primary focus:bg-white dark:focus:bg-slate-800 transition-all text-slate-950 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700"
                                        required
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-950 dark:text-white uppercase tracking-widest px-1">Seu E-mail</label>
                                <input
                                    placeholder="exemplo@email.com"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-none text-xs font-black uppercase tracking-widest outline-none focus:border-primary focus:bg-white dark:focus:bg-slate-800 transition-all text-slate-950 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[10px] font-black text-slate-950 dark:text-white uppercase tracking-widest">Sua Senha</label>
                                    {isSignUp ? null : (
                                        <a href="#" className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline">Esqueceu a senha?</a>
                                    )}
                                </div>
                                <div className="relative">
                                    <input
                                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-none text-xs font-black uppercase tracking-widest outline-none focus:border-primary focus:bg-white dark:focus:bg-slate-800 transition-all text-slate-950 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700"
                                        placeholder="••••••••••••"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors p-1"
                                    >
                                        {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full mt-6 bg-slate-950 dark:bg-primary py-8 rounded-none border-none text-[12px] font-black uppercase tracking-[0.4em] shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all group"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <span className="flex items-center gap-3">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        ENTRANDO...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-3">
                                        {isSignUp ? 'CRIAR MINHA CONTA' : 'ENTRAR NO SISTEMA'}
                                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </span>
                                )}
                            </Button>
                        </form>

                        <div className="mt-12 flex justify-center">
                            <button
                                onClick={() => {
                                    setIsSignUp(!isSignUp);
                                    setError(null);
                                }}
                                className="text-[11px] font-bold text-slate-500 hover:text-primary transition-all group flex flex-col items-center gap-2 w-full max-w-xs"
                            >
                                <span className="uppercase tracking-[0.2em] opacity-60 w-full text-center">
                                    {isSignUp ? 'Já tem uma conta?' : 'Novo por aqui?'}
                                </span>
                                <span className="text-slate-950 dark:text-white group-hover:text-primary underline underline-offset-8 font-black uppercase tracking-widest text-[12px] bg-slate-50 dark:bg-slate-900 px-4 py-2 rounded-sm mt-1 transition-all w-full text-center">
                                    {isSignUp ? 'Fazer Login' : 'Criar meu acesso agora'}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer Decoration */}
                <div className="mt-8 flex justify-center items-center px-2 opacity-40">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">EsteticaFlow © 2026</span>
                </div>
            </motion.div>
        </div>
    );
};
