
import React, { useState } from 'react';
import { Users, Plus, Check, Crown, X } from './Icons';
import { ConfirmationCard } from './UIComponents';
import { Member } from '../types';

interface MemberSelectorProps {
  members: Member[];
  activeMemberId: string | 'FAMILY_OVERVIEW';
  onSelectMember: (id: string | 'FAMILY_OVERVIEW') => void;
  onAddMember: (name: string, avatarUrl: string) => void;
  onDeleteMember: (id: string) => void;
  isSidebarOpen: boolean;
  userPlan?: 'starter' | 'pro' | 'family';
}

const GRADIENTS = [
  'bg-gradient-to-br from-blue-500 to-cyan-400',
  'bg-gradient-to-br from-purple-500 to-pink-500',
  'bg-gradient-to-br from-green-500 to-emerald-400',
  'bg-gradient-to-br from-yellow-500 to-orange-500',
  'bg-gradient-to-br from-red-500 to-rose-500',
];

export const MemberSelector: React.FC<MemberSelectorProps> = ({
  members,
  activeMemberId,
  onSelectMember,
  onAddMember,
  onDeleteMember,
  isSidebarOpen,
  userPlan = 'starter'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);

  // Limit Logic
  const canAddMember = () => {
      const count = members.length;
      if (userPlan === 'starter' && count >= 1) return false;
      if (userPlan === 'pro' && count >= 2) return false;
      if (userPlan === 'family' && count >= 5) return false;
      return true;
  };

  const isLimitReached = !canAddMember();

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      const autoGradient = GRADIENTS[members.length % GRADIENTS.length];
      onAddMember(newName, autoGradient);
      setNewName('');
      setIsAdding(false);
      setIsOpen(false);
    }
  };

  // Get Active Member Display Info
  const activeMember = activeMemberId === 'FAMILY_OVERVIEW'
    ? { name: 'Família', avatarUrl: 'bg-gradient-to-r from-gray-700 to-gray-800' }
    : members.find(m => m.id === activeMemberId);

  if (!isSidebarOpen) {
    return (
      <button
        onClick={() => onSelectMember('FAMILY_OVERVIEW')}
        className="w-10 h-10 mx-auto rounded-full bg-gray-800 flex items-center justify-center text-[#d97757] hover:bg-gray-700 transition-colors"
      >
        <Users size={20} />
      </button>
    );
  }

  return (
    <>
    <div className="px-3 mb-6 relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-gray-900 border border-gray-800 rounded-xl p-2 flex items-center gap-3 hover:border-gray-700 transition-all group"
      >
        <div className={`w-10 h-10 rounded-full ${activeMember?.avatarUrl || 'bg-gray-700'} flex items-center justify-center shadow-inner text-white font-bold text-sm`}>
          {activeMemberId === 'FAMILY_OVERVIEW' ? <Users size={18} /> : activeMember?.name.substring(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 text-left overflow-hidden">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Perfil Ativo</p>
          <p className="text-sm font-bold text-gray-200 truncate group-hover:text-[#d97757] transition-colors">
            {activeMember?.name || 'Família'}
          </p>
        </div>
        <div className="bg-gray-800 p-1 rounded text-gray-500">
          <Users size={14} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 w-full z-50 px-3 mt-2">
          <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden animate-fade-in">

            {/* Family Overview Option */}
            <button
              onClick={() => { onSelectMember('FAMILY_OVERVIEW'); setIsOpen(false); }}
              className={`w-full p-3 flex items-center gap-3 hover:bg-gray-800 transition-colors border-b border-gray-800 ${activeMemberId === 'FAMILY_OVERVIEW' ? 'bg-gray-800/50' : ''}`}
            >
              <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-[#d97757]">
                <Users size={16} />
              </div>
              <span className="text-sm font-medium text-gray-300">Visão Família</span>
              {activeMemberId === 'FAMILY_OVERVIEW' && <Check size={14} className="ml-auto text-[#d97757]" />}
            </button>

            {/* Member List */}
            <div className="max-h-48 overflow-y-auto custom-scrollbar">
              {members.map(member => (
                <div
                  key={member.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => { onSelectMember(member.id); setIsOpen(false); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { onSelectMember(member.id); setIsOpen(false); }
                  }}
                  className={`w-full p-3 flex items-center gap-3 hover:bg-gray-800 transition-colors ${activeMemberId === member.id ? 'bg-gray-800/50' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full ${member.avatarUrl} flex items-center justify-center text-white text-xs font-bold`}>
                    {member.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-medium text-gray-300 block">{member.name}</span>
                    {member.role === 'admin' && <span className="text-[10px] text-yellow-500 flex items-center gap-1"><Crown size={8} /> Admin</span>}
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    {activeMemberId === member.id && <Check size={14} className="text-[#d97757]" />}
                    {member.role !== 'admin' && (
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setDeleteTarget(member);
                        }}
                        className="p-1 rounded-lg text-gray-500 hover:text-red-400 hover:bg-gray-900 transition-colors"
                        title="Remover membro"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add New Member Interface */}
            {isAdding ? (
              <form onSubmit={handleAdd} className="p-3 bg-gray-950 border-t border-gray-800">
                <div className="mb-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Nome do membro..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:border-[#d97757] outline-none"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 py-1.5 bg-gray-800 text-gray-400 rounded-lg text-xs hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-1.5 bg-[#d97757] text-white rounded-lg text-xs font-bold hover:bg-[#c56a4d]"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => !isLimitReached && setIsAdding(true)}
                className={`w-full p-3 flex items-center justify-center gap-2 text-xs font-medium border-t border-gray-800 transition-colors ${
                    isLimitReached 
                    ? 'text-gray-600 cursor-not-allowed bg-gray-900/50' 
                    : 'text-gray-500 hover:text-white hover:bg-gray-800'
                }`}
              >
                {isLimitReached ? (
                    <>
                       <div className="p-1 bg-gray-800 rounded-md"><Users size={12} className="opacity-50" /></div>
                       <span>Limite do Plano Atingido</span>
                    </>
                ) : (
                    <>
                       <Plus size={14} /> Adicionar Membro
                    </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>

      <ConfirmationCard
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            onDeleteMember(deleteTarget.id);
            setIsOpen(false);
          }
        }}
        title="Remover conta da familia?"
        description={deleteTarget ? `Voce esta prestes a apagar ${deleteTarget.name}. Esta acao pode ser desfeita.` : ''}
        confirmText="Sim, remover"
        cancelText="Cancelar"
        isDestructive
      />
    </>
  );
};
