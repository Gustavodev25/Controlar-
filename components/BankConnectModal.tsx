import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { PluggyConnect } from 'react-pluggy-connect';
import { X, Loader2, Building, CheckCircle, AlertCircle } from './Icons';
import * as dbService from '../services/database';
import { ConnectedAccount } from '../types';

interface BankConnectModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string | null;
    onSuccess?: (accounts: ConnectedAccount[]) => void;
}

const API_BASE = '/api';

export const BankConnectModal: React.FC<BankConnectModalProps> = ({
    isOpen,
    onClose,
    userId,
    onSuccess
}) => {
    // UI States
    const [view, setView] = useState<'connect' | 'manage'>('connect');
    const [isVisible, setIsVisible] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    // Data States
    const [connectToken, setConnectToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
    const [syncMessage, setSyncMessage] = useState('');

    const [existingItems, setExistingItems] = useState<any[]>([]);
    const [isDeletingItem, setIsDeletingItem] = useState<string | null>(null);

    // Animation effect (igual Reminders modal)
    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        if (isOpen) {
            setIsVisible(true);
            setView('connect'); // Reset view on open
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsAnimating(true);
                });
            });
            // Fetch token when modal opens
            if (userId) {
                fetchConnectToken();
            }
        } else {
            setIsAnimating(false);
            timeoutId = setTimeout(() => {
                setIsVisible(false);
                // Reset states after animation
                setConnectToken(null);
                setError(null);
                setSyncStatus('idle');
                setSyncMessage('');
                setExistingItems([]);
            }, 300);
        }
        return () => clearTimeout(timeoutId);
    }, [isOpen, userId]);

    const fetchExistingItems = useCallback(async () => {
        if (!userId) return;
        setIsLoading(true);
        setSyncStatus('idle');
        setSyncMessage('');
        try {
            const response = await fetch(`${API_BASE}/pluggy/items?userId=${userId}`);
            const data = await response.json();
            if (response.ok) {
                // API returns { success: true, items: [...] }
                setExistingItems(data.items || data.results || []);
                setView('manage');
                setError(null);
            } else {
                console.error('Failed to fetch items:', data);
                // Fallback if fetch fails
                setError('Não foi possível carregar as conexões existentes.');
            }
        } catch (err) {
            console.error('Error fetching items:', err);
            setError('Erro ao carregar conexões.');
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    const handleDeleteRemoteItem = async (itemId: string) => {
        if (!userId) return;
        setIsDeletingItem(itemId);
        try {
            // Correct endpoint: DELETE /api/pluggy/item/:itemId
            const response = await fetch(`${API_BASE}/pluggy/item/${itemId}?userId=${userId}`, {
                method: 'DELETE',
            });
            
            if (response.ok) {
                setExistingItems(prev => {
                    const next = prev.filter(i => i.id !== itemId);
                    if (next.length === 0) {
                        // If no items left, go back to connect
                        fetchConnectToken();
                        setView('connect');
                    }
                    return next;
                });
            } else {
               console.error('Failed to delete item'); 
            }
        } catch (err) {
            console.error('Error deleting item:', err);
        } finally {
            setIsDeletingItem(null);
        }
    };

    const fetchConnectToken = async () => {
        setIsLoading(true);
        setError(null);
        setSyncStatus('idle'); // Reset sync status
        
        try {
            const response = await fetch(`${API_BASE}/pluggy/create-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao criar token');
            }

            setConnectToken(data.accessToken);
            if (Array.isArray(data.existingItems)) {
                setExistingItems(data.existingItems);
            }
        } catch (err: any) {
            console.error('Error fetching connect token:', err);
            setError(err.message || 'Erro ao conectar com o serviço. Verifique se o servidor está rodando.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuccess = useCallback(async (data: { item: { id: string } }) => {
        if (!userId) return;

        const itemId = data.item.id;
        console.log('Pluggy connection success, item:', itemId);

        setSyncStatus('syncing');
        setSyncMessage('Sincronizando dados bancários...');

        try {
            const response = await fetch(`${API_BASE}/pluggy/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId, userId })
            });

            const syncData = await response.json();

            if (!response.ok) {
                throw new Error(syncData.error || 'Erro na sincronização');
            }

            console.log('Sync complete:', syncData);

            // Save accounts to Firebase
            if (syncData.accounts && syncData.accounts.length > 0) {
                for (const account of syncData.accounts) {
                    await dbService.addConnectedAccount(userId, account);
                }
            }

            // Save checking account transactions
            if (syncData.transactions?.checking && syncData.transactions.checking.length > 0) {
                setSyncMessage(`Salvando ${syncData.transactions.checking.length} transações de conta corrente...`);
                for (const tx of syncData.transactions.checking) {
                    const exists = await dbService.transactionExists(userId, tx);
                    if (!exists) {
                        await dbService.addTransaction(userId, tx);
                    }
                }
            }

            // Save credit card transactions
            if (syncData.transactions?.creditCard && syncData.transactions.creditCard.length > 0) {
                setSyncMessage(`Salvando ${syncData.transactions.creditCard.length} transações de cartão de crédito...`);
                for (const tx of syncData.transactions.creditCard) {
                    const exists = await dbService.creditCardTransactionExists(userId, tx.providerId);
                    if (!exists) {
                        await dbService.addCreditCardTransaction(userId, tx);
                    }
                }
            }

            const totalTx = (syncData.transactionCounts?.checking || 0) + (syncData.transactionCounts?.creditCard || 0);
            setSyncStatus('success');
            setSyncMessage(`${syncData.accounts?.length || 0} conta(s) e ${totalTx} transação(ões) sincronizada(s)!`);

            if (onSuccess && syncData.accounts) {
                onSuccess(syncData.accounts);
            }

            setTimeout(() => {
                onClose();
            }, 2000);

        } catch (err: any) {
            console.error('Sync error:', err);
            setSyncStatus('error');
            setSyncMessage(err.message || 'Erro ao sincronizar');
        }
    }, [userId, onSuccess, onClose]);

    const handleError = useCallback((error: { message?: string; code?: string; data?: any }) => {
        const errorCode = error.message || error.code || '';
        
        // Handle expected errors gracefully without spamming console.error
        if (errorCode === 'ITEM_USER_ALREADY_EXISTS') {
            console.log('Pluggy: User attempted to add an existing item.');
            setError('Este banco já está conectado. Você não pode adicionar a mesma conta duas vezes.');
            setSyncStatus('error');
            return;
        }

        console.error('Pluggy connection error (full):', JSON.stringify(error, null, 2));

        // Handle specific Pluggy errors with user-friendly messages
        let errorMessage = 'Erro na conexão';

        if (errorCode === 'ITEM_LOGIN_ALREADY_QUEUED') {
            errorMessage = 'Uma conexão já está em andamento. Aguarde alguns segundos e tente novamente.';
        } else if (errorCode === 'ITEM_LOGIN_TIMEOUT') {
            errorMessage = 'O tempo de conexão expirou. Tente novamente.';
        } else if (errorCode === 'ITEM_CREDENTIALS_INVALID' || errorCode === 'INVALID_CREDENTIALS') {
            errorMessage = 'Credenciais bancárias inválidas. Verifique seus dados.';
        } else if (errorCode === 'SITE_NOT_SUPPORTED') {
            errorMessage = 'Este banco não está disponível no momento.';
        } else if (errorCode === 'ACCOUNT_LOCKED') {
            errorMessage = 'Sua conta está bloqueada. Verifique junto ao banco.';
        } else if (error.data?.message) {
            errorMessage = error.data.message;
        } else if (errorCode) {
            errorMessage = `Erro: ${errorCode}`;
        }

        setError(errorMessage);
        setSyncStatus('error');
    }, []);

    if (!isVisible) return null;

    return createPortal(
        <div className={`
      fixed inset-0 z-[9999] flex items-center justify-center p-4 
      transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
      ${isAnimating ? 'backdrop-blur-md bg-black/60' : 'backdrop-blur-none bg-black/0'}
    `}>
            <div className={`
        bg-gray-950 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-800 
        flex flex-col max-h-[90vh] relative 
        transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
        ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
      `}>

                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 opacity-20 bg-[#d97757]" />

                {/* Header */}
                <div className="p-5 border-b border-gray-800/50 flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-[#d97757]/10 rounded-xl border border-[#d97757]/20">
                            <Building size={20} className="text-[#d97757]" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-white">
                                {view === 'manage' ? 'Gerenciar Conexões' : 'Conectar Banco'}
                            </h3>
                            <p className="text-xs text-gray-500">Open Finance - Pluggy</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-white p-2 hover:bg-gray-800/50 rounded-lg transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden relative z-10 p-5 overflow-y-auto custom-scrollbar">
                    
                    {/* View: MANAGE Existing Connections */}
                    {view === 'manage' && (
                        <div className="space-y-4 animate-fade-in">
                            <p className="text-sm text-gray-400 text-center mb-2">
                                Identificamos conexões ativas na sua conta Pluggy. Você pode removê-las para conectar novamente.
                            </p>
                            
                            {existingItems.length === 0 && !isLoading ? (
                                <p className="text-center text-gray-500 py-8">Nenhuma conexão encontrada.</p>
                            ) : (
                                <div className="space-y-3">
                                    {existingItems.map((item) => (
                                        <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {item.connector && (
                                                    <div className="w-10 h-10 rounded-full bg-white p-1 overflow-hidden">
                                                        <img src={item.connector.imageUrl} alt={item.connector.name} className="w-full h-full object-contain" />
                                                    </div>
                                                )}
                                                <div>
                                                    <h4 className="text-sm font-bold text-white">{item.connector?.name || 'Banco Desconhecido'}</h4>
                                                    <p className="text-[10px] text-gray-500">Status: {item.status}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteRemoteItem(item.id)}
                                                disabled={isDeletingItem === item.id}
                                                className="text-xs bg-red-500/10 text-red-500 hover:bg-red-500/20 px-3 py-1.5 rounded-lg border border-red-500/20 transition-colors"
                                            >
                                                {isDeletingItem === item.id ? 'Removendo...' : 'Desconectar'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="pt-4 flex justify-center">
                                <button
                                    onClick={() => {
                                        setView('connect');
                                        fetchConnectToken();
                                    }}
                                    className="text-sm text-gray-400 hover:text-white underline"
                                >
                                    Voltar para conexão
                                </button>
                            </div>
                        </div>
                    )}

                    {/* View: CONNECT (Default) */}
                    {view === 'connect' && (
                        <>
                            {/* Loading State */}
                            {isLoading && (
                                <div className="flex flex-col items-center justify-center py-12 gap-4 animate-fade-in">
                                    <div className="p-4 bg-[#d97757]/10 rounded-full">
                                        <Loader2 className="animate-spin text-[#d97757]" size={32} />
                                    </div>
                                    <p className="text-gray-400 text-sm">Preparando conexão segura...</p>
                                </div>
                            )}

                            {/* Error State */}
                            {error && !isLoading && (
                                <div className="flex flex-col items-center justify-center py-12 gap-4 animate-fade-in">
                                    <div className="p-4 bg-red-500/10 rounded-full border border-red-500/20">
                                        <AlertCircle className="text-red-500" size={32} />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-white font-medium mb-1">Erro na conexão</p>
                                        <p className="text-gray-400 text-sm max-w-xs">{error}</p>
                                    </div>
                                    
                                    <div className="flex flex-col gap-2 mt-4 w-full max-w-[200px]">
                                        {error.includes('já está conectado') ? (
                                            <>
                                                <button
                                                    onClick={fetchExistingItems}
                                                    className="w-full px-4 py-2 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl transition-colors text-sm font-bold shadow-lg shadow-[#d97757]/20"
                                                >
                                                    Gerenciar Conexões
                                                </button>
                                                <button
                                                    onClick={onClose}
                                                    className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors text-sm font-medium border border-gray-700"
                                                >
                                                    Fechar
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={fetchConnectToken}
                                                className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors text-sm font-medium border border-gray-700"
                                            >
                                                Tentar novamente
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Sync Status */}
                            {syncStatus !== 'idle' && (
                                <div className="flex flex-col items-center justify-center py-12 gap-4 animate-fade-in">
                                    {syncStatus === 'syncing' && (
                                        <>
                                            <div className="p-4 bg-[#d97757]/10 rounded-full">
                                                <Loader2 className="animate-spin text-[#d97757]" size={32} />
                                            </div>
                                            <p className="text-gray-400 text-sm">{syncMessage}</p>
                                        </>
                                    )}
                                    {syncStatus === 'success' && (
                                        <>
                                            <div className="p-4 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                                                <CheckCircle className="text-emerald-500" size={32} />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-white font-medium mb-1">Sincronização completa!</p>
                                                <p className="text-gray-400 text-sm">{syncMessage}</p>
                                            </div>
                                        </>
                                    )}
                                    {syncStatus === 'error' && (
                                        <>
                                            <div className="p-4 bg-red-500/10 rounded-full border border-red-500/20">
                                                <AlertCircle className="text-red-500" size={32} />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-white font-medium mb-1">Erro na sincronização</p>
                                                <p className="text-gray-400 text-sm">{syncMessage}</p>
                                            </div>
                                            <button
                                                onClick={onClose}
                                                className="mt-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors text-sm font-medium border border-gray-700"
                                            >
                                                Fechar
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Pluggy Widget */}
                            {connectToken && !isLoading && !error && syncStatus === 'idle' && (
                                <div className="min-h-[400px] animate-fade-in">
                                    <PluggyConnect
                                        connectToken={connectToken}
                                        includeSandbox={true}
                                        onSuccess={handleSuccess}
                                        onError={handleError}
                                        onClose={onClose}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                {view === 'connect' && !isLoading && !error && syncStatus === 'idle' && (
                    <div className="px-5 py-4 border-t border-gray-800/50 relative z-10">
                        <p className="text-[11px] text-gray-500 text-center">
                            Sua conexão é segura e criptografada. Seus dados são protegidos pelo Open Finance Brasil.
                        </p>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
