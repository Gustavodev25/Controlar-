import React, { useState, useRef, useEffect } from 'react';
import { User as UserType } from '../types';
import { User, LogOut, Settings, ChevronRight } from './Icons';

interface UserMenuProps {
  user: UserType;
  onLogout: () => void;
  onOpenSettings: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ user, onLogout, onOpenSettings }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Determine background color based on avatarUrl if it exists (assuming it's a gradient string for now)
  const avatarBg = user.avatarUrl || 'bg-gradient-to-br from-purple-600 to-blue-600';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 hover:bg-gray-800 rounded-full pl-2 pr-1 py-1 transition-all border border-transparent hover:border-gray-700"
      >
        <div className="text-right hidden sm:block">
          <p className="text-xs font-bold text-gray-200">{user.name}</p>
          <p className="text-[10px] text-gray-500">Plano gratuito</p>
        </div>
        <div className={`w-8 h-8 rounded-full ${avatarBg} flex items-center justify-center text-xs font-bold text-white shadow-md border border-gray-700`}>
          {getInitials(user.name)}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-gray-900 rounded-xl shadow-2xl border border-gray-800 overflow-hidden z-50 animate-fade-in">
          <div className="p-4 border-b border-gray-800 bg-gray-900">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${avatarBg} flex items-center justify-center text-white font-bold border border-gray-700 shadow-inner`}>
                {getInitials(user.name)}
              </div>
              <div className="overflow-hidden">
                <h4 className="text-sm font-bold text-white truncate">{user.name}</h4>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
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
