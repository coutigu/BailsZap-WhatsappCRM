import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import Sidebar from '../components/Sidebar';
import { Layers, Users, MessageSquare, CheckCircle, Clock, Hourglass, BarChart as BarChartIcon, User, RefreshCcw } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface StatsData {
  totalTickets: number;
  ticketsByStatus: Record<string, number>;
  ticketsBySector: Record<string, number>;
  ticketsByUser: Record<string, number>;
  averageResolutionTimeMinutes: number;
  totalContacts: number;
  totalMessages: number;
  messagesBySender: Record<string, number>;
  ticketsByDate: Record<string, Record<string, number>>;
  ticketsByUserByMonth: Record<string, Record<string, number>>;
}

export default function Statistics() {
  const { token } = useAuthStore();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(response.data);
      } catch (err) {
        console.error('Failed to fetch stats', err);
      } finally {
        setLoading(false);
      }
    };
    if (token) {
      fetchStats();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="flex h-screen bg-dark">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-screen bg-dark">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center text-text-muted">
          Erro ao carregar estatísticas.
        </div>
      </div>
    );
  }

  const emEspera = data.ticketsByStatus['Em espera'] || 0;
  const emAtendimento = data.ticketsByStatus['Em atendimento'] || 0;
  const finalizados = data.ticketsByStatus['Finalizado'] || 0;

  return (
    <div className="flex h-screen bg-dark overflow-hidden selection:bg-primary/20 selection:text-primary">
      <Sidebar />
      <div className="flex-1 overflow-y-auto bg-dark p-8">
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
          
          {/* Header */}
          <div className="flex flex-col mb-8">
            <h1 className="text-3xl font-bold text-text-main tracking-tight flex items-center gap-3">
              <BarChartIcon className="w-8 h-8 text-primary animate-pulse" />
              Dashboard de Estatísticas (CRM)
            </h1>
            <p className="text-text-muted mt-2 text-[15px]">Visão geral dos atendimentos, contatos e performance da equipe.</p>
          </div>

          {/* Stat Cards Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard 
              title="Total de Tickets" 
              value={data.totalTickets} 
              icon={<Layers className="w-6 h-6 text-primary" />} 
              delay="0ms" 
            />
            <StatCard 
              title="Total de Contatos" 
              value={data.totalContacts} 
              icon={<User className="w-6 h-6 text-blue-400" />} 
              delay="100ms" 
            />
            <StatCard 
              title="Total de Mensagens" 
              value={data.totalMessages} 
              icon={<CheckCircle className="w-6 h-6 text-emerald-500" />} 
              delay="200ms" 
            />
          </div>

          {/* Stat Cards Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6">
            <StatCard 
              title="Em Espera" 
              value={emEspera} 
              icon={<Hourglass className="w-6 h-6 text-amber-500" />} 
              delay="300ms" 
            />
            <StatCard 
              title="Finalizados" 
              value={finalizados} 
              icon={<CheckCircle className="w-6 h-6 text-green-500" />} 
              delay="400ms" 
            />
            <StatCard 
              title="T.M. de Resolução" 
              value={`${data.averageResolutionTimeMinutes} min`} 
              icon={<Clock className="w-6 h-6 text-indigo-400" />} 
              delay="500ms" 
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Evolução Últimos 7 dias */}
            <div className="bg-surface rounded-2xl p-6 shadow-xl border border-border-subtle animate-slide-up col-span-1 lg:col-span-2" style={{ animationDelay: '550ms', animationFillMode: 'both' }}>
              <h2 className="text-[17px] font-semibold text-text-main mb-6 flex items-center gap-2">
                <BarChartIcon className="w-5 h-5 text-text-muted" />
                Novos Tickets (Últimos 7 dias)
              </h2>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={Object.entries(data.ticketsByDate || {}).map(([date, users]) => ({ date, ...users }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2D2D3B" vertical={false} />
                    <XAxis dataKey="date" stroke="#8A8A9E" fontSize={12} tickMargin={10} />
                    <YAxis stroke="#8A8A9E" fontSize={12} allowDecimals={false} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#1A1A24', borderColor: '#2D2D3B', borderRadius: '8px' }}
                      itemStyle={{ color: '#E1E1E6' }}
                    />
                    <Legend iconType="circle" />
                    {/* Exibe o Total como principal ou deixa apenas os atendentes empilhados. Vamos mostrar o total como barra separada ou stacked? Apenas colunas separadas para os atendentes é melhor. */}
                    {Array.from(new Set(Object.values(data.ticketsByDate || {}).flatMap(u => Object.keys(u).filter(k => k !== 'Total')))).map((user, idx) => {
                      const colors = ['#00E676', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];
                      return <Bar key={user} dataKey={user} stackId="a" fill={colors[idx % colors.length]} radius={[0, 0, 0, 0]} />;
                    })}
                    {/* The top bar in the stack needs radius */}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Atendimentos por Setor */}
            <div className="bg-surface rounded-2xl p-6 shadow-xl border border-border-subtle animate-slide-up" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
              <h2 className="text-[17px] font-semibold text-text-main mb-6 flex items-center gap-2">
                <Layers className="w-5 h-5 text-text-muted" />
                Atendimentos por Setor
              </h2>
              <div className="h-[250px] w-full">
                {Object.entries(data.ticketsBySector || {}).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(data.ticketsBySector || {}).map(([name, value]) => ({ name, value }))}
                        cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}
                        dataKey="value" stroke="none"
                      >
                        {Object.entries(data.ticketsBySector || {}).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={['#00E676', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'][index % 5]} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ backgroundColor: '#1A1A24', borderColor: '#2D2D3B', borderRadius: '8px' }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-text-muted text-[14px] flex items-center justify-center h-full">Nenhum dado disponível.</div>
                )}
              </div>
            </div>

            {/* Atendimentos por Atendente */}
            <div className="bg-surface rounded-2xl p-6 shadow-xl border border-border-subtle animate-slide-up" style={{ animationDelay: '700ms', animationFillMode: 'both' }}>
              <h2 className="text-[17px] font-semibold text-text-main mb-6 flex items-center gap-2">
                <User className="w-5 h-5 text-text-muted" />
                Atendimentos por Atendente (Geral)
              </h2>
              <div className="h-[250px] w-full">
                {Object.entries(data.ticketsByUser || {}).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={Object.entries(data.ticketsByUser || {}).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2D2D3B" horizontal={false} />
                      <XAxis type="number" stroke="#8A8A9E" fontSize={12} allowDecimals={false} />
                      <YAxis dataKey="name" type="category" stroke="#8A8A9E" fontSize={11} width={80} />
                      <RechartsTooltip contentStyle={{ backgroundColor: '#1A1A24', borderColor: '#2D2D3B', borderRadius: '8px' }} />
                      <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]} name="Tickets" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-text-muted text-[14px] flex items-center justify-center h-full">Nenhum dado disponível.</div>
                )}
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Mensagens Enviadas */}
            <div className="bg-surface rounded-2xl p-6 shadow-xl border border-border-subtle animate-slide-up lg:col-span-2" style={{ animationDelay: '800ms', animationFillMode: 'both' }}>
              <h2 className="text-[17px] font-semibold text-text-main mb-6 flex items-center gap-2">
                <Layers className="w-5 h-5 text-text-muted" />
                Origem das Mensagens (Sistema vs Cliente)
              </h2>
              <div className="h-[250px] w-full">
                {Object.entries(data.messagesBySender || {}).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={Object.entries(data.messagesBySender || {}).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2D2D3B" horizontal={false} />
                      <XAxis type="number" stroke="#8A8A9E" fontSize={12} allowDecimals={false} />
                      <YAxis dataKey="name" type="category" stroke="#8A8A9E" fontSize={12} width={80} />
                      <RechartsTooltip contentStyle={{ backgroundColor: '#1A1A24', borderColor: '#2D2D3B', borderRadius: '8px' }} />
                      <Bar dataKey="value" fill="#10B981" radius={[0, 4, 4, 0]} name="Mensagens" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-text-muted text-[14px] flex items-center justify-center h-full">Nenhum dado disponível.</div>
                )}
              </div>
            </div>
          </div>

          {/* Atendimentos por Usuário por Mês */}
          <div className="bg-surface rounded-2xl p-6 shadow-xl border border-border-subtle animate-slide-up" style={{ animationDelay: '900ms', animationFillMode: 'both' }}>
            <h2 className="text-[17px] font-semibold text-text-main mb-6 flex items-center gap-2">
              <BarChartIcon className="w-5 h-5 text-text-muted" />
              Atendimentos por Atendente (Por Mês)
            </h2>
            <div className="h-[400px] w-full">
              {Object.entries(data.ticketsByUserByMonth || {}).length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={
                      Object.entries(data.ticketsByUserByMonth || {}).map(([month, users]) => {
                        return { month, ...users };
                      })
                    }
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#2D2D3B" vertical={false} />
                    <XAxis dataKey="month" stroke="#8A8A9E" fontSize={12} />
                    <YAxis stroke="#8A8A9E" fontSize={12} allowDecimals={false} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#1A1A24', borderColor: '#2D2D3B', borderRadius: '8px' }} cursor={{fill: '#2D2D3B', opacity: 0.4}} />
                    <Legend iconType="circle" />
                    {/* Render a bar for each unique user across all months */}
                    {Array.from(new Set(Object.values(data.ticketsByUserByMonth || {}).flatMap(u => Object.keys(u)))).map((user, idx) => {
                      const colors = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];
                      return <Bar key={user} dataKey={user} fill={colors[idx % colors.length]} radius={[4, 4, 0, 0]} />;
                    })}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-text-muted text-[14px] flex items-center justify-center h-full">Nenhum dado disponível.</div>
              )}
            </div>
          </div>
          
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, delay }: { title: string, value: string | number, icon: React.ReactNode, delay: string }) {
  return (
    <div 
      className="bg-surface rounded-2xl p-6 shadow-lg border border-border-subtle flex items-center gap-5 hover:scale-[1.02] transition-transform duration-300 cursor-default animate-slide-up hover:shadow-2xl"
      style={{ animationDelay: delay, animationFillMode: 'both' }}
    >
      <div className="p-4 bg-darker rounded-xl border border-border-subtle flex-shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-[13px] font-medium text-text-muted tracking-wide uppercase mb-1">{title}</div>
        <div className="text-2xl font-bold text-text-main tracking-tight">{value}</div>
      </div>
    </div>
  );
}
