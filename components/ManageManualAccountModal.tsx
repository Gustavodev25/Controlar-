import React, { useState, useEffect } from 'react';
import { ConnectedAccount } from '../types';
import * as dbService from '../services/database';
import { toast } from 'sonner';
import { UniversalModal } from './UniversalModal';
import { CustomSelect } from './UIComponents';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Trash2, CreditCard, Wallet, Pencil, DollarSign, Calendar, Flag, FileText, ChevronsUpDown } from 'lucide-react';

interface ManageManualAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId?: string;
    existingAccount?: ConnectedAccount | null; // If provided, edit mode
    onSuccess?: () => void;
}

export const ManageManualAccountModal: React.FC<ManageManualAccountModalProps> = ({
    isOpen,
    onClose,
    userId,
    existingAccount,
    onSuccess
}) => {
    const isEditMode = !!existingAccount;

    const [type, setType] = useState<'CHECKING' | 'CREDIT'>('CHECKING');
    const [name, setName] = useState('');
    const [balance, setBalance] = useState(''); // For checking
    const [limit, setLimit] = useState(''); // For credit
    const [closingDay, setClosingDay] = useState(''); // For credit
    const [dueDay, setDueDay] = useState(''); // For credit
    const [brand, setBrand] = useState('mastercard'); // For credit

    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (existingAccount) {
            setType(existingAccount.type === 'CREDIT' ? 'CREDIT' : 'CHECKING');
            setName(existingAccount.name || '');
            setBalance(existingAccount.balance?.toString() || '0');
            setLimit(existingAccount.creditLimit?.toString() || '');
            setClosingDay(existingAccount.closingDay?.toString() || '');
            setDueDay(existingAccount.dueDay?.toString() || '');
            setBrand(existingAccount.brand?.toLowerCase() || 'mastercard');
        } else {
            // Reset for new
            setType('CHECKING');
            setName('');
            setBalance('');
            setLimit('');
            setClosingDay('');
            setDueDay('');
            setBrand('mastercard');
        }
    }, [existingAccount, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId) return;

        if (!name.trim()) {
            toast.error("O nome da conta é obrigatório.");
            return;
        }

        setIsSubmitting(true);

        try {
            const numericBalance = parseFloat(balance.replace(',', '.')) || 0;

            const commonData = {
                name,
                connectionMode: 'MANUAL' as const,
                currency: 'BRL',
                institution: 'Manual',
                lastUpdated: new Date().toISOString(),
                accountTypeName: type === 'CREDIT' ? 'Cartão de Crédito' : 'Conta Manual'
            };

            if (type === 'CREDIT') {
                const numericLimit = parseFloat(limit.replace(',', '.')) || 0;
                const iClosingDay = parseInt(closingDay) || 1;
                const iDueDay = parseInt(dueDay) || 10;

                const creditData = {
                    ...commonData,
                    type: 'CREDIT',
                    subtype: 'CREDIT_CARD',
                    isCredit: true,
                    creditLimit: numericLimit,
                    balance: 0, // Cards usually start with 0 balance (invoice amount) unless we want to track it differently
                    closingDay: iClosingDay,
                    dueDay: iDueDay,
                    brand
                };

                if (isEditMode && existingAccount) {
                    await dbService.updateConnectedAccount(userId, existingAccount.id, creditData);
                    toast.success("Cartão atualizado com sucesso!");
                } else {
                    await dbService.addManualAccount(userId, creditData);
                    toast.success("Cartão criado com sucesso!");
                }
            } else {
                // Checking / Savings
                const bankData = {
                    ...commonData,
                    type: 'BANK',
                    subtype: 'CHECKING_ACCOUNT',
                    isChecking: true,
                    balance: numericBalance,
                    initialBalance: numericBalance // Store initial balance for reconciliation if needed
                };

                if (isEditMode && existingAccount) {
                    await dbService.updateConnectedAccount(userId, existingAccount.id, bankData);
                    toast.success("Conta atualizada com sucesso!");
                } else {
                    await dbService.addManualAccount(userId, bankData);
                    toast.success("Conta criada com sucesso!");
                }
            }

            if (onSuccess) onSuccess();
            onClose();

        } catch (error) {
            console.error("Error saving manual account:", error);
            toast.error("Erro ao salvar conta manual.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!userId || !existingAccount || !confirm("Tem certeza que deseja excluir esta conta?")) return;
        setIsSubmitting(true);
        try {
            await dbService.deleteConnectedAccount(userId, existingAccount.id);
            toast.success("Conta removida com sucesso!");
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Erro ao remover conta.");
        } finally {
            setIsSubmitting(false);
        }
    }

    const footerContent = (
        <div className="flex items-center gap-3">
            {isEditMode && (
                <button
                    type="button"
                    onClick={handleDelete}
                    className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-colors"
                >
                    <Trash2 size={20} />
                </button>
            )}
            <button
                onClick={() => document.getElementById('manual-account-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))}
                disabled={isSubmitting}
                className={`flex-1 py-3 font-bold rounded-xl flex items-center justify-center gap-2 transition-all bg-[#d97757] hover:bg-[#c66646] text-white`}
            >
                {isSubmitting ? (
                    <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Salvando...
                    </>
                ) : (
                    <>
                        <Save size={18} />
                        Salvar
                    </>
                )}
            </button>
        </div>
    );

    return (
        <UniversalModal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditMode ? 'Editar Conta Manual' : 'Nova Conta Manual'}
            subtitle="Crie contas e cartões para gerenciar manualmente"
            icon={isEditMode ? <Pencil size={24} /> : <Wallet size={24} />}
            themeColor="#d97757"
            footer={footerContent}
        >
            <form id="manual-account-form" onSubmit={handleSubmit} className="space-y-5">
                {/* Type Selection - Smooth Segmented Control */}
                {!isEditMode && (
                    <div className="relative flex p-1 bg-gray-900/50 rounded-xl">
                        <div
                            className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg transition-all duration-300 ease-out"
                            style={{
                                left: type === 'CHECKING' ? '4px' : 'calc(50% + 0px)',
                                backgroundColor: 'rgba(217, 119, 87, 0.9)'
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => setType('CHECKING')}
                            className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-colors duration-200 ${type === 'CHECKING' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <Wallet size={16} /> Conta / Carteira
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('CREDIT')}
                            className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-colors duration-200 ${type === 'CREDIT' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <CreditCard size={16} /> Cartão de Crédito
                        </button>
                    </div>
                )}

                <div className="space-y-4">
                    {/* Conta Name */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Nome da Conta</label>
                        <div className="relative">
                            <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                            <input
                                required
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600"
                                placeholder={type === 'CREDIT' ? "Ex: Nubank, Inter" : "Ex: Carteira, Cofre"}
                                autoFocus
                            />
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        {type === 'CHECKING' ? (
                            <motion.div
                                key="checking-fields"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-4 overflow-hidden"
                            >
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Saldo Atual (R$)</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={balance ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(balance)) : ''}
                                            onChange={e => {
                                                const value = e.target.value.replace(/\D/g, '');
                                                const numberValue = Number(value) / 100;
                                                setBalance(numberValue.toString());
                                            }}
                                            placeholder="R$ 0,00"
                                            className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-10 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600 font-mono"
                                        />
                                        <ChevronsUpDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={14} />
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="credit-fields"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-4 overflow-hidden"
                            >
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Limite Total (R$)</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={limit ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(limit)) : ''}
                                            onChange={e => {
                                                const value = e.target.value.replace(/\D/g, '');
                                                const numberValue = Number(value) / 100;
                                                setLimit(numberValue.toString());
                                            }}
                                            placeholder="Ex: R$ 5.000,00"
                                            className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-10 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600 font-mono"
                                        />
                                        <ChevronsUpDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={14} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Dia Fechamento</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                                            <input
                                                type="number"
                                                min="1"
                                                max="31"
                                                value={closingDay}
                                                onChange={e => setClosingDay(e.target.value)}
                                                placeholder="Ex: 1"
                                                className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-10 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                            <ChevronsUpDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={14} />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Dia Vencimento</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                                            <input
                                                type="number"
                                                min="1"
                                                max="31"
                                                value={dueDay}
                                                onChange={e => setDueDay(e.target.value)}
                                                placeholder="Ex: 10"
                                                className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-10 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                            <ChevronsUpDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={14} />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Bandeira</label>
                                    <div className="relative">
                                        <CustomSelect
                                            value={brand}
                                            onChange={(val) => setBrand(val)}
                                            options={[
                                                { value: 'mastercard', label: 'Mastercard' },
                                                { value: 'visa', label: 'Visa' },
                                                { value: 'elo', label: 'Elo' },
                                                { value: 'other', label: 'Outra' }
                                            ]}
                                            icon={<Flag size={16} />}
                                            placeholder="Selecione a bandeira"
                                            className="w-full text-sm"
                                            portal
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </form>
        </UniversalModal>
    );
};
