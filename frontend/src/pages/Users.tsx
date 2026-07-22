import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { ShieldCheck, UserCog, Edit2, Trash2, X, Save, Shield } from 'lucide-react';
import Sidebar from '../components/Sidebar';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function Users() {
  const { token, user } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState<any>(null); // null = off, 'new' = criando, object = editando
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '', role: 'Atendente' });

  const fetchUsers = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const handleDelete = async (id: string) => {
    if (id === user?.id) {
      alert('Você não pode excluir sua própria conta!');
      return;
    }
    if (!window.confirm('Tem certeza que deseja excluir este usuário?')) return;
    try {
      await axios.delete(`${API_URL}/api/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir usuário');
    }
  };

  const handleSave = async () => {
    if (!editForm.name || !editForm.email) {
      alert('Nome e E-mail são obrigatórios!');
      return;
    }
    try {
      if (isEditing === 'new') {
        if (!editForm.password) {
          alert('Senha é obrigatória para novos usuários!');
          return;
        }
        await axios.post(`${API_URL}/api/users`, editForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.put(`${API_URL}/api/users/${isEditing.id}`, editForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setIsEditing(null);
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Erro ao salvar usuário');
    }
  };

  const openEdit = (u: any) => {
    setIsEditing(u);
    setEditForm({ name: u.name, email: u.email, role: u.role, password: '' });
  };

  const openNew = () => {
    setIsEditing('new');
    setEditForm({ name: '', email: '', role: 'Atendente', password: '' });
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
            <h1 className="text-3xl font-bold flex items-center"><UserCog className="mr-3 text-primary" /> Equipe e Usuários</h1>
            
            <button 
              onClick={openNew}
              className="px-5 py-2.5 bg-primary text-darker font-bold rounded-xl hover:bg-primary/90 transition shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]"
            >
              + Novo Usuário
            </button>
          </div>
          
          <div className="bg-dark border border-border-focus rounded-2xl overflow-hidden shadow-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-overlay border-b border-border-focus text-sm font-medium text-text-muted">
                  <th className="p-4 pl-6">Nome</th>
                  <th className="p-4">E-mail</th>
                  <th className="p-4">Perfil</th>
                  <th className="p-4 text-right pr-6">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-border-subtle hover:bg-overlay transition group">
                    <td className="p-4 pl-6 font-semibold">{u.name} {u.id === user?.id && <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Você</span>}</td>
                    <td className="p-4 text-text-muted">{u.email}</td>
                    <td className="p-4">
                      {u.role === 'Admin' ? (
                        <span className="flex items-center text-xs bg-red-500/20 text-red-400 px-3 py-1 rounded-lg w-fit"><ShieldCheck className="w-3 h-3 mr-1" /> Admin</span>
                      ) : (
                        <span className="flex items-center text-xs bg-blue-500/20 text-blue-400 px-3 py-1 rounded-lg w-fit"><UserCog className="w-3 h-3 mr-1" /> Atendente</span>
                      )}
                    </td>
                    <td className="p-4 text-right pr-6">
                      <div className="flex items-center justify-end space-x-2">
                        <button onClick={() => openEdit(u)} className="p-2 bg-overlay hover:bg-overlay-hover text-text-muted hover:text-text-main rounded-lg transition" title="Editar">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(u.id)} 
                          disabled={u.id === user?.id}
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition disabled:opacity-20 disabled:cursor-not-allowed" 
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de Edição / Adição */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-darker border border-border-focus rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-border-focus flex justify-between items-center">
              <h2 className="text-xl font-bold text-text-main flex items-center">
                <UserCog className="w-5 h-5 mr-3 text-primary" />
                {isEditing === 'new' ? 'Novo Usuário' : 'Editar Usuário'}
              </h2>
              <button onClick={() => setIsEditing(null)} className="text-text-faint hover:text-text-main transition">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">Nome</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-dark border border-border-focus rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary/50 transition"
                  placeholder="Ex: João Silva"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">E-mail</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full bg-dark border border-border-focus rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary/50 transition"
                  placeholder="exemplo@email.com"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-2">Senha</label>
                  <input
                    type="password"
                    value={editForm.password}
                    onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                    className="w-full bg-dark border border-border-focus rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary/50 transition"
                    placeholder={isEditing === 'new' ? "Senha" : "Deixe em branco"}
                  />
                  {isEditing !== 'new' && <span className="text-[10px] text-text-faint mt-1 block">Deixe em branco para manter a atual</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-2">Perfil</label>
                  <select
                    value={editForm.role}
                    onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full bg-dark border border-border-focus rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary/50 transition appearance-none"
                  >
                    <option value="Atendente">Atendente</option>
                    <option value="Admin">Administrador</option>
                  </select>
                </div>
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
                className="px-5 py-2.5 rounded-xl bg-primary text-darker font-medium hover:bg-primary/90 transition flex items-center shadow-lg shadow-primary/20"
              >
                <Save className="w-4 h-4 mr-2" />
                {isEditing === 'new' ? 'Cadastrar' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
