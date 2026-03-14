
import React, { useState, useEffect } from 'react';
import { UniversalModal } from './UniversalModal';
import { MapPin, Calendar, Check, Loader2 } from 'lucide-react';
import { CustomDatePicker } from './UIComponents';
import { useToasts } from './Toast';
import * as dbService from '../services/database';
import { motion, AnimatePresence } from 'framer-motion';

interface CompleteRegistrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    onComplete?: () => void;
}

export const CompleteRegistrationModal: React.FC<CompleteRegistrationModalProps> = ({
    isOpen,
    onClose,
    userId,
    onComplete
}) => {
    const [cep, setCep] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [address, setAddress] = useState({
        street: '',
        number: '',
        neighborhood: '',
        city: '',
        state: ''
    });
    const [isCepLoading, setIsCepLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showAddressFields, setShowAddressFields] = useState(false);
    const toast = useToasts();

    const formatCEP = (value: string) => {
        return value
            .replace(/\D/g, '')
            .replace(/(\d{5})(\d)/, '$1-$2')
            .replace(/(-\d{3})\d+?$/, '$1');
    };

    const fetchCepData = async (cepValue: string) => {
        const cleanCep = cepValue.replace(/\D/g, '');
        if (cleanCep.length === 8) {
            setIsCepLoading(true);
            try {
                const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
                const data = await response.json();
                if (!data.erro) {
                    setAddress(prev => ({
                        ...prev,
                        street: data.logradouro,
                        neighborhood: data.bairro,
                        city: data.localidade,
                        state: data.uf
                    }));
                    setShowAddressFields(true);
                } else {
                    toast.error('CEP não encontrado.');
                    setShowAddressFields(true);
                }
            } catch (err) {
                console.error("Erro ao buscar CEP:", err);
            } finally {
                setIsCepLoading(false);
            }
        }
    };

    const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawVal = e.target.value;
        const formatted = formatCEP(rawVal);
        setCep(formatted);
        if (formatted.replace(/\D/g, '').length === 8) {
            fetchCepData(formatted);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!cep || !birthDate || !address.street || !address.number || !address.city || !address.state) {
            toast.error("Por favor, preencha todos os campos.");
            return;
        }

        setIsSubmitting(true);
        try {
            await dbService.updateUserProfile(userId, {
                birthDate,
                address: {
                    cep,
                    ...address
                }
            } as any);

            toast.success("Cadastro completado com sucesso!");
            onComplete?.();
            onClose();
        } catch (error) {
            console.error("Error updating profile:", error);
            toast.error("Erro ao salvar os dados. Tente novamente.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputStyle = "input-primary w-full bg-gray-900/50 border-gray-800 focus:bg-gray-900 focus:border-[#d97757] text-[#faf9f5] placeholder-gray-500 h-12 transition-all rounded-xl";

    return (
        <UniversalModal
            isOpen={isOpen}
            onClose={() => {}} // User MUST complete registration
            title="Complete seu Cadastro"
            subtitle="Precisamos de mais alguns dados para finalizar."
            width="max-w-md"
        >
            <form onSubmit={handleSubmit} className="space-y-5 p-1">
                <div className="space-y-4">
                    {/* Data de Nascimento */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-2 ml-1 uppercase tracking-wider">Data de Nascimento</label>
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 z-10"><Calendar size={18} /></div>
                            <CustomDatePicker
                                value={birthDate}
                                onChange={(val) => setBirthDate(val)}
                                placeholder="dd/mm/aaaa"
                                dropdownMode="fixed"
                                className="!pl-11"
                            />
                        </div>
                    </div>

                    {/* CEP */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-2 ml-1 uppercase tracking-wider">CEP</label>
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                                {isCepLoading ? <Loader2 size={18} className="animate-spin text-[#d97757]" /> : <MapPin size={18} />}
                            </div>
                            <input
                                type="text"
                                maxLength={9}
                                value={cep}
                                onChange={handleCepChange}
                                placeholder="00000-000"
                                className={`${inputStyle} pl-11`}
                            />
                        </div>
                    </div>

                    {/* Address Fields */}
                    <AnimatePresence>
                        {showAddressFields && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="space-y-4 overflow-hidden"
                            >
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-gray-400 mb-2 ml-1 uppercase tracking-wider">Rua</label>
                                        <input
                                            type="text"
                                            value={address.street}
                                            onChange={(e) => setAddress({ ...address, street: e.target.value })}
                                            className={inputStyle}
                                            placeholder="Nome da rua"
                                        />
                                    </div>
                                    <div className="w-24">
                                        <label className="block text-xs font-semibold text-gray-400 mb-2 ml-1 uppercase tracking-wider">Nº</label>
                                        <input
                                            type="text"
                                            value={address.number}
                                            onChange={(e) => setAddress({ ...address, number: e.target.value })}
                                            className={inputStyle}
                                            placeholder="123"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-2 ml-1 uppercase tracking-wider">Cidade</label>
                                        <input
                                            type="text"
                                            value={address.city}
                                            onChange={(e) => setAddress({ ...address, city: e.target.value })}
                                            className={inputStyle}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-2 ml-1 uppercase tracking-wider">Estado</label>
                                        <input
                                            type="text"
                                            value={address.state}
                                            onChange={(e) => setAddress({ ...address, state: e.target.value })}
                                            className={inputStyle}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 bg-[#d97757] hover:bg-[#c56a4d] text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#d97757]/20 mt-2"
                >
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    {isSubmitting ? 'Salvando...' : 'Finalizar Cadastro'}
                </button>
            </form>
        </UniversalModal>
    );
};
