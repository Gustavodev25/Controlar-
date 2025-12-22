import React, { useState } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  Menu,
  Lock,
  Filter,
  Calendar,
  ChevronDown,
  Bell,
  RotateCcw,
  TrendingUp,
  Lightbulb,
  X,
  XCircle
} from './Icons';
import { toast } from 'sonner';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownLabel } from './Dropdown';
import { CustomSelect, CustomMonthPicker } from './UIComponents';
import { NotificationCenter } from './NotificationCenter';
import { UserMenu } from './UserMenu';
import { SyncStatusPanel } from './SyncStatusPanel';
import { User, Member, Reminder, Budget, Transaction, AppNotification as SystemNotification } from '../types';
import { TabType } from './Sidebar';

export type FilterMode = 'month' | 'year' | 'last3' | 'last6' | 'all';

interface HeaderProps {
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  activeMemberId: string;
  members: Member[];
  currentUser: User | null;

  // Header Info & Limits
  isLimitReached: boolean;

  // Dashboard Filters State
  filterMode: FilterMode;
  setFilterMode: (mode: FilterMode) => void;
  dashboardDate: string;
  setDashboardDate: (date: string) => void;
  dashboardYear: number;
  setDashboardYear: (year: number) => void;
  dashboardCategory: string; // for checking if filters are active

  // Projection Settings
  projectionSettings: {
    reminders: boolean;
    subscriptions: boolean;
    salary: boolean;
    vale: boolean;
  };
  setProjectionSettings: React.Dispatch<React.SetStateAction<{
    reminders: boolean;
    subscriptions: boolean;
    salary: boolean;
    vale: boolean;
  }>>;
  isProMode: boolean;

  // Mobile specific
  showProjectionMenu: boolean;
  setShowProjectionMenu: (show: boolean) => void;

  // Handlers
  onResetFilters: () => void;

  // Notification Center Props
  reminders: Reminder[];
  budgets: Budget[];
  transactions: Transaction[];
  notifications: SystemNotification[];
  onArchiveNotification: (id: string) => void;
  onDeleteNotification: (id: string) => void;
  onMarkReadNotification: (id: string) => void;

  // User Menu Props
  isAdminMode: boolean;
  setIsAdminMode: (mode: boolean) => void;
  setIsSettingsOpen: (open: boolean) => void;
  onLogout: () => void;

  // Family View Props
  onFamilyView?: () => void;
  onBackToProfile?: () => void;
  isInFamilyView?: boolean;
  showFamilyOption?: boolean;

  // Sync Status Props
  userId?: string | null;
  hasConnectedAccounts?: boolean;
  onSyncComplete?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isSidebarOpen,
  setSidebarOpen,
  activeTab,
  setActiveTab,
  activeMemberId,
  members,
  currentUser,
  isLimitReached,
  filterMode,
  setFilterMode,
  dashboardDate,
  setDashboardDate,
  dashboardYear,
  setDashboardYear,
  dashboardCategory,
  projectionSettings,
  setProjectionSettings,
  isProMode,
  showProjectionMenu,
  setShowProjectionMenu,
  onResetFilters,
  reminders,
  budgets,
  transactions,
  notifications,
  onArchiveNotification,
  onDeleteNotification,
  onMarkReadNotification,
  isAdminMode,
  setIsAdminMode,
  setIsSettingsOpen,
  onLogout,
  onFamilyView,
  onBackToProfile,
  isInFamilyView,
  showFamilyOption,
  userId,
  hasConnectedAccounts,
  onSyncComplete
}) => {
  const getHeaderInfo = () => {
    const memberName = activeMemberId === 'FAMILY_OVERVIEW'
      ? 'Família'
      : members.find(m => m.id === activeMemberId)?.name || 'Membro';

    if (activeMemberId === 'FAMILY_OVERVIEW') {
      return { title: 'Visão Familiar', desc: 'Resumo financeiro de todos os membros.' };
    }

    switch (activeTab) {
      case 'dashboard': return { title: `Dashboard de ${memberName}`, desc: `Fluxo de caixa e estatísticas.` };
      case 'table': return { title: 'Movimentações', desc: 'Histórico completo de movimentações.' };
      case 'reminders': return { title: 'Lembretes', desc: 'Organize seus lembretes.' };
      case 'investments': return { title: 'Caixinhas', desc: 'Gerencie suas caixinhas e metas financeiras.' };
      case 'fire': return { title: 'Simulador FIRE', desc: 'Planeje sua aposentadoria antecipada com a regra dos 4%.' };
      case 'budgets': return { title: 'Metas', desc: 'Planejamento e controle de gastos.' };
      case 'subscriptions': return { title: 'Assinaturas', desc: 'Gestão de serviços recorrentes.' };
      case 'connections': return { title: 'Contas Conectadas', desc: 'Bancos vinculados via Open Finance.' };
      case 'admin_overview': return { title: 'Painel Administrativo', desc: 'Visão geral do sistema.' };
      case 'admin_waitlist': return { title: 'Lista de Espera', desc: 'Gerenciar solicitações de acesso.' };
      case 'admin_email': return { title: 'Mensagem em Geral', desc: 'Criar e enviar mensagens.' };
      case 'admin_coupons': return { title: 'Gerenciar Cupons', desc: 'Criar e editar códigos promocionais.' };
      case 'admin_feedbacks': return { title: 'Feedbacks', desc: 'Gerenciar feedbacks e bugs reportados pelos usuários.' };
      case 'admin_users': return { title: 'Usuários', desc: 'Gerenciar usuários cadastrados no sistema.' };
      case 'credit_cards': return { title: 'Faturas', desc: 'Gerencie suas despesas em cartões de crédito.' };
      default: return { title: 'Controlar+', desc: '' };
    }
  };

  const headerInfo = getHeaderInfo();
  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const isDefaultFilter = filterMode === 'month' && dashboardCategory === '' && dashboardDate === currentMonthStr;

  // Tip Banner State for Reminders
  const [isTipDismissed, setIsTipDismissed] = useState(() => {
    const dismissed = localStorage.getItem('reminders_tip_dismissed');
    const dismissedAt = localStorage.getItem('reminders_tip_dismissed_at');
    if (dismissed === 'true' && dismissedAt) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return true;
      } else {
        localStorage.removeItem('reminders_tip_dismissed');
        localStorage.removeItem('reminders_tip_dismissed_at');
        return false;
      }
    }
    return false;
  });

  const handleDismissTip = () => {
    setIsTipDismissed(true);
    localStorage.setItem('reminders_tip_dismissed', 'true');
    localStorage.setItem('reminders_tip_dismissed_at', Date.now().toString());
  };

  return (
    <>
      <header
        className="h-16 lg:h-20 sticky top-0 z-40 px-3 lg:px-6 flex items-center justify-between gap-2 lg:gap-4 mx-auto transition-all bg-[#30302E] border-b border-gray-800"
      >
        {/* Mobile Menu Button */}
        <button
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          className="lg:hidden p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors shrink-0"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-2 lg:gap-3 min-w-0 flex-1 overflow-hidden">
          <div className="flex flex-col min-w-0 flex-1 overflow-hidden justify-center">
            <div className="flex items-center gap-2">
              <h1 className="text-sm lg:text-2xl font-bold text-[#faf9f5] tracking-tight truncate leading-tight">
                {headerInfo.title}
              </h1>
              {isLimitReached && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 animate-fade-in">
                  <Lock size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">Limite Atingido</span>
                </div>
              )}
            </div>
            <p className="text-[11px] lg:text-xs text-gray-400 font-medium truncate leading-tight mt-0.5">
              {headerInfo.desc}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Dashboard Advanced Filters */}
          {activeTab === 'dashboard' && activeMemberId !== 'FAMILY_OVERVIEW' && (
            <div className="hidden lg:flex items-center gap-2 flex-wrap">
              {/* Filter Mode Selector */}
              <div className="w-28 lg:w-36 hidden sm:block">
                <CustomSelect
                  value={filterMode}
                  onChange={(v) => setFilterMode(v as FilterMode)}
                  options={[
                    { value: 'month', label: 'Mensal' },
                    { value: 'year', label: 'Anual' },
                    { value: 'last3', label: 'Últimos 3' },
                    { value: 'last6', label: 'Últimos 6' },
                    { value: 'all', label: 'Tudo' }
                  ]}
                  icon={<Filter size={16} />}
                  className="text-sm"
                />
              </div>

              {/* Dynamic Date Picker based on mode */}
              {filterMode === 'month' && (
                <div className="w-40 lg:w-64">
                  <CustomMonthPicker
                    value={dashboardDate}
                    onChange={setDashboardDate}
                  />
                </div>
              )}

              {/* Forecast Dropdown */}
              {filterMode === 'month' && (
                <Dropdown>
                  <DropdownTrigger className={`
                      h-11 px-4 flex items-center gap-2 rounded-xl transition-all duration-200 font-medium text-sm whitespace-nowrap border cursor-pointer
                      ${(projectionSettings.reminders || projectionSettings.subscriptions || projectionSettings.salary)
                      ? 'bg-[#d97757]/10 text-[#d97757] border-[#d97757]'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border-gray-700'
                    }
                    `}>
                    <Calendar size={16} className={(projectionSettings.reminders || projectionSettings.subscriptions || projectionSettings.salary) ? "animate-pulse" : ""} />
                    Previsão
                    <ChevronDown size={14} className="transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </DropdownTrigger>

                  <DropdownContent width="w-56" align="right" portal>
                    <DropdownLabel>Incluir na Previsão</DropdownLabel>

                    {/* Toggle Lembretes */}
                    <div
                      onClick={() => setProjectionSettings(prev => ({ ...prev, reminders: !prev.reminders }))}
                      className="flex items-center justify-between px-3 py-2.5 mx-1 rounded-lg hover:bg-white/10 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <Bell size={14} className="text-gray-400 group-hover:text-white" />
                        <span className="text-sm text-gray-300 group-hover:text-white font-medium">Lembretes</span>
                      </div>
                      <div className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors duration-200 ${projectionSettings.reminders ? 'bg-[#d97757]' : 'bg-gray-700'}`}>
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${projectionSettings.reminders ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </div>
                    </div>

                    {/* Toggle Assinaturas */}
                    <div
                      onClick={() => setProjectionSettings(prev => ({ ...prev, subscriptions: !prev.subscriptions }))}
                      className="flex items-center justify-between px-3 py-2.5 mx-1 rounded-lg hover:bg-white/10 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <RotateCcw size={14} className="text-gray-400 group-hover:text-white" />
                        <span className="text-sm text-gray-300 group-hover:text-white font-medium">Assinaturas</span>
                      </div>
                      <div className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors duration-200 ${projectionSettings.subscriptions ? 'bg-[#d97757]' : 'bg-gray-700'}`}>
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${projectionSettings.subscriptions ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </div>
                    </div>

                    {/* Toggle Salário */}
                    <div
                      onClick={() => setProjectionSettings(prev => ({ ...prev, salary: !prev.salary }))}
                      className="flex items-center justify-between px-3 py-2.5 mx-1 rounded-lg hover:bg-white/10 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <TrendingUp size={14} className="text-gray-400 group-hover:text-white" />
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-300 group-hover:text-white font-medium">Salário</span>
                        </div>
                      </div>
                      <div className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors duration-200 ${projectionSettings.salary ? 'bg-[#d97757]' : 'bg-gray-700'}`}>
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${projectionSettings.salary ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </div>
                    </div>

                    {/* Toggle Vale */}
                    <div
                      onClick={() => setProjectionSettings(prev => ({ ...prev, vale: !prev.vale }))}
                      className="flex items-center justify-between px-3 py-2.5 mx-1 rounded-lg hover:bg-white/10 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <TrendingUp size={14} className="text-gray-400 group-hover:text-white" />
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-300 group-hover:text-white font-medium">Vale</span>
                        </div>
                      </div>
                      <div className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors duration-200 ${projectionSettings.vale ? 'bg-[#d97757]' : 'bg-gray-700'}`}>
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${projectionSettings.vale ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </div>
                    </div>
                  </DropdownContent>
                </Dropdown>
              )}

              {filterMode === 'year' && (
                <div className="w-24 lg:w-28">
                  <CustomSelect
                    value={dashboardYear}
                    onChange={(v) => setDashboardYear(Number(v))}
                    options={Array.from({ length: 5 }, (_, i) => {
                      const y = new Date().getFullYear() - i;
                      return { value: y, label: String(y) };
                    })}
                    icon={<Calendar size={16} />}
                    className="text-sm"
                  />
                </div>
              )}

              {/* Clear Filters Button */}
              {!isDefaultFilter && (
                <button
                  onClick={onResetFilters}
                  className="h-11 w-11 flex items-center justify-center rounded-xl bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors border border-gray-700 shrink-0"
                  title="Limpar Filtros"
                >
                  <RotateCcw size={16} />
                </button>
              )}
            </div>
          )}

          {/* Compact Sync Status - only show when user has connected accounts */}
          <div className="h-8 w-px bg-gray-800 mx-1 lg:mx-2 hidden sm:block"></div>

          {/* Admin: Cancel All Syncs Button */}
          {isAdminMode && userId && (
            <button
              onClick={async () => {
                try {
                  const response = await fetch('/api/pluggy/cancel-all-syncs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId })
                  });
                  const data = await response.json();
                  if (data.success) {
                    toast.success('Sincronizações canceladas!');
                  } else {
                    toast.error(data.error || 'Erro ao cancelar');
                  }
                } catch (e) {
                  toast.error('Erro de conexão');
                }
              }}
              className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-all border border-red-500/20 hover:border-red-500/40"
              title="Cancelar todas as sincronizações"
            >
              <XCircle size={18} />
            </button>
          )}

          {/* Notification Center */}
          <NotificationCenter
            reminders={reminders}
            budgets={budgets}
            transactions={transactions}
            externalNotifications={notifications}
            onArchiveNotification={onArchiveNotification}
            onDeleteNotification={onDeleteNotification}
            onMarkReadNotification={onMarkReadNotification}
          />

          <UserMenu
            user={currentUser}
            onLogout={onLogout}
            onOpenSettings={() => setIsSettingsOpen(true)}
            isAdminMode={isAdminMode}
            onToggleAdminMode={() => {
              const nextMode = !isAdminMode;
              setIsAdminMode(nextMode);
              if (nextMode) {
                setActiveTab('admin_overview');
              } else {
                setActiveTab('dashboard');
              }
            }}
            onFamilyView={onFamilyView}
            onBackToProfile={onBackToProfile}
            isInFamilyView={isInFamilyView}
            showFamilyOption={showFamilyOption}
          />
        </div>
      </header>

      {/* Tip Banner for Reminders */}
      <AnimatePresence>
        {(activeTab === 'reminders' || activeTab === 'subscriptions') && !isTipDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border-b border-blue-500/20"
          >
            <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
              {/* Left - Message */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-400 flex-shrink-0">
                  <Lightbulb size={16} />
                </div>
                <p className="text-sm text-gray-300">
                  <span className="font-medium text-white">Dica:</span>
                  <span className="text-gray-400"> Veja o impacto no saldo clicando em "Previsão" no Dashboard.</span>
                </p>
              </div>

              {/* Right - Close */}
              <button
                onClick={handleDismissTip}
                className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 rounded-lg transition-all flex-shrink-0"
                title="Dispensar"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Dashboard Filters */}
      {activeTab === 'dashboard' && activeMemberId !== 'FAMILY_OVERVIEW' && (
        <div className="lg:hidden bg-gray-950/50 backdrop-blur-sm border-b border-gray-800 px-3 py-3 flex items-center gap-3 overflow-x-auto no-scrollbar snap-x">
          {/* Filter Mode */}
          <div className="shrink-0 w-32 snap-start">
            <CustomSelect
              value={filterMode}
              onChange={(v) => setFilterMode(v as FilterMode)}
              options={[
                { value: 'month', label: 'Mensal' },
                { value: 'year', label: 'Anual' },
                { value: 'last3', label: '3 Meses' },
                { value: 'last6', label: '6 Meses' },
                { value: 'all', label: 'Tudo' }
              ]}
              icon={<Filter size={14} />}
              className="text-xs h-10"
              portal
            />
          </div>

          {/* Dynamic Date Picker */}
          {filterMode === 'month' && (
            <div className="shrink-0 w-40 snap-start">
              <CustomMonthPicker
                value={dashboardDate}
                onChange={setDashboardDate}
                portal
              />
            </div>
          )}

          {filterMode === 'year' && (
            <div className="shrink-0 w-24 snap-start">
              <CustomSelect
                value={dashboardYear}
                onChange={(v) => setDashboardYear(Number(v))}
                options={Array.from({ length: 5 }, (_, i) => {
                  const y = new Date().getFullYear() - i;
                  return { value: y, label: String(y) };
                })}
                icon={<Calendar size={14} />}
                className="text-xs h-10"
                portal
              />
            </div>
          )}

          {/* Forecast Toggle */}
          {filterMode === 'month' && (
            <Dropdown>
              <DropdownTrigger className={`
                  h-10 px-3 flex items-center gap-2 rounded-xl transition-all duration-200 font-bold text-xs whitespace-nowrap border cursor-pointer
                  ${(projectionSettings.reminders || projectionSettings.subscriptions || projectionSettings.salary)
                  ? 'bg-[#d97757]/10 text-[#d97757] border-[#d97757]'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border-gray-700'}
                `}>
                <Calendar size={14} className={(projectionSettings.reminders || projectionSettings.subscriptions || projectionSettings.salary) ? "animate-pulse" : ""} />
                Previsão
                <ChevronDown size={12} className="transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </DropdownTrigger>

              <DropdownContent width="w-56" align="right" portal>
                <DropdownLabel>Incluir na Previsão</DropdownLabel>

                {/* Toggle Lembretes */}
                <div
                  onClick={() => setProjectionSettings(prev => ({ ...prev, reminders: !prev.reminders }))}
                  className="flex items-center justify-between px-3 py-2.5 mx-1 rounded-lg hover:bg-white/10 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <Bell size={14} className="text-gray-400 group-hover:text-white" />
                    <span className="text-sm text-gray-300 group-hover:text-white font-medium">Lembretes</span>
                  </div>
                  <div className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors duration-200 ${projectionSettings.reminders ? 'bg-[#d97757]' : 'bg-gray-700'}`}>
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${projectionSettings.reminders ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </div>

                {/* Toggle Assinaturas */}
                <div
                  onClick={() => setProjectionSettings(prev => ({ ...prev, subscriptions: !prev.subscriptions }))}
                  className="flex items-center justify-between px-3 py-2.5 mx-1 rounded-lg hover:bg-white/10 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <RotateCcw size={14} className="text-gray-400 group-hover:text-white" />
                    <span className="text-sm text-gray-300 group-hover:text-white font-medium">Assinaturas</span>
                  </div>
                  <div className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors duration-200 ${projectionSettings.subscriptions ? 'bg-[#d97757]' : 'bg-gray-700'}`}>
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${projectionSettings.subscriptions ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </div>

                {/* Toggle Salário */}
                <div
                  onClick={() => setProjectionSettings(prev => ({ ...prev, salary: !prev.salary }))}
                  className="flex items-center justify-between px-3 py-2.5 mx-1 rounded-lg hover:bg-white/10 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-gray-400 group-hover:text-white" />
                    <span className="text-sm text-gray-300 group-hover:text-white font-medium">Salário</span>
                  </div>
                  <div className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors duration-200 ${projectionSettings.salary ? 'bg-[#d97757]' : 'bg-gray-700'}`}>
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${projectionSettings.salary ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </div>

                {/* Toggle Vale */}
                <div
                  onClick={() => setProjectionSettings(prev => ({ ...prev, vale: !prev.vale }))}
                  className="flex items-center justify-between px-3 py-2.5 mx-1 rounded-lg hover:bg-white/10 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-gray-400 group-hover:text-white" />
                    <span className="text-sm text-gray-300 group-hover:text-white font-medium">Vale</span>
                  </div>
                  <div className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors duration-200 ${projectionSettings.vale ? 'bg-[#d97757]' : 'bg-gray-700'}`}>
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${projectionSettings.vale ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </div>
              </DropdownContent>
            </Dropdown>
          )}

          {/* Clear Filters */}
          {!isDefaultFilter && (
            <button
              onClick={onResetFilters}
              className="h-10 w-10 flex items-center justify-center rounded-xl bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors border border-gray-700 shrink-0 snap-start"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      )}
    </>
  );
};
