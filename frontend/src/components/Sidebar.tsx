import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageSquare, Users, UserCog, Settings, X, Save, MessageCircle, Layers, Sliders, Sun, Moon, BarChart } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import axios from 'axios';
import { useToast } from './Toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function Sidebar() {
  const location = useLocation();
  const { user, token, setUser } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const toast = useToast();
  const [showProfile, setShowProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: user?.name || '', email: user?.email || '', password: '' });

  const handleOpenProfile = () => {
    setProfileForm({ name: user?.name || '', email: user?.email || '', password: '' });
    setShowProfile(true);
  };

  const handleSaveProfile = async () => {
    try {
      const { data } = await axios.put(`${API_URL}/api/users/profile`, profileForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser({ ...user, name: data.name, email: data.email });
      setShowProfile(false);
      toast.success('Perfil atualizado com sucesso!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao atualizar perfil.');
    }
  };

  return (
    <div className="w-[68px] bg-darker hairline-r flex flex-col items-center py-6 gap-6 z-20 relative shrink-0">
      <Link 
        to="/" 
        className={`p-2.5 rounded-xl btn-press ${location.pathname === '/' ? 'bg-overlay text-text-main shadow-sm' : 'text-text-faint hover:text-text-muted hover:bg-overlay'}`}
        title="Atendimentos (1-a-1)"
      >
        <MessageSquare className="w-[22px] h-[22px] stroke-[1.5]" />
      </Link>
      <Link 
        to="/groups" 
        className={`p-2.5 rounded-xl btn-press ${location.pathname === '/groups' ? 'bg-overlay text-text-main shadow-sm' : 'text-text-faint hover:text-text-muted hover:bg-overlay'}`}
        title="Grupos"
      >
        <MessageCircle className="w-[22px] h-[22px] stroke-[1.5]" />
      </Link>
      <Link 
        to="/contacts" 
        className={`p-2.5 rounded-xl btn-press ${location.pathname === '/contacts' ? 'bg-overlay text-text-main shadow-sm' : 'text-text-faint hover:text-text-muted hover:bg-overlay'}`}
        title="Contatos"
      >
        <Users className="w-[22px] h-[22px] stroke-[1.5]" />
      </Link>
      <Link 
        to="/stats" 
        className={`p-2.5 rounded-xl btn-press ${location.pathname === '/stats' ? 'bg-overlay text-text-main shadow-sm' : 'text-text-faint hover:text-text-muted hover:bg-overlay'}`}
        title="Estatísticas"
      >
        <BarChart className="w-[22px] h-[22px] stroke-[1.5]" />
      </Link>
      {user?.role === 'Admin' && (
        <>
          <div className="w-8 h-px bg-overlay my-1" />
          <Link 
            to="/users" 
            className={`p-2.5 rounded-xl btn-press ${location.pathname === '/users' ? 'bg-overlay text-text-main shadow-sm' : 'text-text-faint hover:text-text-muted hover:bg-overlay'}`}
            title="Equipe"
          >
            <UserCog className="w-[22px] h-[22px] stroke-[1.5]" />
          </Link>
          <Link 
            to="/sectors" 
            className={`p-2.5 rounded-xl btn-press ${location.pathname === '/sectors' ? 'bg-overlay text-text-main shadow-sm' : 'text-text-faint hover:text-text-muted hover:bg-overlay'}`}
            title="Setores"
          >
            <Layers className="w-[22px] h-[22px] stroke-[1.5]" />
          </Link>
          <Link 
            to="/settings" 
            className={`p-2.5 rounded-xl btn-press ${location.pathname === '/settings' ? 'bg-overlay text-text-main shadow-sm' : 'text-text-faint hover:text-text-muted hover:bg-overlay'}`}
            title="Configurações"
          >
            <Sliders className="w-[22px] h-[22px] stroke-[1.5]" />
          </Link>
        </>
      )}

      <div className="mt-auto mb-4 flex flex-col gap-2">
        <button 
          onClick={toggleTheme}
          className="p-2.5 rounded-xl btn-press text-text-faint hover:text-text-muted hover:bg-overlay transition-colors"
          title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
        >
          {theme === 'dark' ? (
            <Sun className="w-[20px] h-[20px] stroke-[1.5]" />
          ) : (
            <Moon className="w-[20px] h-[20px] stroke-[1.5]" />
          )}
        </button>
        <button 
          onClick={handleOpenProfile}
          className="p-2.5 rounded-xl btn-press text-text-faint hover:text-text-muted hover:bg-overlay transition-colors"
          title="Meu Perfil"
        >
          <Settings className="w-[20px] h-[20px] stroke-[1.5]" />
        </button>
      </div>

      {/* Modal de Perfil */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-border-subtle rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-scale-in">
            <div className="p-5 hairline-b flex justify-between items-center bg-darker/50">
              <h2 className="text-[15px] font-semibold text-text-main flex items-center tracking-tight">
                <Settings className="w-4 h-4 mr-2 text-text-muted" />
                Meu Perfil
              </h2>
              <button onClick={() => setShowProfile(false)} className="text-text-muted hover:text-text-main transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-text-muted">Nome</label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-[14px] bg-dark rounded-lg border border-border-subtle"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-text-muted">E-mail (Login)</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-[14px] bg-dark rounded-lg border border-border-subtle"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-text-muted">Nova Senha</label>
                <input
                  type="password"
                  value={profileForm.password}
                  onChange={e => setProfileForm({ ...profileForm, password: e.target.value })}
                  className="w-full px-3 py-2 text-[14px] bg-dark rounded-lg border border-border-subtle"
                  placeholder="Deixe em branco para manter"
                />
              </div>
            </div>
            
            <div className="p-5 hairline-t flex justify-end space-x-2 bg-darker/50">
              <button 
                onClick={() => setShowProfile(false)}
                className="btn-press btn-ghost px-4 py-2 rounded-xl text-[13px] font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveProfile}
                className="btn-press btn-primary px-4 py-2 rounded-xl text-[13px] font-medium flex items-center"
              >
                <Save className="w-4 h-4 mr-1.5" />
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
