import React, { useState, FormEvent } from 'react';
import { motion } from 'motion/react';
import { Scissors, EyeOff, Eye, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { InputField } from '../components/ui/InputField';
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
                toast.success('Login realizado com sucesso!');
            }
        } catch (err: any) {
            const errorMessage = err.message || 'Ocorreu um erro ao processar sua solicitação.';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 transition-colors">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-8 sm:p-12"
            >
                <div className="flex justify-center mb-6">
                    <div className={`${(theme === 'dark' ? (settings.logo_url_dark || settings.logo_url) : settings.logo_url) ? 'w-full h-24' : 'w-16 h-16 rounded-2xl bg-primary/20 text-primary-dark dark:text-primary-light'} flex items-center justify-center overflow-hidden`}>
                        {theme === 'dark' && settings.logo_url_dark ? (
                            <img src={settings.logo_url_dark} alt="Logo" className="max-w-full max-h-full object-contain" />
                        ) : settings.logo_url ? (
                            <img src={settings.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
                        ) : (
                            <Scissors className="w-10 h-10" />
                        )}
                    </div>
                </div>
                {!(theme === 'dark' ? (settings.logo_url_dark || settings.logo_url) : settings.logo_url) && (
                    <h2 className="text-center text-3xl font-black text-primary-dark dark:text-primary-light mb-2">
                        {settings.business_name}
                    </h2>
                )}
                <h3 className="text-center text-xl font-bold text-slate-900 dark:text-white mb-2">
                    {isSignUp ? 'Crie sua conta' : 'Bem-vinda de volta'}
                </h3>
                <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-8">
                    {isSignUp
                        ? 'Comece a gerenciar sua clínica de forma profissional'
                        : 'Entre na sua conta para gerenciar sua clínica'}
                </p>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm font-medium"
                    >
                        {error}
                    </motion.div>
                )}

                <form className="space-y-4" onSubmit={handleAuth}>
                    {isSignUp && (
                        <InputField
                            label="Nome Completo"
                            placeholder="Como quer ser chamada?"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    )}

                    <InputField
                        label="E-mail"
                        placeholder="seu@email.com"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />

                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Senha</label>
                            {!isSignUp && (
                                <a href="#" className="text-xs font-semibold text-primary-dark dark:text-primary-light hover:text-primary">Esqueci minha senha</a>
                            )}
                        </div>
                        <div className="relative">
                            <input
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white transition-all"
                                placeholder="Sua senha secreta"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
                            >
                                {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {!isSignUp && (
                        <div className="flex items-center">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-primary focus:ring-primary accent-primary" />
                                <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">Lembrar-me</span>
                            </label>
                        </div>
                    )}

                    <Button
                        type="submit"
                        className="w-full mt-2"
                        size="lg"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Processando...
                            </span>
                        ) : (
                            isSignUp ? 'Criar minha conta' : 'Entrar'
                        )}
                    </Button>
                </form>

                <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-100 dark:border-slate-800"></div>
                    </div>
                    <div className="relative flex justify-center text-xs font-bold uppercase tracking-wider text-slate-400">
                        <span className="bg-white dark:bg-slate-900 px-4 transition-colors">OU</span>
                    </div>
                </div>

                <button className="w-full flex items-center justify-center gap-3 border border-slate-200 dark:border-slate-700 py-3 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all hover:border-slate-300 dark:hover:border-slate-600 active:scale-[0.98]">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path d="M12.0003 20.45c4.6483 0 8.545-3.2355 9.5936-7.702h-9.5936v-3.798h13.803c.123.637.189 1.303.189 1.99 0 7.363-5.029 12.55-12.046 12.55-6.627 0-12-5.373-12-12s5.373-12 12-12c3.15 0 6.027 1.134 8.283 3.018l-3.328 3.328c-1.077-.999-2.738-1.798-4.955-1.798-4.329 0-7.85 3.52-7.85 7.85s3.521 7.85 7.85 7.85V20.45z" fill="#4285F4" />
                    </svg>
                    Entrar com Google
                </button>

                <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-8">
                    {isSignUp ? 'Já tem uma conta?' : 'Não tem uma conta?'} {' '}
                    <button
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError(null);
                        }}
                        className="font-bold text-primary-dark dark:text-primary-light hover:text-primary transition-colors"
                    >
                        {isSignUp ? 'Entrar agora' : 'Criar conta gratuitamente'}
                    </button>
                </p>
            </motion.div>
        </div>
    );
};
