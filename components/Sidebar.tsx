import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  MathMaxMin,
  SidebarWallet,
  Pig,
  Wallet,
  MessageSquare
} from './Icons';
import { Flame, Users as UsersIcon, BrainCircuit, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { Member } from '../types';
import { Logo } from './Logo';
import { MemberSelector } from './MemberSelector';
import coinzinhaImg from '../assets/coinzinha.png';

export type TabType =
  | 'dashboard' | 'table' | 'credit_cards' | 'reminders' | 'subscriptions'
  | 'budgets' | 'connections' | 'investments' | 'fire'
  | 'subscription' | 'admin_overview' | 'admin_waitlist' | 'admin_email' | 'admin_coupons' | 'admin_feedbacks';

// --- NAVITEM: Item Individual ---
interface NavItemProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  isOpen: boolean;
  badge?: number;
  disabled?: boolean;
  isChild?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ active, onClick, icon, label, isOpen, badge, disabled, isChild }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleMouseEnter = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setTooltipPos({
        top: rect.top + rect.height / 2,
        left: rect.right + 12
      });
    }
    setIsHovered(true);
  };

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative flex items-center outline-none group transition-all duration-300
        ${isOpen
          ? isChild
            ? 'ml-9 w-[calc(100%-2.25rem)] gap-3 p-2 justify-start rounded-lg'
            : 'w-full gap-3 p-2.5 justify-start rounded-xl'
          : 'w-10 h-10 justify-center rounded-xl mx-auto'
        }
        ${active
          ? 'bg-gray-800 text-white shadow-md shadow-gray-900/10'
          : disabled
            ? 'text-gray-600 cursor-not-allowed opacity-50'
            : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
        }
      `}
    >
      <div className={`relative flex items-center justify-center shrink-0 z-10 ${isChild ? 'scale-75' : ''}`}>
        <span className={`transition-colors duration-300 ${active ? 'text-[#d97757]' : 'text-gray-500 group-hover:text-gray-300'}`}>
          {icon}
        </span>
        {(badge || 0) > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white z-20 border-2 border-[#30302E]">
            {badge && badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.span
            initial={{ opacity: 0, x: -10, filter: "blur(5px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: -5, filter: "blur(5px)" }}
            transition={{ duration: 0.3 }}
            className={`font-medium text-sm whitespace-nowrap overflow-hidden text-left flex-1 ${isChild ? 'text-sm opacity-90 font-normal' : ''}`}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Tooltip via Portal */}
      {createPortal(
        <AnimatePresence>
          {!isOpen && isHovered && (
            <motion.div
              // CORREÇÃO: y: "-50%" movido para cá para alinhamento perfeito
              initial={{ opacity: 0, x: -10, y: "-50%", scale: 0.95, filter: "blur(10px)" }}
              animate={{ opacity: 1, x: 0, y: "-50%", scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: -10, y: "-50%", scale: 0.95, filter: "blur(10px)" }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'fixed',
                top: tooltipPos.top,
                left: tooltipPos.left,
                zIndex: 9999,
                pointerEvents: 'none'
              }}
              className="bg-[#30302E] border border-[#373734] rounded-lg shadow-xl p-2 px-3 min-w-max ring-1 ring-white/5"
            >
              <div
                className="absolute w-2.5 h-2.5 bg-[#30302E] border-l border-b border-[#373734]"
                style={{
                  left: -5,
                  top: '50%',
                  transform: 'translateY(-50%) rotate(45deg)',
                }}
              />
              <p className="text-sm font-semibold text-white relative z-10">{label}</p>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </button>
  );
};

// --- NAVGROUP: Grupo Colapsável ---
interface NavGroupProps {
  label: string;
  icon: React.ReactNode;
  isOpen: boolean;
  isActiveParent: boolean;
  children: React.ReactNode;
  onToggleSidebar: () => void;
}

const NavGroup: React.FC<NavGroupProps> = ({ label, icon, isOpen, isActiveParent, children, onToggleSidebar }) => {
  const [isExpanded, setIsExpanded] = useState(isActiveParent);
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isActiveParent) setIsExpanded(true);
  }, [isActiveParent]);

  const handleMouseEnter = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setTooltipPos({
        top: rect.top + rect.height / 2,
        left: rect.right + 12
      });
    }
    setIsHovered(true);
  };

  const handleClick = () => {
    if (!isOpen) {
      onToggleSidebar();
      setIsExpanded(true);
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className="flex flex-col gap-1 w-full transition-all relative">
      <button
        ref={buttonRef}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          relative flex items-center outline-none group transition-all duration-300 z-20
          ${isOpen
            ? 'w-full gap-3 p-2.5 justify-start rounded-xl hover:bg-gray-800/30'
            : 'w-10 h-10 justify-center rounded-xl mx-auto'
          }
          ${isActiveParent && !isOpen ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'}
        `}
      >
        <div className="relative flex items-center justify-center shrink-0 z-10">
          <span className={`transition-colors duration-300 ${isActiveParent ? 'text-[#d97757]' : 'text-gray-500 group-hover:text-gray-300'}`}>
            {icon}
          </span>
        </div>

        <AnimatePresence>
          {isOpen && (
            <>
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                className={`font-semibold text-sm whitespace-nowrap overflow-hidden text-left flex-1 ${isActiveParent ? 'text-gray-200' : ''}`}
              >
                {label}
              </motion.span>
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown size={14} className="text-gray-500" />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </button>

      {/* Tooltip Fechado - Usando Portal */}
      {createPortal(
        <AnimatePresence>
          {!isOpen && isHovered && (
            <motion.div
              // CORREÇÃO: y: "-50%" movido para cá também
              initial={{ opacity: 0, x: -10, y: "-50%", scale: 0.95, filter: "blur(10px)" }}
              animate={{ opacity: 1, x: 0, y: "-50%", scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: -10, y: "-50%", scale: 0.95, filter: "blur(10px)" }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'fixed',
                top: tooltipPos.top,
                left: tooltipPos.left,
                zIndex: 9999,
                pointerEvents: 'none'
              }}
              className="bg-[#30302E] border border-[#373734] rounded-lg shadow-xl p-2 px-3 min-w-max ring-1 ring-white/5"
            >
              <div
                className="absolute w-2.5 h-2.5 bg-[#30302E] border-l border-b border-[#373734]"
                style={{
                  left: -5,
                  top: '50%',
                  transform: 'translateY(-50%) rotate(45deg)',
                }}
              />
              <p className="text-sm font-semibold text-white">{label}</p>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Container dos Filhos */}
      <AnimatePresence>
        {isOpen && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden flex flex-col gap-1 w-full relative"
          >
            <div className="absolute left-[1.25rem] top-0 bottom-3 w-[1px] bg-gray-800 z-0" />
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- SIDEBAR COMPLETA ---
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
  isOpen, setIsOpen, activeTab, setActiveTab, isAdminMode, activeMemberId, members,
  onSelectMember, onAddMember, onDeleteMember, userPlan, isAdmin, overdueRemindersCount = 0, onOpenAIModal
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
    if (isMobile) setIsOpen(false);
  };

  const sidebarVariants = {
    open: { width: "16rem", x: 0, transition: { type: "spring", stiffness: 300, damping: 30 } },
    closed: { width: isMobile ? "16rem" : "5.5rem", x: isMobile ? "-100%" : 0, transition: { type: "spring", stiffness: 300, damping: 30 } }
  };

  return (
    <>
      <LayoutGroup>
        <motion.aside
          initial={false}
          animate={isOpen ? "open" : "closed"}
          variants={sidebarVariants}
          className="fixed inset-y-0 left-0 z-50 bg-[#30302E] border-r border-gray-800 flex flex-col overflow-visible will-change-transform shadow-2xl shadow-black/20"
        >
          {/* Header */}
          <div className="h-20 flex items-center justify-center px-4 border-b border-gray-800/50 shrink-0 relative">
            <div className={`flex items-center transition-all duration-300 ${!isOpen ? 'justify-center w-12' : 'justify-start w-full'}`}>
              <Logo
                size={32}
                withText={isOpen}
                className="gap-3"
                textClassName="font-bold text-lg whitespace-nowrap text-[#faf9f5]"
                imgClassName="rounded-lg shadow-sm"
              />
            </div>

            <AnimatePresence>
              {isOpen && !isMobile && (
                <motion.button
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => setIsOpen(false)}
                  className="absolute right-3 p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  <ChevronLeft size={18} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {!isOpen && !isMobile && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute top-[28px] -right-3 z-50">
              <button
                onClick={() => setIsOpen(true)}
                className="p-1 rounded-full bg-[#373734] border border-gray-700 text-gray-400 hover:text-white shadow-lg hover:scale-110 transition-all"
              >
                <ChevronRight size={14} />
              </button>
            </motion.div>
          )}

          <div className={`flex-1 space-y-4 custom-scrollbar py-4 overflow-y-auto overflow-x-hidden ${isOpen ? 'px-3' : 'px-2'}`}>
            <div className="space-y-2 flex flex-col items-center w-full">
              {isOpen && <p className="w-full text-xs font-bold text-gray-500 uppercase tracking-widest px-2 mb-2">{isAdminMode ? 'Admin' : 'Menu'}</p>}

              {/* ADMIN MODE MENU */}
              {isAdminMode ? (
                <>
                  <NavItem
                    active={activeTab === 'admin_overview'}
                    onClick={() => handleNavClick('admin_overview')}
                    icon={<LayoutDashboard size={20} />}
                    label="Overview"
                    isOpen={isOpen}
                  />
                  <NavItem
                    active={activeTab === 'admin_waitlist'}
                    onClick={() => handleNavClick('admin_waitlist')}
                    icon={<UsersIcon size={20} />}
                    label="Waitlist"
                    isOpen={isOpen}
                  />
                  <NavItem
                    active={activeTab === 'admin_email'}
                    onClick={() => handleNavClick('admin_email')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>}
                    label="Email"
                    isOpen={isOpen}
                  />
                  <NavItem
                    active={activeTab === 'admin_coupons'}
                    onClick={() => handleNavClick('admin_coupons')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" /></svg>}
                    label="Cupons"
                    isOpen={isOpen}
                  />
                  <NavItem
                    active={activeTab === 'admin_feedbacks'}
                    onClick={() => handleNavClick('admin_feedbacks')}
                    icon={<MessageSquare size={20} />}
                    label="Feedbacks"
                    isOpen={isOpen}
                  />
                </>
              ) : activeMemberId === 'FAMILY_OVERVIEW' ? (
                <NavItem active={true} onClick={() => { }} icon={<LayoutDashboard size={20} />} label="Visão Geral" isOpen={isOpen} />
              ) : (
                <>
                  <NavItem active={activeTab === 'dashboard'} onClick={() => handleNavClick('dashboard')} icon={<LayoutDashboard size={20} />} label="Visão Geral" isOpen={isOpen} />

                  {/* Grupo Transações */}
                  <NavGroup
                    label="Transações"
                    icon={<SidebarWallet size={20} />}
                    isOpen={isOpen}
                    isActiveParent={activeTab === 'table' || activeTab === 'credit_cards'}
                    onToggleSidebar={() => setIsOpen(true)}
                  >
                    <NavItem
                      active={activeTab === 'table'}
                      onClick={() => handleNavClick('table')}
                      icon={<div className="scale-90"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /><path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg></div>}
                      label="Movimentações"
                      isOpen={isOpen}
                      isChild={true}
                    />
                    <NavItem
                      active={activeTab === 'credit_cards'}
                      onClick={() => handleNavClick('credit_cards')}
                      icon={<div className="scale-90"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg></div>}
                      label="Cartões"
                      isOpen={isOpen}
                      isChild={true}
                    />
                  </NavGroup>

                  <NavItem active={activeTab === 'reminders'} onClick={() => handleNavClick('reminders')} icon={<div className="scale-90"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg></div>} label="Lembretes" isOpen={isOpen} badge={overdueRemindersCount} />
                  <NavItem active={activeTab === 'subscriptions'} onClick={() => handleNavClick('subscriptions')} icon={<RotateCcw size={20} />} label="Assinaturas" isOpen={isOpen} />
                  <NavItem active={activeTab === 'budgets'} onClick={() => handleNavClick('budgets')} icon={<MathMaxMin size={20} />} label="Metas" isOpen={isOpen} />
                  <NavItem active={activeTab === 'connections'} onClick={() => handleNavClick('connections')} icon={<Wallet size={20} />} label="Open Finance" isOpen={isOpen} />
                  <NavItem active={activeTab === 'investments'} onClick={() => handleNavClick('investments')} icon={<Pig size={20} />} label="Caixinhas" isOpen={isOpen} />
                  <NavItem active={activeTab === 'fire'} onClick={() => handleNavClick('fire')} icon={<Flame size={20} />} label="FIRE" isOpen={isOpen} />
                </>
              )}
            </div>

            {!isAdminMode && (
              <div className="space-y-2 pt-4 border-t border-gray-800/50 flex flex-col items-center w-full">
                {isOpen && <p className="w-full text-xs font-bold text-gray-500 uppercase tracking-widest px-2 mb-2">Coinzinha</p>}

                <button
                  onClick={onOpenAIModal}
                  className={`
                      relative flex items-center outline-none group transition-all duration-300
                      ${isOpen ? 'w-full gap-3 p-2.5 justify-start rounded-xl' : 'w-10 h-10 justify-center rounded-xl mx-auto'}
                      ${isOpen ? 'border border-[#d97757]/30 bg-[#d97757]/5 hover:bg-[#d97757]/10' : 'hover:bg-gray-800'}
                    `}
                >
                  <div className="relative flex items-center justify-center shrink-0">
                    <img src={coinzinhaImg} alt="Coinzinha" className={`w-5 h-5 object-contain transition-transform duration-300 ${!isOpen ? 'group-hover:scale-110' : ''}`} />
                  </div>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                        className="font-bold text-sm text-[#d97757] ml-0"
                      >
                        Lançar com Coinzinha
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </div>
            )}
          </div>
        </motion.aside>
      </LayoutGroup>

      <AnimatePresence>
        {isOpen && isMobile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
};