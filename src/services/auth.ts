import { supabase } from '../lib/supabase';

export interface Perfil {
  id: string; // auth.users id
  rol: 'admin' | 'operador' | 'visita';
  full_name: string | null;
  avatar_url: string | null;
}

export const AuthService = {
  async getPerfil(userId: string): Promise<Perfil | null> {
    const { data, error } = await supabase
      .from('perfiles')
      .select('id, rol, full_name, avatar_url')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching perfil:', error);
      return null;
    }
    return data as Perfil;
  },

  async logIngreso(userId: string, metodo: 'google' | 'password'): Promise<void> {
    const { error } = await supabase
      .from('logs_ingreso')
      .insert([
        {
          user_id: userId,
          metodo,
          fecha_hora: new Date().toISOString()
        }
      ]);
    
    if (error) {
      console.error('Error logging ingreso:', error);
    }
  },

  async updatePerfil(userId: string, updates: Partial<Perfil>): Promise<void> {
    const { error } = await supabase
      .from('perfiles')
      .update(updates)
      .eq('id', userId);
    
    if (error) {
      console.error('Error updating perfil:', error);
      throw error;
    }
  }
};
