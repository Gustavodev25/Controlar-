import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  MathMaxMin,
  SidebarWallet,
  Pig
} from './Icons';
import { Flame, Users as UsersIcon, BrainCircuit, Sparkles, Ticket } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Member } from '../types';
import { Logo } from './Logo';
import { MemberSelector } from './MemberSelector';
import coinzinhaImg from '../assets/coinzinha.png';

// Tipos de tab
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
  | 'admin_email'
  | 'admin_coupons';

// --- SUB-COMPONENTE NAVITEM (CORRIGIDO) ---
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
        flex items-center transition-colors duration-200 group relative rounded-lg outline-none
        /* Aqui garantimos que o botão ocupe a largura certa para o cálculo do tooltip */
        ${isOpen
          ? 'w-full gap-3 p-2.5 justify-start overflow-hidden'
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
      {/* REMOVIDO: Indicador Ativo (Barra lateral laranja) */}
      {/* {!isOpen && active && (
        <motion.div 
          layoutId="activeIndicator"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#d97757] rounded-r-md"
        />
      )}
      */}

      {/* Ícone e Badge */}
      <div className="relative flex items-center justify-center">
        <span className={`transition-colors relative z-10 flex-shrink-0 ${active ? 'text-[#d97757]' : 'text-gray-500 group-hover:text-gray-300'}`}>
          {icon}
        </span>

        {(badge || 0) > 0 && (
          <span className={`absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white z-20 border-2 border-[#30302E]`}>
            {badge && badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>

      {/* Animação do Texto (Aparece só quando aberto) */}
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.span
            initial={{ opacity: 0, x: -10, filter: "blur(5px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: -10, filter: "blur(5px)" }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="font-medium text-sm truncate whitespace-nowrap ml-0"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>

      {/* TOOLTIP CARD (POSICIONAMENTO CORRIGIDO)
          Agora ele fica FORA do wrapper do ícone, direto no botão.
          Como o botão é "w-full" (ocupa a sidebar toda), "left-full" joga o tooltip 
          para fora da sidebar, evitando cortes.
      */}
      <AnimatePresence>
        {!isOpen && isHovered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: -5, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.9, x: -5, filter: "blur(4px)" }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            style={{
              position: 'absolute',
              left: '100%', // Começa exatamente no fim do botão (borda da sidebar)
              top: '50%',
              y: '-50%' // Centraliza verticalmente
            }}
            className="ml-3 z-[999] bg-[#30302E] border border-[#373734] rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.4)] p-3 min-w-max text-left pointer-events-none ring-1 ring-white/5"
          >
            {/* Seta do Tooltip */}
            <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[#30302E] border-l border-b border-[#373734] rotate-45"></div>

            <p className="text-sm font-bold text-white whitespace-nowrap relative z-10 px-1">{label}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
};

// --- COMPONENTE SIDEBAR (FINAL) ---
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
  isProMode?: boolean;
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
  onOpenAIModal,
  isProMode = true
}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleNavClick = (tab: TabType) => {
    setActiveTab(tab);
    if (isMobile) {
      setIsOpen(false);
    }
  };

  const sidebarVariants = {
    open: {
      width: "16rem",
      x: 0,
      transition: { type: "spring", stiffness: 200, damping: 20, mass: 0.8 }
    },
    closed: {
      width: isMobile ? "16rem" : "5rem", // 5rem = 80px (largura padrão colapsada)
      x: isMobile ? "-100%" : 0,
      transition: { type: "spring", stiffness: 200, damping: 20, mass: 0.8 }
    }
  };

  return (
    <>
      <motion.aside
        initial={false}
        animate={isOpen ? "open" : "closed"}
        variants={sidebarVariants}
        className={`
          fixed inset-y-0 left-0 z-50
          bg-[#30302E]
          border-r border-gray-800
          flex flex-col
          /* Overflow always visible to allow dropdowns to appear */
          overflow-visible
          transition-[overflow] delay-200
        `}
      >
        {/* Header */}
        <div className="h-16 lg:h-20 flex items-center justify-between px-4 border-b border-gray-800/50 relative flex-shrink-0">
          <div className={`flex items-center overflow-hidden transition-all duration-300 ${!isOpen ? 'w-full justify-center' : ''}`}>
            <Logo
              size={32}
              withText={isOpen}
              className="gap-3"
              textClassName="font-bold text-lg whitespace-nowrap text-[#faf9f5]"
              imgClassName="rounded-lg"
            />
          </div>

          <AnimatePresence>
            {isOpen && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setIsOpen(false)}
                className="hidden lg:flex p-1.5 rounded-md text-gray-500 hover:bg-gray-800 hover:text-white transition-colors"
              >
                <ChevronLeft size={16} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Botão de Expandir (Aparece quando fechado no Desktop) */}
        {!isOpen && !isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="hidden lg:flex justify-center py-3 border-b border-gray-800/30 flex-shrink-0"
          >
            <button
              onClick={() => setIsOpen(true)}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </motion.div>
        )}

        {/* MEMBER SELECTOR:
            Renderiza sempre, mas com visual diferente baseado em isOpen.
            Quando fechado, mostra só o ícone clicável com dropdown à direita.
        */}
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="flex-shrink-0 overflow-visible"
          >
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
          </motion.div>
        ) : (
          <div className="flex-shrink-0">
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
          </div>
        )}

        {/* Navigation */}
        <div className={`flex-1 space-y-6 custom-scrollbar ${isOpen ? 'px-3 overflow-y-auto' : 'px-2 overflow-visible'}`}>
          <div className="space-y-1">
            {isOpen && (
              <motion.p
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 0.7, x: 0 }}
                transition={{ delay: 0.1 }}
                className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 pt-2"
              >
                Menu
              </motion.p>
            )}

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
                  active={activeTab === 'admin_coupons'}
                  onClick={() => handleNavClick('admin_coupons')}
                  icon={<Ticket size={20} />}
                  label="Cupons"
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
                  onClick={() => { }}
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
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
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
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
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
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

          {!isAdminMode && (
            <div className="space-y-1">
              {isOpen && (
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 0.7, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2"
                >
                  Inteligência
                </motion.p>
              )}

              <NavItem
                active={false}
                onClick={() => { }}
                icon={<Sparkles size={20} className="text-gray-600" />}
                label="Novidades IA (Em breve)"
                isOpen={isOpen}
                disabled={true}
              />

              <button
                onClick={onOpenAIModal}
                disabled={activeMemberId === 'FAMILY_OVERVIEW'}
                className={`
                  flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200 group relative
                  ${isOpen ? 'overflow-hidden w-full justify-start' : 'w-full justify-center'}
                  ${activeMemberId === 'FAMILY_OVERVIEW'
                    ? 'bg-gray-800 text-gray-600 cursor-not-allowed shadow-none'
                    : isOpen
                      ? 'border border-[#d97757] text-[#d97757] bg-[#d97757]/5 hover:bg-[#d97757]/10'
                      : 'bg-transparent text-[#d97757] hover:bg-gray-800 shadow-none'
                  }
                `}
              >
                {/* Ícone e Tooltip Coinzinha */}
                <div className="relative flex items-center justify-center">
                  <img
                    src={coinzinhaImg}
                    alt="Coinzinha"
                    className={`w-5 h-5 object-contain flex-shrink-0 ${activeMemberId !== 'FAMILY_OVERVIEW' ? 'group-hover:scale-110 transition-transform' : ''}`}
                  />

                  {/* Tooltip Coinzinha (Mesma lógica) */}
                  <AnimatePresence>
                    {!isOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, x: -5, filter: "blur(4px)" }}
                        whileHover={{ opacity: 1, scale: 1, x: 0, filter: "blur(0px)" }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        style={{
                          position: 'absolute',
                          left: '200%', // Coinzinha pode precisar de ajuste se o botão for menor, mas 100% + margem no pai funciona melhor
                          top: '50%',
                          y: '-50%'
                        }}
                        // Ajuste manual: Coinzinha botão tem estrutura diferente. Usando 'fixed' ou portal seria melhor, mas aqui:
                        // Vamos jogar bem pra direita com classe tailwind
                        className="ml-8 z-[999] bg-[#30302E] border border-[#373734] rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.4)] p-3 min-w-max text-left hidden group-hover:block pointer-events-none ring-1 ring-white/5 absolute left-full top-1/2 -translate-y-1/2"
                      >
                        <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[#30302E] border-l border-b border-[#373734] rotate-45"></div>
                        <p className="text-sm font-bold text-white whitespace-nowrap relative z-10 px-1">Coinzinha</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <AnimatePresence>
                  {isOpen && (
                    <motion.span
                      initial={{ opacity: 0, x: -10, filter: "blur(5px)" }}
                      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, x: -10, filter: "blur(5px)" }}
                      transition={{ duration: 0.3 }}
                      className="font-bold text-sm tracking-wide whitespace-nowrap ml-3"
                    >
                      Coinzinha
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
          )}
        </div>
      </motion.aside>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
};