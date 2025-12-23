import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bug,
    Lightbulb,
    Check,
    X,
    Trash2,
    MessageSquare,
    Clock,
    CheckCircle,
    AlertCircle,
    Eye,
    Map,
    Hammer
} from './Icons';
import * as dbService from '../services/database';
import { Feedback } from '../services/database';
import { EmptyState } from './EmptyState';
import { ConfirmationBar } from './ConfirmationBar';
import NumberFlow from '@number-flow/react';

type StatusFilter = 'all' | 'pending' | 'reviewed' | 'planned' | 'in_progress' | 'completed' | 'resolved' | 'dismissed';

const statusTabs: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'pending', label: 'Pendente' },
    { value: 'reviewed', label: 'Em Análise' },
    { value: 'planned', label: 'Planejado' },
    { value: 'in_progress', label: 'Em Construção' },
    { value: 'completed', label: 'Concluído' },
    // { value: 'resolved', label: 'Resolvido' }, // Hide resolved to simplify, or merge with completed
    { value: 'dismissed', label: 'Dispensado' },
];

export const AdminFeedbacks: React.FC = () => {
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
    const [adminNotes, setAdminNotes] = useState('');
    const [deleteId, setDeleteId] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = dbService.listenToFeedbacks((data) => {
            setFeedbacks(data);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const filteredFeedbacks = feedbacks.filter(f =>
        statusFilter === 'all' ? true : f.status === statusFilter
    );

    const getStatusColor = (status: Feedback['status']) => {
        switch (status) {
            case 'pending': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            case 'reviewed': return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
            case 'planned': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'in_progress': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
            case 'completed': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'resolved': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'dismissed': return 'bg-red-500/10 text-red-500 border-red-500/20';
            default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
        }
    };

    const getStatusLabel = (status: Feedback['status']) => {
        switch (status) {
            case 'pending': return 'Pendente';
            case 'reviewed': return 'Em Análise';
            case 'planned': return 'Planejado';
            case 'in_progress': return 'Em Construção';
            case 'completed': return 'Concluído';
            case 'resolved': return 'Resolvido';
            case 'dismissed': return 'Dispensado';
            default: return status;
        }
    };

    const handleUpdateStatus = async (feedback: Feedback, newStatus: Feedback['status']) => {
        await dbService.updateFeedback({
            ...feedback,
            status: newStatus,
            resolvedAt: (newStatus === 'resolved' || newStatus === 'completed') ? new Date().toISOString() : null,
            adminNotes: adminNotes || feedback.adminNotes || null
        });
        setSelectedFeedback(null);
        setAdminNotes('');
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await dbService.deleteFeedback(deleteId);
        } catch (error) {
            console.error('Error deleting feedback:', error);
        } finally {
            setDeleteId(null);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const stats = {
        total: feedbacks.length,
        pending: feedbacks.filter(f => f.status === 'pending').length,
        bugs: feedbacks.filter(f => f.type === 'bug').length,
        suggestions: feedbacks.filter(f => f.type === 'suggestion').length,
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Feedbacks</h1>
                    <p className="text-gray-500 mt-1 text-sm">
                        Gerencie os feedbacks e bugs reportados pelos usuários
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-4">
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wide">Total</p>
                    <p className="text-2xl font-bold text-white mt-1 animate-[pulse_3s_ease-in-out_infinite]" style={{ animationDuration: '4s' }}>
                        <NumberFlow value={stats.total} />
                    </p>
                </div>
                <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-4">
                    <p className="text-xs text-amber-500 uppercase font-bold tracking-wide">Pendentes</p>
                    <p className="text-2xl font-bold text-white mt-1 animate-[pulse_3s_ease-in-out_infinite]" style={{ animationDuration: '4s' }}>
                        <NumberFlow value={stats.pending} />
                    </p>
                </div>
                <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-4">
                    <p className="text-xs text-red-500 uppercase font-bold tracking-wide">Bugs</p>
                    <p className="text-2xl font-bold text-white mt-1 animate-[pulse_3s_ease-in-out_infinite]" style={{ animationDuration: '4s' }}>
                        <NumberFlow value={stats.bugs} />
                    </p>
                </div>
                <div className="bg-[#30302E] border border-[#373734] rounded-2xl p-4">
                    <p className="text-xs text-amber-400 uppercase font-bold tracking-wide">Sugestões</p>
                    <p className="text-2xl font-bold text-white mt-1 animate-[pulse_3s_ease-in-out_infinite]" style={{ animationDuration: '4s' }}>
                        <NumberFlow value={stats.suggestions} />
                    </p>
                </div>
            </div>

            {/* Status Tabs with Smooth Animation */}
            <div className="relative">
                <div className="inline-flex bg-[#333431] rounded-2xl p-1.5 border border-[#373734]">
                    {statusTabs.map((tab) => (
                        <button
                            key={tab.value}
                            onClick={() => setStatusFilter(tab.value)}
                            className="relative py-2 px-4 text-sm font-medium transition-colors duration-200 z-10"
                        >
                            <span className={statusFilter === tab.value ? 'text-white' : 'text-gray-500 hover:text-gray-300'}>
                                {tab.label}
                            </span>
                            {statusFilter === tab.value && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute inset-0 bg-[#d97757] rounded-xl shadow-lg shadow-[#d97757]/20"
                                    style={{ zIndex: -1 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-[#30302E] border border-[#373734] rounded-2xl overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-[#d97757] border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filteredFeedbacks.length === 0 ? (
                    <EmptyState
                        title="Nenhum feedback encontrado"
                        description="Os feedbacks dos usuários aparecerão aqui quando forem enviados."
                        minHeight="min-h-[300px]"
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-[#333431] text-xs uppercase tracking-wider text-gray-500">
                                <tr>
                                    <th className="px-4 py-3 text-left">Tipo</th>
                                    <th className="px-4 py-3 text-left">Usuário</th>
                                    <th className="px-4 py-3 text-left">Mensagem</th>
                                    <th className="px-4 py-3 text-left">Status</th>
                                    <th className="px-4 py-3 text-left">Data</th>
                                    <th className="px-4 py-3 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#373734]">
                                {filteredFeedbacks.map((feedback) => (
                                    <tr key={feedback.id} className="hover:bg-[#373734]/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${feedback.type === 'bug'
                                                ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                                : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                                }`}>
                                                {feedback.type === 'bug' ? <Bug size={12} /> : <Lightbulb size={12} />}
                                                {feedback.type === 'bug' ? 'Bug' : 'Sugestão'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="text-white font-medium text-sm">{feedback.userName || 'Anônimo'}</p>
                                                <p className="text-gray-500 text-xs">{feedback.userEmail || '-'}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 max-w-xs">
                                            <p className="text-gray-300 text-sm truncate" title={feedback.message}>
                                                {feedback.message}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(feedback.status)}`}>
                                                {feedback.status === 'pending' && <Clock size={10} />}
                                                {feedback.status === 'reviewed' && <Eye size={10} />}
                                                {feedback.status === 'planned' && <Clock size={10} />}
                                                {feedback.status === 'in_progress' && <Hammer size={10} />}
                                                {(feedback.status === 'completed' || feedback.status === 'resolved') && <CheckCircle size={10} />}
                                                {feedback.status === 'dismissed' && <X size={10} />}
                                                {getStatusLabel(feedback.status)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-gray-400 text-xs font-mono">{formatDate(feedback.createdAt)}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        setSelectedFeedback(feedback);
                                                        setAdminNotes(feedback.adminNotes || '');
                                                    }}
                                                    className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                                                    title="Visualizar"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteId(feedback.id!)}
                                                    className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Detail Modal - Equal to system modals */}
            {createPortal(
                <AnimatePresence>
                    {selectedFeedback && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60"
                            onClick={() => setSelectedFeedback(null)}
                        >
                            <motion.div
                                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-gray-950 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-800 flex flex-col max-h-[90vh] relative"
                            >
                                {/* Background Glow */}
                                <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 opacity-20 bg-[#d97757]" />

                                {/* Header */}
                                <div className="p-5 border-b border-gray-800/50 flex justify-between items-center relative z-10">
                                    <h3 className="text-base font-semibold text-white flex items-center gap-2">
                                        <div className={`p-1.5 rounded-lg ${selectedFeedback.type === 'bug' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                            {selectedFeedback.type === 'bug' ? <Bug size={16} /> : <Lightbulb size={16} />}
                                        </div>
                                        {selectedFeedback.type === 'bug' ? 'Bug Report' : 'Sugestão'}
                                    </h3>
                                    <button
                                        onClick={() => setSelectedFeedback(null)}
                                        className="text-gray-500 hover:text-white p-2 hover:bg-gray-800/50 rounded-lg transition-all"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="p-6 overflow-y-auto custom-scrollbar space-y-5 animate-fade-in relative z-10">
                                    {/* User Info */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Informações</label>
                                        <div className="bg-gray-900/40 border border-gray-800/60 rounded-xl p-4 space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-gray-500 uppercase">Usuário</span>
                                                <span className="text-sm text-white font-medium">{selectedFeedback.userName || 'Anônimo'}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-gray-500 uppercase">Email</span>
                                                <span className="text-sm text-gray-300">{selectedFeedback.userEmail || '-'}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-gray-500 uppercase">Data</span>
                                                <span className="text-sm text-gray-400 font-mono">{formatDate(selectedFeedback.createdAt)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Message */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Mensagem</label>
                                        <p className="text-white p-4 bg-gray-900/40 border border-gray-800/60 rounded-xl text-sm whitespace-pre-wrap leading-relaxed">
                                            {selectedFeedback.message}
                                        </p>
                                    </div>

                                    {/* Admin Notes */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Notas do Admin</label>
                                        <textarea
                                            value={adminNotes}
                                            onChange={(e) => setAdminNotes(e.target.value)}
                                            placeholder="Adicione notas internas..."
                                            rows={3}
                                            className="w-full p-4 bg-gray-900/40 border border-gray-800/60 rounded-xl text-white text-sm placeholder-gray-600 focus:border-gray-700 focus:bg-gray-900/60 outline-none resize-none transition-all"
                                        />
                                    </div>

                                    {/* Status Actions */}
                                    <div className="flex flex-col gap-2 pt-2">
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleUpdateStatus(selectedFeedback, 'reviewed');
                                                }}
                                                className="flex-1 py-3 rounded-xl border border-gray-800 bg-gray-900/40 hover:bg-gray-800/50 text-gray-300 hover:text-white transition-all font-medium text-xs flex items-center justify-center gap-1.5"
                                            >
                                                <Eye size={14} /> Em Análise
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleUpdateStatus(selectedFeedback, 'planned');
                                                }}
                                                className="flex-1 py-3 rounded-xl border border-blue-900/30 bg-blue-900/10 hover:bg-blue-900/20 text-blue-400 hover:text-blue-300 transition-all font-medium text-xs flex items-center justify-center gap-1.5"
                                            >
                                                <Clock size={14} /> Planejado
                                            </button>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleUpdateStatus(selectedFeedback, 'in_progress');
                                                }}
                                                className="flex-1 py-3 rounded-xl border border-amber-900/30 bg-amber-900/10 hover:bg-amber-900/20 text-amber-400 hover:text-amber-300 transition-all font-medium text-xs flex items-center justify-center gap-1.5"
                                            >
                                                <Hammer size={14} /> Em Construção
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleUpdateStatus(selectedFeedback, 'completed');
                                                }}
                                                className="flex-1 py-3 rounded-xl bg-[#d97757] hover:bg-[#c56a4d] text-white font-bold transition-all shadow-lg shadow-[#d97757]/20 text-xs flex items-center justify-center gap-1.5"
                                            >
                                                <Check size={14} /> Concluído
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                // Map 'resolved' to completed or keep as internal resolved
                                                handleUpdateStatus(selectedFeedback, 'resolved');
                                            }}
                                            className="w-full py-2 rounded-xl text-gray-500 hover:text-white text-xs hover:bg-gray-800 transition-all"
                                        >
                                            Marcar como Resolvido (Interno)
                                        </button>
                                    </div>

                                    {/* Dismiss link */}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleUpdateStatus(selectedFeedback, 'dismissed');
                                        }}
                                        className="w-full text-center text-xs text-gray-500 hover:text-gray-400 transition-colors py-2"
                                    >
                                        Dispensar este feedback
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* Delete Confirmation */}
            <ConfirmationBar
                isOpen={!!deleteId}
                onCancel={() => setDeleteId(null)}
                onConfirm={handleDelete}
                label="Excluir Feedback?"
                confirmText="Sim, excluir"
                cancelText="Cancelar"
                isDestructive={true}
            />
        </div>
    );
};
