import React, { useState } from 'react';
import { User } from '../types';
import { migrateUsersAddAdminField, fixCategoriesForUser, getAllUsers } from '../services/database';
import { useToasts } from './Toast';

interface AdminDashboardProps {
  user: User;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  const [isMigrating, setIsMigrating] = useState(false);
  const toast = useToasts();

  const handleMigration = async () => {
    if (!confirm("Isso irá verificar TODOS os usuários e definir isAdmin=false para quem não tiver o campo. Continuar?")) return;

    setIsMigrating(true);
    try {
      const count = await migrateUsersAddAdminField();
      toast.success(`Migração concluída! ${count} usuários atualizados.`);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao executar migração. Verifique o console.");
    } finally {
      setIsMigrating(false);
    }
  };

  const handleFixCategories = async () => {
    if (!confirm("Isso irá verificar TODAS as transações de TODOS os usuários e traduzir as categorias (Inglês -> Português). Continuar?")) return;

    setIsMigrating(true);
    try {
        const users = await getAllUsers();
        let totalUpdated = 0;
        for (const u of users) {
            totalUpdated += await fixCategoriesForUser(u.id);
        }
        toast.success(`Correção concluída! ${totalUpdated} transações atualizadas.`);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao executar correção de categorias.");
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Painel Administrativo</h1>
          <p className="text-gray-400">Bem-vindo ao modo superusuário, {user.name}.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Usuários</h3>
          <p className="text-3xl font-bold text-[#d97757]">--</p>
          <p className="text-xs text-gray-500 mt-1">Total de usuários cadastrados</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Transações</h3>
          <p className="text-3xl font-bold text-[#d97757]">--</p>
          <p className="text-xs text-gray-500 mt-1">Volume total processado</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Sistema</h3>
          <p className="text-green-500 font-bold">Operacional</p>
          <p className="text-xs text-gray-500 mt-1">Status do servidor</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Ações de Manutenção</h3>
        <div className="flex flex-wrap gap-4">
            <button
                onClick={handleMigration}
                disabled={isMigrating}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
            >
                {isMigrating ? 'Processando...' : 'Migrar Admin Fields'}
            </button>
            <button
                onClick={handleFixCategories}
                disabled={isMigrating}
                className="px-4 py-2 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
            >
                {isMigrating ? 'Corrigindo...' : 'Traduzir Categorias (Inglês -> PT)'}
            </button>
        </div>
      </div>
    </div>
  );
};

