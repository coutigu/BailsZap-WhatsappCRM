import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MessageSquare } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const setAuth = useAuthStore(state => state.setAuth);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${API_URL}/api/auth/login`, { email, password });
      setAuth(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao fazer login');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-darker">
      {/* Subtle background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md px-8 py-10 glass rounded-[24px] shadow-2xl relative z-10 animate-scale-in">
        <div className="flex justify-center mb-8">
          <div className="w-12 h-12 bg-surface rounded-xl flex items-center justify-center border border-border-subtle shadow-inner">
            <MessageSquare className="text-primary w-6 h-6" />
          </div>
        </div>
        <h2 className="text-[22px] font-semibold text-center text-text-main mb-1.5 tracking-tight">BailsZap CRM</h2>
        <p className="text-center text-text-muted text-[13px] mb-8">Acesse seu workspace</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/10 text-red-400 px-4 py-3 rounded-xl mb-6 text-[13px] font-medium text-center animate-fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-text-muted">E-mail</label>
            <input
              type="email"
              className="w-full px-4 py-2.5 text-[14px]"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-text-muted">Senha</label>
            <input
              type="password"
              className="w-full px-4 py-2.5 text-[14px]"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn-press btn-primary w-full py-2.5 mt-2 rounded-xl text-[14px] shadow-sm flex items-center justify-center gap-2"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
