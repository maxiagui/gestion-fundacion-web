import React, { useState } from 'react';
import { Settings, LogOut, ChevronRight, User as UserIcon, X, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AuthService } from '../services/auth';
import { supabase } from '../lib/supabase';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// Helper to generate initials and color
const getInitialAndColor = (email?: string, name?: string) => {
  const str = name || email || 'Usuario';
  const initial = str.charAt(0).toUpperCase();
  
  // Predictable colors based on initial
  const colors = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-500', 
    'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-blue-500', 
    'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500',
    'bg-pink-500', 'bg-rose-500'
  ];
  const charCode = initial.charCodeAt(0) || 0;
  const color = colors[charCode % colors.length];
  
  return { initial, color };
};

export default function ProfileSection() {
  const { user, perfil, signOut, updatePerfilState } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Profile edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(perfil?.full_name || '');
  const [isSaving, setIsSaving] = useState(false);
  
  // Password edit state
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [passMsg, setPassMsg] = useState({ text: '', type: '' });

  if (!user) return null;

  const handleLogout = async () => {
    if (window.confirm('¿Estás seguro de que quieres cerrar sesión?')) {
      await signOut();
    }
  };

  const isGoogle = user.app_metadata.provider === 'google';
  const avatarUrl = perfil?.avatar_url || user.user_metadata?.avatar_url;
  const displayName = perfil?.full_name || user.user_metadata?.full_name || (user.email ? user.email.split('@')[0] : 'Usuario');
  
  const { initial, color } = getInitialAndColor(user.email, displayName);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await AuthService.updatePerfil(user.id, { full_name: editName });
      updatePerfilState({ full_name: editName });
      setIsEditing(false);
    } catch (err) {
      alert("Error al guardar perfil.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPass || newPass.length < 6) {
      setPassMsg({ text: 'Debe tener al menos 6 caracteres', type: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) throw error;
      setPassMsg({ text: 'Contraseña actualizada', type: 'success' });
      setNewPass('');
      setTimeout(() => setPassMsg({text:'', type:''}), 3000);
    } catch (err: any) {
      setPassMsg({ text: err.message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const openModal = () => {
    setEditName(perfil?.full_name || displayName);
    setIsModalOpen(true);
    setIsEditing(false);
    setIsChangingPass(false);
    setPassMsg({text:'', type:''});
    setNewPass('');
  };

  return (
    <div className="p-4 border-t border-border dark:border-dark-700 bg-slate-50/50 dark:bg-dark-900/50">
      
      {/* Profile summary button */}
      <button 
        onClick={openModal}
        className="flex items-center w-full p-2 mb-2 rounded-xl hover:bg-slate-200/50 dark:hover:bg-dark-700/50 transition-colors duration-200 group text-left"
      >
        <div className="relative flex-shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-dark-700 shadow-sm" />
          ) : (
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white font-bold border-2 border-white dark:border-dark-700 shadow-sm", color)}>
              {initial}
            </div>
          )}
          {/* Online indicator */}
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-dark-800 rounded-full"></div>
        </div>
        
        <div className="ml-3 flex-1 overflow-hidden">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{displayName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{perfil?.rol || user.email}</p>
        </div>
        
        <div className="flex items-center justify-center text-slate-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          <Settings className="w-4 h-4 mr-1" />
        </div>
      </button>

      {/* Logout button */}
      <button 
        onClick={handleLogout}
        className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200"
      >
        <LogOut className="mr-3 h-4 w-4" />
        Cerrar Sesión
      </button>

      {/* Settings Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-dark-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Perfil</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="flex flex-col items-center mb-6">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-20 h-20 rounded-full object-cover shadow-sm mb-3" />
                ) : (
                  <div className={cn("w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-sm mb-3", color)}>
                    {initial}
                  </div>
                )}
                <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
                {perfil?.rol && <span className="mt-2 px-2.5 py-1 text-xs font-semibold bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 rounded-lg">{perfil.rol}</span>}
              </div>

              {/* Edit Name */}
              <div className="space-y-4">
                <div className="border border-slate-200 dark:border-dark-700 rounded-xl p-4 bg-slate-50 dark:bg-dark-900/30">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nombre de visualización</label>
                    <button onClick={() => setIsEditing(!isEditing)} className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400">
                      {isEditing ? 'Cancelar' : 'Editar'}
                    </button>
                  </div>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={editName} 
                        onChange={e => setEditName(e.target.value)} 
                        className="flex-1 px-3 py-1.5 text-sm border border-slate-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 outline-none focus:border-primary-500"
                      />
                      <button onClick={handleSaveProfile} disabled={isSaving} className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm disabled:opacity-50">
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-slate-800 dark:text-slate-200 font-medium">{displayName}</p>
                  )}
                </div>

                {/* Change Password - Only if not google */}
                {!isGoogle && (
                  <div className="border border-slate-200 dark:border-dark-700 rounded-xl p-4 bg-slate-50 dark:bg-dark-900/30">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Seguridad</label>
                      <button onClick={() => setIsChangingPass(!isChangingPass)} className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400">
                        {isChangingPass ? 'Cancelar' : 'Cambiar Contraseña'}
                      </button>
                    </div>
                    
                    {isChangingPass ? (
                      <form onSubmit={handleChangePassword} className="space-y-3 mt-3 border-t border-slate-200 dark:border-dark-700 pt-3">
                        <input 
                          type="password" 
                          placeholder="Nueva contraseña"
                          value={newPass} 
                          onChange={e => setNewPass(e.target.value)} 
                          className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 outline-none focus:border-primary-500"
                        />
                        <button type="submit" disabled={isSaving} className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                          {isSaving ? 'Guardando...' : 'Actualizar Contraseña'}
                        </button>
                        {passMsg.text && (
                          <p className={cn("text-xs text-center mt-2", passMsg.type === 'error' ? "text-red-500" : "text-green-500")}>
                            {passMsg.text}
                          </p>
                        )}
                      </form>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">Acceso mediante email y contraseña.</p>
                    )}
                  </div>
                )}

                {isGoogle && (
                   <div className="border border-slate-200 dark:border-dark-700 rounded-xl p-4 bg-slate-50 dark:bg-dark-900/30 text-center">
                    <p className="text-xs text-slate-500 flex items-center justify-center">
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      Cuenta vinculada con Google
                    </p>
                   </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
