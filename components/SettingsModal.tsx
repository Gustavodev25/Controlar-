import React, { useState, useEffect } from 'react';
import { X, User, Mail, Check, Save, Sparkles } from './Icons';
import { User as UserType } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType;
  onUpdateUser: (user: UserType) => void;
}

const AVATAR_GRADIENTS = [
  'bg-gradient-to-br from-[#d97757] to-orange-600',
  'bg-gradient-to-br from-purple-600 to-blue-600',
  'bg-gradient-to-br from-emerald-500 to-teal-600',
  'bg-gradient-to-br from-gray-600 to-gray-800',
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, user, onUpdateUser }) => {
  const [formData, setFormData] = useState(user);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setFormData(user);
  }, [user, isOpen]);

  useEffect(() => {
      if(isOpen) setIsVisible(true);
      else setTimeout(() => setIsVisible(false), 300);
  }, [isOpen]);

  if (!isVisible) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser(formData);
    onClose();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-800 flex flex-col transition-all duration-300 transform ${isOpen ? 'translate-y-0 scale-100' : 'translate-y-10 scale-95'}`}>
        
        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-950">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            Configurações da Conta
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          
          {/* Avatar Selection */}
          <div className="flex flex-col items-center gap-4">
            <div className={`w-24 h-24 rounded-full ${formData.avatarUrl || AVATAR_GRADIENTS[0]} flex items-center justify-center text-3xl font-bold text-white shadow-2xl ring-4 ring-gray-800`}>
              {getInitials(formData.name)}
            </div>
            <div className="space-y-2 w-full text-center">
               <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Escolha seu Estilo</label>
               <div className="flex justify-center gap-2">
                 {AVATAR_GRADIENTS.map((grad) => (
                   <button
                     key={grad}
                     type="button"
                     onClick={() => setFormData({...formData, avatarUrl: grad})}
                     className={`w-8 h-8 rounded-full ${grad} hover:scale-110 transition-transform ring-2 ${formData.avatarUrl === grad ? 'ring-white' : 'ring-transparent'}`}
                   />
                 ))}
               </div>
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Nome de Exibição</label>
              <div className="relative group">
                <User className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-[#d97757] transition-colors" size={16} />
                <input 
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="input-primary pl-10 focus:border-[#d97757]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">E-mail</label>
              <div className="relative group">
                <Mail className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-[#d97757] transition-colors" size={16} />
                <input 
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="input-primary pl-10 focus:border-[#d97757]"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2">
            <button 
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-[#d97757] to-[#c56a4d] hover:from-[#c56a4d] hover:to-[#d97757] text-white rounded-xl font-medium transition-all shadow-lg shadow-[#d97757]/20 flex items-center justify-center gap-2"
            >
              <Save size={18} />
              Salvar Alterações
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};