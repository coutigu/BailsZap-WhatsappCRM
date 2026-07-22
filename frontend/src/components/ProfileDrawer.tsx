import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { X, User, Users, Info, Phone, Loader2, Shield, Hash } from 'lucide-react';
import Avatar from './Avatar';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  contact: any;
  isGroup?: boolean;
}

export default function ProfileDrawer({ isOpen, onClose, contact, isGroup }: ProfileDrawerProps) {
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Mount/unmount with animation
  useEffect(() => {
    if (isOpen) {
      setVisible(true);
    } else {
      // Delay unmount to let exit animation play
      const t = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !contact?.jid) return;

    const fetchData = async () => {
      setLoading(true);
      setData(null);
      try {
        if (isGroup) {
          const res = await axios.get(`${API_URL}/api/whatsapp/group-meta/${contact.jid}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setData(res.data);
        } else {
          const res = await axios.get(`${API_URL}/api/whatsapp/contact-info/${contact.jid}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setData(res.data);
        }
      } catch (err) {
        console.error('Error fetching profile info', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, contact?.jid, isGroup, token]);

  if (!visible && !isOpen) return null;

  const isAnimatingOut = !isOpen && visible;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
        style={{
          transition: 'opacity 280ms cubic-bezier(0.23, 1, 0.32, 1)',
          opacity: isOpen ? 1 : 0,
        }}
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        className="fixed top-0 right-0 h-full w-full max-w-md bg-darker border-l border-border-subtle shadow-2xl z-[70] flex flex-col overflow-hidden"
        style={{
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: isOpen
            ? 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)'
            : 'transform 260ms cubic-bezier(0.77, 0, 0.175, 1)',
        }}
      >
        {/* Header */}
        <div className="h-14 border-b border-border-subtle flex items-center justify-between px-5 glass shrink-0">
          <h2 className="text-sm font-semibold text-text-main flex items-center tracking-tight">
            {isGroup
              ? <><Users className="w-4 h-4 mr-2 text-primary" /> Dados do Grupo</>
              : <><User className="w-4 h-4 mr-2 text-primary" /> Dados do Contato</>
            }
          </h2>
          <button
            onClick={onClose}
            className="btn-press p-1.5 text-text-muted hover:text-text-main rounded-lg hover:bg-overlay transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Hero */}
        <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center border-b border-border-subtle bg-gradient-to-b from-white/[0.02] to-transparent">
          <div className="relative mb-4">
            <Avatar
              url={contact?.profilePicUrl}
              name={contact?.name || contact?.jid?.split('@')[0]}
              contactId={contact?.id}
              className="w-24 h-24 text-3xl shadow-2xl ring-4 ring-white/8"
            />
          </div>
          <h1 className="text-xl font-bold text-text-main tracking-tight">{contact?.name || 'Desconhecido'}</h1>
          {contact?.whatsappName && contact?.whatsappName !== contact?.name && (
            <p className="text-xs text-text-muted mt-1 italic">~ {contact.whatsappName}</p>
          )}
          <div className="mt-3 flex items-center text-xs font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
            <Phone className="w-3 h-3 mr-1.5" />
            {contact?.jid?.split('@')[0]}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
              <p className="text-xs text-text-faint">Carregando informações...</p>
            </div>
          ) : (
            <>
              {/* Status (pessoas) */}
              {!isGroup && data?.status && (
                <div className="animate-fade-in bg-surface border border-border-subtle rounded-2xl p-4">
                  <h3 className="text-[10px] font-semibold text-text-faint uppercase tracking-widest mb-2.5 flex items-center">
                    <Info className="w-3 h-3 mr-1.5" /> Recado
                  </h3>
                  <p className="text-text-main text-sm leading-relaxed">{data.status.status || 'Disponível'}</p>
                  {data.status.setAt && (
                    <p className="text-[10px] text-text-faint mt-2 tabular">
                      Atualizado em: {new Date(data.status.setAt).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              )}

              {/* Descrição (grupos) */}
              {isGroup && data?.desc && (
                <div className="animate-fade-in bg-surface border border-border-subtle rounded-2xl p-4">
                  <h3 className="text-[10px] font-semibold text-text-faint uppercase tracking-widest mb-2.5 flex items-center">
                    <Info className="w-3 h-3 mr-1.5" /> Descrição
                  </h3>
                  <p className="text-text-main text-sm whitespace-pre-wrap leading-relaxed">{data.desc}</p>
                </div>
              )}

              {/* Grupos em Comum */}
              {!isGroup && data?.commonGroups && data.commonGroups.length > 0 && (
                <div className="animate-fade-in">
                  <h3 className="text-[10px] font-semibold text-text-faint uppercase tracking-widest mb-3 flex items-center">
                    <Users className="w-3 h-3 mr-1.5" /> Grupos em Comum ({data.commonGroups.length})
                  </h3>
                  <div className="space-y-1.5">
                    {data.commonGroups.map((g: any, i: number) => (
                      <div
                        key={g.id}
                        className="bg-surface border border-border-subtle rounded-xl px-3 py-2.5 flex items-center"
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        <Avatar
                          url={g.profilePicUrl}
                          name={g.subject || g.id}
                          contactId={g.dbId}
                          className="w-8 h-8 mr-2.5 shrink-0 text-xs"
                        />
                        <span className="text-sm font-medium text-text-main truncate">{g.subject || g.id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sem grupos em comum */}
              {!isGroup && !loading && data && (!data.commonGroups || data.commonGroups.length === 0) && (
                <div className="animate-fade-in bg-surface border border-border-subtle rounded-2xl p-4 text-center">
                  <Hash className="w-5 h-5 text-text-faint mx-auto mb-2" />
                  <p className="text-xs text-text-faint">Nenhum grupo em comum</p>
                </div>
              )}

              {/* Participantes (grupos) */}
              {isGroup && data?.participants && (
                <div className="animate-fade-in">
                  <h3 className="text-[10px] font-semibold text-text-faint uppercase tracking-widest mb-3 flex items-center">
                    <Users className="w-3 h-3 mr-1.5" /> Participantes ({data.participants.length})
                  </h3>
                  <div className="bg-surface border border-border-subtle rounded-2xl overflow-hidden divide-y divide-border-subtle">
                    {data.participants.map((p: any) => (
                      <div key={p.id} className="px-4 py-3 flex items-center">
                        <div className="w-8 h-8 rounded-full bg-overlay border border-border-subtle flex items-center justify-center mr-3 shrink-0">
                          <User className="w-4 h-4 text-text-faint" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-main truncate">
                            {p.dbName || p.whatsappName || (p.phoneNumber || p.id).split('@')[0]}
                          </p>
                          {(p.dbName || p.whatsappName) && (
                            <p className="text-[10px] text-text-faint truncate tabular">{(p.phoneNumber || p.id).split('@')[0]}</p>
                          )}
                        </div>
                        {p.admin && (
                          <span className={`ml-2 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 ${p.admin === 'superadmin' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-primary/15 text-primary border border-primary/20'}`}>
                            {p.admin === 'superadmin' && <Shield className="w-2.5 h-2.5" />}
                            {p.admin === 'superadmin' ? 'Dono' : 'Admin'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
