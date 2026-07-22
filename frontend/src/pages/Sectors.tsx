import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { Layers, Edit2, Trash2, X, Save, Shield } from 'lucide-react';
import Sidebar from '../components/Sidebar';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function Sectors() {
  const { token, user } = useAuthStore();
  const [sectors, setSectors] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState<any>(null); // null = off, 'new' = criando, object = editando
  const [editForm, setEditForm] = useState({ name: '', message: '' });

  const fetchSectors = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/sectors`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSectors(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSectors();
  }, [token]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este setor?')) return;
    try {
      await axios.delete(`${API_URL}/api/sectors/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchSectors();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Erro ao excluir setor.');
    }
  };

  const handleSave = async () => {
    if (!editForm.name || !editForm.message) {
      alert('Nome do setor e Mensagem de boas-vindas são obrigatórios!');
      return;
    }
    try {
      if (isEditing === 'new') {
        await axios.post(`${API_URL}/api/sectors`, editForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.put(`${API_URL}/api/sectors/${isEditing.id}`, editForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setIsEditing(null);
      fetchSectors();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Erro ao salvar setor.');
    }
  };

  const openEdit = (s: any) => {
    setIsEditing(s);
    setEditForm({ name: s.name, message: s.message });
  };

  const openNew = () => {
    setIsEditing('new');
    setEditForm({ name: '', message: '' });
  };

  if (user?.role !== 'Admin') {
    return (
      <div className="flex h-screen bg-darker text-text-main">
        <Sidebar />
        <div className="flex-1 flex flex-col items-center justify-center">
          <Shield className="w-16 h-16 text-red-500/50 mb-4" />
          <h2 className="text-2xl font-bold text-text-muted">Acesso Negado</h2>
          <p className="text-text-faint mt-2">Apenas administradores podem acessar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-darker text-text-main font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-8 relative">
        <div className="absolute top-[-30%] right-[-10%] w-[800px] h-[800px] bg-primary/5 rounded-full blur-[150px] pointer-events-none"></div>
        
        <div className="max-w-5xl mx-auto z-10 relative">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <h1 className="text-3xl font-bold flex items-center"><Layers className="mr-3 text-primary" /> Setores e Fila URA</h1>
            
            <button 
              onClick={openNew}
              className="px-5 py-2.5 bg-primary text-darker font-bold rounded-xl hover:bg-primary/90 transition shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]"
            >
              + Novo Setor
            </button>
          </div>
          
          <div className="bg-dark border border-border-focus rounded-2xl overflow-hidden shadow-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-overlay border-b border-border-focus text-sm font-medium text-text-muted">
                  <th className="p-4 pl-6">Nome do Setor</th>
                  <th className="p-4">Mensagem de Boas-vindas</th>
                  <th className="p-4 text-right pr-6">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sectors.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-text-faint">
                      Nenhum setor cadastrado. Quando houver 0 ou 1 setor, novos tickets serão criados sem menu de opções.
                    </td>
                  </tr>
                ) : (
                  sectors.map(s => (
                    <tr key={s.id} className="border-b border-border-subtle hover:bg-overlay transition group">
                      <td className="p-4 pl-6 font-semibold text-text-main">{s.name}</td>
                      <td className="p-4 text-text-muted max-w-md truncate" title={s.message}>{s.message}</td>
                      <td className="p-4 text-right pr-6">
                        <div className="flex items-center justify-end space-x-2">
                          <button onClick={() => openEdit(s)} className="p-2 bg-overlay hover:bg-overlay-hover text-text-muted hover:text-text-main rounded-lg transition" title="Editar">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(s.id)} 
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition" 
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de Cadastro/Edição */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-darker border border-border-focus rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-fade-in">
            <div className="p-6 border-b border-border-focus flex justify-between items-center">
              <h2 className="text-xl font-bold text-text-main flex items-center">
                <Layers className="w-5 h-5 mr-3 text-primary" />
                {isEditing === 'new' ? 'Novo Setor' : 'Editar Setor'}
              </h2>
              <button onClick={() => setIsEditing(null)} className="text-text-faint hover:text-text-main transition">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">Nome do Setor</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-dark border border-border-focus rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary/50 transition font-semibold"
                  placeholder="Ex: Financeiro, Dúvidas, Suporte"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">Mensagem de Boas-vindas</label>
                <textarea
                  value={editForm.message}
                  onChange={e => setEditForm({ ...editForm, message: e.target.value })}
                  className="w-full bg-dark border border-border-focus rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary/50 transition h-32 resize-none"
                  placeholder="Mensagem enviada automaticamente para o contato quando este setor for selecionado."
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-border-focus flex justify-end space-x-3 bg-dark/50">
              <button 
                onClick={() => setIsEditing(null)}
                className="px-5 py-2.5 rounded-xl border border-border-focus text-text-muted hover:bg-overlay transition"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="px-5 py-2.5 rounded-xl bg-primary text-darker font-bold hover:bg-primary/90 transition flex items-center shadow-lg shadow-primary/20"
              >
                <Save className="w-4 h-4 mr-2" />
                Salvar Setor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
