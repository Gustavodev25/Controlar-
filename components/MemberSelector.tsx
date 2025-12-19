
import React, { useState } from 'react';
import { Users, Plus, Check, Crown, X } from './Icons';
import { ConfirmationBar } from './ConfirmationBar';
import { Member } from '../types';

interface MemberSelectorProps {
  members: Member[];
  activeMemberId: string | 'FAMILY_OVERVIEW';
  onSelectMember: (id: string | 'FAMILY_OVERVIEW') => void;
  onAddMember: (name: string, avatarUrl: string) => void;
  onDeleteMember: (id: string) => void;
  isSidebarOpen: boolean;
  userPlan?: 'starter' | 'pro' | 'family';
  isAdmin?: boolean;
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
  userPlan = 'starter',
  isAdmin = false
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
    if (userPlan === 'family' && count >= 3) return false;
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
    ? { name: 'Família', avatarUrl: 'bg-[#363735] border border-[#3A3B39]' }
    : members.find(m => m.id === activeMemberId);

  if (!isSidebarOpen) {
    return (
      <div className="relative py-3 flex justify-center">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-10 h-10 rounded-full bg-[#363735] border border-[#3A3B39] flex items-center justify-center text-[#d97757] hover:border-[#d97757] transition-colors cursor-pointer"
        >
          {activeMemberId === 'FAMILY_OVERVIEW' ? <Users size={20} /> : (
            <span className="text-xs font-bold text-white">
              {activeMember?.name ? activeMember.name.substring(0, 2).toUpperCase() : <Users size={20} />}
            </span>
          )}
        </button>

        {/* Dropdown for collapsed sidebar */}
        {isOpen && (
          <div className="absolute left-full top-0 ml-3 z-[999] w-56">
            <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden animate-dropdown-open">
              {/* Seta do tooltip */}
              <div className="absolute left-0 top-5 -translate-x-1/2 w-2.5 h-2.5 bg-gray-900 border-l border-b border-gray-800 rotate-45"></div>

              {/* Family Overview Option */}


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
                    className={`w-full p-3 flex items-center gap-3 hover:bg-gray-800 transition-colors cursor-pointer ${activeMemberId === member.id ? 'bg-gray-800/50' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-full ${member.avatarUrl} flex items-center justify-center text-white text-xs font-bold`}>
                      {member.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-medium text-gray-300 block">{member.name}</span>
                      {member.role === 'admin' ? (
                        <span className="text-[10px] text-yellow-500 flex items-center gap-1"><Crown size={8} /> Admin</span>
                      ) : (
                        <span className="text-[10px] text-gray-500 flex items-center gap-1">Convidado</span>
                      )}
                    </div>
                    {activeMemberId === member.id && <Check size={14} className="ml-auto text-[#d97757]" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="px-3 py-4 relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full bg-gray-900 border border-gray-800 rounded-xl p-2.5 flex items-center gap-3 hover:border-gray-700 transition-all group"
        >
          <div className={`w-10 h-10 rounded-full ${activeMember?.avatarUrl?.includes('url') ? activeMember.avatarUrl : 'bg-[#363735] border border-[#3A3B39]'} flex items-center justify-center shadow-inner text-white font-bold text-sm`}>
            {activeMemberId === 'FAMILY_OVERVIEW' ? <Users size={18} /> : activeMember?.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 text-left overflow-hidden flex items-center">
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
            <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden animate-dropdown-open">

              {/* Family Overview Option */}


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
                      {member.role === 'admin' ? (
                        <span className="text-[10px] text-yellow-500 flex items-center gap-1"><Crown size={8} /> Admin</span>
                      ) : (
                        <span className="text-[10px] text-gray-500 flex items-center gap-1">Convidado</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      {activeMemberId === member.id && <Check size={14} className="text-[#d97757]" />}
                      {isAdmin && member.role !== 'admin' && (
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

              {/* Add New Member Interface - REMOVED for new Family System */}
              {/* 
              Formerly here. Now users should use the Family Dashboard to invite/add members.
            */}
            </div>
          </div>
        )}
      </div>

      <ConfirmationBar
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            onDeleteMember(deleteTarget.id);
            setIsOpen(false);
            setDeleteTarget(null);
          }
        }}
        label="Remover conta da familia?"
        confirmText="Sim, remover"
        cancelText="Cancelar"
        isDestructive={true}
      />
    </>
  );
};
