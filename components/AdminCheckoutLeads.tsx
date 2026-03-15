import React, { useEffect, useState } from 'react';
import { getCheckoutLeads, deleteCheckoutLead, CheckoutLead } from '../services/database';
import { Trash2, Mail, Phone, Calendar, ArrowLeft, RefreshCw, Copy, Check, CheckCircle, Clock, Smartphone, User as UserIcon, Keyboard } from 'lucide-react';
import { motion } from 'framer-motion';
import { getAvatarColors, getInitials } from '../utils/avatarUtils';
import NumberFlow from '@number-flow/react';

export const AdminCheckoutLeads: React.FC = () => {
  const [leads, setLeads] = useState<CheckoutLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'abandoned' | 'completed'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getCheckoutLeads();
        setLeads(data);
      } catch (error) {
        console.error('Erro ao carregar leads de checkout:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o lead de ${name}?`)) {
      try {
        await deleteCheckoutLead(id);
        setLeads(prev => prev.filter(e => e.id !== id));
      } catch (error) {
        console.error('Erro ao excluir:', error);
        alert('Erro ao excluir registro.');
      }
    }
  };

  const filteredLeads = leads.filter(lead => {
    if (filter === 'all') return true;
    return lead.status === filter;
  });

  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const stats = {
    total: leads.length,
    abandoned: leads.filter(l => l.status === 'abandoned').length,
    completed: leads.filter(l => l.status === 'completed').length,
    conversionRate: leads.length > 0 ? ((leads.filter(l => l.status === 'completed').length / leads.length) * 100).toFixed(1) : 0,
    potentialRevenue: leads.filter(l => l.status === 'abandoned').reduce((acc, curr) => acc + (curr.price || 0), 0)
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#d97757] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in text-[#faf9f5]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Abandono de Carrinho
          </h1>
          <p className="text-gray-400">Leads que iniciaram o checkout mas não completaram o pagamento.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-[#333431] p-1.5 rounded-2xl border border-[#373734]">
          <button 
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${filter === 'all' ? 'bg-[#d97757] text-white shadow-lg shadow-[#d97757]/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            Todos
          </button>
          <button 
            onClick={() => setFilter('abandoned')}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${filter === 'abandoned' ? 'bg-[#d97757] text-white shadow-lg shadow-[#d97757]/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            Abandonados
          </button>
          <button 
            onClick={() => setFilter('completed')}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${filter === 'completed' ? 'bg-[#d97757] text-white shadow-lg shadow-[#d97757]/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            Completos
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-4 transition-all hover:bg-[#373734]/50">
            <div className="mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total de Leads</span>
            </div>
            <div className="text-2xl font-bold text-white"><NumberFlow value={stats.total} /></div>
          </div>

          <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-4 transition-all hover:bg-[#373734]/50">
            <div className="mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Abandonos</span>
            </div>
            <div className="text-2xl font-bold text-white"><NumberFlow value={stats.abandoned} /></div>
          </div>

          <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-4 transition-all hover:bg-[#373734]/50">
            <div className="mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Convertidos</span>
            </div>
            <div className="text-2xl font-bold text-white"><NumberFlow value={stats.completed} /></div>
          </div>

          <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-4 transition-all hover:bg-[#373734]/50">
            <div className="mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Taxa Conv.</span>
            </div>
            <div className="text-2xl font-bold text-white"><NumberFlow value={Number(stats.conversionRate)} suffix="%" /></div>
          </div>

          <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-4 transition-all hover:bg-[#373734]/50">
            <div className="mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Recuperável</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.potentialRevenue)}
            </div>
          </div>
        </div>

      <div className="bg-[#30302E] border border-[#373734] rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-[#333431] text-gray-400 uppercase text-[10px] tracking-widest font-bold border-b border-[#373734]">
              <tr>
                <th className="px-6 py-4">Data/Hora</th>
                <th className="px-6 py-4">Usuário</th>
                <th className="px-6 py-4">Contato</th>
                <th className="px-6 py-4">Plano Escolhido</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#373734]">
              {paginatedLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 italic">
                    Nenhum lead encontrado com o filtro selecionado.
                  </td>
                </tr>
              ) : (
                paginatedLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-[#373734]/30 transition-colors group">
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-white font-medium">
                          {new Date(lead.updatedAt).toLocaleDateString('pt-BR')}
                        </span>
                        <span className="text-[11px] text-gray-500 flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(lead.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ${getAvatarColors(lead.name || '').bg} ${getAvatarColors(lead.name || '').text}`}>
                          {getInitials(lead.name || 'U')}
                        </div>
                        <span className="font-semibold text-white group-hover:text-[#d97757] transition-colors">
                          {lead.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-1">
                        <div 
                          className="flex items-center gap-2 text-gray-300 hover:text-white cursor-pointer transition-colors group/item"
                          onClick={() => copyToClipboard(lead.email, 'email')}
                        >
                          <Mail size={12} className="text-gray-500 group-hover/item:text-[#d97757]" />
                          {lead.email}
                          <Copy size={10} className="opacity-0 group-hover/item:opacity-100 transition-opacity" />
                        </div>
                        <div 
                          className="flex items-center gap-2 text-gray-400 text-xs hover:text-white cursor-pointer transition-colors group/item"
                          onClick={() => copyToClipboard(lead.phone, 'telefone')}
                        >
                          <Smartphone size={12} className="text-gray-500 group-hover/item:text-[#d97757]" />
                          {lead.phone}
                          <Copy size={10} className="opacity-0 group-hover/item:opacity-100 transition-opacity" />
                        </div>

                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-white font-medium uppercase text-[11px] tracking-wider">
                          {lead.planName}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {lead.billingCycle === 'annual' ? 'Anual' : 'Mensal'} - R$ {lead.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {lead.status === 'completed' ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 text-[10px] font-bold uppercase tracking-wider">
                          <CheckCircle size={10} />
                          Completo
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 text-[10px] font-bold uppercase tracking-wider">
                          <Clock size={10} />
                          Abandonado
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button
                        onClick={() => handleDelete(lead.id!, lead.name)}
                        className="text-gray-600 hover:text-red-500 transition-all p-2 rounded-lg hover:bg-red-500/10 opacity-0 group-hover:opacity-100"
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#373734] bg-[#333431]">
            <div className="text-xs text-gray-400">
              Mostrando <span className="text-white font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="text-white font-medium">{Math.min(currentPage * itemsPerPage, filteredLeads.length)}</span> de <span className="text-white font-medium">{filteredLeads.length}</span> leads
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 px-3 rounded-lg text-xs font-medium bg-[#30302E] border border-[#373734] text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Anterior
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${currentPage === page ? 'bg-[#d97757] text-white' : 'bg-[#30302E] border border-[#373734] text-gray-400 hover:text-white'}`}
                >
                  {page}
                </button>
              )).slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))}
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 px-3 rounded-lg text-xs font-medium bg-[#30302E] border border-[#373734] text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Próximo
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500 text-center pb-4">
        Exibindo {filteredLeads.length} de {leads.length} leads
      </div>
    </div>
  );
};
