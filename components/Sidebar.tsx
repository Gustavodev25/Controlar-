import React, { useState } from 'react';
import {
  LayoutDashboard,
  Bot,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  MathMaxMin,
  SidebarWallet,
  Pig
} from './Icons';
import { Flame, MessageCircle, Users as UsersIcon, BrainCircuit } from 'lucide-react';
import { Member } from '../types';
import { Logo } from './Logo';
import { MemberSelector } from './MemberSelector';

// Tipos de tab disponíveis
export type TabType =
  | 'dashboard'
  | 'table'
  | 'credit_cards'
  | 'reminders'
  | 'subscriptions'
  | 'budgets'
  | 'connections'
  | 'investments'
  | 'fire'
  | 'advisor'
  | 'subscription'
  | 'admin_overview'
  | 'admin_waitlist'
  | 'admin_email';

// Sub-componente para itens de navegação
interface NavItemProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  isOpen: boolean;
  badge?: number;
  disabled?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ active, onClick, icon, label, isOpen, badge, disabled }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        flex items-center transition-all duration-200 group relative rounded-lg
        ${isOpen
          ? 'w-full gap-3 p-2.5 justify-start'
          : 'w-full py-3 justify-center'
        }
        ${active
          ? 'bg-gray-800 text-white shadow-sm'
          : disabled
            ? 'text-gray-600 cursor-not-allowed opacity-50'
            : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
        }
      `}
    >
      <span className={`transition-colors relative z-10 ${active ? 'text-[#d97757]' : 'text-gray-500 group-hover:text-gray-300'}`}>
        {icon}
      </span>

      {isOpen && <span className="font-medium text-sm truncate animate-fade-in">{label}</span>}

      {/* Badge */}
      {(badge || 0) > 0 && (
        <span className={`absolute ${isOpen ? 'right-2 top-1/2 -translate-y-1/2' : 'top-1 right-1'} flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white`}>
          {badge && badge > 9 ? '9+' : badge}
        </span>
      )}

      {/* Active Indicator (Collapsed) */}
      {!isOpen && active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#d97757] rounded-r-md"></div>
      )}

      {/* Tooltip Card (Collapsed Only) */}
      {!isOpen && isHovered && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 z-50 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl p-3 min-w-[140px] text-left animate-fade-in">
          <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-gray-900 border-l border-b border-gray-800 rotate-45"></div>
          <p className="text-sm font-bold text-white whitespace-nowrap">{label}</p>
        </div>
      )}
    </button>
  );
};

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isAdminMode: boolean;
  activeMemberId: string;
  members: Member[];
  onSelectMember: (id: string) => void;
  onAddMember: (name: string) => Promise<void>;
  onDeleteMember: (id: string) => Promise<void>;
  userPlan: 'starter' | 'pro' | 'family';
  isAdmin?: boolean;
  overdueRemindersCount?: number;
  onOpenAIModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  setIsOpen,
  activeTab,
  setActiveTab,
  isAdminMode,
  activeMemberId,
  members,
  onSelectMember,
  onAddMember,
  onDeleteMember,
  userPlan,
  isAdmin,
  overdueRemindersCount = 0,
  onOpenAIModal
}) => {
  const handleNavClick = (tab: TabType) => {
    setActiveTab(tab);
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    }
  };

  const sidebarClasses = `
    fixed inset-y-0 left-0 z-50
    border-r border-gray-800
    transition-all duration-300 ease-in-out
    flex flex-col
    ${isOpen ? 'overflow-hidden' : 'overflow-hidden lg:overflow-visible'}
    ${isOpen ? 'w-64 translate-x-0' : '-translate-x-full w-0 lg:translate-x-0 lg:w-20'}
  `;

  return (
    <>
      <aside className={sidebarClasses}>
        {/* Header */}
        <div className="h-16 lg:h-20 flex items-center justify-between px-4 border-b border-gray-800/50 relative">
          <div className={`flex items-center overflow-hidden transition-all duration-300 ${!isOpen ? 'w-full justify-center' : ''}`}>
            <Logo
              size={32}
              withText={isOpen}
              className="gap-3"
              textClassName="font-bold text-lg whitespace-nowrap text-[#faf9f5]"
              imgClassName="rounded-lg"
            />
          </div>

          {isOpen && (
            <button
              onClick={() => setIsOpen(false)}
              className="hidden lg:flex p-1.5 rounded-md text-gray-500 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {/* Expand Button (Collapsed) */}
        {!isOpen && (
          <div className="hidden lg:flex justify-center py-3 border-b border-gray-800/30">
            <button
              onClick={() => setIsOpen(true)}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Member Selector */}
        <MemberSelector
          members={members}
          activeMemberId={activeMemberId}
          onSelectMember={onSelectMember}
          onAddMember={onAddMember}
          onDeleteMember={onDeleteMember}
          isSidebarOpen={isOpen}
          userPlan={userPlan}
          isAdmin={isAdmin}
        />

        {/* Navigation */}
        <div className={`flex-1 space-y-6 custom-scrollbar ${isOpen ? 'px-3 overflow-y-auto' : 'px-2 overflow-visible'}`}>
          <div className="space-y-1">
            {isOpen && <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 animate-fade-in opacity-70">Menu</p>}

            {isAdminMode ? (
              <>
                <NavItem
                  active={activeTab === 'admin_overview'}
                  onClick={() => handleNavClick('admin_overview')}
                  icon={<LayoutDashboard size={20} />}
                  label="Painel Admin"
                  isOpen={isOpen}
                />
                <NavItem
                  active={activeTab === 'admin_waitlist'}
                  onClick={() => handleNavClick('admin_waitlist')}
                  icon={<UsersIcon size={20} />}
                  label="Lista de Espera"
                  isOpen={isOpen}
                />
                <NavItem
                  active={activeTab === 'admin_email'}
                  onClick={() => handleNavClick('admin_email')}
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  }
                  label="Mensagem Email"
                  isOpen={isOpen}
                />
              </>
            ) : (
              activeMemberId === 'FAMILY_OVERVIEW' ? (
                <NavItem
                  active={true}
                  onClick={() => {}}
                  icon={<LayoutDashboard size={20} />}
                  label="Visão Geral"
                  isOpen={isOpen}
                />
              ) : (
                <>
                  <NavItem
                    active={activeTab === 'dashboard'}
                    onClick={() => handleNavClick('dashboard')}
                    icon={<LayoutDashboard size={20} />}
                    label="Visão Geral"
                    isOpen={isOpen}
                  />
                  <NavItem
                    active={activeTab === 'table'}
                    onClick={() => handleNavClick('table')}
                    icon={
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-refresh-dot">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                        <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" />
                        <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
                        <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
                      </svg>
                    }
                    label="Movimentações"
                    isOpen={isOpen}
                  />
                  <NavItem
                    active={activeTab === 'credit_cards'}
                    onClick={() => handleNavClick('credit_cards')}
                    icon={
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-credit-card-pay">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                        <path d="M12 19h-6a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v4.5" />
                        <path d="M3 10h18" />
                        <path d="M16 19h6" />
                        <path d="M19 16l3 3l-3 3" />
                        <path d="M7.005 15h.005" />
                        <path d="M11 15h2" />
                      </svg>
                    }
                    label="Cartão de Crédito"
                    isOpen={isOpen}
                  />
                  <NavItem
                    active={activeTab === 'reminders'}
                    onClick={() => handleNavClick('reminders')}
                    icon={
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-bell">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                        <path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" />
                        <path d="M9 17v1a3 3 0 0 0 6 0v-1" />
                      </svg>
                    }
                    label="Lembretes"
                    isOpen={isOpen}
                    badge={overdueRemindersCount}
                  />
                  <NavItem
                    active={activeTab === 'subscriptions'}
                    onClick={() => handleNavClick('subscriptions')}
                    icon={<RotateCcw size={20} />}
                    label="Assinaturas"
                    isOpen={isOpen}
                  />
                  <NavItem
                    active={activeTab === 'budgets'}
                    onClick={() => handleNavClick('budgets')}
                    icon={<MathMaxMin size={20} />}
                    label="Metas"
                    isOpen={isOpen}
                  />
                  <NavItem
                    active={activeTab === 'connections'}
                    onClick={() => handleNavClick('connections')}
                    icon={<SidebarWallet size={20} />}
                    label="Open Finance"
                    isOpen={isOpen}
                  />
                  <NavItem
                    active={activeTab === 'investments'}
                    onClick={() => handleNavClick('investments')}
                    icon={<Pig size={20} />}
                    label="Caixinhas"
                    isOpen={isOpen}
                  />
                  <NavItem
                    active={activeTab === 'fire'}
                    onClick={() => handleNavClick('fire')}
                    icon={<Flame size={20} />}
                    label="FIRE"
                    isOpen={isOpen}
                  />
                  <NavItem
                    active={activeTab === 'advisor'}
                    onClick={() => handleNavClick('advisor')}
                    icon={<BrainCircuit size={20} />}
                    label="Consultor IA"
                    isOpen={isOpen}
                  />
                </>
              )
            )}
          </div>

          {/* Seção Inteligência */}
          {!isAdminMode && (
            <div className="space-y-1">
              {isOpen && <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 animate-fade-in opacity-70">Inteligência</p>}

              <NavItem
                active={false}
                onClick={() => {}}
                icon={<MessageCircle size={20} className="text-gray-600" />}
                label="Coinzinha (Em breve)"
                isOpen={isOpen}
                disabled={true}
              />

              <button
                onClick={onOpenAIModal}
                disabled={activeMemberId === 'FAMILY_OVERVIEW'}
                className={`
                  flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200 group shadow-lg relative
                  ${activeMemberId === 'FAMILY_OVERVIEW'
                    ? 'bg-gray-800 text-gray-600 cursor-not-allowed shadow-none w-full justify-start'
                    : isOpen
                      ? 'w-full justify-start bg-[#d97757] text-[#faf9f5] hover:bg-[#c56a4d] shadow-[#d97757]/20'
                      : 'w-full justify-center bg-transparent text-[#d97757] hover:bg-gray-800 shadow-none'
                  }
                `}
              >
                <Bot size={20} className={`${isOpen ? 'text-[#faf9f5]' : 'text-[#d97757]'} ${activeMemberId !== 'FAMILY_OVERVIEW' ? 'group-hover:scale-110 transition-transform' : ''}`} />
                {isOpen && <span className="font-medium text-sm">Novo c/ IA</span>}

                {/* Tooltip */}
                {!isOpen && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 z-50 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl p-3 min-w-[140px] text-left hidden group-hover:block animate-fade-in pointer-events-none">
                    <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-gray-900 border-l border-b border-gray-800 rotate-45"></div>
                    <p className="text-sm font-bold text-white whitespace-nowrap">Novo c/ IA</p>
                  </div>
                )}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        ></div>
      )}
    </>
  );
};
