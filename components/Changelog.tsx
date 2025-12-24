import React from 'react';
import { motion } from 'framer-motion';
import { Tag, Calendar, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface ChangeLogItem {
    version: string;
    date: string;
    type: 'major' | 'minor' | 'patch';
    changes: {
        type: 'new' | 'improvement' | 'fix';
        text: string;
    }[];
}

const changelogs: ChangeLogItem[] = [
    {
        version: '0.1.0',
        date: '24 de Dezembro, 2024',
        type: 'major',
        changes: [
            { type: 'new', text: 'Lançamento do Changelog para acompanhar as novidades do sistema.' },
            { type: 'new', text: 'Implementação de animações de carregamento na página inicial.' },
            { type: 'improvement', text: 'Otimização da Landing Page removendo conteúdo desnecessário.' },
            { type: 'fix', text: 'Correção na exibição do tutorial Pro.' },
            { type: 'new', text: 'Adicionado sistema de cupons na área administrativa.' },
            { type: 'new', text: 'Novo dashboard de parceiros e comissões.' },
        ]
    },
    {
        version: '0.0.9',
        date: '23 de Dezembro, 2024',
        type: 'minor',
        changes: [
            { type: 'new', text: 'Badge "NOVO" adicionado ao item Roadmap Público no menu.' },
            { type: 'fix', text: 'Correção de exibição "NaN" na seção de investimentos.' },
            { type: 'improvement', text: 'Melhorias na central de notificações com alertas de assinaturas.' },
            { type: 'improvement', text: 'Truncamento de emails longos na tabela de usuários admin.' },
        ]
    },
    {
        version: '0.0.8',
        date: '22 de Dezembro, 2024',
        type: 'minor',
        changes: [
            { type: 'new', text: 'Implementação de limite de sincronização diária para contas bancárias.' },
            { type: 'improvement', text: 'Redesign das tabelas de transações para melhor legibilidade.' },
            { type: 'fix', text: 'Ajustes no layout e posicionamento da Hero section.' },
        ]
    }
];

export const Changelog: React.FC = () => {
    return (
        <div className="flex-1 p-6 max-w-5xl mx-auto mb-20">
            <div className="flex flex-col gap-2 mb-8">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Sparkles className="text-[#d97757]" size={32} />
                    Novidades e Atualizações
                </h1>
                <p className="text-gray-400">
                    Fique por dentro de tudo que há de novo no Controlar.
                </p>
            </div>

            <div className="space-y-8 relative">
                {/* Linha do tempo vertical - decorativa */}
                <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-800 hidden md:block" />

                {changelogs.map((log, index) => (
                    <motion.div
                        key={log.version}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="relative md:pl-12"
                    >
                        {/* Bolinha da linha do tempo */}
                        <div className="absolute left-[13px] top-6 w-3 h-3 rounded-full bg-[#d97757] ring-4 ring-[#30302E] hidden md:block" />

                        <div className="bg-[#30302E] border border-gray-800 rounded-xl overflow-hidden shadow-lg">
                            <div className="p-6 border-b border-gray-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-900/20">
                                <div className="flex items-center gap-4">
                                    <span className={`
                    px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                    ${log.type === 'major' ? 'bg-[#d97757] text-white' : 'bg-gray-800 text-gray-300'}
                  `}>
                                        v{log.version}
                                    </span>
                                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                                        <Calendar size={14} />
                                        <span>{log.date}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                {log.changes.map((change, i) => (
                                    <div key={i} className="flex items-start gap-3 group">
                                        <div className="mt-1 shrink-0">
                                            {change.type === 'new' && <Sparkles size={16} className="text-green-400" />}
                                            {change.type === 'improvement' && <CheckCircle2 size={16} className="text-blue-400" />}
                                            {change.type === 'fix' && <AlertCircle size={16} className="text-orange-400" />}
                                        </div>
                                        <div>
                                            <span className={`
                        text-xs font-bold uppercase mr-2 px-1.5 py-0.5 rounded border
                        ${change.type === 'new' ? 'border-green-500/30 text-green-400 bg-green-500/10' : ''}
                        ${change.type === 'improvement' ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' : ''}
                        ${change.type === 'fix' ? 'border-orange-500/30 text-orange-400 bg-orange-500/10' : ''}
                      `}>
                                                {change.type === 'new' ? 'Novo' : change.type === 'improvement' ? 'Melhoria' : 'Correção'}
                                            </span>
                                            <span className="text-gray-300 group-hover:text-white transition-colors">
                                                {change.text}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};
