import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import { Save, Bot, Clock, ArrowLeft, ToggleLeft, ToggleRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function Settings() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const toast = useToast();
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSettings(data);
    } catch (err) {
      console.error('Erro ao buscar configurações:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await axios.post(`${API_URL}/api/settings`, settings, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Configurações salvas com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar configurações:', err);
      toast.error('Erro ao salvar as configurações.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (k: string, v: any) => {
    setSettings((prev: any) => ({ ...prev, [k]: v }));
  };

  return (
    <div className="flex h-screen bg-darker text-text-main overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-dark border-b border-border-subtle py-4 px-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')}
              className="p-2 hover:bg-overlay rounded-lg transition text-text-muted hover:text-text-main"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold">Configurações do Sistema</h2>
          </div>
          <button 
            onClick={saveSettings}
            disabled={saving}
            className="px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/20 rounded-lg text-sm font-medium transition flex items-center disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            
            {loading ? (
              <div className="text-center text-text-faint mt-10">Carregando configurações...</div>
            ) : (
              <form onSubmit={saveSettings} className="space-y-6">
                
                {/* Bot / URA */}
                <div className="bg-dark border border-border-subtle rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border-subtle">
                    <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-text-main">Configurações da URA / Bot</h3>
                      <p className="text-xs text-text-muted">Gerencie como o robô responde automaticamente.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-medium text-text-muted">Ativar Bot (URA)</label>
                        <p className="text-xs text-text-faint mt-1">Se desativado, o robô não enviará mensagens de menu e não associará setores sozinho.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={settings.botEnabled !== 'false'}
                          onChange={(e) => handleChange('botEnabled', e.target.checked ? 'true' : 'false')}
                        />
                        <div className="w-11 h-6 bg-overlay-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <div className="flex-1 mr-4">
                        <label className="block text-sm font-medium text-text-muted mb-1">Máximo de Tentativas do Bot</label>
                        <p className="text-xs text-text-faint">Se o contato errar o setor essa quantidade de vezes, o bot será desativado e o atendimento irá para a fila de "Em espera" sem setor.</p>
                      </div>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={settings.botMaxRetries || '3'}
                        onChange={(e) => handleChange('botMaxRetries', e.target.value)}
                        className="w-20 bg-darker border border-border-focus rounded-lg px-3 py-2 text-sm text-text-main focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-center"
                      />
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-text-muted mb-1">Mensagem de Saudação</label>
                      <p className="text-xs text-text-faint mb-2">Mensagem enviada pelo robô ANTES de listar os setores disponíveis.</p>
                      <textarea
                        value={settings.greetingMessage || ''}
                        onChange={(e) => handleChange('greetingMessage', e.target.value)}
                        placeholder="Ex: Olá! Por favor, selecione o setor para prosseguir digitando o número correspondente:"
                        className="w-full bg-darker border border-border-focus rounded-lg px-4 py-3 text-sm text-text-main focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[100px] resize-y"
                      />
                    </div>
                  </div>
                </div>

                {/* Tickets Behavior */}
                <div className="bg-dark border border-border-subtle rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border-subtle">
                    <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-text-main">Comportamento de Tickets</h3>
                      <p className="text-xs text-text-muted">Regras de negócio de atendimento e fechamento.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1">Tempo de Reabertura (minutos)</label>
                      <p className="text-xs text-text-faint mb-2">Se o cliente enviar uma nova mensagem dentro desse tempo após um ticket ser fechado, o sistema reabre o mesmo ticket. Se passar desse tempo, cria um novo (padrão: 0,5 = 30 seg).</p>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={settings.ticketReopenThreshold || '0.5'}
                        onChange={(e) => handleChange('ticketReopenThreshold', e.target.value)}
                        className="w-full md:w-1/3 bg-darker border border-border-focus rounded-lg px-4 py-2 text-sm text-text-main focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1">Mensagem de Encerramento</label>
                      <p className="text-xs text-text-faint mb-2">Se preenchido, o sistema enviará este texto automaticamente quando o atendente finalizar o ticket.</p>
                      <textarea
                        value={settings.goodbyeMessage || ''}
                        onChange={(e) => handleChange('goodbyeMessage', e.target.value)}
                        placeholder="Ex: Seu atendimento foi finalizado. Agradecemos o contato!"
                        className="w-full bg-darker border border-border-focus rounded-lg px-4 py-3 text-sm text-text-main focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[100px] resize-y"
                      />
                    </div>
                  </div>
                </div>

              </form>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
