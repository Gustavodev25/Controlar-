import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Search, ArrowLeft, Info, Sparkles, Bug, ArrowRight, ExternalLink } from 'lucide-react';
import { Topbar } from './novalandingpage/Topbar';

interface ChangeLogItem {
    version: string;
    majorVersion: string;
    date: string;
    type: 'major' | 'minor' | 'patch';
    image?: string;
    summary?: string;
    actionLink?: string;
    changes: {
        type: 'new' | 'improvement' | 'fix';
        text: string;
    }[];
}

const changelogs: ChangeLogItem[] = [
    {
        version: 'Versão 0.1.0',
        majorVersion: '10',
        date: '24 Dez, 2024',
        type: 'major',
        image: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1000&auto=format&fit=crop',
        summary: 'Uma reforma visual completa para trazer mais clareza e modernidade ao seu controle financeiro. O novo design foca no que realmente importa.',
        actionLink: '#',
        changes: [
            { type: 'new', text: 'Lançamento oficial da página de Novidades (Changelog).' },
            { type: 'new', text: 'Implementação de animações focadas em performance na Landing Page.' },
            { type: 'improvement', text: 'Otimização visual completa ("Clean Look") da nova Landing Page.' },
            { type: 'fix', text: 'Correção de bug onde o tutorial Pro aparecia múltiplas vezes.' },
        ]
    },
    {
        version: 'Versão 0.0.9',
        majorVersion: '09',
        date: '23 Dez, 2024',
        type: 'minor',
        changes: [
            { type: 'new', text: 'Badge "NOVO" para destacar funcionalidades recentes no menu lateral.' },
            { type: 'improvement', text: 'Central de notificações agora alerta sobre vencimento de assinaturas.' },
            { type: 'improvement', text: 'Tabelas administrativas otimizadas para melhor leitura de dados.' },
            { type: 'fix', text: 'Correção de valores exibidos como "NaN" nos investimentos.' },
            { type: 'fix', text: 'E-mails longos truncados na tabela de usuários admin.' },
        ]
    },
    {
        version: 'Versão 0.0.8',
        majorVersion: '08',
        date: '22 Dez, 2024',
        type: 'minor',
        changes: [
            { type: 'new', text: 'Limite inteligente de sincronização bancária para economizar recursos.' },
            { type: 'improvement', text: 'Redesign completo das tabelas de transações (Grid System).' },
            { type: 'fix', text: 'Ajustes finos de espaçamento e tipografia na Hero Section.' },
        ]
    }
];

export const PublicChangelog: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    return (
        <div className="min-h-screen bg-[#262624] font-sans selection:bg-[#D97757]/30 text-[#FAF9F5] pb-20">

            {/* Topbar Wrapper */}
            <div className="bg-[#262624]">
                <Topbar />
            </div>

            <main className="pt-32 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">

                {/* Standard Page Header (No Card) */}
                <div className="relative z-10 py-12 md:py-20 text-center max-w-4xl mx-auto mb-12">
                    {/* Ambient background glow behind title */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-[#D97757]/10 blur-[100px] rounded-full pointer-events-none" />

                    <h1 className="relative text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 tracking-tight leading-tight">
                        Acompanhe a evolução do <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D97757] via-[#ffcfbf] to-[#D97757]">Controlar</span>
                    </h1>
                    <p className="relative text-lg md:text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto">
                        Central de Novidades: fique por dentro de cada melhoria, nova funcionalidade e correção que implementamos para aprimorar sua experiência financeira.
                    </p>
                </div>

                {/* Sub-header info (Simplified) */}
                <div className="flex flex-col md:flex-row items-center justify-end gap-4 mb-16 px-2">
                    <div className="bg-[#30302E] px-4 py-2 rounded-full border border-gray-700 shadow-sm text-sm font-medium text-gray-300 cursor-pointer hover:bg-gray-800 transition-colors hover:text-white hover:border-gray-600">
                        Atualizações em 2024
                    </div>
                </div>

                {/* Timeline Grid */}
                <div className="relative">
                    {/* Dotted Line */}
                    <div className="absolute left-[8px] md:left-[180px] top-4 bottom-0 w-px border-l-2 border-dashed border-gray-700" />

                    <div className="space-y-16">
                        {changelogs.map((log, index) => {
                            const improvements = log.changes.filter(c => c.type !== 'fix');
                            const bugfixes = log.changes.filter(c => c.type === 'fix');

                            return (
                                <motion.div
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.5, delay: index * 0.1 }}
                                    key={log.version}
                                    className="flex flex-col md:flex-row gap-8 md:gap-12 relative"
                                >
                                    {/* Date Column */}
                                    <div className="md:w-[150px] flex-shrink-0 md:text-right pt-2 pl-8 md:pl-0 relative">
                                        <span className="text-sm font-bold text-gray-400 capitalize">{log.date}</span>
                                        {/* Timeline Circle */}
                                        <div className="absolute left-[3px] md:left-auto md:-right-[21px] top-3 w-3 h-3 bg-[#262624] border-2 border-gray-600 rounded-full z-10" />
                                    </div>

                                    {/* Content Column */}
                                    <div className="flex-1">
                                        <div className="rounded-[2rem] p-8 md:p-10 relative overflow-hidden bg-[#30302E] shadow-xl border border-gray-800/50 hover:border-gray-700 transition-all duration-300">

                                            {/* Big Watermark Number */}
                                            <div className="absolute -right-4 top-4 pointer-events-none opacity-[0.03] font-black text-9xl tracking-tighter select-none text-white">
                                                {log.majorVersion}
                                            </div>

                                            {/* Header: Title */}
                                            <div className="relative z-10 mb-6">
                                                <h2 className="text-3xl font-bold text-gray-100 mb-2">{log.version}</h2>
                                                {log.summary && (
                                                    <p className="text-gray-400 text-base leading-relaxed max-w-2xl">
                                                        {log.summary}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Optional Image */}
                                            {log.image && (
                                                <div className="relative z-10 mb-8 rounded-2xl overflow-hidden shadow-2xl border border-gray-800 group">
                                                    <div className="absolute inset-0 bg-gradient-to-t from-[#262624] via-transparent to-transparent opacity-60" />
                                                    <img
                                                        src={log.image}
                                                        alt={`Update ${log.version}`}
                                                        className="w-full h-64 md:h-80 object-cover transform group-hover:scale-105 transition-transform duration-700 ease-in-out"
                                                    />
                                                </div>
                                            )}

                                            {/* Change Lists */}
                                            <div className="grid md:grid-cols-1 gap-8 relative z-10">
                                                {improvements.length > 0 && (
                                                    <div>
                                                        <h3 className="font-bold text-gray-300 mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
                                                            <Sparkles size={16} className="text-[#D97757]" />
                                                            Melhorias
                                                        </h3>
                                                        <ul className="space-y-3">
                                                            {improvements.map((item, i) => (
                                                                <li key={i} className="flex items-start gap-3 text-sm text-gray-400 leading-relaxed font-medium">
                                                                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-600 flex-shrink-0" />
                                                                    {item.text}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {bugfixes.length > 0 && (
                                                    <div>
                                                        <h3 className="font-bold text-gray-300 mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
                                                            <Bug size={16} className="text-red-400" />
                                                            Correções
                                                        </h3>
                                                        <ul className="space-y-3">
                                                            {bugfixes.map((item, i) => (
                                                                <li key={i} className="flex items-start gap-3 text-sm text-gray-400 leading-relaxed font-medium">
                                                                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-600 flex-shrink-0" />
                                                                    {item.text}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Footer: Date & Button */}
                                            {log.actionLink && (
                                                <div className="mt-8 pt-8 border-t border-gray-800 flex items-center justify-between relative z-10">
                                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-widest">
                                                        Lançado em {log.date}
                                                    </span>

                                                    {/* Ghost Button */}
                                                    <a
                                                        href={log.actionLink}
                                                        className="
                                                    group flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300
                                                    bg-transparent text-white border border-gray-600
                                                    hover:bg-white hover:text-black hover:border-white hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]
                                                "
                                                    >
                                                        Saber mais
                                                        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                                                    </a>
                                                </div>
                                            )}

                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer Link */}
                <div className="mt-20 text-center pb-8 border-t border-gray-800 pt-8">
                    <button
                        onClick={onBack}
                        className="text-gray-500 hover:text-white transition-colors text-sm flex items-center justify-center gap-2 mx-auto font-medium"
                    >
                        <ArrowLeft size={16} />
                        Voltar para o Início
                    </button>
                </div>

            </main>
        </div>
    );
};
