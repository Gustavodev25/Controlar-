import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Search, ArrowLeft, Info, Sparkles, Bug, ArrowRight, ExternalLink } from 'lucide-react';
import { Topbar } from './novalandingpage/Topbar';
import { AnimatedGridPattern } from './AnimatedGridPattern';
import { ShiningText } from './ShiningText';

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
        <div className="min-h-screen font-sans selection:bg-[#D97757]/30 text-[#FAF9F5] pb-20 relative overflow-hidden bg-[radial-gradient(ellipse_60%_40%_at_50%_40%,_#3a1a10_0%,_#1a0f0a_100%)]">

            {/* Grid Animado de Fundo */}
            <AnimatedGridPattern
                width={60}
                height={60}
                numSquares={20}
                maxOpacity={0.08}
                duration={4}
                repeatDelay={2}
                className="[mask-image:radial-gradient(ellipse_50%_50%_at_50%_40%,white_0%,transparent_70%)] fill-white/5 stroke-white/[0.03] fixed inset-0 h-full w-full pointer-events-none"
            />

            {/* Topbar Wrapper */}
            <div className="relative z-50">
                <Topbar onLogin={() => { }} />
            </div>

            <main className="relative z-10 pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col lg:flex-row gap-12 h-[calc(100vh-20px)] overflow-hidden">

                {/* Left Column - Fixed Content */}
                <div className="lg:w-5/12 flex flex-col justify-center lg:sticky lg:top-0 lg:h-full pb-12 pl-4">
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 tracking-tight leading-tight">
                                Acompanhe a evolução do <ShiningText text="Controlar+" />
                            </h1>
                            <p className="text-lg md:text-xl text-gray-400 leading-relaxed max-w-xl">
                                Central de Novidades: fique por dentro de cada melhoria, nova funcionalidade e correção que implementamos para aprimorar sua experiência financeira.
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Badge Removed */}
                        </div>

                        <div className="pt-8">
                            <button
                                onClick={onBack}
                                className="group flex items-center gap-2 px-5 py-3 rounded-full bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-all border border-white/10 hover:border-white/20"
                            >
                                <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
                                Voltar para o Início
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column - Scrollable Content */}
                <div className="lg:w-7/12 lg:overflow-y-auto lg:h-full pb-32 pr-2 custom-scrollbar">
                    <div className="space-y-10 pt-4">
                        {changelogs.map((log, index) => {
                            const improvements = log.changes.filter(c => c.type !== 'fix');
                            const bugfixes = log.changes.filter(c => c.type === 'fix');

                            return (
                                <motion.div
                                    initial={{ opacity: 0, x: 50 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true, margin: "-100px" }}
                                    transition={{ duration: 0.5, delay: index * 0.1 }}
                                    key={log.version}
                                    className="flex flex-col gap-4"
                                >
                                    {/* Version Header Small */}
                                    <div className="flex items-center gap-4 pl-2">
                                        <span className="text-sm font-bold text-[#D97757]">{log.version}</span>
                                        <div className="h-px bg-gray-800 flex-1" />
                                        <span className="text-xs font-medium text-gray-500 uppercase">{log.date}</span>
                                    </div>

                                    {/* Main Card */}
                                    <div
                                        className="rounded-[24px] border border-white/10 p-8 relative overflow-hidden shadow-[0_8px_40px_-10px_rgba(0,0,0,0.6)] flex flex-col gap-6 group transition-all hover:border-white/20"
                                        style={{
                                            backgroundColor: "rgba(10, 10, 10, 0.65)",
                                            backdropFilter: "blur(24px) saturate(180%)",
                                            WebkitBackdropFilter: "blur(24px) saturate(180%)",
                                        }}
                                    >
                                        {/* Textura Noise */}
                                        <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] contrast-125" />

                                        {/* Borda Superior Brilhante */}
                                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />

                                        {/* Big Watermark Number */}
                                        <div className="absolute -right-4 top-4 pointer-events-none opacity-[0.03] font-black text-9xl tracking-tighter select-none text-white group-hover:opacity-[0.05] transition-opacity">
                                            {log.majorVersion}
                                        </div>

                                        {/* Optional Image */}
                                        {log.image && (
                                            <div className="relative z-10 rounded-2xl overflow-hidden shadow-lg border border-white/10">
                                                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent opacity-60" />
                                                <img
                                                    src={log.image}
                                                    alt={`Update ${log.version}`}
                                                    className="w-full h-48 sm:h-64 object-cover transform group-hover:scale-105 transition-transform duration-700 ease-in-out"
                                                />
                                            </div>
                                        )}

                                        <div className="relative z-10 flex flex-col gap-6">
                                            {log.summary && (
                                                <p className="text-gray-300 text-base leading-relaxed">
                                                    {log.summary}
                                                </p>
                                            )}

                                            <div className="space-y-8">
                                                {improvements.length > 0 && (
                                                    <div>
                                                        <h3 className="font-bold text-gray-400 mb-4 text-xs uppercase tracking-wider flex items-center gap-2">
                                                            <Sparkles size={14} className="text-[#D97757]" />
                                                            Melhorias
                                                        </h3>
                                                        <ul className="space-y-3">
                                                            {improvements.map((item, i) => (
                                                                <li key={i} className="flex items-start gap-3 text-sm text-gray-400 font-medium">
                                                                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-700 flex-shrink-0" />
                                                                    {item.text}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {bugfixes.length > 0 && (
                                                    <div>
                                                        <h3 className="font-bold text-gray-400 mb-4 text-xs uppercase tracking-wider flex items-center gap-2">
                                                            <Bug size={14} className="text-red-400" />
                                                            Correções
                                                        </h3>
                                                        <ul className="space-y-3">
                                                            {bugfixes.map((item, i) => (
                                                                <li key={i} className="flex items-start gap-3 text-sm text-gray-400 font-medium">
                                                                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-700 flex-shrink-0" />
                                                                    {item.text}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Footer Button */}
                                        {log.actionLink && (
                                            <div className="mt-8 pt-6 border-t border-gray-800/50 flex justify-end relative z-10">
                                                <a
                                                    href={log.actionLink}
                                                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#D97757] hover:text-[#ff9270] transition-colors"
                                                >
                                                    Saber mais <ArrowRight size={16} />
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </main>
        </div>
    );
};
