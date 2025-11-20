
import React, { useState, useEffect } from 'react';
import { Landmark, Plus, CheckCircle, AlertTriangle, Link } from './Icons';
import { createConnectToken, syncPluggyData } from '../services/pluggyService';
import { useToasts } from './Toast';

interface BankConnectProps {
  userId: string | null;
  onSyncComplete: () => void;
  isSidebar?: boolean;
}

declare global {
  interface Window {
    PluggyConnect: any;
  }
}

export const BankConnect: React.FC<BankConnectProps> = ({ userId, onSyncComplete, isSidebar = false }) => {
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToasts();

  const handleConnect = async () => {
    if (!userId) return;
    setIsLoading(true);

    try {
      // 1. Get Token
      const accessToken = await createConnectToken();

      // 2. Initialize Widget
      if (!window.PluggyConnect) {
         toast.error("Erro ao carregar widget do Pluggy.");
         setIsLoading(false);
         return;
      }

      const pluggyConnect = new window.PluggyConnect({
        connectToken: accessToken,
        includeSandbox: true, // For testing
        onSuccess: async (itemData: any) => {
           toast.success("Banco conectado! Sincronizando...");
           try {
             const count = await syncPluggyData(userId, itemData.item.id);
             toast.success(`${count} transações importadas!`);
             onSyncComplete();
           } catch (e) {
             toast.error("Erro na sincronização de dados.");
           } finally {
             setIsLoading(false);
           }
        },
        onError: (error: any) => {
           console.error("Pluggy Widget Error", error);
           toast.error("Erro na conexão bancária.");
           setIsLoading(false);
        },
        onClose: () => {
           setIsLoading(false);
        }
      });

      pluggyConnect.init();
      pluggyConnect.open();

    } catch (error) {
      console.error(error);
      toast.error("Erro ao iniciar conexão Open Finance.");
      setIsLoading(false);
    }
  };

  if (isSidebar) {
      return (
        <button
            onClick={handleConnect}
            disabled={isLoading}
            className="w-full flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200 group text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 disabled:opacity-50"
            title="Conectar Banco (Open Finance)"
        >
            <span className={`transition-colors ${isLoading ? 'text-gray-500' : 'text-green-500 group-hover:text-green-400'}`}>
            {isLoading ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Link size={20} />}
            </span>
            <span className="font-medium text-sm truncate animate-fade-in">Conectar Banco</span>
        </button>
      );
  }

  return (
    <button 
      onClick={handleConnect}
      disabled={isLoading}
      className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium text-sm transition-all border border-gray-700 hover:border-green-500/50 group shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
    >
      {isLoading ? (
         <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
         <Landmark size={16} className="text-green-500 group-hover:text-green-400 transition-colors" />
      )}
      Open Finance
    </button>
  );
};
