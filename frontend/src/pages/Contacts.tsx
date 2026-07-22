import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, User, Users, Edit2, Trash2, X, Save, DownloadCloud } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Avatar from '../components/Avatar';
import ProfileDrawer from '../components/ProfileDrawer';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function Contacts() {
  const { token } = useAuthStore();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState<any>(null); // Conta a editar
  const [isAdding, setIsAdding] = useState(false); // Modal de adição
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [profileContact, setProfileContact] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', notes: '', phone: '' });

  const fetchContacts = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/contacts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setContacts(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [token]);

  const startChat = async (contact: any) => {
    try {
      const { data } = await axios.post(`${API_URL}/api/tickets`, { phone: contact.jid.split('@')[0] }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      navigate(`/?ticketId=${data.id}`);
    } catch (err) {
      console.error(err);
      alert('Erro ao iniciar conversa');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este contato? Isso apagará também os tickets e mensagens.')) return;
    try {
      await axios.delete(`${API_URL}/api/contacts/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchContacts();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir contato');
    }
  };

  const handleEdit = (contact: any) => {
    setIsEditing(contact);
    setEditForm({
      name: contact.name || '',
      email: contact.email || '',
      notes: contact.notes || ''
    });
  };

  const handleAdd = async () => {
    if (!editForm.phone || !editForm.name) {
      alert('Nome e Telefone são obrigatórios!');
      return;
    }
    try {
      await axios.post(`${API_URL}/api/contacts`, editForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsAdding(false);
      fetchContacts();
    } catch (err) {
      console.error(err);
      alert('Erro ao adicionar contato');
    }
  };

  const handleSaveEdit = async () => {
    try {
      await axios.put(`${API_URL}/api/contacts/${isEditing.id}`, {
        name: editForm.name,
        email: editForm.email,
        notes: editForm.notes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsEditing(null);
      fetchContacts();
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar contato');
    }
  };

  const handleImport = async () => {
    if (!window.confirm('Deseja iniciar a importação da agenda do seu celular? (Pode levar alguns segundos)')) return;
    try {
      const { data } = await axios.post(`${API_URL}/api/contacts/import`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`Importação concluída! ${data.importedCount} contatos encontrados/sincronizados na memória atual.`);
      fetchContacts();
    } catch (err) {
      console.error(err);
      alert('Erro ao importar contatos');
    }
  };

  const getProfilePic = (url: string | null) => {
    if (!url) return null;
    return url.startsWith('/') ? `${API_URL}${url}` : url;
  };

  const handleAvatarError = async (contactId: string) => {
    try {
      const { data } = await axios.post(
        `${API_URL}/api/contacts/${contactId}/refresh-avatar`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, profilePicUrl: data.profilePicUrl } : c));
    } catch (err) {
      console.log('Erro ao atualizar foto de perfil quebrada:', err);
    }
  };

  const filteredContacts = contacts.filter(c => 
    (c.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (c.jid || '').includes(searchQuery)
  );

  return (
    <div className="flex h-screen bg-darker text-text-main font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-8 relative">
        <div className="absolute top-[-30%] left-[20%] w-[800px] h-[800px] bg-primary/5 rounded-full blur-[150px] pointer-events-none"></div>
        
        <div className="max-w-5xl mx-auto z-10 relative">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <h1 className="text-3xl font-bold flex items-center"><Users className="mr-3 text-primary" /> Contatos</h1>
            
            <div className="flex w-full md:w-auto space-x-3">
              <input 
                type="text" 
                placeholder="Pesquisar contatos..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full md:w-64 bg-dark border border-border-focus rounded-xl px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-primary/50 transition"
              />
              <button 
                onClick={handleImport}
                className="px-4 py-2.5 bg-darker border border-primary text-primary font-medium rounded-xl hover:bg-primary/10 transition whitespace-nowrap flex items-center"
                title="Importar da agenda do Celular"
              >
                <DownloadCloud className="w-4 h-4 mr-2" />
                Importar
              </button>
              <button 
                onClick={() => {
                  setEditForm({ name: '', email: '', notes: '', phone: '' });
                  setIsAdding(true);
                }}
                className="px-4 py-2.5 bg-primary text-darker font-medium rounded-xl hover:bg-primary/90 transition whitespace-nowrap"
              >
                + Novo Contato
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContacts.map(c => (
              <div key={c.id} className="bg-dark border border-border-focus rounded-2xl p-6 flex flex-col items-center text-center transition hover:border-primary/30 hover:bg-overlay relative group">
                
                {/* Ações ocultas reveladas no hover */}
                <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => {
                      setProfileContact(c);
                      setShowProfileDrawer(true);
                    }} 
                    className="p-2 bg-overlay hover:bg-overlay-hover text-text-muted hover:text-text-main rounded-lg transition" 
                    title="Ver Perfil"
                  >
                    <User className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleEdit(c)} className="p-2 bg-overlay hover:bg-overlay-hover text-text-muted hover:text-text-main rounded-lg transition" title="Editar Contato">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition" title="Excluir Contato">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <Avatar 
                  url={c.profilePicUrl} 
                  name={c.name || c.jid.split('@')[0]} 
                  contactId={c.id} 
                  className="w-20 h-20 mb-4 text-2xl"
                  onAvatarRefresh={(newUrl) => {
                    setContacts(prev => prev.map(contact => contact.id === c.id ? { ...contact, profilePicUrl: newUrl } : contact));
                  }}
                />
                <h3 className="text-lg font-bold text-text-main mb-1">{c.name || 'Desconhecido'}</h3>
                <p className="text-sm text-text-muted mb-2">{c.jid.split('@')[0]}</p>
                
                {/* Detalhes Extras */}
                {(c.email || c.notes) && (
                  <div className="w-full text-left bg-darker/50 p-3 rounded-lg mb-6 text-xs text-text-muted">
                    {c.email && <div className="truncate"><span className="text-text-faint">Email:</span> {c.email}</div>}
                    {c.notes && <div className="truncate mt-1"><span className="text-text-faint">Notas:</span> {c.notes}</div>}
                  </div>
                )}
                
                <button 
                  onClick={() => startChat(c)}
                  className="w-full mt-auto py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl hover:bg-primary hover:text-darker transition font-medium flex items-center justify-center"
                >
                  <MessageSquare className="w-4 h-4 mr-2" /> Iniciar Conversa
                </button>
              </div>
            ))}
            
            {filteredContacts.length === 0 && (
              <div className="col-span-full text-center py-20 text-text-faint">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p>Nenhum contato encontrado no sistema ainda.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Edição / Adição */}
      {(isEditing || isAdding) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-darker border border-border-focus rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-border-focus flex justify-between items-center">
              <h2 className="text-xl font-bold text-text-main flex items-center">
                <Edit2 className="w-5 h-5 mr-3 text-primary" />
                {isAdding ? 'Novo Contato' : 'Editar Contato'}
              </h2>
              <button onClick={() => { setIsEditing(null); setIsAdding(false); }} className="text-text-faint hover:text-text-main transition">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {isAdding && (
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-2">Telefone (WhatsApp)</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full bg-dark border border-border-focus rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary/50 transition"
                    placeholder="Ex: 5511999999999"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">Nome</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-dark border border-border-focus rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary/50 transition"
                  placeholder="Nome do Contato"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full bg-dark border border-border-focus rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary/50 transition"
                  placeholder="exemplo@email.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">Anotações / Notas</label>
                <textarea
                  value={editForm.notes}
                  onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full bg-dark border border-border-focus rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary/50 transition resize-none h-24"
                  placeholder="Informações adicionais do cliente..."
                ></textarea>
              </div>
            </div>
            
            <div className="p-6 border-t border-border-focus flex justify-end space-x-3 bg-dark/50">
              <button 
                onClick={() => { setIsEditing(null); setIsAdding(false); }}
                className="px-5 py-2.5 rounded-xl border border-border-focus text-text-muted hover:bg-overlay transition"
              >
                Cancelar
              </button>
              <button 
                onClick={isAdding ? handleAdd : handleSaveEdit}
                className="px-5 py-2.5 rounded-xl bg-primary text-darker font-medium hover:bg-primary/90 transition flex items-center shadow-lg shadow-primary/20"
              >
                <Save className="w-4 h-4 mr-2" />
                {isAdding ? 'Adicionar' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer de Perfil */}
      <ProfileDrawer 
        isOpen={showProfileDrawer}
        onClose={() => setShowProfileDrawer(false)}
        contact={profileContact}
        isGroup={profileContact?.jid?.includes('@g.us')}
      />
    </div>
  );
}
