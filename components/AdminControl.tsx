import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users as UsersIcon, CreditCard } from 'lucide-react';
import { AdminUsers } from './AdminUsers';
import { AdminSubscriptions } from './AdminSubscriptions';

type ControlTab = 'users' | 'subscriptions';

export const AdminControl: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ControlTab>('subscriptions');

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header and Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        Controle
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm">
                        Gerenciamento centralizado de usuários e assinaturas
                    </p>
                </div>

                {/* Custom Toggle */}
                <div className="bg-[#30302E] p-1 rounded-xl border border-[#373734] inline-flex">
                    <button
                        onClick={() => setActiveTab('subscriptions')}
                        className={`
              relative px-4 py-2 rounded-lg text-sm font-medium transition-colors z-10 flex items-center gap-2
              ${activeTab === 'subscriptions' ? 'text-white' : 'text-gray-400 hover:text-white'}
            `}
                    >
                        {activeTab === 'subscriptions' && (
                            <motion.div
                                layoutId="controlTab"
                                className="absolute inset-0 bg-[#373734] rounded-lg border border-gray-600/30 -z-10 shadow-sm"
                                transition={{ type: "spring", duration: 0.5 }}
                            />
                        )}
                        <CreditCard size={16} />
                        <span>Assinaturas</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('users')}
                        className={`
              relative px-4 py-2 rounded-lg text-sm font-medium transition-colors z-10 flex items-center gap-2
              ${activeTab === 'users' ? 'text-white' : 'text-gray-400 hover:text-white'}
            `}
                    >
                        {activeTab === 'users' && (
                            <motion.div
                                layoutId="controlTab"
                                className="absolute inset-0 bg-[#373734] rounded-lg border border-gray-600/30 -z-10 shadow-sm"
                                transition={{ type: "spring", duration: 0.5 }}
                            />
                        )}
                        <UsersIcon size={16} />
                        <span>Usuários</span>
                    </button>
                </div>
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-gray-800/50" />

            {/* Content Area */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10, scale: 0.95, filter: "blur(10px)" }}
                    animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -10, scale: 0.95, filter: "blur(10px)" }}
                    transition={{ duration: 0.4, ease: "circInOut", type: "spring", stiffness: 200, damping: 20 }}
                >
                    {activeTab === 'users' ? (
                        <AdminUsers />
                    ) : (
                        <AdminSubscriptions />
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};
