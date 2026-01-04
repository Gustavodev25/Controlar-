import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, ArrowLeft, Sparkles, Bug, ArrowRight, Zap } from 'lucide-react';
import { Topbar } from './novalandingpage/Topbar';
import { AnimatedGridPattern } from './AnimatedGridPattern';
import { ShiningText } from './ShiningText';
import { ChangelogItem } from '../types';
import * as dbService from '../services/database';
import { RichTextRenderer } from './RichTextRenderer';

export const PublicChangelog: React.FC<{ onBack: () => void; user?: any }> = ({ onBack, user }) => {
    const [changelogs, setChangelogs] = useState<ChangelogItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const data = await dbService.getChangelogs();
            setChangelogs(data);
            setIsLoading(false);
        };
        load();
    }, []);

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
                <Topbar
                    onLogin={() => { }}
                    hideNavigation={true}
                    user={user}
                    centerContent={
                        <span className="text-white/40 font-mono text-sm tracking-wider">
                            {new Date().getFullYear()}
                        </span>
                    }
                />
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
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-8 h-8 border-4 border-[#d97757] border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-10 pt-4">
                            {changelogs.length === 0 ? (
                                <div className="p-8 border border-white/10 rounded-2xl bg-white/5 text-center text-gray-400">
                                    Nenhuma atualização encontrada.
                                </div>
                            ) : changelogs.map((log, index) => {
                                const newFeatures = log.changes.filter(c => c.type === 'new');
                                const improvements = log.changes.filter(c => c.type === 'improvement');
                                const bugfixes = log.changes.filter(c => c.type === 'fix');

                                return (
                                    <motion.div
                                        initial={{ opacity: 0, x: 50 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true, margin: "-100px" }}
                                        transition={{ duration: 0.5, delay: index * 0.1 }}
                                        key={log.id || index}
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
                                                        <RichTextRenderer text={log.summary} />
                                                    </p>
                                                )}

                                                <div className="space-y-8">
                                                    {/* New Features */}
                                                    {newFeatures.length > 0 && (
                                                        <div>
                                                            <h3 className="font-bold text-gray-400 mb-2 text-xs uppercase tracking-wider flex items-center gap-2">
                                                                <Sparkles size={14} className="text-green-400" />
                                                                Novidades
                                                            </h3>
                                                            {log.newFeaturesIntro && (
                                                                <p className="text-sm text-gray-500 italic mb-3 pl-6">{log.newFeaturesIntro}</p>
                                                            )}
                                                            <ul className="space-y-3">
                                                                {newFeatures.map((item, i) => (
                                                                    <li key={i} className="flex items-start gap-3 text-sm text-gray-400 font-medium">
                                                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500/50 flex-shrink-0" />
                                                                        <RichTextRenderer text={item.text} />
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {/* Improvements */}
                                                    {improvements.length > 0 && (
                                                        <div>
                                                            <h3 className="font-bold text-gray-400 mb-2 text-xs uppercase tracking-wider flex items-center gap-2">
                                                                <Zap size={14} className="text-blue-400" />
                                                                Melhorias
                                                            </h3>
                                                            {log.improvementsIntro && (
                                                                <p className="text-sm text-gray-500 italic mb-3 pl-6">{log.improvementsIntro}</p>
                                                            )}
                                                            <ul className="space-y-3">
                                                                {improvements.map((item, i) => (
                                                                    <li key={i} className="flex items-start gap-3 text-sm text-gray-400 font-medium">
                                                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500/50 flex-shrink-0" />
                                                                        <RichTextRenderer text={item.text} />
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {/* Bug Fixes */}
                                                    {bugfixes.length > 0 && (
                                                        <div>
                                                            <h3 className="font-bold text-gray-400 mb-2 text-xs uppercase tracking-wider flex items-center gap-2">
                                                                <Bug size={14} className="text-orange-400" />
                                                                Correções
                                                            </h3>
                                                            {log.fixesIntro && (
                                                                <p className="text-sm text-gray-500 italic mb-3 pl-6">{log.fixesIntro}</p>
                                                            )}
                                                            <ul className="space-y-3">
                                                                {bugfixes.map((item, i) => (
                                                                    <li key={i} className="flex items-start gap-3 text-sm text-gray-400 font-medium">
                                                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-500/50 flex-shrink-0" />
                                                                        <RichTextRenderer text={item.text} />
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
                    )}
                </div>
            </main>
        </div>
    );
};
