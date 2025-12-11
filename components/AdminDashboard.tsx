import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { migrateUsersAddAdminField, getPluggyUsage } from '../services/database';
import { useToasts } from './Toast';
import { Link } from './Icons';

interface AdminDashboardProps {
  user: User;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  const [isMigrating, setIsMigrating] = useState(false);
  const [pluggyStats, setPluggyStats] = useState({ total_connections: 0 });
  const toast = useToasts();

  useEffect(() => {
    const loadStats = async () => {
      const stats = await getPluggyUsage();
      setPluggyStats(stats);
    };
    loadStats();
  }, []);

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

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Painel Administrativo</h1>
          <p className="text-gray-400">Bem-vindo ao modo superusuário, {user.name}.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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

        {/* Pluggy Usage Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold text-white">Conexões Pluggy</h3>
                <Link size={16} className="text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-blue-400">{pluggyStats.total_connections}</p>
            <p className="text-xs text-gray-500 mt-1">Total de conexões Open Finance</p>
          </div>
        </div>
      </div>
    </div>
  );
};
