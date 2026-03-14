import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, User, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con Google.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        navigate('/'); // Will be handled by AuthGuard anyway, but good to have
      } else if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name
            }
          }
        });
        if (error) throw error;
        
        // Sometimes signUp logs user in immediately if email confirmation is off
        if (data.session) {
          navigate('/');
        } else {
          setSuccessMsg('Revisa tu correo para confirmar la cuenta.');
          setMode('login');
        }
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/reset-password', // To be implemented if needed
        });
        if (error) throw error;
        setSuccessMsg('Se ha enviado un correo de recuperación.');
        setMode('login');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ha ocurrido un error.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-dark-900">
      {/* Left Pane - Image & Brand (Visible on md+) */}
      <div className="hidden lg:flex w-1/2 relative bg-primary-900 overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 z-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=2070')] bg-cover bg-center mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-primary-900/90 to-primary-800/50 z-10"></div>
        <div className="relative z-20 text-center max-w-lg mx-auto">
          <img src="/fondologo.jpg" alt="Logo" className="w-40 h-40 mx-auto rounded-full border-4 border-white/20 shadow-2xl mb-8 object-cover" />
          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">AACM Web</h1>
          <p className="text-lg text-primary-100 leading-relaxed font-light">
            Plataforma integral para la gestión de socios y administración.
          </p>
        </div>
      </div>

      {/* Right Pane - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-md mx-auto relative z-10">
          
          <div className="text-center mb-8 lg:hidden">
            <img src="/fondologo.jpg" alt="Logo" className="w-24 h-24 mx-auto rounded-full border border-slate-200 dark:border-dark-700 shadow-md mb-4" />
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">AACM Web</h2>
          </div>

          <div className="bg-white dark:bg-dark-800 rounded-3xl shadow-xl dark:shadow-2xl border border-slate-100 dark:border-dark-700/50 p-8">
            <h2 className="text-2xl font-semibold mb-2 text-slate-800 dark:text-slate-100 text-center">
              {mode === 'login' ? 'Bienvenido de nuevo' : mode === 'register' ? 'Crear Usuario' : 'Recuperar contraseña'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
              {mode === 'login' ? 'Ingresa tus credenciales para continuar.' : mode === 'register' ? 'Ingresa tus datos para registrarte.' : 'Te enviaremos las instrucciones.'}
            </p>

            {errorMsg && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm border border-red-100 dark:border-red-900/50 flex items-start">
                <AlertCircle className="w-5 h-5 mr-2 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
            
            {successMsg && (
              <div className="mb-6 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm border border-green-100 dark:border-green-900/50 flex items-start">
                <AlertCircle className="w-5 h-5 mr-2 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre Completo</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 dark:border-dark-600 rounded-xl bg-slate-50 dark:bg-dark-900/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      placeholder="Juan Pérez"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 dark:border-dark-600 rounded-xl bg-slate-50 dark:bg-dark-900/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    placeholder="tu@email.com"
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Contraseña</label>
                    {mode === 'login' && (
                      <button type="button" onClick={() => setMode('forgot')} className="text-xs font-semibold text-primary-600 hover:text-primary-500 dark:text-primary-400 transition-colors">
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 dark:border-dark-600 rounded-xl bg-slate-50 dark:bg-dark-900/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all mt-6"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  mode === 'login' ? 'Iniciar Sesión' : mode === 'register' ? 'Crear Cuenta' : 'Enviar Instrucciones'
                )}
              </button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-dark-700" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-dark-800 text-slate-500">O también</span>
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-slate-300 dark:border-dark-600 rounded-xl shadow-sm bg-white dark:bg-dark-800 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-dark-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all disabled:opacity-70"
                >
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continuar con Google
                </button>
              </div>
            </div>

            <div className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
              {mode === 'login' ? (
                <>
                  ¿No tienes una cuenta?{' '}
                  <button onClick={() => setMode('register')} className="font-semibold text-primary-600 hover:text-primary-500 dark:text-primary-400 transition-colors">
                    Crear Usuario
                  </button>
                </>
              ) : (
                <>
                  ¿Ya tienes una cuenta?{' '}
                  <button onClick={() => setMode('login')} className="font-semibold text-primary-600 hover:text-primary-500 dark:text-primary-400 transition-colors">
                    Iniciar Sesión
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
