import React, { useState, useEffect } from 'react';
import { Save, Code, Activity, Check } from 'lucide-react';
import * as dbService from '../services/database';
import { useToasts } from './Toast';

export const AdminPixels: React.FC = () => {
    const [pixelId, setPixelId] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const toast = useToasts();

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setIsLoading(true);
        try {
            const settings = await dbService.getSystemSettings();
            if (settings.metaPixelId) {
                setPixelId(settings.metaPixelId);
            }
        } catch (error) {
            console.error("Error loading system settings:", error);
            toast.error("Erro ao carregar configurações.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await dbService.updateSystemSettings({ metaPixelId: pixelId });
            toast.success("Pixel ID salvo com sucesso!");
        } catch (error) {
            console.error("Error saving system settings:", error);
            toast.error("Erro ao salvar Pixel ID.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in max-w-2xl">
            <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Pixel do Facebook</h2>
                <p className="text-gray-400 text-sm mt-1">Configure o ID do Pixel para rastreamento.</p>
            </div>

            <div className="bg-[#30302E] rounded-xl border border-gray-800 p-6">
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                <Activity size={16} className="text-[#d97757]" />
                                Meta Pixel ID
                            </label>
                            {pixelId && !isSaving && (
                                <span className="flex items-center gap-1.5 text-[10px] font-bold text-green-500 uppercase bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                                    <Check size={10} strokeWidth={3} /> Ativo
                                </span>
                            )}
                        </div>

                        <div className="relative group/input">
                            <Code className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 transition-colors group-focus-within/input:text-[#d97757]" size={18} />
                            <input
                                type="text"
                                value={pixelId}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    // Try to extract ID from script if pasted
                                    const match = val.match(/fbq\('init',\s*['"](\d+)['"]\)/);
                                    if (match && match[1]) {
                                        setPixelId(match[1]);
                                        toast.success("ID extraído do código!");
                                    } else {
                                        setPixelId(val.trim());
                                    }
                                }}
                                placeholder="Ex: 898144952781827 ou cole o script"
                                className="w-full bg-gray-900/50 border border-gray-800 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:border-[#d97757] focus:ring-1 focus:ring-[#d97757] outline-none transition-all font-mono"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            type="submit"
                            disabled={isSaving || isLoading}
                            className="bg-[#d97757] hover:bg-[#c56a4d] disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-[#d97757]/20 text-sm"
                        >
                            <Save size={16} />
                            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
