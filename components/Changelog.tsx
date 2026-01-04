import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Sparkles, Zap, Bug } from 'lucide-react';
import { ChangelogItem } from '../types';
import * as dbService from '../services/database';
import { RichTextRenderer } from './RichTextRenderer';

export const Changelog: React.FC = () => {
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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="w-8 h-8 border-4 border-[#d97757] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

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

                {changelogs.length === 0 ? (
                    <div className="text-center py-20 bg-[#30302E] rounded-2xl border border-[#373734] border-dashed">
                        <p className="text-gray-400">Nenhuma atualização encontrada.</p>
                    </div>
                ) : (
                    changelogs.map((log, index) => (
                        <motion.div
                            key={log.id || index}
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

                                <div className="p-6 space-y-6">
                                    {/* Summary */}
                                    {log.summary && (
                                        <div className="text-gray-300 text-sm leading-relaxed border-l-2 border-[#d97757]/30 pl-4 py-1">
                                            <RichTextRenderer text={log.summary} />
                                        </div>
                                    )}

                                    {/* New Features */}
                                    {log.changes.filter(c => c.type === 'new').length > 0 && (
                                        <div className="space-y-3">
                                            <h4 className="flex items-center gap-2 text-green-400 font-bold uppercase text-xs tracking-wider">
                                                <Sparkles size={14} /> Novidades
                                            </h4>
                                            {log.newFeaturesIntro && (
                                                <p className="text-sm text-gray-400 italic mb-2">{log.newFeaturesIntro}</p>
                                            )}
                                            <div className="space-y-2">
                                                {log.changes.filter(c => c.type === 'new').map((change, i) => (
                                                    <div key={i} className="flex items-start gap-3 group pl-2">
                                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500/50 flex-shrink-0" />
                                                        <span className="text-gray-300 group-hover:text-white transition-colors text-sm">
                                                            <RichTextRenderer text={change.text} />
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Improvements */}
                                    {log.changes.filter(c => c.type === 'improvement').length > 0 && (
                                        <div className="space-y-3">
                                            <h4 className="flex items-center gap-2 text-blue-400 font-bold uppercase text-xs tracking-wider">
                                                <Zap size={14} /> Melhorias
                                            </h4>
                                            {log.improvementsIntro && (
                                                <p className="text-sm text-gray-400 italic mb-2">{log.improvementsIntro}</p>
                                            )}
                                            <div className="space-y-2">
                                                {log.changes.filter(c => c.type === 'improvement').map((change, i) => (
                                                    <div key={i} className="flex items-start gap-3 group pl-2">
                                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500/50 flex-shrink-0" />
                                                        <span className="text-gray-300 group-hover:text-white transition-colors text-sm">
                                                            <RichTextRenderer text={change.text} />
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Fixes */}
                                    {log.changes.filter(c => c.type === 'fix').length > 0 && (
                                        <div className="space-y-3">
                                            <h4 className="flex items-center gap-2 text-orange-400 font-bold uppercase text-xs tracking-wider">
                                                <Bug size={14} /> Correções
                                            </h4>
                                            {log.fixesIntro && (
                                                <p className="text-sm text-gray-400 italic mb-2">{log.fixesIntro}</p>
                                            )}
                                            <div className="space-y-2">
                                                {log.changes.filter(c => c.type === 'fix').map((change, i) => (
                                                    <div key={i} className="flex items-start gap-3 group pl-2">
                                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-500/50 flex-shrink-0" />
                                                        <span className="text-gray-300 group-hover:text-white transition-colors text-sm">
                                                            <RichTextRenderer text={change.text} />
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
};
