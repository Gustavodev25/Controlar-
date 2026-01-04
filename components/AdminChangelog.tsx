import React, { useState, useEffect } from 'react';
import { ChangelogItem } from '../types';
import * as dbService from '../services/database';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, Check, X, Sparkles, Bug, AlertCircle, Calendar, FileText, Monitor, Tag, Zap, AlignLeft, Upload } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';
import { CustomDatePicker, CustomSelect } from './UIComponents';
import { EmptyState } from './EmptyState';
import { UniversalModal, ModalSection, ModalDivider } from './UniversalModal';
import { ConfirmationBar } from './ConfirmationBar';

// Helper to parse PT-BR date string (e.g. "24 Dez, 2024" or "24 de dez. de 2024") to YYYY-MM-DD
const parseDateToIso = (dateStr: string): string => {
    try {
        if (!dateStr) return new Date().toISOString().split('T')[0];

        // Map of Portuguese month abbreviations/names to index
        const months: Record<string, string> = {
            'jan': '01', 'janeiro': '01', 'fev': '02', 'fevereiro': '02', 'mar': '03', 'março': '03',
            'abr': '04', 'abril': '04', 'mai': '05', 'maio': '05', 'jun': '06', 'junho': '06',
            'jul': '07', 'julho': '07', 'ago': '08', 'agosto': '08', 'set': '09', 'setembro': '09',
            'out': '10', 'outubro': '10', 'nov': '11', 'novembro': '11', 'dez': '12', 'dezembro': '12'
        };

        // Remove "de" and "." and extra spaces
        const cleanStr = dateStr.toLowerCase().replace(/de/g, '').replace(/\./g, '').replace(/,/g, '').replace(/\s+/g, ' ').trim();
        // Expected parts: "24", "dez", "2024"
        const parts = cleanStr.split(' ');

        // Find the parts that look like day, month, year
        let day = '', month = '', year = '';

        for (const part of parts) {
            if (/^\d{1,2}$/.test(part) && !day) day = part.padStart(2, '0');
            else if (/^\d{4}$/.test(part)) year = part;
            else if (months[part]) month = months[part];
        }

        if (day && month && year) {
            return `${year}-${month}-${day}`;
        }
        return new Date().toISOString().split('T')[0];
    } catch (e) {
        return new Date().toISOString().split('T')[0];
    }
};

// Helper: Semantic Versioning Increment
const incrementVersion = (version: string, type: 'patch' | 'minor' | 'major'): string => {
    // Basic semver parser (tolerant of v prefix)
    const cleanVer = version.replace(/^v/, '');
    const parts = cleanVer.split('.').map(n => parseInt(n, 10));

    // Default to 0.1.0 if invalid
    if (parts.length < 3 || parts.some(isNaN)) return '0.1.0';

    let [major, minor, patch] = parts;

    if (type === 'major') {
        major++;
        minor = 0;
        patch = 0;
    } else if (type === 'minor') {
        minor++;
        patch = 0;
    } else {
        patch++;
    }

    return `${major}.${minor}.${patch}`;
};

// Helper to format YYYY-MM-DD to PT-BR "24 Dez, 2024"
const formatIsoToDisplay = (isoDate: string): string => {
    if (!isoDate) return '';
    const date = new Date(isoDate + 'T12:00:00'); // Midday to avoid timezone issues
    // Format options closer to what was used: "24 Dez, 2024"
    // Using simple concatenation to match desired style if locale fails to maximize
    const day = date.getDate();
    const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const year = date.getFullYear();
    // Capitalize month
    const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
    return `${day} ${monthCap}, ${year}`;
};

export const AdminChangelog: React.FC = () => {
    const [changelogs, setChangelogs] = useState<ChangelogItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editItem, setEditItem] = useState<ChangelogItem | null>(null);
    const [isoDate, setIsoDate] = useState<string>(''); // For the date picker
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isAutoVersion, setIsAutoVersion] = useState(true);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // Get latest version from changelogs
    const getLatestVersion = () => {
        if (changelogs.length === 0) return '0.1.0';
        const sorted = [...changelogs].sort((a, b) => {
            const pa = (a.version || '0.0.0').replace(/^v/, '').split('.').map(n => parseInt(n, 10));
            const pb = (b.version || '0.0.0').replace(/^v/, '').split('.').map(n => parseInt(n, 10));
            for (let i = 0; i < 3; i++) {
                if (pa[i] > pb[i]) return -1;
                if (pa[i] < pb[i]) return 1;
            }
            return 0;
        });
        return sorted[0].version;
    };

    useEffect(() => {
        loadChangelogs();
    }, []);

    const loadChangelogs = async () => {
        setIsLoading(true);
        const data = await dbService.getChangelogs();
        setChangelogs(data);
        setIsLoading(false);
    };

    const handleEdit = (item: ChangelogItem) => {
        setEditItem({ ...item });
        setIsoDate(parseDateToIso(item.date));
        setIsEditing(true);
        setIsAutoVersion(false); // Manual mode when editing existing
        setSelectedFile(null);
    };

    const handleNew = () => {
        const todayIso = new Date().toISOString().split('T')[0];
        const latest = getLatestVersion();
        const nextVersion = incrementVersion(latest, 'minor'); // Default increment
        const major = nextVersion.split('.')[0];

        setEditItem({
            version: nextVersion,
            majorVersion: major,
            date: formatIsoToDisplay(todayIso),
            type: 'minor',
            summary: '',
            changes: []
        });
        setIsoDate(todayIso);
        setIsEditing(true);
        setIsAutoVersion(true); // Auto mode for new
        setSelectedFile(null);
    };

    const handleDelete = (id: string) => {
        setDeleteId(id);
    };

    const confirmDelete = async () => {
        if (deleteId) {
            await dbService.deleteChangelog(deleteId);
            setDeleteId(null);
            loadChangelogs();
        }
    };

    const handleSave = async () => {
        if (!editItem) return;

        let finalImageUrl = editItem.image;

        // Upload image if selected
        if (selectedFile) {
            try {
                const storageRef = ref(storage, `changelogs/${Date.now()}_${selectedFile.name}`);
                await uploadBytes(storageRef, selectedFile);
                finalImageUrl = await getDownloadURL(storageRef);
            } catch (uploadError) {
                console.error("Error uploading image:", uploadError);
                // Fail silently for now or alert user - but proceed with save without image update?
                // Or maybe keep the old image.
                // For now, let's just proceed.
            }
        }

        // Ensure date is updated from picker
        const itemToSave = {
            ...editItem,
            date: formatIsoToDisplay(isoDate),
            image: finalImageUrl
        };

        if (itemToSave.id) {
            await dbService.updateChangelog(itemToSave.id, itemToSave);
        } else {
            await dbService.addChangelog(itemToSave);
        }
        setIsEditing(false);
        setEditItem(null);
        setSelectedFile(null);
        loadChangelogs();
    };

    const handleVersionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!editItem) return;
        const val = e.target.value;
        const major = val.split('.')[0] || editItem.majorVersion;
        setEditItem({
            ...editItem,
            version: val,
            majorVersion: major
        });
    };

    const handleTypeChange = (newType: 'patch' | 'minor' | 'major') => {
        if (!editItem) return;

        let newVersion = editItem.version;
        if (isAutoVersion) {
            const latest = getLatestVersion();
            newVersion = incrementVersion(latest, newType);
        }

        const major = newVersion.split('.')[0] || editItem.majorVersion;

        setEditItem({
            ...editItem,
            type: newType,
            version: newVersion,
            majorVersion: major
        });
    };

    const addChange = () => {
        if (!editItem) return;
        setEditItem({
            ...editItem,
            changes: [...editItem.changes, { type: 'new', text: '' }]
        });
    };

    const removeChange = (index: number) => {
        if (!editItem) return;
        const newChanges = [...editItem.changes];
        newChanges.splice(index, 1);
        setEditItem({ ...editItem, changes: newChanges });
    };

    const updateChange = (index: number, field: 'type' | 'text', value: string) => {
        if (!editItem) return;
        const newChanges = [...editItem.changes];
        newChanges[index] = { ...newChanges[index], [field]: value };
        setEditItem({ ...editItem, changes: newChanges });
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'new': return <Sparkles size={14} />;
            case 'improvement': return <Zap size={14} />;
            case 'fix': return <Bug size={14} />;
            default: return <Sparkles size={14} />;
        }
    };

    // Updated colors for better highlight
    const getTypeColor = (type: string) => {
        switch (type) {
            case 'new': return 'text-green-400 bg-green-500/10 border-green-500/20 shadow-[0_0_10px_rgba(74,222,128,0.1)]';
            case 'improvement': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
            case 'fix': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
            default: return 'text-gray-400';
        }
    };

    return (
        <div className="p-6 space-y-8 animate-fade-in pb-20 max-w-6xl mx-auto w-full">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Gerenciar Changelog</h1>
                    <p className="text-gray-400">Adicione e edite as novidades do sistema.</p>
                </div>
                <button
                    onClick={handleNew}
                    className="px-4 py-2 bg-[#d97757] hover:bg-[#ff9270] text-white font-bold rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-[#d97757]/20 shrink-0"
                >
                    <Plus size={18} /> Novo Lançamento
                </button>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-4 border-[#d97757] border-t-transparent rounded-full animate-spin" />
                </div>
            ) : changelogs.length === 0 ? (
                <div className="w-full">
                    <EmptyState
                        title="Nenhum changelog encontrado"
                        description="Crie o primeiro lançamento para manter seus usuários informados sobre as novidades do sistema."
                        action={{
                            label: "Criar Lançamento",
                            onClick: handleNew
                        }}
                        icon={<Sparkles size={48} />}
                    />
                </div>
            ) : (
                <div className="space-y-4">
                    {changelogs.map((log) => (
                        <div
                            key={log.id}
                            className="bg-[#30302E] border border-[#373734] rounded-xl p-6 hover:border-[#4a4a48] transition-colors group relative overflow-hidden"
                        >
                            <div className="absolute right-0 top-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 bg-gradient-to-l from-[#30302E] pl-8">
                                <button
                                    onClick={() => handleEdit(log)}
                                    className="p-2 bg-gray-800 text-blue-400 rounded-lg hover:bg-blue-400/20 transition-colors"
                                    title="Editar"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={() => log.id && handleDelete(log.id)}
                                    className="p-2 bg-gray-800 text-red-400 rounded-lg hover:bg-red-400/20 transition-colors"
                                    title="Excluir"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-6">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className={`
                      px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                      ${log.type === 'major' ? 'bg-[#d97757] text-white' : 'bg-gray-800 text-gray-300'}
                    `}>
                                            v{log.version}
                                        </span>
                                        <span className="text-gray-500 text-sm flex items-center gap-1">
                                            <Calendar size={12} />
                                            {log.date}
                                        </span>
                                    </div>

                                    {log.summary && (
                                        <p className="text-gray-300 mb-4 text-sm">{log.summary}</p>
                                    )}

                                    <div className="flex flex-wrap gap-2">
                                        <div className="flex items-center gap-1 text-xs font-medium text-green-400 bg-green-400/10 px-2 py-1 rounded">
                                            <Sparkles size={12} />
                                            {log.changes.filter(c => c.type === 'new').length}
                                        </div>
                                        <div className="flex items-center gap-1 text-xs font-medium text-blue-400 bg-blue-400/10 px-2 py-1 rounded">
                                            <Check size={12} />
                                            {log.changes.filter(c => c.type === 'improvement').length}
                                        </div>
                                        <div className="flex items-center gap-1 text-xs font-medium text-orange-400 bg-orange-400/10 px-2 py-1 rounded">
                                            <Bug size={12} />
                                            {log.changes.filter(c => c.type === 'fix').length}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de Edição/Criação */}
            {editItem && (
                <UniversalModal
                    isOpen={isEditing}
                    onClose={() => setIsEditing(false)}
                    title={editItem.id ? 'Editar Changelog' : 'Novo Changelog'}
                    width="max-w-2xl"
                    footer={
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!editItem.version || !isoDate}
                                className="px-6 py-2 bg-[#d97757] hover:bg-[#ff9270] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center gap-2 text-sm shadow-lg shadow-[#d97757]/20"
                            >
                                <Check size={16} /> Salvar Changelog
                            </button>
                        </div>
                    }
                >
                    <div className="space-y-6">
                        <ModalSection icon={<Tag size={18} />} title="Informações da Versão" iconClassName="text-[#d97757]">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Versão</label>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-gray-500 font-bold uppercase">Auto</span>
                                            <button
                                                onClick={() => setIsAutoVersion(!isAutoVersion)}
                                                className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${isAutoVersion ? 'bg-[#d97757]' : 'bg-gray-600'}`}
                                            >
                                                <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200 ${isAutoVersion ? 'translate-x-4' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={editItem.version}
                                            onChange={handleVersionChange}
                                            readOnly={isAutoVersion}
                                            className={`w-full bg-[#30302E] border border-[#373734] rounded-xl p-3 text-white outline-none text-sm font-mono transition-colors h-[46px] ${isAutoVersion
                                                ? 'opacity-60 cursor-not-allowed focus:border-[#373734]'
                                                : 'focus:border-[#d97757]'
                                                }`}
                                            placeholder="ex: 1.0.0"
                                        />
                                        {isAutoVersion && (
                                            <Sparkles size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#d97757]" />
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Major Version (Background)</label>
                                    <input
                                        type="text"
                                        value={editItem.majorVersion}
                                        onChange={e => setEditItem({ ...editItem, majorVersion: e.target.value })}
                                        className="w-full bg-[#30302E] border border-[#373734] rounded-xl p-3 text-white focus:border-[#d97757] outline-none text-sm font-mono h-[46px]"
                                        placeholder="ex: 1"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Data de Lançamento</label>
                                    <CustomDatePicker
                                        value={isoDate}
                                        onChange={setIsoDate}
                                        className="w-full h-[46px]"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Tipo</label>
                                    <div className="flex bg-[#30302E] rounded-xl p-1 border border-[#373734] h-[46px] items-stretch">
                                        {(['patch', 'minor', 'major'] as const).map((t) => (
                                            <button
                                                key={t}
                                                onClick={() => handleTypeChange(t)}
                                                className={`flex-1 flex items-center justify-center text-xs font-bold rounded-lg uppercase transition-all ${editItem.type === t ? 'bg-[#d97757] text-white shadow-md' : 'text-gray-500 hover:text-white'}`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </ModalSection>

                        <ModalSection icon={<FileText size={18} />} title="Resumo" iconClassName="text-blue-400">
                            <div className="space-y-4">
                                <textarea
                                    value={editItem.summary || ''}
                                    onChange={e => setEditItem({ ...editItem, summary: e.target.value })}
                                    className="w-full bg-[#30302E] border border-[#373734] rounded-xl p-3 text-white focus:border-[#d97757] outline-none min-h-[80px] text-sm resize-none"
                                    placeholder="Descrição geral da atualização..."
                                />
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Imagem de Capa (Opcional)</label>

                                    {!editItem.image ? (
                                        <label className="block w-full cursor-pointer">
                                            <div className="bg-[#30302E] border border-[#373734] border-dashed rounded-xl p-4 text-center hover:border-[#d97757] transition-colors group">
                                                <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-[#d97757]/10 group-hover:text-[#d97757] transition-colors text-gray-500">
                                                    <Upload size={20} />
                                                </div>
                                                <p className="text-xs font-medium text-gray-300">Clique para enviar imagem</p>
                                                <p className="text-[10px] text-gray-500 mt-1">PNG, JPG ou GIF (max. 2MB)</p>
                                            </div>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        if (file.size > 2 * 1024 * 1024) {
                                                            alert('Imagem muito grande. Máximo 2MB.');
                                                            return;
                                                        }
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => {
                                                            setEditItem({ ...editItem, image: reader.result as string });
                                                        };
                                                        reader.readAsDataURL(file);
                                                        setSelectedFile(file);
                                                    }
                                                }}
                                            />
                                        </label>
                                    ) : (
                                        <div className="relative w-full rounded-xl overflow-hidden border border-[#373734] bg-[#30302E] group">
                                            <div className="h-40 w-full relative">
                                                <img src={editItem.image} alt="Cover Preview" className="w-full h-full object-cover opacity-80 group-hover:opacity-40 transition-opacity" />
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => {
                                                            setEditItem({ ...editItem, image: '' });
                                                            setSelectedFile(null);
                                                        }}
                                                        className="bg-red-500/90 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-red-500 shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all"
                                                    >
                                                        <Trash2 size={14} /> Remover
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="px-3 py-2 bg-gray-900/50 border-t border-[#373734] flex justify-between items-center">
                                                <span className="text-[10px] text-gray-400">Imagem selecionada</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </ModalSection>

                        <ModalSection icon={<AlignLeft size={18} />} title="Introdução das Seções (Opcional)" iconClassName="text-purple-400">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Sparkles size={12} className="text-green-400" />
                                        <label className="text-xs font-bold text-green-400 uppercase">Novidades</label>
                                    </div>
                                    <textarea
                                        value={editItem.newFeaturesIntro || ''}
                                        onChange={e => setEditItem({ ...editItem, newFeaturesIntro: e.target.value })}
                                        className="w-full bg-[#30302E] border border-[#373734] rounded-xl p-3 text-white focus:border-[#d97757] outline-none min-h-[60px] text-sm resize-none"
                                        placeholder="Texto introdutório para as novidades..."
                                    />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Zap size={12} className="text-blue-400" />
                                        <label className="text-xs font-bold text-blue-400 uppercase">Melhorias</label>
                                    </div>
                                    <textarea
                                        value={editItem.improvementsIntro || ''}
                                        onChange={e => setEditItem({ ...editItem, improvementsIntro: e.target.value })}
                                        className="w-full bg-[#30302E] border border-[#373734] rounded-xl p-3 text-white focus:border-[#d97757] outline-none min-h-[60px] text-sm resize-none"
                                        placeholder="Texto introdutório para as melhorias..."
                                    />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Bug size={12} className="text-orange-400" />
                                        <label className="text-xs font-bold text-orange-400 uppercase">Correções</label>
                                    </div>
                                    <textarea
                                        value={editItem.fixesIntro || ''}
                                        onChange={e => setEditItem({ ...editItem, fixesIntro: e.target.value })}
                                        className="w-full bg-[#30302E] border border-[#373734] rounded-xl p-3 text-white focus:border-[#d97757] outline-none min-h-[60px] text-sm resize-none"
                                        placeholder="Texto introdutório para as correções..."
                                    />
                                </div>
                            </div>
                        </ModalSection>

                        <ModalDivider />

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Monitor size={18} className="text-green-400" />
                                <h4 className="text-sm font-bold text-white">Lista de Mudanças <span className="text-xs font-normal text-gray-500 ml-2">(Use **negrito** para destacar)</span></h4>
                            </div>
                            <button
                                onClick={addChange}
                                className="flex items-center gap-2 px-3 py-1.5 bg-[#d97757]/10 text-[#d97757] rounded-lg text-xs font-bold hover:bg-[#d97757]/20 transition-colors uppercase tracking-wider"
                            >
                                <Plus size={12} /> Adicionar
                            </button>
                        </div>

                        <div className="space-y-3">
                            <AnimatePresence>
                                {editItem.changes.map((change, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="flex gap-2 items-start group"
                                    >
                                        <div className="w-40 shrink-0">
                                            <CustomSelect
                                                value={change.type}
                                                onChange={val => updateChange(index, 'type', val as any)}
                                                options={[
                                                    { value: 'new', label: <div className="flex items-center gap-2"><Sparkles size={14} className="text-green-400" /> Novo</div> },
                                                    { value: 'improvement', label: <div className="flex items-center gap-2"><Zap size={14} className="text-blue-400" /> Melhoria</div> },
                                                    { value: 'fix', label: <div className="flex items-center gap-2"><Bug size={14} className="text-orange-400" /> Correção</div> }
                                                ]}
                                                className="w-full"
                                                portal={true}
                                            />
                                        </div>

                                        <div className="flex-1 bg-[#30302E] border border-[#373734] rounded-xl pl-4 pr-2 py-2.5 flex items-center gap-2 focus-within:border-[#d97757] focus-within:bg-[rgba(58,59,57,0.8)] transition-all h-11 group/input">
                                            <input
                                                type="text"
                                                value={change.text}
                                                onChange={e => updateChange(index, 'text', e.target.value)}
                                                className="flex-1 bg-transparent border-none outline-none text-white text-sm placeholder-gray-500"
                                                placeholder="Descreva a mudança..."
                                                autoFocus={index === editItem.changes.length - 1 && !change.text}
                                            />
                                            <button
                                                onClick={() => removeChange(index)}
                                                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 group-focus-within/input:opacity-100"
                                                title="Remover"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            {editItem.changes.length === 0 && (
                                <div className="text-center py-8 border-2 border-dashed border-[#373734] rounded-xl bg-[#30302E]/30 flex flex-col items-center gap-2">
                                    <div className="p-3 bg-[#30302E] rounded-full text-gray-600">
                                        <Sparkles size={20} />
                                    </div>
                                    <p className="text-gray-500 text-sm">Nenhuma mudança registrada.</p>
                                    <button
                                        onClick={addChange}
                                        className="text-[#d97757] text-sm font-bold hover:underline"
                                    >
                                        Adicionar primeira mudança
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </UniversalModal>
            )}

            {/* Barra de Confirmação de Exclusão */}
            <ConfirmationBar
                isOpen={!!deleteId}
                onCancel={() => setDeleteId(null)}
                onConfirm={confirmDelete}
                label="Excluir este changelog?"
                confirmText="Sim, excluir"
                cancelText="Cancelar"
                isDestructive={true}
                position="bottom"
            />
        </div>
    );
};
