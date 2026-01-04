import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    Tag,
    Edit2,
    Check,
    X,
    RotateCcw,
    Loader2,
    Filter,
    ChevronDown,
    Sparkles,
    AlertCircle,
    CheckCircle2,
    Plus,
    Trash2
} from 'lucide-react';
import { CategoryMapping } from '../types';
import {
    initializeCategoryMappings,
    updateCategoryMapping,
    resetCategoryMapping,
    listenToCategoryMappings,
    createCustomCategory,
    deleteCategoryMapping,
    DEFAULT_CATEGORY_MAPPINGS
} from '../services/database';
import { ConfirmationBar } from './ConfirmationBar';

interface CategoryManagerProps {
    userId: string;
}

// Grupos de categorias para melhor organização
const CATEGORY_GROUPS: Record<string, string[]> = {
    'Renda': ['salary', 'retirement', 'government aid', 'non-recurring income', 'fixed income', 'variable income', 'proceeds interests and dividends'],
    'Transferências': ['same person transfer - pix', 'transfer - pix', 'credit card payment', 'bank slip', 'debt card'],
    'Moradia': ['rent', 'electricity', 'water'],
    'Alimentação': ['n/a', 'groceries', 'eating out', 'food delivery'],
    'Transporte': ['taxi and ride-hailing', 'public transportation', 'car rental', 'bicycle', 'gas stations', 'parking'],
    'Saúde': ['pharmacy', 'hospital clinics and labs', 'health insurance', 'gyms and fitness centers', 'wellness'],
    'Educação': ['school', 'university'],
    'Telecom': ['telecommunications', 'internet', 'mobile'],
    'Entretenimento': ['cinema, theater and concerts', 'video streaming', 'music streaming', 'lottery', 'leisure', 'entertainment'],
    'Compras': ['online shopping', 'electronics', 'clothing'],
    'Viagem': ['airport and airlines', 'accommodation'],
    'Finanças': ['loans', 'interests charged', 'income taxes', 'account fees'],
    'Outros': ['alimony', 'donation', 'vehicle insurance'],
};

export const CategoryManager: React.FC<CategoryManagerProps> = ({ userId }) => {
    const [categories, setCategories] = useState<CategoryMapping[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGroup, setSelectedGroup] = useState<string>('all');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [saving, setSaving] = useState<string | null>(null);
    const [showSuccess, setShowSuccess] = useState<string | null>(null);
    const [showGroupDropdown, setShowGroupDropdown] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set(Object.keys(CATEGORY_GROUPS)));

    // Create Mode State
    // Agora o create é por grupo, então usamos um estado que guarda o grupo sendo editado
    const [addingToGroup, setAddingToGroup] = useState<string | null>(null);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deleteCategory, setDeleteCategory] = useState<CategoryMapping | null>(null);



    // Inicializar e escutar categorias
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await initializeCategoryMappings(userId);
            setLoading(false);
        };

        init();

        const unsubscribe = listenToCategoryMappings(userId, (mappings) => {
            setCategories(mappings);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);

    // Encontrar o nome padrão original de uma categoria
    const getDefaultDisplayName = (originalKey: string): string => {
        const defaultCat = DEFAULT_CATEGORY_MAPPINGS.find(
            cat => cat.originalKey.toLowerCase() === originalKey.toLowerCase()
        );
        return defaultCat?.displayName || originalKey;
    };

    // Verificar se uma categoria é originalmente padrão (existe no DEFAULT_CATEGORY_MAPPINGS)
    const isOriginallyDefault = (originalKey: string): boolean => {
        return DEFAULT_CATEGORY_MAPPINGS.some(
            cat => cat.originalKey.toLowerCase() === originalKey.toLowerCase()
        );
    };

    // Verificar se uma categoria foi customizada (nome diferente do padrão)
    const isCustomized = (category: CategoryMapping): boolean => {
        const defaultName = getDefaultDisplayName(category.originalKey);
        return category.displayName !== defaultName;
    };

    // Agrupar categorias
    const groupedCategories = useMemo(() => {
        const filtered = categories.filter(cat => {
            const matchesSearch =
                cat.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                cat.originalKey.toLowerCase().includes(searchQuery.toLowerCase());

            if (selectedGroup === 'all') return matchesSearch;
            if (selectedGroup === 'customized') return matchesSearch && !cat.isDefault;

            const groupKeys = CATEGORY_GROUPS[selectedGroup] || [];
            return matchesSearch && groupKeys.some(key => key.toLowerCase() === cat.originalKey.toLowerCase());
        });

        // Organizar por grupos
        const grouped: Record<string, CategoryMapping[]> = {};

        for (const cat of filtered) {
            let foundGroup = 'Outros';

            // Prioridade: Se tiver grupo definido manualmente
            if (cat.group && CATEGORY_GROUPS[cat.group]) {
                foundGroup = cat.group;
            } else {
                // Senão busca pelo mapeamento original
                for (const [groupName, keys] of Object.entries(CATEGORY_GROUPS)) {
                    if (keys.some(key => key.toLowerCase() === cat.originalKey.toLowerCase())) {
                        foundGroup = groupName;
                        break;
                    }
                }
            }

            if (!grouped[foundGroup]) grouped[foundGroup] = [];
            grouped[foundGroup].push(cat);
        }

        return grouped;
    }, [categories, searchQuery, selectedGroup]);

    // Iniciar edição
    const startEditing = (category: CategoryMapping) => {
        setEditingId(category.id);
        setEditValue(category.displayName);
    };

    // Cancelar edição
    const cancelEditing = () => {
        setEditingId(null);
        setEditValue('');
    };

    // Salvar edição
    const saveEdit = async (category: CategoryMapping) => {
        if (!editValue.trim() || editValue === category.displayName) {
            cancelEditing();
            return;
        }

        setSaving(category.id);
        try {
            const defaultName = getDefaultDisplayName(category.originalKey);

            // Se o valor editado for igual ao nome padrão, marca como isDefault
            if (editValue.trim() === defaultName) {
                await resetCategoryMapping(userId, category.id, defaultName);
            } else {
                await updateCategoryMapping(userId, category.id, editValue.trim());
            }

            setShowSuccess(category.id);
            setTimeout(() => setShowSuccess(null), 2000);
        } catch (error) {
            console.error('Erro ao salvar categoria:', error);
        } finally {
            setSaving(null);
            setEditingId(null);
            setEditValue('');
        }
    };

    // Resetar para padrão
    const handleReset = async (category: CategoryMapping) => {
        const defaultName = getDefaultDisplayName(category.originalKey);
        setSaving(category.id);
        try {
            await resetCategoryMapping(userId, category.id, defaultName);
            setShowSuccess(category.id);
            setTimeout(() => setShowSuccess(null), 2000);
        } catch (error) {
            console.error('Erro ao resetar categoria:', error);
        } finally {
            setSaving(null);
        }
    };

    // Criar categoria
    const handleCreate = async (groupName: string) => {
        if (!newCategoryName.trim()) return;

        setSaving('new');
        try {
            await createCustomCategory(userId, newCategoryName.trim(), groupName);
            setAddingToGroup(null);
            setNewCategoryName('');
            setShowSuccess('new');
            setTimeout(() => setShowSuccess(null), 2000);
        } catch (error) {
            console.error('Erro ao criar categoria:', error);
        } finally {
            setSaving(null);
        }
    };

    // Deletar categoria - abre confirmação
    const handleDelete = (category: CategoryMapping) => {
        setDeleteCategory(category);
    };

    // Confirmar exclusão
    const confirmDelete = async () => {
        if (!deleteCategory) return;
        setDeletingId(deleteCategory.id);
        try {
            await deleteCategoryMapping(userId, deleteCategory.id);
        } catch (error) {
            console.error('Erro ao deletar categoria:', error);
        } finally {
            setDeletingId(null);
            setDeleteCategory(null);
        }
    };

    // Quantidade de categorias customizadas
    const customizedCount = categories.filter(c => !c.isDefault).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-[#d97757] animate-spin" />
                    <p className="text-gray-400">Carregando categorias...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="mb-2">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-0.5">
                            <h1 className="text-2xl font-bold text-white whitespace-nowrap">Gestão de Categorias</h1>
                            <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs text-blue-300 whitespace-nowrap">
                                Aplica em todas as transações
                            </span>
                        </div>
                        <p className="text-xs text-gray-500">
                            Personalize os nomes das categorias das suas transações
                        </p>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4">
                        <div className="px-4 py-2 bg-[#30302E] rounded-xl border border-gray-700/50" data-tour="cat-stats">
                            <p className="text-xs text-gray-400">Total</p>
                            <p className="text-lg font-bold text-white">{categories.length}</p>
                        </div>
                        <div className="px-4 py-2 bg-[#30302E] rounded-xl border border-gray-700/50">
                            <p className="text-xs text-gray-400">Customizadas</p>
                            <p className="text-lg font-bold text-[#d97757]">{customizedCount}</p>
                        </div>
                    </div>
                </div>
            </div>


            {/* Filters & Actions */}
            <div className="flex flex-col gap-4">
            </div>

            {/* Categories Grid */}
            <div className="space-y-6">
                {Object.entries(groupedCategories).length === 0 ? (
                    <div className="text-center py-12">
                        <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400">Nenhuma categoria encontrada</p>
                    </div>
                ) : (
                    Object.entries(groupedCategories).map(([groupName, cats], groupIndex) => (
                        <motion.div
                            key={groupName}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-[#30302E] rounded-2xl border border-gray-800/50 overflow-hidden"
                        >
                            {/* Group Header */}
                            <button
                                onClick={() => {
                                    setCollapsedGroups(prev => {
                                        const next = new Set(prev);
                                        if (next.has(groupName)) {
                                            next.delete(groupName);
                                        } else {
                                            next.add(groupName);
                                        }
                                        return next;
                                    });
                                }}
                                className="w-full px-5 py-3 bg-[#373734] border-b border-gray-700/50 flex items-center justify-between hover:bg-[#3f3f3c] transition-colors"
                            >
                                <h3 className="text-sm font-semibold text-gray-300">{groupName}</h3>
                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${collapsedGroups.has(groupName) ? '' : 'rotate-180'}`} />
                            </button>

                            {/* Categories List */}
                            <AnimatePresence initial={false}>
                                {!collapsedGroups.has(groupName) && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="divide-y divide-gray-800/50 overflow-hidden"
                                    >
                                        {cats.map((category, catIndex) => (
                                            <div
                                                key={category.id}
                                                className="px-5 py-4 hover:bg-[#373734]/30 transition-colors"
                                            >
                                                <div className="flex items-center justify-between gap-4">
                                                    {/* Left: Original Key */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">
                                                            Chave Original
                                                        </p>
                                                        <p className="text-sm text-gray-400 truncate font-mono">
                                                            {category.originalKey}
                                                        </p>
                                                    </div>

                                                    {/* Center: Display Name (Editable) */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider flex items-center gap-1">
                                                            Nome de Exibição
                                                            {isCustomized(category) && (
                                                                <span className="px-1.5 py-0.5 bg-[#d97757]/20 text-[#d97757] text-[10px] rounded-full font-medium">
                                                                    Customizado
                                                                </span>
                                                            )}
                                                        </p>

                                                        {editingId === category.id ? (
                                                            <div className="relative flex-1">
                                                                <input
                                                                    type="text"
                                                                    value={editValue}
                                                                    onChange={(e) => setEditValue(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') saveEdit(category);
                                                                        if (e.key === 'Escape') cancelEditing();
                                                                    }}
                                                                    autoFocus
                                                                    className="w-full pl-4 pr-20 py-2.5 bg-[#252523] border border-gray-600 rounded-xl text-white text-sm focus:outline-none focus:border-gray-500 transition-all"
                                                                />
                                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                                    <button
                                                                        onClick={() => setEditValue(getDefaultDisplayName(category.originalKey))}
                                                                        className="p-1.5 text-gray-400 hover:text-[#d97757] hover:bg-[#d97757]/20 rounded-lg transition-colors"
                                                                        title="Resetar para nome padrão"
                                                                    >
                                                                        <RotateCcw className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => saveEdit(category)}
                                                                        disabled={saving === category.id}
                                                                        className="p-1.5 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                                                                        title="Salvar (Enter)"
                                                                    >
                                                                        {saving === category.id ? (
                                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                                        ) : (
                                                                            <Check className="w-4 h-4" />
                                                                        )}
                                                                    </button>
                                                                    <button
                                                                        onClick={cancelEditing}
                                                                        className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                                                        title="Cancelar (Esc)"
                                                                    >
                                                                        <X className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm text-white font-medium truncate">
                                                                    {category.displayName}
                                                                </p>
                                                                {showSuccess === category.id && (
                                                                    <motion.div
                                                                        initial={{ opacity: 0, scale: 0.5 }}
                                                                        animate={{ opacity: 1, scale: 1 }}
                                                                        exit={{ opacity: 0 }}
                                                                        className="flex items-center gap-1 text-green-400 text-xs"
                                                                    >
                                                                        <CheckCircle2 className="w-4 h-4" />
                                                                        Salvo!
                                                                    </motion.div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Right: Actions */}
                                                    <div className="flex items-center gap-2">
                                                        {editingId !== category.id && (
                                                            <>
                                                                <button
                                                                    onClick={() => startEditing(category)}
                                                                    className="p-2 text-gray-400 hover:text-white hover:bg-[#373734] rounded-lg transition-colors"
                                                                    title="Editar nome"
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </button>
                                                                {/* Reset button - for originally default categories that have been customized */}
                                                                {isOriginallyDefault(category.originalKey) && isCustomized(category) && (
                                                                    <button
                                                                        onClick={() => handleReset(category)}
                                                                        disabled={saving === category.id}
                                                                        className="p-2 text-[#d97757] hover:text-[#ff9270] hover:bg-[#d97757]/10 rounded-lg transition-colors disabled:opacity-50"
                                                                        title="Restaurar nome padrão"
                                                                    >
                                                                        {saving === category.id ? (
                                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                                        ) : (
                                                                            <RotateCcw className="w-4 h-4" />
                                                                        )}
                                                                    </button>
                                                                )}
                                                                {/* Delete button - only for custom categories (not originally default) */}
                                                                {!isOriginallyDefault(category.originalKey) && (
                                                                    <button
                                                                        onClick={() => handleDelete(category)}
                                                                        disabled={deletingId === category.id}
                                                                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
                                                                        title="Excluir Categoria"
                                                                    >
                                                                        {deletingId === category.id ? (
                                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                                        ) : (
                                                                            <Trash2 className="w-4 h-4" />
                                                                        )}
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Inline Create Row */}
                                        <div className="px-5 py-3 border-t border-gray-800/50 bg-[#373734]/10">
                                            {addingToGroup === groupName ? (
                                                <div className="flex items-center gap-2 animate-in fadeIn slide-in-from-top-2 duration-200">
                                                    <div className="flex-1 flex items-center gap-2">
                                                        <div className="p-1.5 bg-[#d97757]/20 rounded-lg">
                                                            <Plus className="w-4 h-4 text-[#d97757]" />
                                                        </div>
                                                        <input
                                                            type="text"
                                                            value={newCategoryName}
                                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleCreate(groupName);
                                                                if (e.key === 'Escape') {
                                                                    setAddingToGroup(null);
                                                                    setNewCategoryName('');
                                                                }
                                                            }}
                                                            placeholder="Nome da categoria..."
                                                            autoFocus
                                                            className="flex-1 bg-transparent border-none text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-0"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => handleCreate(groupName)}
                                                            disabled={saving === 'new' || !newCategoryName.trim()}
                                                            className="p-1.5 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                                                        >
                                                            {saving === 'new' ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <Check className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setAddingToGroup(null);
                                                                setNewCategoryName('');
                                                            }}
                                                            className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        setAddingToGroup(groupName);
                                                        setNewCategoryName('');
                                                    }}
                                                    className="w-full flex items-center justify-center gap-2 py-1 text-sm text-gray-500 hover:text-[#d97757] transition-colors group"
                                                >
                                                    <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                                    Adicionar Categoria
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))
                )}
            </div>

            {/* Barra de Confirmação de Exclusão */}
            <ConfirmationBar
                isOpen={!!deleteCategory}
                onCancel={() => setDeleteCategory(null)}
                onConfirm={confirmDelete}
                label={`Excluir a categoria "${deleteCategory?.displayName}"?`}
                confirmText="Sim, excluir"
                cancelText="Cancelar"
                isDestructive={true}
                position="bottom"
            />
        </div>
    );
};

export default CategoryManager;
