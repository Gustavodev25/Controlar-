import React, { useEffect } from 'react';
import { User as UserType } from '../types';
import { LogOut, Settings, Users, LayoutDashboard } from './Icons';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator } from './Dropdown';

interface UserMenuProps {
  user: UserType;
  onLogout: () => void;
  onOpenSettings: () => void;
  isAdminMode: boolean;
  onToggleAdminMode: () => void;
  onFamilyView?: () => void;
  onBackToProfile?: () => void;
  isInFamilyView?: boolean;
  showFamilyOption?: boolean;
}

export const UserMenu: React.FC<UserMenuProps> = ({ user, onLogout, onOpenSettings, isAdminMode, onToggleAdminMode, onFamilyView, onBackToProfile, isInFamilyView, showFamilyOption }) => {

  // Debug log to see if user.isAdmin is being received
  useEffect(() => {
    console.log('[UserMenu] User data:', {
      name: user.name,
      isAdmin: user.isAdmin,
      hasIsAdminProp: 'isAdmin' in user,
      userKeys: Object.keys(user)
    });
  }, [user, user.isAdmin]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Generate a consistent pastel color based on user name
  const getAvatarColors = (name: string) => {
    // Beautiful pastel color palette
    const colorPalettes = [
      { bg: 'bg-gradient-to-br from-amber-300 to-orange-400', text: 'text-amber-900' },      // Warm amber
      { bg: 'bg-gradient-to-br from-sky-300 to-blue-400', text: 'text-blue-900' },           // Sky blue
      { bg: 'bg-gradient-to-br from-emerald-300 to-teal-400', text: 'text-teal-900' },       // Emerald
      { bg: 'bg-gradient-to-br from-violet-300 to-purple-400', text: 'text-purple-900' },    // Violet
      { bg: 'bg-gradient-to-br from-rose-300 to-pink-400', text: 'text-rose-900' },          // Rose
      { bg: 'bg-gradient-to-br from-lime-300 to-green-400', text: 'text-green-900' },        // Lime
      { bg: 'bg-gradient-to-br from-cyan-300 to-teal-400', text: 'text-teal-900' },          // Cyan
      { bg: 'bg-gradient-to-br from-fuchsia-300 to-pink-400', text: 'text-pink-900' },       // Fuchsia
      { bg: 'bg-gradient-to-br from-yellow-200 to-amber-300', text: 'text-amber-900' },      // Soft yellow
      { bg: 'bg-gradient-to-br from-indigo-300 to-blue-400', text: 'text-indigo-900' },      // Indigo
      { bg: 'bg-gradient-to-br from-teal-200 to-cyan-300', text: 'text-teal-900' },          // Soft teal
      { bg: 'bg-gradient-to-br from-orange-200 to-red-300', text: 'text-red-900' },          // Coral
    ];

    // Create a simple hash from the name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % colorPalettes.length;
    return colorPalettes[index];
  };

  const getPlanDisplay = () => {
    if (user.familyRole === 'member') return 'Convidado Familiar';

    const plan = user.subscription?.plan || 'starter';
    if (plan === 'starter') return 'Starter';

    const planName = plan === 'pro' ? 'Pro' : 'Family';

    if (user.subscription?.nextBillingDate) {
      const today = new Date();
      const next = new Date(user.subscription.nextBillingDate);
      const diffTime = next.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return `${planName} • ${Math.max(0, diffDays)} dias`;
    }

    return `${planName}`;
  };

  // Get avatar colors based on user name
  const avatarColors = getAvatarColors(user.name);
  const hasCustomAvatar = user.avatarUrl?.includes('url');

  return (
    <Dropdown>
      <DropdownTrigger className="flex items-center hover:bg-gray-800 rounded-full p-1 transition-all border border-transparent hover:border-gray-700">
        <div className={`w-8 h-8 rounded-full ${hasCustomAvatar ? '' : avatarColors.bg} flex items-center justify-center text-xs font-bold ${hasCustomAvatar ? 'text-white' : avatarColors.text} shadow-md`}>
          {!hasCustomAvatar && getInitials(user.name)}
        </div>
      </DropdownTrigger>

      <DropdownContent align="right" width="w-64" portal>
        <div className="p-2 border-b border-[#373734]">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${hasCustomAvatar ? '' : avatarColors.bg} flex items-center justify-center font-bold ${hasCustomAvatar ? 'text-white' : avatarColors.text} shadow-inner`}>
              {!hasCustomAvatar && getInitials(user.name)}
            </div>
            <div className="overflow-hidden">
              <h4 className="text-sm font-bold text-gray-200 truncate">{user.name}</h4>
              <p className="text-xs text-gray-500 truncate">{getPlanDisplay()}</p>
            </div>
          </div>
        </div>

        <div className="p-1">
          {/* Show "Visão Controlar" when in Family View to go back */}
          {isInFamilyView && onBackToProfile && (
            <DropdownItem onClick={onBackToProfile} icon={LayoutDashboard}>
              Visão Controlar
            </DropdownItem>
          )}

          {/* Show "Visão Família" when NOT in Family View */}
          {!isInFamilyView && showFamilyOption && onFamilyView && (
            <DropdownItem onClick={onFamilyView} icon={Users}>
              Visão Família
            </DropdownItem>
          )}

          <DropdownItem onClick={onOpenSettings} icon={Settings} shortcut="→">
            Configurações
          </DropdownItem>

          {user.isAdmin && (
            <DropdownItem
              onClick={onToggleAdminMode}
              className={isAdminMode ? 'bg-red-900/20 text-red-400' : ''}
            >
              <div className="flex items-center gap-3 w-full">
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isAdminMode ? 'border-red-500 bg-red-500' : 'border-gray-500'}`}>
                  {isAdminMode && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                </div>
                <span>Modo Admin</span>
              </div>
            </DropdownItem>
          )}
        </div>

        <DropdownSeparator />

        <div className="p-1">
          <DropdownItem onClick={onLogout} icon={LogOut} danger>
            Sair da conta
          </DropdownItem>
        </div>

      </DropdownContent>
    </Dropdown>
  );
};
