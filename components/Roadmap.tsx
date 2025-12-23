import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Clock, Hammer, Map } from './Icons';
import * as dbService from '../services/database';
import { Feedback } from '../services/database';

export const Roadmap: React.FC = () => {
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [showWelcome, setShowWelcome] = useState(false);

    useEffect(() => {
        // Listen to all feedbacks, but we will filter in the UI
        const unsubscribe = dbService.listenToFeedbacks((data) => {
            setFeedbacks(data);
            setIsLoading(false);
        });

        // Check for welcome message
        const hasSeen = localStorage.getItem('roadmap_welcome_seen');
        if (!hasSeen) {
            setShowWelcome(true);
        }

        return () => unsubscribe();
    }, []);

    const handleDismissWelcome = () => {
        localStorage.setItem('roadmap_welcome_seen', 'true');
        setShowWelcome(false);
    };

    const planned = feedbacks.filter(f => f.status === 'planned');
    const inProgress = feedbacks.filter(f => f.status === 'in_progress');
    const completed = feedbacks.filter(f => f.status === 'completed' || f.status === 'resolved');

    const renderCard = (feedback: Feedback) => (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            key={feedback.id}
            className="bg-[#30302E] border border-[#373734] rounded-xl p-4 shadow-sm hover:border-gray-600 transition-colors"
        >
            <div className="flex items-start justify-between gap-3 mb-2">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide border ${feedback.type === 'bug'
                    ? 'bg-red-500/10 text-red-500 border-red-500/20'
                    : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    }`}>
                    {feedback.type === 'bug' ? 'Correção' : 'Sugestão'}
                </span>
                <span className="text-[10px] text-gray-500 font-mono">
                    Enviado em: {new Date(feedback.createdAt).toLocaleDateString('pt-BR')}
                </span>
            </div>
            <p className="text-gray-200 text-sm leading-relaxed mb-3">
                {feedback.message}
            </p>

            {/* Completion Date */}
            {(feedback.status === 'completed' || feedback.status === 'resolved') && feedback.resolvedAt && (
                <div className="mb-3 flex items-center gap-1.5 text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded w-fit">
                    <Check size={10} />
                    Finalizado em: {new Date(feedback.resolvedAt).toLocaleDateString('pt-BR')}
                </div>
            )}

            {feedback.adminNotes && (
                <p className="text-xs text-gray-500 border-t border-gray-800 pt-2 italic">
                    Note: {feedback.adminNotes}
                </p>
            )}
        </motion.div>
    );

    const Column = ({ title, icon, items, colorClass, emptyText }: any) => (
        <div className="flex flex-col gap-4 min-h-[400px]">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-800">
                <div className={`p-1.5 rounded-lg ${colorClass}`}>
                    {icon}
                </div>
                <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wide flex-1">{title}</h3>
                <span className="text-xs font-mono text-gray-500 bg-gray-800/50 px-2 py-0.5 rounded-full">
                    {items.length}
                </span>
            </div>

            <div className="flex flex-col gap-3">
                {items.length > 0 ? (
                    items.map((item: Feedback) => renderCard(item))
                ) : (
                    <div className="py-10 text-center border border-dashed border-gray-800 rounded-xl bg-gray-900/20">
                        <p className="text-sm text-gray-600">{emptyText}</p>
                    </div>
                )}
            </div>
        </div>
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="w-8 h-8 border-2 border-[#d97757] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Map className="text-[#d97757]" />
                        Roadmap Público
                    </h1>
                    <p className="text-gray-500 mt-2 max-w-2xl text-sm leading-relaxed">
                        Acompanhe o que estamos construindo. Nossa evolução é transparente e guiada pelo feedback de vocês.
                    </p>
                </div>
            </div>

            {/* Welcome Banner */}
            {showWelcome && (
                <motion.div
                    initial={{ opacity: 0, y: -20, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -20, height: 0 }}
                    className="bg-gradient-to-r from-blue-900/10 to-blue-900/5 border border-blue-900/20 rounded-xl p-6 relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Map size={100} className="text-blue-500" />
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold text-blue-100">Bem-vindo ao nosso Roadmap!</h3>
                            <p className="text-blue-200/70 text-sm max-w-2xl leading-relaxed">
                                Este é o espaço onde tornamos nosso desenvolvimento transparente.
                                Aqui você pode ver quais sugestões foram aceitas e quando elas serão implementadas.
                                <br />
                                Quer sugerir algo? Use o botão <strong>"Enviar Feedback"</strong> na barra lateral!
                            </p>
                        </div>
                        <button
                            onClick={handleDismissWelcome}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg transition-all shadow-lg shadow-blue-900/20 whitespace-nowrap"
                        >
                            Entendi, vamos lá!
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Kanban Board */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Column
                    title="Próximas Atualizações"
                    icon={<Clock size={16} />}
                    items={planned}
                    colorClass="bg-blue-500/10 text-blue-500"
                    emptyText="Nada planejado por enquanto."
                />

                <Column
                    title="Em Construção"
                    icon={<Hammer size={16} />}
                    items={inProgress}
                    colorClass="bg-amber-500/10 text-amber-500"
                    emptyText="A equipe está focada em outras tarefas."
                />

                <Column
                    title="Feito"
                    icon={<Check size={16} />}
                    items={completed}
                    colorClass="bg-emerald-500/10 text-emerald-500"
                    emptyText="Ainda não concluímos novos itens."
                />
            </div>
        </div>
    );
};
