import { useAuthStore } from '../store/authStore';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { Send, Users, MessageSquare, Ban, Paperclip } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Avatar from '../components/Avatar';
import ProfileDrawer from '../components/ProfileDrawer';
import { useRef, useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function Groups() {
  const { token, user } = useAuthStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [activeGroup, setActiveGroup] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [profileContact, setProfileContact] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeGroupRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    activeGroupRef.current = activeGroup;
  }, [activeGroup]);

  useEffect(() => {
    const fetchGroups = async () => {
      const { data } = await axios.get(`${API_URL}/api/tickets/groups`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroups(data);
    };
    fetchGroups();

    // Setup Socket
    const newSocket = io(API_URL);
    setSocket(newSocket);

    newSocket.on('new-ticket', (ticket) => {
      if (ticket.status === 'Grupo') {
        setGroups((prev) => [ticket, ...prev]);
      }
    });

    newSocket.on('ticket-updated', (data) => {
        if (data.status === 'Grupo') {
            setGroups(prev => {
                const exists = prev.find(t => t.id === data.id);
                if (exists) return prev.map(t => t.id === data.id ? data : t);
                return [data, ...prev];
            });
        }
    });

    newSocket.on('contact-updated', (data) => {
        setGroups((prev: any[]) => prev.map(t => t.contactId === data.id ? { ...t, contact: { ...t.contact, profilePicUrl: data.profilePicUrl } } : t));
        setActiveGroup((prev: any) => (prev && prev.contactId === data.id) ? { ...prev, contact: { ...prev.contact, profilePicUrl: data.profilePicUrl } } : prev);
    });

    newSocket.on('new-message', (msg) => {
      if (activeGroupRef.current && msg.ticketId === activeGroupRef.current.id) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    newSocket.on('message-deleted', (data) => {
      if (activeGroupRef.current && data.ticketId === activeGroupRef.current.id) {
        setMessages((prev) => prev.map(m => m.messageId === data.messageId ? { ...m, isDeleted: true } : m));
      }
    });

    return () => { newSocket.close(); };
  }, [token]);

  const loadMessages = async (group: any) => {
    setActiveGroup(group);
    const { data } = await axios.get(`${API_URL}/api/tickets/${group.id}/messages`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setMessages(data);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || !activeGroup) return;
    
    await axios.post(`${API_URL}/api/tickets/${activeGroup.id}/send`, { content: inputMsg }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setInputMsg('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files.length || !activeGroup) return;
    const file = e.target.files[0];
    
    const formData = new FormData();
    formData.append('file', file);
    if (inputMsg.trim()) {
      formData.append('caption', inputMsg);
    }

    try {
      await axios.post(`${API_URL}/api/tickets/${activeGroup.id}/send-media`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setInputMsg('');
    } catch (err) {
      console.error('Erro ao enviar mídia:', err);
      alert('Erro ao enviar mídia.');
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex h-screen bg-darker text-text-main font-sans overflow-hidden">
      <Sidebar />
      {/* Groups Sidebar */}
      <div className="w-80 border-r border-border-focus flex flex-col bg-dark relative z-10 shrink-0">
        <div className="p-6 border-b border-border-focus">
          <h1 className="text-xl font-bold tracking-tight text-text-main flex items-center">
            <Users className="w-5 h-5 mr-2 text-primary" /> Grupos
          </h1>
          <p className="text-xs text-text-muted mt-2">Monitore e responda grupos do WhatsApp.</p>
        </div>
        
        {/* Groups List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {groups.map(g => (
            <div 
              key={g.id} 
              onClick={() => loadMessages(g)}
              className={`p-4 rounded-xl cursor-pointer transition border flex items-center ${activeGroup?.id === g.id ? 'bg-overlay-hover border-border-focus' : 'bg-darker border-border-subtle hover:border-border-focus'}`}
            >
              <Avatar 
                url={g.contact?.profilePicUrl} 
                name={g.contact?.name || 'Grupo Desconhecido'} 
                contactId={g.contact?.id} 
                className="w-10 h-10 shrink-0 mr-3 text-sm"
                onAvatarRefresh={(newUrl) => {
                  setGroups(prev => prev.map(group => group.id === g.id ? { ...group, contact: { ...group.contact, profilePicUrl: newUrl } } : group));
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-sm truncate text-text-main">{g.contact?.name || 'Grupo Desconhecido'}</span>
                  <span className="text-[10px] text-text-faint shrink-0">{new Date(g.updatedAt).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          ))}
          {groups.length === 0 && (
             <div className="text-center p-6 text-text-faint text-sm">Nenhum grupo ativo detectado. Quando chegarem mensagens de grupos, eles aparecerão aqui.</div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        <div className="absolute top-[-30%] left-[20%] w-[800px] h-[800px] bg-primary/5 rounded-full blur-[150px] pointer-events-none"></div>

        {activeGroup ? (
          <>
            <div className="p-6 border-b border-border-focus flex justify-between items-center glass z-10">
              <div 
                className="flex items-center cursor-pointer hover:bg-overlay p-2 -ml-2 rounded-xl transition"
                onClick={() => {
                  setProfileContact(activeGroup.contact);
                  setShowProfileDrawer(true);
                }}
              >
                <Avatar 
                  url={activeGroup.contact?.profilePicUrl} 
                  name={activeGroup.contact?.name || 'Grupo'} 
                  contactId={activeGroup.contact?.id} 
                  className="w-12 h-12 shrink-0 mr-4 text-base"
                  onAvatarRefresh={(newUrl) => {
                    setActiveGroup((prev: any) => ({ ...prev, contact: { ...prev.contact, profilePicUrl: newUrl } }));
                  }}
                />
                <div>
                  <h2 className="text-lg font-semibold">{activeGroup.contact?.name || 'Grupo'}</h2>
                  <span className="text-xs text-primary">Grupo do WhatsApp</span>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 z-10">
              {messages.map(m => {
                const isSystem = m.sender === 'Sistema';
                return (
                  <div key={m.id} className={`flex flex-col ${isSystem ? 'items-end' : 'items-start'}`}>
                    {/* Exibe o nome do remetente da mensagem acima do balão (apenas se for mensagem de fora) */}
                    {!isSystem && m.sender !== 'Cliente' && (
                        <span className="text-xs text-primary mb-1 ml-1 font-medium">{m.sender}</span>
                    )}
                    <div className={`max-w-md p-4 rounded-2xl ${isSystem ? 'bg-primary/20 border border-primary/20 text-text-main rounded-tr-none' : 'bg-secondary border border-border-subtle rounded-tl-none'}`}>
                      {m.isDeleted && (
                         <div className="flex items-center text-xs text-red-400 mb-2 bg-red-400/10 px-2 py-1 rounded">
                           <Ban className="w-3 h-3 mr-1" /> Mensagem apagada pelo remetente
                         </div>
                      )}
                      
                      {m.type === 'text' && <p className="whitespace-pre-wrap text-sm">{m.content}</p>}
                      {m.type === 'image' && <img src={`${API_URL}${m.content}`} className="max-w-xs rounded-lg mt-2" alt="Imagem" />}
                      {m.type === 'sticker' && <img src={`${API_URL}${m.content}`} className="max-w-[120px] rounded-lg mt-2 bg-transparent" alt="Figurinha" />}
                      {m.type === 'video' && <video src={`${API_URL}${m.content}`} controls className="max-w-xs rounded-lg mt-2" />}
                      {m.type === 'audio' && <audio src={`${API_URL}${m.content}`} controls className="max-w-xs mt-2" />}
                      {m.type === 'document' && (
                          <a href={`${API_URL}${m.content}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 underline mt-2 bg-black/20 p-2 rounded-lg text-sm">
                              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                              <span className="truncate max-w-[200px]">{m.fileName || 'Baixar Documento'}</span>
                          </a>
                      )}
                      
                      <span className="text-[10px] text-text-faint mt-2 block text-right">
                        {new Date(m.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-border-focus glass z-10">
              <form onSubmit={sendMessage} className="flex gap-2 relative items-center">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                />
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 text-text-muted hover:text-text-main transition"
                  title="Anexar arquivo"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input 
                  type="text" 
                  value={inputMsg}
                  onChange={e => setInputMsg(e.target.value)}
                  placeholder="Envie uma mensagem (ou legenda)..."
                  className="flex-1 px-4 py-3 bg-dark/50 border border-border-focus rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-sm placeholder-gray-500"
                />
                <button 
                  type="submit" 
                  className="px-5 bg-primary text-darker rounded-xl hover:bg-emerald-400 transition shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-faint flex-col z-10">
            <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
            <p>Selecione um grupo na barra lateral para ler as mensagens.</p>
          </div>
        )}
      </div>
      
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
