import { useEffect, useState, useRef } from 'react';
import type React from 'react';
import { useAuthStore } from '../store/authStore';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { Send, User, CheckCircle2, Clock, Inbox, LogOut, Ban, MessageSquare, Smartphone, X, Paperclip, Headphones, Wifi, WifiOff, Smile, RefreshCw, Edit2, Trash2, Reply, Check, CheckCheck, Layers } from 'lucide-react';
import QRCode from 'react-qr-code';
import EmojiPicker from 'emoji-picker-react';
import { useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Avatar from '../components/Avatar';
import ProfileDrawer from '../components/ProfileDrawer';
import { useToast } from '../components/Toast';

const renderTextWithLinks = (text: string) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline underline-offset-2 break-all">
          {part}
        </a>
      );
    }
    return part;
  });
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const getSectorColor = (name: string) => {
  const colors = [
    'bg-blue-500/10 text-blue-400',
    'bg-emerald-500/10 text-emerald-400',
    'bg-purple-500/10 text-purple-400',
    'bg-orange-500/10 text-orange-400',
    'bg-pink-500/10 text-pink-400',
    'bg-teal-500/10 text-teal-400',
    'bg-yellow-500/10 text-yellow-400',
    'bg-indigo-500/10 text-indigo-400',
    'bg-rose-500/10 text-rose-400',
    'bg-cyan-500/10 text-cyan-400'
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return colors[sum % colors.length];
};

export default function Dashboard() {
  const { token, user, logout } = useAuthStore();
  const toast = useToast();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);
  const [activeTicket, setActiveTicket] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const activeTicketRef = useRef<any>(null);

  useEffect(() => {
    activeTicketRef.current = activeTicket;
  }, [activeTicket]);
  const [inputMsg, setInputMsg] = useState('');
  const [filter, setFilter] = useState<'Em espera' | 'Em atendimento' | 'Finalizado'>('Em espera');
  const [ticketSearch, setTicketSearch] = useState('');
  const [showOnlyMine, setShowOnlyMine] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [waStatus, setWaStatus] = useState<string>('connecting');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [profileContact, setProfileContact] = useState<any>(null);
  const [newTicketPhone, setNewTicketPhone] = useState('');
  const [newTicketName, setNewTicketName] = useState('');
  const [forwardMessage, setForwardMessage] = useState<any>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardSearch, setForwardSearch] = useState('');
  const [forwardContacts, setForwardContacts] = useState<any[]>([]);
  const [searchParams] = useSearchParams();
  const ticketIdParam = searchParams.get('ticketId');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [contactPresence, setContactPresence] = useState<any>(null);

  const [showSectorModal, setShowSectorModal] = useState<{isOpen: boolean, ticket: any, action: 'assign' | 'new'}>({ isOpen: false, ticket: null, action: 'assign' });
  const [showTransferModal, setShowTransferModal] = useState<{isOpen: boolean, ticket: any}>({ isOpen: false, ticket: null });
  const [transferUsers, setTransferUsers] = useState<any[]>([]);

  const refreshQueue = async () => {
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const { data: ticketsData } = await axios.get(`${API_URL}/api/tickets`, { headers });
      setTickets(ticketsData);
      toast.success('Fila atualizada');
    } catch (err) {
      toast.error('Erro ao atualizar fila');
    }
  };

  const refreshConversation = async () => {
    if (activeTicket) {
      await loadMessages(activeTicket);
      toast.success('Conversa atualizada');
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!activeTicket) return;
    
    if (!window.confirm('Tem certeza que deseja apagar esta mensagem para todos?')) return;

    try {
      await axios.delete(`${API_URL}/api/tickets/${activeTicket.id}/messages/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Mensagem apagada.');
    } catch (err) {
      toast.error('Erro ao apagar mensagem.');
    }
  };

  const editMessage = async (messageId: string, currentContent: string) => {
    if (!activeTicket) return;
    const newContent = window.prompt('Editar mensagem:', currentContent.replace(/^\*.*?\*\n\n/, ''));
    if (!newContent || newContent.trim() === '') return;
    
    try {
      await axios.put(`${API_URL}/api/tickets/${activeTicket.id}/messages/${messageId}`, { newContent }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Mensagem editada.');
    } catch (err) {
      toast.error('Erro ao editar mensagem.');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const fetchTicketsAndStatus = async () => {
      const headers = { Authorization: `Bearer ${token}` };
      const { data: ticketsData } = await axios.get(`${API_URL}/api/tickets`, { headers });
      setTickets(ticketsData);
      
      if (ticketIdParam) {
        const t = ticketsData.find((t: any) => t.id === ticketIdParam);
        if (t) loadMessages(t);
      }
      
      try {
        const { data: waData } = await axios.get(`${API_URL}/api/whatsapp/status`, { headers });
        setWaStatus(waData.status);
        setQrCode(waData.qr);
      } catch (err) {}

      try {
        const { data: sectorsData } = await axios.get(`${API_URL}/api/sectors`, { headers });
        setSectors(sectorsData);
      } catch (err) {}
    };
    fetchTicketsAndStatus();

    // Setup Socket
    const newSocket = io(API_URL);
    setSocket(newSocket);

    newSocket.on('new-ticket', (ticket) => {
      setTickets((prev) => [ticket, ...prev]);
    });

    newSocket.on('ticket-updated', (data) => {
        setTickets(prev => {
            const exists = prev.find(t => t.id === data.id);
            if (exists) return prev.map(t => t.id === data.id ? data : t);
            return [data, ...prev];
        });
        setActiveTicket(prev => (prev && prev.id === data.id) ? data : prev);
    });

    newSocket.on('contact-updated', (data) => {
        setTickets((prev: any[]) => prev.map(t => t.contactId === data.id ? { ...t, contact: { ...t.contact, profilePicUrl: data.profilePicUrl } } : t));
        setActiveTicket((prev: any) => (prev && prev.contactId === data.id) ? { ...prev, contact: { ...prev.contact, profilePicUrl: data.profilePicUrl } } : prev);
    });

    newSocket.on('new-message', (msg) => {
      if (activeTicketRef.current && msg.ticketId === activeTicketRef.current.id) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    newSocket.on('message-deleted', (data) => {
      if (activeTicketRef.current && data.ticketId === activeTicketRef.current.id) {
        setMessages((prev) => prev.map(m => m.messageId === data.messageId ? { ...m, isDeleted: true } : m));
      }
    });

    newSocket.on('message-edited', (data) => {
      if (activeTicketRef.current && data.ticketId === activeTicketRef.current.id) {
        setMessages((prev) => prev.map(m => m.messageId === data.messageId ? { ...m, content: data.content, isEdited: true, oldContent: data.oldContent } : m));
      }
    });

    newSocket.on('message-reaction', (data) => {
      if (activeTicketRef.current && data.ticketId === activeTicketRef.current.id) {
        setMessages((prev) => prev.map(m => m.messageId === data.messageId ? { ...m, reaction: data.reaction } : m));
      }
    });

    newSocket.on('message-ack', (data) => {
      if (activeTicketRef.current && data.ticketId === activeTicketRef.current.id) {
        setMessages((prev) => prev.map(m => m.messageId === data.messageId ? { ...m, ack: data.ack } : m));
      }
    });

    newSocket.on('contact-presence', (data) => {
      if (activeTicketRef.current && data.id === activeTicketRef.current.contact?.jid) {
          const presenceData = Object.values(data.presences || {})[0] as any;
          if (presenceData) {
             setContactPresence({ id: data.id, ...presenceData });
          }
      }
    });

    newSocket.on('ticket-transferred', (data) => {
      if (data.toUserId === user?.id) {
        toast.info(`O usuário ${data.fromUserName} transferiu a conversa de ${data.contactName} para você!`);
      }
    });

    newSocket.on('whatsapp-status', (status) => setWaStatus(status));
    newSocket.on('whatsapp-qr', (qr) => setQrCode(qr));

    return () => { newSocket.close(); };
  }, [token]);

  const loadMessages = async (ticket: any) => {
    setActiveTicket(ticket);
    setMessagesLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/tickets/${ticket.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(data);
    } finally {
      setMessagesLoading(false);
    }

    // Auto-heal missing profile picture lazily
    if (ticket.contact && !ticket.contact.profilePicUrl) {
      handleAvatarError(ticket.contact.id);
    }
  };

  useEffect(() => {
    if (activeTicket) {
      setContactPresence(null);
      axios.post(`${API_URL}/api/tickets/${activeTicket.id}/subscribe-presence`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
  }, [activeTicket?.id]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || !activeTicket) return;
    
    await axios.post(`${API_URL}/api/tickets/${activeTicket.id}/send`, { content: inputMsg, quotedMessageId: replyingTo?.id }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setInputMsg('');
    setReplyingTo(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files.length || !activeTicket) return;
    const file = e.target.files[0];
    await uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    if (inputMsg.trim()) {
      formData.append('caption', inputMsg);
    }

    try {
      await axios.post(`${API_URL}/api/tickets/${activeTicket.id}/send-media`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setInputMsg('');
    } catch (err) {
      console.error('Erro ao enviar mídia:', err);
      toast.error('Erro ao enviar mídia.');
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0 && activeTicket?.status === 'Em atendimento') {
      const file = e.clipboardData.files[0];
      if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/') || file.type.includes('pdf')) {
        e.preventDefault();
        await uploadFile(file);
      }
    }
  };

  const assignTicket = async () => {
    if (!activeTicket) return;
    if (!activeTicket.sectorId) {
      setShowSectorModal({ isOpen: true, ticket: activeTicket, action: 'assign' });
      return;
    }
    await executeAssignTicket(activeTicket);
  };

  const executeAssignTicket = async (ticket: any, direct: boolean = false) => {
    try {
      const { data } = await axios.post(`${API_URL}/api/tickets/${ticket.id}/assign`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTickets(prev => prev.map(t => t.id === data.id ? data : t));
      if (!direct) {
          setActiveTicket(data);
      } else {
          loadMessages(data);
      }
      setFilter('Em atendimento');
    } catch (err) {
      console.error('Erro ao assumir ticket:', err);
    }
  };

  const assignTicketDirectly = async (ticket: any) => {
    if (!ticket.sectorId) {
      setShowSectorModal({ isOpen: true, ticket, action: 'new' });
      return;
    }
    await executeAssignTicket(ticket, true);
  };

  const returnTicket = async () => {
    if (!activeTicket) return;
    try {
      const { data } = await axios.post(`${API_URL}/api/tickets/${activeTicket.id}/return`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTickets(prev => prev.map(t => t.id === data.id ? data : t));
      setActiveTicket(data);
      setFilter('Em espera');
    } catch (err) {
      console.error('Erro ao devolver ticket:', err);
    }
  };

  const closeTicket = async (skipGoodbye = false) => {
    if (!activeTicket) return;
    try {
      const { data } = await axios.post(`${API_URL}/api/tickets/${activeTicket.id}/close`, { skipGoodbye }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTickets(prev => prev.map(t => t.id === data.id ? data : t));
      setActiveTicket(data);
    } catch (err) {
      console.error('Erro ao finalizar ticket:', err);
    }
  };

  const reopenTicket = async () => {
    if (!activeTicket) return;
    try {
      const { data } = await axios.post(`${API_URL}/api/tickets/${activeTicket.id}/reopen`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTickets(prev => prev.map(t => t.id === data.id ? data : t));
      setActiveTicket(data);
    } catch (err) {
      console.error('Erro ao reabrir ticket:', err);
    }
  };

  const avatarAttempted = useRef<Set<string>>(new Set());

  const handleAvatarError = async (contactId: string) => {
    if (avatarAttempted.current.has(contactId)) return;
    avatarAttempted.current.add(contactId);

    try {
      await axios.post(
        `${API_URL}/api/contacts/${contactId}/refresh-avatar`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      console.log('Erro ao atualizar foto de perfil quebrada:', err);
    }
  };

  const createNewTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketPhone.trim()) return;
    try {
      const { data } = await axios.post(`${API_URL}/api/tickets`, { phone: newTicketPhone, name: newTicketName }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowNewTicketModal(false);
      setNewTicketPhone('');
      setNewTicketName('');
      setActiveTicket(data);
      toast.success('Atendimento criado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar ticket.');
    }
  };

  const reactToMessage = async (ticketId: string, messageId: string, emoji: string) => {
    try {
      await axios.post(`${API_URL}/api/tickets/${ticketId}/messages/${messageId}/react`, { emoji }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      toast.error('Erro ao reagir.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Mensagem copiada!');
  };

  // handleForward is deprecated, we use handleForwardToPhone exclusively

  useEffect(() => {
    if (showForwardModal) {
      axios.get(`${API_URL}/api/contacts`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => setForwardContacts(res.data)).catch(console.error);
    } else {
      setForwardContacts([]);
      setForwardSearch('');
    }
  }, [showForwardModal]);

  const handleForwardToPhone = async (phone: string, name: string = '') => {
    if (!phone.trim() || !forwardMessage) return;
    try {
      const { data } = await axios.post(`${API_URL}/api/tickets`, { phone: phone.replace(/\D/g, ''), name }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await axios.post(`${API_URL}/api/tickets/${data.id}/messages/${forwardMessage.id}/forward`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowForwardModal(false);
      setForwardMessage(null);
      setForwardSearch('');
      toast.success('Mensagem encaminhada!');
    } catch (err) {
      toast.error('Erro ao encaminhar mensagem.');
    }
  };

  const baseTickets = tickets.filter(t => {
    if (showOnlyMine) {
      // We must still show unassigned tickets (t.userId === null) so the agent can pick up new tickets in 'Em espera'
      // But if a ticket IS assigned to someone, and it's NOT the current user, hide it.
      if (t.userId !== null && t.userId !== user?.id) return false;
    }
    
    if (ticketSearch.trim()) {
      const searchLower = ticketSearch.toLowerCase();
      const searchNum = ticketSearch.replace(/\D/g, '');
      const nameMatch = t.contact?.name && t.contact.name.toLowerCase().includes(searchLower);
      const jidMatch = searchNum && t.contact?.jid && t.contact.jid.includes(searchNum);
      if (!nameMatch && !jidMatch) return false;
    }
    
    return true;
  });

  const filteredTickets = baseTickets.filter(t => t.status === filter);
  const countEspera = baseTickets.filter(t => t.status === 'Em espera').length;
  const countAtivos = baseTickets.filter(t => t.status === 'Em atendimento').length;

  // Status colors helper
  const statusConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
    'Em espera':      { color: 'text-amber-400', label: 'Em Espera', icon: <Clock className="w-3 h-3" /> },
    'Em atendimento': { color: 'text-primary', label: 'Em Atendimento', icon: <Headphones className="w-3 h-3" /> },
    'Finalizado':     { color: 'text-slate-400', label: 'Finalizado', icon: <CheckCircle2 className="w-3 h-3" /> },
  };

  return (
    <div className="flex h-screen bg-darker text-text-main overflow-hidden">
      <Sidebar />
      {/* Queues Sidebar */}
      <div className="w-[320px] hairline-r flex flex-col bg-darker relative z-10 shrink-0">
        <div className="p-5 hairline-b">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-[16px] font-semibold tracking-tight text-text-main">Atendimentos</h1>
            <div className="flex items-center gap-1.5">
              <button onClick={refreshQueue} className="btn-press p-1.5 bg-overlay text-text-muted hover:text-text-main hover:bg-overlay-hover rounded-lg transition-colors" title="Atualizar Fila">
                <RefreshCw className="w-[18px] h-[18px] stroke-[1.5]" />
              </button>
              <button onClick={() => setShowNewTicketModal(true)} className="btn-press p-1.5 bg-overlay text-text-muted hover:text-text-main hover:bg-overlay-hover rounded-lg transition-colors" title="Novo Ticket">
                <MessageSquare className="w-[18px] h-[18px] stroke-[1.5]" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center text-[13px] font-medium text-text-muted">
              <User className="w-[14px] h-[14px] mr-1.5 stroke-[2]" />
              {user?.name} 
              <span className="ml-2 px-1.5 py-0.5 rounded-md bg-overlay text-text-faint text-[10px] font-semibold uppercase tracking-wider">{user?.role}</span>
            </div>
            <button onClick={logout} className="text-text-faint hover:text-red-400 transition-colors" title="Sair">
              <LogOut className="w-[14px] h-[14px]" />
            </button>
          </div>
        </div>
        
        {/* WhatsApp Status — top of queue sidebar */}
        {user?.role === 'Admin' && (
          <div className="px-5 py-2.5 hairline-b bg-surface/30">
            <button
              onClick={() => setShowQrModal(true)}
              className={`btn-press w-full py-1.5 rounded-[8px] text-[12px] font-medium flex items-center justify-center transition-colors border gap-2 ${
                waStatus === 'open'
                  ? 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20'
                  : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
              }`}
            >
              <span className={`relative flex h-1.5 w-1.5`}>
                <span className={`animate-ping-slow absolute inline-flex h-full w-full rounded-full ${
                  waStatus === 'open' ? 'bg-primary' : 'bg-red-400'
                } opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                  waStatus === 'open' ? 'bg-primary' : 'bg-red-400'
                }`}></span>
              </span>
              {waStatus === 'open'
                ? 'WhatsApp Conectado'
                : 'Conectar WhatsApp'}
            </button>
          </div>
        )}

        {/* Queues Tabs */}
        <div className="flex p-3 gap-1 hairline-b bg-darker">
          <button onClick={() => setFilter('Em espera')} className={`btn-press relative flex-1 py-1.5 text-[12px] font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${filter === 'Em espera' ? 'bg-overlay-hover text-text-main shadow-sm' : 'text-text-muted hover:bg-overlay'}`}>
            <Inbox className="w-3.5 h-3.5 stroke-[1.5]" /> 
            <span>Espera</span>
            {countEspera > 0 && (
              <span className="bg-[#25D366] text-white rounded-full min-w-[16px] h-4 flex items-center justify-center text-[10px] px-1 font-bold shadow-sm">
                {countEspera}
              </span>
            )}
          </button>
          <button onClick={() => setFilter('Em atendimento')} className={`btn-press relative flex-1 py-1.5 text-[12px] font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${filter === 'Em atendimento' ? 'bg-overlay-hover text-text-main shadow-sm' : 'text-text-muted hover:bg-overlay'}`}>
            <Clock className="w-3.5 h-3.5 stroke-[1.5]" /> 
            <span>Ativos</span>
            {countAtivos > 0 && (
              <span className="bg-[#25D366] text-white rounded-full min-w-[16px] h-4 flex items-center justify-center text-[10px] px-1 font-bold shadow-sm">
                {countAtivos}
              </span>
            )}
          </button>
          <button onClick={() => setFilter('Finalizado')} className={`btn-press flex-1 py-1.5 text-[12px] font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${filter === 'Finalizado' ? 'bg-overlay-hover text-text-main shadow-sm' : 'text-text-muted hover:bg-overlay'}`}>
            <CheckCircle2 className="w-3.5 h-3.5 stroke-[1.5]" /> 
            <span>Fechados</span>
          </button>
        </div>

        {/* Toggle Show Only Mine */}
        <div className="px-5 py-2 flex items-center justify-between bg-darker/30">
          <span className="text-[12px] font-medium text-text-muted">Apenas meus atendimentos</span>
          <button 
            onClick={() => setShowOnlyMine(!showOnlyMine)}
            className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${showOnlyMine ? 'bg-primary' : 'bg-border-focus'}`}
          >
            <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${showOnlyMine ? 'translate-x-4' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Search Tickets */}
        <div className="px-3 pb-3 pt-1 hairline-b bg-darker/30">
          <input 
            type="text" 
            placeholder="Pesquisar tickets..." 
            value={ticketSearch}
            onChange={e => setTicketSearch(e.target.value)}
            className="w-full px-3 py-1.5 text-[13px] bg-dark rounded-[8px] border border-border-subtle focus:border-border-focus placeholder-text-faint outline-none"
          />
        </div>

        {/* Ticket List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {filteredTickets.map(t => (
            <div 
              key={t.id} 
              className={`p-3.5 rounded-[12px] transition-colors border ${activeTicket?.id === t.id ? 'bg-surface border-border-focus shadow-sm' : 'bg-transparent border-transparent hover:bg-overlay'}`}
            >
              <div className="flex items-center">
                <Avatar 
                  url={t.contact?.profilePicUrl} 
                  name={t.contact?.name || t.contact?.jid?.split('@')[0]} 
                  contactId={t.contact?.id} 
                  className="w-9 h-9 shrink-0 mr-3"
                  onAvatarRefresh={(newUrl) => {
                    setTickets(prev => prev.map(tick => tick.id === t.id ? { ...tick, contact: { ...tick.contact, profilePicUrl: newUrl } } : tick));
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-medium text-[13px] text-text-main truncate pr-2">{t.contact?.name || t.contact?.jid?.split('@')[0] || 'Desconhecido'}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {t.unreadCount > 0 && (
                        <span className="bg-primary text-darker text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                          {t.unreadCount}
                        </span>
                      )}
                      <span className="text-[10px] text-text-muted tabular">{new Date(t.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-text-faint flex justify-between items-center mt-0.5">
                    <span className="truncate pr-2">{t.user ? `Resp: ${t.user.name}` : 'Sem responsável'}</span>
                    {t.sector ? (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-[4px] font-medium shrink-0 tracking-wide uppercase ${getSectorColor(t.sector.name)}`}>
                        {t.sector.name}
                      </span>
                    ) : (
                      t.status === 'Em espera' && (
                        <span className="text-[9px] bg-amber-500/10 text-amber-500/80 px-1.5 py-0.5 rounded-[4px] font-medium shrink-0 tracking-wide uppercase">
                          Sem Setor
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              <div className={`flex gap-1.5 mt-3 pt-3 hairline-t ${activeTicket?.id === t.id ? 'border-border-subtle' : 'border-border-subtle'}`}>
                {t.status === 'Em espera' ? (
                  <>
                    <button 
                      onClick={(e) => { e.stopPropagation(); loadMessages(t); }} 
                      className="btn-press flex-1 py-1.5 bg-darker/50 text-text-muted hover:text-text-main rounded-lg text-[11px] font-medium transition-colors"
                    >
                      Espiar
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); assignTicketDirectly(t); }} 
                      className="btn-press flex-1 py-1.5 bg-primary/10 text-primary hover:bg-primary/15 rounded-lg text-[11px] font-medium transition-colors"
                    >
                      Atender
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={(e) => { e.stopPropagation(); loadMessages(t); }} 
                    className="btn-press w-full py-1.5 bg-overlay text-text-muted hover:text-text-main hover:bg-overlay-hover rounded-lg text-[11px] font-medium transition-colors"
                  >
                    Ver Conversa
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative bg-darker">
        {/* Subtle radial glow for chat area */}
        <div className="absolute top-[-30%] left-[20%] w-[800px] h-[800px] bg-primary/5 rounded-full blur-[150px] pointer-events-none"></div>

        {activeTicket ? (
          <>
            <div className="p-4 hairline-b flex justify-between items-center bg-surface/50 backdrop-blur-md z-10">
              <div
                className="btn-press flex items-center cursor-pointer hover:bg-overlay p-1.5 -ml-1.5 rounded-xl transition-colors"
                onClick={() => {
                  setProfileContact(activeTicket.contact);
                  setShowProfileDrawer(true);
                }}
              >
                <Avatar
                  url={activeTicket.contact?.profilePicUrl}
                  name={activeTicket.contact?.name || activeTicket.contact?.jid?.split('@')[0]}
                  contactId={activeTicket.contact?.id}
                  className="w-10 h-10 shrink-0 mr-3"
                  onAvatarRefresh={(newUrl) => {
                    setActiveTicket((prev: any) => ({ ...prev, contact: { ...prev.contact, profilePicUrl: newUrl } }));
                  }}
                />
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight text-text-main leading-tight">{activeTicket.contact?.name || activeTicket.contact?.jid?.split('@')[0]}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    {statusConfig[activeTicket.status] && (
                      <span className={`flex items-center gap-1 text-[11px] font-medium ${statusConfig[activeTicket.status].color}`}>
                        {statusConfig[activeTicket.status].icon}
                        {statusConfig[activeTicket.status].label}
                      </span>
                    )}
                    {activeTicket.sector && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-[4px] font-medium tracking-wide uppercase ${getSectorColor(activeTicket.sector.name)}`}>
                        {activeTicket.sector.name}
                      </span>
                    )}
                    {contactPresence && contactPresence.lastKnownPresence && (
                      <span className="text-[11px] font-medium text-emerald-400 ml-1">
                        {contactPresence.lastKnownPresence === 'composing' ? 'Digitando...' : 
                         contactPresence.lastKnownPresence === 'recording' ? 'Gravando áudio...' : 
                         contactPresence.lastKnownPresence === 'available' ? 'Online' : 
                         contactPresence.lastSeen ? `Visto por último às ${new Date(contactPresence.lastSeen * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <button onClick={refreshConversation} className="btn-press p-1.5 bg-overlay text-text-muted hover:text-text-main hover:bg-overlay-hover rounded-lg transition-colors" title="Atualizar Conversa">
                  <RefreshCw className="w-[18px] h-[18px] stroke-[1.5]" />
                </button>
                {/* Sector Selector */}
                <select
                  value={activeTicket.sectorId || ''}
                  onChange={async (e) => {
                    const secId = e.target.value;
                    try {
                      const { data } = await axios.post(
                        `${API_URL}/api/tickets/${activeTicket.id}/sector`,
                        { sectorId: secId || null },
                        { headers: { Authorization: `Bearer ${token}` } }
                      );
                      setActiveTicket(data);
                      setTickets(prev => prev.map(t => t.id === data.id ? data : t));
                    } catch (err) {
                      console.error('Erro ao transferir setor:', err);
                      alert('Erro ao transferir setor.');
                    }
                  }}
                  className="bg-transparent border-none text-[12px] text-text-muted hover:text-text-main focus:outline-none focus:ring-0 cursor-pointer font-medium pr-6 py-1"
                >
                  <option value="" className="bg-dark text-text-main">Sem Setor</option>
                  {sectors.map(s => (
                    <option key={s.id} value={s.id} className="bg-dark text-text-main">{s.name}</option>
                  ))}
                </select>
                
                <div className="w-px h-5 bg-overlay-hover mx-1"></div>

                {activeTicket.status === 'Em espera' && (
                  <>
                    <button onClick={assignTicket} className="btn-press px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-[12px] font-medium transition-colors">Assumir Ticket</button>
                    <button onClick={() => closeTicket(false)} className="btn-press px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-[12px] font-medium transition-colors">Finalizar</button>
                    <button onClick={() => closeTicket(true)} className="btn-press px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-[12px] font-medium transition-colors" title="Finalizar sem enviar mensagem de despedida">Finalizar S/ Msg</button>
                  </>
                )}
                {activeTicket.status === 'Em atendimento' && (
                  <>
                    <button onClick={() => {
                        setShowTransferModal({ isOpen: true, ticket: activeTicket });
                        axios.get(`${API_URL}/api/users/list`, { headers: { Authorization: `Bearer ${token}` }})
                          .then(res => setTransferUsers(res.data.filter((u: any) => u.id !== user?.id)))
                          .catch(console.error);
                    }} className="btn-press px-3 py-1.5 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 rounded-lg text-[12px] font-medium transition-colors">Transferir</button>
                    <button onClick={returnTicket} className="btn-press px-3 py-1.5 bg-amber-500/10 text-amber-500/80 hover:bg-amber-500/20 rounded-lg text-[12px] font-medium transition-colors">Devolver</button>
                    <button onClick={() => closeTicket(false)} className="btn-press px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-[12px] font-medium transition-colors">Finalizar</button>
                    <button onClick={() => closeTicket(true)} className="btn-press px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-[12px] font-medium transition-colors" title="Finalizar sem enviar mensagem de despedida">Finalizar S/ Msg</button>
                  </>
                )}
                {activeTicket.status === 'Finalizado' && (
                  <button onClick={reopenTicket} className="btn-press px-3 py-1.5 bg-overlay text-text-main hover:bg-overlay-hover rounded-lg text-[12px] font-medium transition-colors">Reabrir</button>
                )}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-1 z-10 scroll-smooth relative bg-darker/40">
              {/* Subtle glassmorphism background glow */}
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none z-0"></div>
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] pointer-events-none z-0"></div>
              
              <div className="relative z-10 space-y-1">
              {messagesLoading ? (
                <div className="space-y-4 p-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                      <div className={`skeleton h-12 ${i % 2 === 0 ? 'w-64' : 'w-48'} rounded-2xl`} />
                    </div>
                  ))}
                </div>
              ) : messages.map((m, idx) => {
                const isSystem = m.sender === 'Sistema';
                const prevMsg = messages[idx - 1];
                const showDaySeparator = !prevMsg || new Date(m.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();
                const dayLabel = (() => {
                  const d = new Date(m.timestamp);
                  const today = new Date();
                  const yesterday = new Date(today);
                  yesterday.setDate(today.getDate() - 1);
                  if (d.toDateString() === today.toDateString()) return 'Hoje';
                  if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
                  return d.toLocaleDateString('pt-BR');
                })();

                return (
                  <div key={m.id}>
                    {showDaySeparator && (
                      <div className="flex items-center gap-3 my-5">
                        <div className="flex-1 h-px bg-overlay" />
                        <span className="text-[10px] text-text-faint font-semibold tracking-widest uppercase tabular">{dayLabel}</span>
                        <div className="flex-1 h-px bg-overlay" />
                      </div>
                    )}
                    <div className={`flex ${isSystem ? 'justify-end' : 'justify-start'} mb-2`}>
                      <div className={`group relative flex items-center gap-2 max-w-[85%] lg:max-w-[70%] ${isSystem ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`px-4 py-3 ${isSystem ? 'bubble-agent' : 'bubble-client'} shadow-sm relative min-w-[70px]`}>
                          {m.isDeleted && (
                            <div className="flex items-center text-[11px] text-red-400/80 mb-1.5 font-medium">
                              <Ban className="w-3 h-3 mr-1" />
                              {isSystem ? 'Você apagou esta mensagem' : 'Mensagem apagada pelo contato'}
                            </div>
                          )}

                          {m.quotedMsgBody && (
                            <div className="mb-2 p-2 bg-dark/30 rounded-md border-l-4 border-primary text-[12px] opacity-80 overflow-hidden line-clamp-3">
                              {m.quotedMsgBody}
                            </div>
                          )}

                          {m.type === 'text' && (
                            <div className="relative group/edit">
                              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-text-main">
                                {renderTextWithLinks(m.content)}
                                {m.isEdited && <span className="text-[10px] text-text-faint ml-2 italic cursor-help relative" title={m.oldContent ? `Original:\n${m.oldContent}` : 'Original indisponível'}>(Editado)</span>}
                              </p>
                            </div>
                          )}
                          {m.type === 'image' && <img src={`${API_URL}${m.mediaUrl || m.content}`} className="max-w-xs rounded-lg mt-1" alt="Imagem" />}
                          {m.type === 'sticker' && <img src={`${API_URL}${m.mediaUrl || m.content}`} className="max-w-[120px] rounded-lg mt-1 bg-transparent" alt="Figurinha" />}
                          {m.type === 'video' && <video src={`${API_URL}${m.mediaUrl || m.content}`} controls className="max-w-xs rounded-lg mt-1" />}
                          {m.type === 'audio' && <audio src={`${API_URL}${m.mediaUrl || m.content}`} controls className="max-w-xs mt-1" />}
                          {m.type === 'document' && (
                            <a href={`${API_URL}${m.mediaUrl || m.content}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-text-muted hover:text-text-main mt-1 bg-darker/50 p-2.5 rounded-lg text-[13px] border border-border-subtle transition-colors">
                              <Paperclip className="w-4 h-4 flex-shrink-0" />
                              <span className="truncate max-w-[200px]">{m.fileName || 'Documento'}</span>
                            </a>
                          )}
                          {(m.mediaUrl && m.content && m.content.trim().length > 0) ? (
                            <p className="text-[14px] leading-relaxed text-text-main mt-2 whitespace-pre-wrap">
                              {renderTextWithLinks(m.content)}
                            </p>
                          ) : null}

                          <span className="text-[10px] text-text-faint mt-1 flex items-center justify-end gap-1 tabular">
                            {new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            {isSystem && m.ack !== undefined && (
                                m.ack <= 2 ? <Check className="w-3 h-3 text-text-muted" /> :
                                m.ack === 3 ? <CheckCheck className="w-3 h-3 text-text-muted" /> :
                                m.ack === 4 ? <CheckCheck className="w-3 h-3 text-blue-500" /> : null
                            )}
                          </span>

                          {m.reaction && (
                            <div className={`absolute -bottom-3 ${isSystem ? 'right-2' : 'left-2'} bg-surface border border-border-subtle rounded-full px-1.5 text-[14px] shadow-sm z-10 leading-none py-0.5`}>
                              {m.reaction}
                            </div>
                          )}
                        </div>

                        {/* Hover Actions Menu */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center bg-surface border border-border-subtle rounded-lg p-1 shadow-md gap-1 shrink-0 z-20">
                            {['👍', '❤️', '😂', '🙏'].map(emoji => (
                                <button key={emoji} onClick={() => reactToMessage(activeTicket.id, m.id, emoji)} className="hover:bg-overlay rounded p-1 text-[14px] leading-none">{emoji}</button>
                            ))}
                            <button onClick={() => reactToMessage(activeTicket.id, m.id, '')} className="hover:bg-overlay rounded p-1 text-[14px] leading-none text-red-400" title="Remover"><X className="w-3 h-3" /></button>
                            <div className="w-px h-4 bg-border-subtle mx-1"></div>
                            <button onClick={() => setReplyingTo(m)} className="p-1 hover:bg-overlay rounded text-text-muted" title="Responder"><Reply className="w-3 h-3" /></button>
                            <div className="w-px h-4 bg-border-subtle mx-1"></div>
                            {m.type === 'text' && (
                                <button onClick={() => copyToClipboard(m.content)} className="p-1 hover:bg-overlay rounded text-text-muted" title="Copiar"><span className="text-[10px] uppercase font-bold px-1 block">Copiar</span></button>
                            )}
                            <button onClick={() => { setForwardMessage(m); setShowForwardModal(true); }} className="p-1 hover:bg-overlay rounded text-text-muted" title="Encaminhar"><span className="text-[10px] uppercase font-bold px-1 block">Encaminhar</span></button>
                            {isSystem && m.type === 'text' && (
                              <button onClick={() => editMessage(m.id, m.content)} className="p-1 hover:bg-overlay rounded text-text-muted" title="Editar"><Edit2 className="w-3 h-3" /></button>
                            )}
                            {isSystem && (
                              <button onClick={() => deleteMessage(m.id)} className="p-1 hover:bg-overlay rounded text-red-400" title="Apagar"><Trash2 className="w-3 h-3" /></button>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="p-4 hairline-t bg-surface/30 backdrop-blur-md z-10 relative">
              {showEmojiPicker && (
                <div className="absolute bottom-[80px] z-50">
                  <EmojiPicker onEmojiClick={(e) => setInputMsg(prev => prev + e.emoji)} theme="dark" />
                </div>
              )}
              {replyingTo && (
                <div className="max-w-4xl mx-auto w-full mb-2 bg-surface/80 border-l-4 border-primary rounded-r-lg p-2.5 flex items-start justify-between backdrop-blur-md shadow-sm">
                  <div className="flex-1 min-w-0 pr-4">
                    <span className="text-primary text-[12px] font-bold block mb-1">Replying to {replyingTo.sender}</span>
                    <p className="text-[13px] text-text-muted truncate">
                      {replyingTo.content}
                    </p>
                  </div>
                  <button type="button" onClick={() => setReplyingTo(null)} className="text-text-faint hover:text-text-main p-1"><X className="w-4 h-4" /></button>
                </div>
              )}
              <form onSubmit={sendMessage} className="flex gap-2 relative items-center max-w-4xl mx-auto w-full">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                />
                <button 
                  type="button" 
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="btn-press p-2.5 text-text-muted hover:text-text-main bg-overlay hover:bg-overlay-hover rounded-[10px] transition-colors"
                  title="Emoji"
                >
                  <Smile className="w-5 h-5 stroke-[1.5]" />
                </button>
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-press p-2.5 text-text-muted hover:text-text-main bg-overlay hover:bg-overlay-hover rounded-[10px] transition-colors"
                  title="Anexar arquivo"
                >
                  <Paperclip className="w-5 h-5 stroke-[1.5]" />
                </button>
                <input 
                  type="text" 
                  value={inputMsg}
                  onChange={e => setInputMsg(e.target.value)}
                  onPaste={handlePaste}
                  disabled={activeTicket.status !== 'Em atendimento'}
                  placeholder={activeTicket.status === 'Em atendimento' ? "Escreva sua mensagem... (Cole imagens com Ctrl+V)" : "Assuma o ticket para responder"}
                  className="flex-1 px-4 py-2.5 text-[14px] bg-dark rounded-[10px] border border-border-subtle focus:border-border-focus placeholder-text-faint disabled:opacity-50"
                />
                <button 
                  type="submit" 
                  disabled={activeTicket.status !== 'Em atendimento' || !inputMsg.trim()}
                  className="btn-press btn-primary p-2.5 rounded-[10px] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-opacity"
                >
                  <Send className="w-5 h-5 stroke-[1.5] -ml-0.5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col z-10 gap-3">
            <div className="w-16 h-16 rounded-full bg-surface border border-border-subtle flex items-center justify-center mb-2 shadow-sm">
              <MessageSquare className="w-7 h-7 text-text-faint stroke-[1.5]" />
            </div>
            <div className="text-center">
              <p className="text-text-main font-medium text-[15px]">Nenhuma conversa selecionada</p>
              <p className="text-text-muted text-[13px] mt-1.5">Escolha um atendimento na barra lateral</p>
            </div>
            {countEspera > 0 && (
              <button
                onClick={() => setFilter('Em espera')}
                className="btn-press mt-4 px-4 py-2 bg-amber-500/10 text-amber-500/90 rounded-[8px] text-[13px] font-medium transition-colors hover:bg-amber-500/20"
              >
                Ver {countEspera} fila{countEspera !== 1 ? 's' : ''} de espera
              </button>
            )}
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-dark border border-border-focus p-6 rounded-2xl shadow-2xl relative max-w-sm w-full">
            <button onClick={() => setShowQrModal(false)} className="absolute top-4 right-4 text-text-faint hover:text-text-main transition">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold mb-2 flex items-center"><Smartphone className="mr-2" /> Conexão WhatsApp</h3>
            
            {waStatus === 'open' ? (
              <div className="text-center p-6 bg-primary/10 rounded-xl border border-primary/20 mt-4">
                <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-2" />
                <p className="text-primary font-medium">Aparelho conectado com sucesso!</p>
              </div>
            ) : qrCode ? (
              <div className="flex flex-col items-center mt-4">
                <p className="text-sm text-text-muted text-center mb-4">Abra o WhatsApp no celular, vá em "Aparelhos Conectados" e leia este código QR.</p>
                <div className="bg-white p-4 rounded-xl">
                  <QRCode value={qrCode} size={200} />
                </div>
              </div>
            ) : (
              <div className="text-center p-6 mt-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
                <p className="text-sm text-text-muted">Aguardando geração do QR Code...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Ticket Modal */}
      {showNewTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-dark border border-border-focus p-6 rounded-2xl shadow-2xl relative max-w-sm w-full">
            <button onClick={() => setShowNewTicketModal(false)} className="absolute top-4 right-4 text-text-faint hover:text-text-main transition">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold mb-4 flex items-center"><MessageSquare className="mr-2" /> Novo Atendimento</h3>
            <form onSubmit={createNewTicket} className="space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">Telefone / WhatsApp</label>
                <input type="text" placeholder="Ex: 5511999999999" value={newTicketPhone} onChange={e => setNewTicketPhone(e.target.value)} required className="w-full px-4 py-2 bg-darker border border-border-focus rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Nome (Opcional)</label>
                <input type="text" placeholder="Nome do contato" value={newTicketName} onChange={e => setNewTicketName(e.target.value)} className="w-full px-4 py-2 bg-darker border border-border-focus rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm" />
              </div>
              <button type="submit" className="w-full py-2 bg-primary text-darker font-bold rounded-lg hover:bg-emerald-400 transition shadow-[0_0_15px_rgba(16,185,129,0.2)]">Iniciar Atendimento</button>
            </form>
          </div>
        </div>
      )}

        {showSectorModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-dark border border-border-focus p-6 rounded-2xl shadow-2xl relative max-w-sm w-full animate-scale-in">
            <button onClick={() => setShowSectorModal({ isOpen: false, ticket: null, action: 'none' as any })} className="absolute top-4 right-4 text-text-faint hover:text-text-main transition">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold mb-4 flex items-center"><Layers className="mr-2 w-5 h-5 text-primary" /> Selecione o Setor</h3>
            <p className="text-text-muted text-[13px] mb-4">Para estatísticas mais precisas, informe de qual setor se trata este atendimento antes de iniciar.</p>
            <div className="space-y-2">
                {sectors.map(s => (
                    <button key={s.id} onClick={async () => {
                        try {
                            const { data } = await axios.post(`${API_URL}/api/tickets/${showSectorModal.ticket.id}/sector`, { sectorId: s.id }, { headers: { Authorization: `Bearer ${token}` } });
                            setTickets(prev => prev.map(t => t.id === data.id ? data : t));
                            if (showSectorModal.ticket.id === activeTicket?.id) setActiveTicket(data);
                            setShowSectorModal({ isOpen: false, ticket: null, action: 'none' as any });
                            await executeAssignTicket(data, showSectorModal.action === 'new');
                        } catch (err) {
                            toast.error('Erro ao definir setor.');
                        }
                    }} className="w-full text-left p-3 hover:bg-overlay rounded-lg flex items-center gap-3 border border-border-subtle transition-colors">
                        <div className={`w-3 h-3 rounded-full ${getSectorColor(s.name).replace('text-', 'bg-').split(' ')[0]}`}></div>
                        <span className="font-medium text-[14px] text-text-main">{s.name}</span>
                    </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {showTransferModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-dark border border-border-focus p-6 rounded-2xl shadow-2xl relative max-w-sm w-full animate-scale-in">
            <button onClick={() => setShowTransferModal({ isOpen: false, ticket: null })} className="absolute top-4 right-4 text-text-faint hover:text-text-main transition">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold mb-4 flex items-center"><Send className="mr-2 w-5 h-5 text-blue-500" /> Transferir Atendimento</h3>
            <p className="text-text-muted text-[13px] mb-4">Selecione o atendente para o qual deseja transferir esta conversa.</p>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {transferUsers.map(u => (
                    <button key={u.id} onClick={async () => {
                        try {
                            const { data } = await axios.post(`${API_URL}/api/tickets/${showTransferModal.ticket.id}/transfer`, { targetUserId: u.id }, { headers: { Authorization: `Bearer ${token}` } });
                            setTickets(prev => prev.map(t => t.id === data.id ? data : t));
                            setShowTransferModal({ isOpen: false, ticket: null });
                            setActiveTicket(null);
                            toast.success(`Atendimento transferido para ${u.name}!`);
                        } catch (err) {
                            toast.error('Erro ao transferir atendimento.');
                        }
                    }} className="w-full text-left p-2 hover:bg-overlay rounded-lg flex items-center gap-2 border border-transparent hover:border-border-subtle transition-colors">
                        <div className="w-8 h-8 shrink-0 flex items-center justify-center bg-blue-500/10 text-blue-500 rounded-full font-bold text-[13px]">{u.name.charAt(0).toUpperCase()}</div>
                        <span className="font-medium text-[14px] text-text-main truncate">{u.name}</span>
                    </button>
                ))}
                {transferUsers.length === 0 && <div className="text-text-muted text-sm p-2 text-center">Nenhum outro atendente disponível.</div>}
            </div>
          </div>
        </div>
      )}

      {/* Forward Modal */}
      {showForwardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-dark border border-border-focus p-6 rounded-2xl shadow-2xl relative max-w-sm w-full">
            <button onClick={() => { setShowForwardModal(false); setForwardMessage(null); setForwardSearch(''); }} className="absolute top-4 right-4 text-text-faint hover:text-text-main transition">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold mb-4 flex items-center"><Send className="mr-2 w-5 h-5" /> Encaminhar Mensagem</h3>
            <div className="mb-4">
              <input 
                type="text" 
                placeholder="Pesquisar contato ou digitar número..." 
                value={forwardSearch} 
                onChange={e => setForwardSearch(e.target.value)}
                className="w-full px-4 py-2 bg-darker border border-border-focus rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2 mb-2 pr-1">
                {forwardSearch.replace(/\D/g, '').length >= 10 && (
                    <button onClick={() => handleForwardToPhone(forwardSearch)} className="w-full text-left p-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg flex items-center gap-2 border border-transparent transition-colors mb-2">
                        <div className="w-8 h-8 shrink-0 flex items-center justify-center bg-primary text-darker rounded-full font-bold"><Send className="w-4 h-4" /></div>
                        <div className="flex-1 min-w-0 text-[13px] font-medium">Encaminhar para {forwardSearch}</div>
                    </button>
                )}
                {forwardContacts.filter(c => {
                    if (!forwardSearch) return true;
                    const searchLower = forwardSearch.toLowerCase();
                    const searchNum = forwardSearch.replace(/\D/g, '');
                    const nameMatch = c.name && c.name.toLowerCase().includes(searchLower);
                    const jidMatch = searchNum && c.jid && c.jid.includes(searchNum);
                    return nameMatch || jidMatch;
                }).map(c => (
                    <button key={c.id} onClick={() => handleForwardToPhone(c.jid.split('@')[0], c.name)} className="w-full text-left p-2 hover:bg-overlay rounded-lg flex items-center gap-2 border border-transparent hover:border-border-subtle transition-colors">
                        <Avatar url={c.profilePicUrl} name={c.name || c.jid} contactId={c.id} className="w-8 h-8 shrink-0" />
                        <div className="flex-1 min-w-0">
                           <div className="text-[13px] font-medium truncate text-text-main">{c.name || c.jid?.split('@')[0]}</div>
                        </div>
                    </button>
                ))}
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
