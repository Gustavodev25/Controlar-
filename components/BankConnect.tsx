import React, { useState, useEffect } from "react";
import { Link, X, Bot, Building, ShieldCheck } from "./Icons";
import { createPortal } from "react-dom";
import { useToasts } from "./Toast";
import { createConnectToken, syncPluggyData } from "../services/pluggyService";
import { PluggyConnect } from "react-pluggy-connect";

interface BankConnectProps {
  userId: string | null;
  memberId?: string | null;
  onItemConnected?: (itemId: string) => void;
  onSyncComplete?: (imported: number) => void;
  isSidebar?: boolean;
  isOpen?: boolean;
  existingAccountsCount?: number;
  userPlan?: 'starter' | 'pro' | 'family';
}

export const BankConnect: React.FC<BankConnectProps> = ({
  userId,
  memberId,
  onItemConnected,
  onSyncComplete,
  isSidebar = false,
  isOpen: isSidebarOpen = true,
  existingAccountsCount = 0,
  userPlan = 'starter',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toast = useToasts();

  const handleOpen = () => {
      if (userPlan === 'starter' && existingAccountsCount >= 1) {
          toast.error("Plano Starter limitado a 1 conexão. Faça upgrade para conectar mais bancos.", { duration: 5000 });
          return;
      }
      setIsOpen(true);
  };

  // Initialize Token when modal opens
  useEffect(() => {
    if (isOpen && !connectToken) {
      initSession();
    }
  }, [isOpen, connectToken]);

  const initSession = async () => {
    if (!userId) {
      setError("Faca login para conectar seu banco.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const token = await createConnectToken(userId);
      setConnectToken(token);
    } catch (err) {
      console.error(err);
      setError("Nao foi possivel iniciar a conexao segura com o Pluggy.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePluggySuccess = async (itemData: { item: { id: string } }) => {
    if (!userId) {
      toast.error("Sessao expirada. Entre novamente.");
      return;
    }
    const itemId = itemData.item.id;
    setSyncing(true);

    try {
      await toast.promise(
        syncPluggyData(userId, itemId, memberId || undefined),
        {
          loading: "Conectando a instituição e sincronizando dados...",
          success: (count) => {
            onItemConnected?.(itemId);
            onSyncComplete?.(count);
            handleClose();
            return `Conexao realizada! ${count} transacoes importadas.`;
          },
          error: (err) => {
            console.error("Erro ao sincronizar Pluggy:", err);
            return "Conexao feita, mas houve erro ao baixar transacoes.";
          },
        }
      );
    } catch (err) {
      // Error is handled visually by toast.promise
    } finally {
      setSyncing(false);
    }
  };

  const handlePluggyError = (err: any) => {
    console.error("Pluggy Widget Error", err);
    toast.error("Nao foi possivel finalizar a conexao.");
  };

  const handleClose = () => {
    setIsOpen(false);
    setConnectToken(null); // Reset token to ensure fresh session next time
    setError(null);
    setSyncing(false);
  };

  const TriggerButton = isSidebar ? (
    <button
      onClick={handleOpen}
      className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200 group text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 relative ${!isSidebarOpen ? 'justify-center' : ''}`}
    >
      <span className="text-[#d97757] group-hover:text-[#e68e70] transition-colors">
        <Building size={20} />
      </span>
      {isSidebarOpen && (
        <span className="font-medium text-sm truncate animate-fade-in">
          Conectar Banco
        </span>
      )}

      {/* Tooltip (Collapsed Only) */}
      {!isSidebarOpen && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 z-50 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl p-3 min-w-[140px] text-left hidden group-hover:block animate-fade-in pointer-events-none">
          <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-gray-900 border-l border-b border-gray-800 rotate-45"></div>
          <p className="text-sm font-bold text-white whitespace-nowrap">Conectar Banco</p>
        </div>
      )}
    </button>
  ) : (
    <button
      onClick={handleOpen}
      className="flex items-center gap-2 px-4 py-2 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-lg font-medium text-sm transition-all shadow-lg shadow-[#d97757]/20"
    >
      <Link size={16} />
      Conectar Banco
    </button>
  );

  return (
    <>
      {TriggerButton}

      {isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-0 md:p-4 animate-fade-in">
            <div className="bg-white w-full max-w-4xl md:rounded-3xl overflow-hidden flex flex-col relative h-full md:h-[80vh]">
              {/* Header */}
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white z-10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#d97757] rounded-lg flex items-center justify-center text-white">
                    <Building size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Conectar Conta Bancaria
                    </h3>
                    <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                      <ShieldCheck size={12} /> Ambiente Seguro Pluggy
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Content Area */}
              <div className="flex-1 relative bg-gray-50">
                {isLoading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="w-10 h-10 border-4 border-[#d97757] border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-500 font-medium">
                      Iniciando conexao segura...
                    </p>
                  </div>
                ) : error ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
                      <X size={32} />
                    </div>
                    <h4 className="text-xl font-bold text-gray-800 mb-2">
                      Erro de Inicializacao
                    </h4>
                    <p className="text-gray-500 max-w-sm">{error}</p>
                    <button
                      onClick={initSession}
                      className="mt-6 px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                    >
                      Tentar Novamente
                    </button>
                  </div>
                ) : syncing ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-white/90 backdrop-blur-sm">
                    <div className="w-16 h-16 bg-[#d97757]/10 text-[#d97757] rounded-full flex items-center justify-center mb-4 animate-pulse">
                      <Bot size={32} />
                    </div>
                    <h4 className="text-xl font-bold text-gray-900 mb-2">
                      Sincronizando...
                    </h4>
                    <p className="text-gray-500">
                      Baixando suas transacoes e categorizando.
                    </p>
                  </div>
                ) : connectToken ? (
                  <PluggyConnect
                    connectToken={connectToken}
                    includeSandbox={true}
                    onSuccess={handlePluggySuccess}
                    onError={handlePluggyError}
                    onClose={handleClose} // Handles the "X" inside widget
                  />
                ) : null}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
