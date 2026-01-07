import React, { useEffect, useState } from 'react';
import { getWaitlistEntries, deleteWaitlistEntry } from '../services/database';
import { WaitlistEntry } from '../types';
import { Trash2 } from './Icons';

export const AdminWaitlist: React.FC = () => {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('Carregando dados da waitlist...');
        const data = await getWaitlistEntries();
        console.log('Dados recebidos:', data);
        console.log('Total de registros:', data.length);
        setEntries(data);
      } catch (error) {
        console.error('Erro ao carregar waitlist:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Tem certeza que deseja excluir ${name} da lista de espera?`)) {
      try {
        await deleteWaitlistEntry(id);
        setEntries(prev => prev.filter(e => e.id !== id));
      } catch (error) {
        console.error('Erro ao excluir:', error);
        alert('Erro ao excluir registro.');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#d97757] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Lista de Espera</h1>
          <p className="text-gray-400">Gerenciamento de leads e interessados.</p>
        </div>
        <div className="bg-gray-900 px-4 py-2 rounded-lg border border-gray-800">
          <span className="text-gray-400 text-sm">Total: </span>
          <span className="text-white font-bold">{entries.length}</span>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-950 text-gray-400 uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-medium">Data</th>
                <th className="px-6 py-4 font-medium">Nome</th>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium">Telefone</th>
                <th className="px-6 py-4 font-medium">Origem</th>
                <th className="px-6 py-4 font-medium">Objetivo</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 text-gray-400 whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleDateString('pt-BR')}
                      <span className="text-[10px] ml-2 opacity-50">
                        {new Date(entry.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-white">
                      {entry.name}
                    </td>
                    <td className="px-6 py-4 text-gray-300">
                      {entry.email}
                    </td>
                    <td className="px-6 py-4 text-gray-400 font-mono">
                      {entry.phone || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {entry.source ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900/30 text-blue-400 border border-blue-900/50">
                          {entry.source}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-400 truncate max-w-xs">
                      {entry.goal || '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(entry.id, entry.name)}
                        className="text-gray-500 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-500/10"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};