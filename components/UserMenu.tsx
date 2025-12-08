import React, { useState, useRef, useEffect } from 'react';
import { User as UserType } from '../types';
import { User, LogOut, Settings, ChevronRight } from './Icons';

interface UserMenuProps {
  user: UserType;
  onLogout: () => void;
  onOpenSettings: () => void;
  isAdminMode: boolean;
  onToggleAdminMode: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ user, onLogout, onOpenSettings, isAdminMode, onToggleAdminMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Debug log to see if user.isAdmin is being received
  useEffect(() => {
    console.log('[UserMenu] User data:', {
      name: user.name,
      isAdmin: user.isAdmin,
      hasIsAdminProp: 'isAdmin' in user,
      userKeys: Object.keys(user)
    });
  }, [user, user.isAdmin]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getPlanDisplay = () => {
    if (user.familyRole === 'member') return 'Convidado';

    const plan = user.subscription?.plan || 'starter';
    if (plan === 'starter') return 'Plano Gratuito';

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

  // Determine background color based on avatarUrl if it exists (assuming it's a gradient string for now)
  const avatarBg = user.avatarUrl?.includes('url') ? user.avatarUrl : 'bg-[#363735] border border-[#3A3B39]';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 hover:bg-gray-800 rounded-full pl-2 pr-1 py-1 transition-all border border-transparent hover:border-gray-700"
      >
        <div className="text-right hidden sm:block">
          <p className="text-xs font-bold text-gray-200">{user.name}</p>
          <p className="text-[10px] text-gray-500">{getPlanDisplay()}</p>
        </div>
        <div className={`w-8 h-8 rounded-full ${avatarBg} flex items-center justify-center text-xs font-bold text-white shadow-md`}>
          {!user.avatarUrl?.includes('url') && getInitials(user.name)}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-gray-900 rounded-xl shadow-2xl border border-gray-800 overflow-hidden z-50 animate-dropdown-open">
          <div className="p-4 border-b border-gray-800 bg-gray-900">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${avatarBg} flex items-center justify-center text-white font-bold shadow-inner`}>
                {!user.avatarUrl?.includes('url') && getInitials(user.name)}
              </div>
              <div className="overflow-hidden">
                <h4 className="text-sm font-bold text-white truncate">{user.name}</h4>
                <p className="text-xs text-gray-500 truncate">{getPlanDisplay()}</p>
              </div>
            </div>
          </div>
          
          <div className="p-2">
            <button 
              onClick={() => {
                setIsOpen(false);
                onOpenSettings();
              }}
              className="w-full flex items-center justify-between p-2 text-sm text-gray-300 hover:bg-gray-800 rounded-lg group transition-colors"
            >
              <div className="flex items-center gap-3">
                <Settings size={16} className="text-gray-500 group-hover:text-purple-400" />
                Configurações
              </div>
              <ChevronRight size={14} className="text-gray-600" />
            </button>

            {(() => {
              console.log('[UserMenu Render] Checking isAdmin condition:', {
                isAdmin: user.isAdmin,
                willRender: !!user.isAdmin
              });
              return user.isAdmin && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onToggleAdminMode();
                  }}
                  className={`w-full flex items-center justify-between p-2 text-sm rounded-lg group transition-colors mt-1 ${isAdminMode ? 'bg-red-900/20 text-red-400' : 'text-gray-300 hover:bg-gray-800'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isAdminMode ? 'border-red-500 bg-red-500' : 'border-gray-500'}`}>
                      {isAdminMode && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                    </div>
                    Modo Admin
                  </div>
                </button>
              );
            })()}
          </div>

          <div className="p-2 border-t border-gray-800 bg-gray-950/50">
            <button 
              onClick={onLogout}
              className="w-full flex items-center gap-3 p-2 text-sm text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <LogOut size={16} />
              Sair da conta
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
