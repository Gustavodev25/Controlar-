import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, Building, AlertTriangle, Loader2 } from './Icons';
import { useToasts } from './Toast';
import axios from 'axios';
import { PluggyConnect } from 'react-pluggy-connect';

interface BankConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: any) => void;
  userId: string;
  itemIdToUpdate?: string | null;
}

export const BankConnectModal: React.FC<BankConnectModalProps> = ({ isOpen, onClose, onSuccess, userId, itemIdToUpdate }) => {
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToasts();

  if (!isOpen) return null;

  const handleStartConnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.post('/api/pluggy/create-token', { 
          userId,
          itemId: itemIdToUpdate 
      });
      setConnectToken(response.data.accessToken);
    } catch (err) {
      console.error("Erro ao criar token Pluggy:", err);
      setError("Não foi possível iniciar a conexão bancária.");
      toast.error("Erro ao conectar com servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePluggySuccess = async (itemData: any) => {
    console.log("Pluggy Success:", itemData);
    toast.success("Conexão realizada! Sincronizando dados...");
    
    // Extract ID safely handling both potential structures
    const itemId = itemData.item?.id || itemData.itemId;

    if (!itemId) {
        console.error("Could not extract Item ID from Pluggy response:", itemData);
        toast.error("Erro ao identificar a conexão.");
        return;
    }

    try {
      // Trigger sync immediately
      const syncResponse = await axios.post('/api/pluggy/sync', { itemId });
      onSuccess(syncResponse.data);
      onClose();
    } catch (err) {
      console.error("Erro ao sincronizar dados:", err);
      toast.error("Conexão feita, mas houve erro na sincronização inicial.");
      onClose(); // Close anyway, user can try syncing later or refreshing
    }
  };

  const handlePluggyError = (error: any) => {
    console.error("Pluggy Connect Error:", error);
    setError("Erro na conexão com o banco.");
  };

  // If we have a token, render PluggyConnect
  if (connectToken) {
    return createPortal(
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl w-full max-w-lg h-[650px] relative overflow-hidden flex flex-col shadow-2xl">
                <div className="flex justify-between items-center p-3 bg-gray-50 border-b">
                    <p className="text-xs text-gray-500 font-medium ml-2">
                        {itemIdToUpdate ? 'Atualizar Conexão' : 'Nova Conexão'} Segura Pluggy
                    </p>
                     <button onClick={onClose} className="p-2 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-600 flex items-center justify-center gap-2 text-center">
                    <span><span className="font-bold">Dica:</span> Se a janela do banco não abrir, autorize os pop-ups ou clique no botão manual.</span>
                </div>
                <div className="flex-1 w-full relative">
                     <PluggyConnect
                        connectToken={connectToken}
                        includeSandbox={true}
                        updateItem={itemIdToUpdate || undefined}
                        // Products removidos para permitir todos os disponiveis (contas, cartoes, investimentos, etc)
                        // products={['ACCOUNTS', 'CREDIT_CARDS', 'TRANSACTIONS', 'IDENTITY', 'INVESTMENTS']}
                        // Tipo de conector - banco pessoal
                        connectorTypes={['PERSONAL_BANK']}
                        onSuccess={handlePluggySuccess}
                        onError={handlePluggyError}
                        onClose={onClose}
                    />
                </div>
            </div>
        </div>,
        document.body
    );
  }

  // Initial View (Explanation + Button)
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
      <div className="bg-gray-950 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-800 flex flex-col relative animate-scale-in">
        
         {/* Background Effects */}
         <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#d97757]/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gray-700/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
        </div>

        {/* Header */}
        <div className="p-5 border-b border-gray-800/50 flex justify-between items-center relative z-10">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building className="text-[#d97757]" size={24} />
            {itemIdToUpdate ? 'Atualizar Conexão' : 'Conectar Banco'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 relative z-10">
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-3 rounded-lg text-sm flex items-center gap-2">
                    <AlertTriangle size={16} />
                    {error}
                </div>
            )}

            <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
                <div className="flex gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg h-fit text-emerald-500">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-200 text-sm">Ambiente Seguro (Open Finance)</h3>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      {itemIdToUpdate 
                        ? 'Você precisa re-autenticar sua conexão para continuar sincronizando seus dados.' 
                        : 'Usamos a tecnologia da Pluggy para conectar suas contas de forma segura e criptografada.'}
                    </p>
                  </div>
                </div>
            </div>

            <ul className="space-y-3 text-sm text-gray-400 px-2">
                <li className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d97757]"></span>
                  Suporte a Nubank, Itaú, Bradesco e principais bancos.
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d97757]"></span>
                  {itemIdToUpdate ? 'Mantém seu histórico de transações.' : 'Importação automática de saldo e transações.'}
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Conta corrente, poupança, cartões e investimentos.
                </li>
            </ul>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex gap-2 items-start">
                <svg className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[11px] text-blue-200/80 leading-tight">
                  <span className="font-bold">Importante:</span> No app do banco, autorize TODAS as opções (conta corrente, cartões, transações) para sincronizar todos os dados.
                </p>
            </div>

             <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex gap-2 items-start">
                <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-200/80 leading-tight">
                  Você será redirecionado para a interface do seu banco para autorizar o acesso.
                </p>
              </div>
        </div>

        <div className="p-6 border-t border-gray-800/50 bg-gray-900/30 flex justify-end gap-3 relative z-10">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleStartConnect}
              disabled={isLoading}
              className="px-6 py-2.5 bg-[#d97757] hover:bg-[#c56a4d] text-[#faf9f5] rounded-xl text-sm font-bold shadow-lg shadow-[#d97757]/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : null}
              {isLoading ? 'Iniciando...' : (itemIdToUpdate ? 'Atualizar Agora' : 'Conectar Agora')}
            </button>
        </div>
      </div>
    </div>,
    document.body
  );
};