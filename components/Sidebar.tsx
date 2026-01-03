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
  MessageSquare,
  Map
} from './Icons';
import { Flame, Users as UsersIcon, BrainCircuit, ChevronDown, TrendingUp, BarChart3, ShoppingBag, CreditCard } from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { Member } from '../types';
import { Logo } from './Logo';
import { MemberSelector } from './MemberSelector';
import coinzinhaImg from '../assets/coinzinha.png';

export type TabType =
  | 'dashboard' | 'table' | 'credit_cards' | 'reminders' | 'subscriptions'
  | 'budgets' | 'connections' | 'investments' | 'fire' | 'roadmap'
  | 'subscription' | 'admin_overview' | 'admin_waitlist' | 'admin_email' | 'admin_coupons' | 'admin_pixels' | 'admin_feedbacks' | 'admin_support' | 'admin_users' | 'admin_subscriptions' | 'admin_control' | 'admin_changelog' | 'chat';

// --- NAVITEM: Item Individual ---
// --- NAVITEM: Item Individual ---
interface NavItemProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  isOpen: boolean;
  badge?: number | string;
  disabled?: boolean;
  isChild?: boolean;
  id?: string;
}

const NavItem: React.FC<NavItemProps> = ({ active, onClick, icon, label, isOpen, badge, disabled, isChild, id }) => {
  // ... (rest of state and handlers)
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleMouseEnter = () => {
    if (!isOpen && buttonRef.current) {
      // ... tooltip logic
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
      id={id}
      ref={buttonRef}
      // ... rest of props
      onClick={!disabled ? onClick : undefined}
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
      {/* ... content */}
      <div className={`relative flex items-center justify-center shrink-0 z-10 ${isChild ? 'scale-75' : ''}`}>
        <span className={`transition-colors duration-300 ${active ? 'text-[#d97757]' : 'text-gray-500 group-hover:text-gray-300'}`}>
          {icon}
        </span>
        {badge !== undefined && (typeof badge === 'number' ? badge > 0 : true) && (
          <span className={`
            absolute flex items-center justify-center font-bold text-white z-20 shadow-sm
            ${typeof badge === 'number'
              ? '-top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-500 text-[10px] border-2 border-[#18181b]'
              : '-top-2.5 -right-4 px-1.5 py-[1px] rounded-full bg-[#d97757] text-[8px] uppercase tracking-wider'
            }
          `}>
            {typeof badge === 'number' ? (badge > 9 ? '9+' : badge) : badge}
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
            // ... tooltip content
            <motion.div
              // ...
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
  badge?: number;
}

const NavGroup: React.FC<NavGroupProps> = ({ label, icon, isOpen, isActiveParent, children, onToggleSidebar, badge }) => {
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
          {(badge || 0) > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white z-20 border-2 border-[#30302E]">
              {badge && badge > 9 ? '9+' : badge}
            </span>
          )}
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
  onOpenFeedback: () => void;
  onOpenSupport: () => void;
  isProMode?: boolean;
  hasUnreadSupport?: boolean; // New prop
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen, setIsOpen, activeTab, setActiveTab, isAdminMode, activeMemberId, members,
  onSelectMember, onAddMember, onDeleteMember, userPlan, isAdmin, overdueRemindersCount = 0, onOpenAIModal, onOpenFeedback, onOpenSupport, isProMode = false, hasUnreadSupport
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
                    active={activeTab === 'admin_control'}
                    onClick={() => handleNavClick('admin_control')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M7 10h3v-3l-3.5 -3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1 -3 3l-6 -6a6 6 0 0 1 -8 -8l3.5 3.5" /></svg>}
                    label="Controle"
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
                    label="Mensagens"
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
                    active={activeTab === 'admin_pixels'}
                    onClick={() => handleNavClick('admin_pixels')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>}
                    label="Pixels"
                    isOpen={isOpen}
                  />
                  <NavItem
                    active={activeTab === 'admin_feedbacks'}
                    onClick={() => handleNavClick('admin_feedbacks')}
                    icon={<MessageSquare size={20} />}
                    label="Feedbacks"
                    isOpen={isOpen}
                  />
                  <NavItem
                    active={activeTab === 'admin_support'}
                    onClick={() => handleNavClick('admin_support')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2z" /><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" /></svg>}
                    label="Suporte"
                    isOpen={isOpen}
                  />
                  <NavItem
                    active={activeTab === 'admin_changelog'}
                    onClick={() => handleNavClick('admin_changelog')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>}
                    label="Changelog"
                    isOpen={isOpen}
                  />
                </>) : (
                <>
                  <NavItem id="sidebar-nav-overview" active={activeTab === 'dashboard'} onClick={() => handleNavClick('dashboard')} icon={<LayoutDashboard size={20} />} label="Visão Geral" isOpen={isOpen} />

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

                  {/* Grupo Recorrências (Lembretes + Assinaturas) */}
                  <NavGroup
                    label="Recorrências"
                    icon={<div className="scale-90"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /><path d="M17 14h-6" /><path d="M13 18H7" /><path d="M7 14h.01" /><path d="M17 18h.01" /></svg></div>}
                    isOpen={isOpen}
                    isActiveParent={activeTab === 'reminders' || activeTab === 'subscriptions'}
                    onToggleSidebar={() => setIsOpen(true)}
                    badge={overdueRemindersCount}
                  >
                    <NavItem
                      active={activeTab === 'reminders'}
                      onClick={() => handleNavClick('reminders')}
                      icon={<div className="scale-90"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg></div>}
                      label="Lembretes"
                      isOpen={isOpen}
                      isChild={true}
                      badge={overdueRemindersCount}
                    />
                    <NavItem
                      active={activeTab === 'subscriptions'}
                      onClick={() => handleNavClick('subscriptions')}
                      icon={<div className="scale-90"><RotateCcw size={18} /></div>}
                      label="Assinaturas"
                      isOpen={isOpen}
                      isChild={true}
                    />
                  </NavGroup>
                  <NavItem id="sidebar-nav-metas" active={activeTab === 'budgets'} onClick={() => handleNavClick('budgets')} icon={<MathMaxMin size={20} />} label="Metas" isOpen={isOpen} />
                  <NavItem id="sidebar-nav-connections" active={activeTab === 'connections'} onClick={() => handleNavClick('connections')} icon={<Wallet size={20} />} label="Open Finance" isOpen={isOpen} />

                  <NavItem active={activeTab === 'fire'} onClick={() => handleNavClick('fire')} icon={<Flame size={20} />} label="FIRE" isOpen={isOpen} />
                  <NavItem active={activeTab === 'investments'} onClick={() => handleNavClick('investments')} icon={<Pig size={20} />} label="Caixinhas" isOpen={isOpen} />

                  <NavItem active={activeTab === 'roadmap'} onClick={() => handleNavClick('roadmap')} icon={<Map size={20} />} label="Roadmap Público" isOpen={isOpen} badge="NOVO" />

                  {/* Em Breve Section */}
                  {isOpen && <p className="w-full text-xs font-bold text-gray-600 uppercase tracking-widest px-2 mt-4 mb-2">Em Breve</p>}
                  <NavItem active={false} onClick={() => { }} icon={<TrendingUp size={20} />} label="Investimentos" isOpen={isOpen} disabled />
                  <NavItem active={false} onClick={() => { }} icon={<BarChart3 size={20} />} label="Indicadores" isOpen={isOpen} disabled />
                  <NavItem active={false} onClick={() => { }} icon={<ShoppingBag size={20} />} label="Produtos" isOpen={isOpen} disabled />
                </>
              )}
            </div>
          </div>

          {/* Support & Feedback Buttons */}
          {!isAdminMode && (
            <div className={`${isOpen ? 'px-3 pb-2 space-y-1' : 'px-2 pb-2 space-y-1'}`}>

              {/* Support Button - New */}
              <button
                onClick={onOpenSupport}
                className={`
                    relative flex items-center outline-none group transition-all duration-300 w-full
                    ${isOpen ? 'gap-3 p-2.5 justify-start rounded-xl' : 'w-10 h-10 justify-center rounded-xl mx-auto'}
                    ${hasUnreadSupport
                    ? 'bg-[#d97757]/10 text-[#d97757] hover:bg-[#d97757]/20 border border-[#d97757]/30'
                    : 'text-gray-500 hover:bg-gray-800/50 hover:text-gray-300'
                  }
                  `}
              >
                <div className="relative flex items-center justify-center shrink-0">
                  {hasUnreadSupport && (
                    <>
                      {/* Pulsing ring effect */}
                      <div className="absolute inset-0 w-6 h-6 -m-1 bg-[#d97757]/20 rounded-full animate-ping" />
                      {/* Dot indicator */}
                      <div className="absolute -right-1 -top-1 w-2.5 h-2.5 bg-[#d97757] rounded-full animate-pulse shadow-lg shadow-[#d97757]/50" />
                    </>
                  )}
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 group-hover:scale-110 ${hasUnreadSupport ? 'text-[#d97757]' : ''}`}><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2z" /><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" /></svg>
                </div>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2 flex-1"
                    >
                      <span className={`font-medium text-sm ${hasUnreadSupport ? 'text-[#d97757]' : 'text-gray-400 group-hover:text-gray-300'}`}>
                        Suporte
                      </span>
                      {hasUnreadSupport && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="px-2 py-0.5 bg-[#d97757] text-white text-[10px] font-bold rounded-full uppercase tracking-wider shadow-lg shadow-[#d97757]/30"
                        >
                          Nova resposta!
                        </motion.span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>

              <button
                onClick={onOpenFeedback}
                className={`
                    relative flex items-center outline-none group transition-all duration-300 w-full
                    ${isOpen ? 'gap-3 p-2.5 justify-start rounded-xl' : 'w-10 h-10 justify-center rounded-xl mx-auto'}
                    text-gray-500 hover:bg-gray-800/50 hover:text-gray-300
                  `}
              >
                <div className="relative flex items-center justify-center shrink-0">
                  <MessageSquare size={18} className="transition-transform duration-300 group-hover:scale-110" />
                </div>

                <AnimatePresence>
                  {isOpen && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                      className="font-medium text-sm text-gray-400 group-hover:text-gray-300"
                    >
                      Enviar Feedback
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
          )}

          {/* Footer - Beta Badge (hidden in admin mode) */}
          {!isAdminMode && (
            <div className={`mt-auto border-t border-gray-800/50 ${isOpen ? 'p-3' : 'p-2'} bg-[#30302E]`}>
              <div className={`flex items-center ${isOpen ? 'gap-2 px-1' : 'justify-center'}`}>
                <Logo
                  size={18}
                  withText={false}
                  imgClassName="opacity-60"
                />
                <AnimatePresence>
                  {isOpen && (
                    <motion.p
                      initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                      className="text-[9px] text-gray-500"
                    >
                      Versão beta <span className="text-[#D97757]">v0.1.0</span> · Versões iniciais
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
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