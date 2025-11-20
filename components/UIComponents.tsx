import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Calendar, ChevronLeft, ChevronRight, AlertTriangle, Check, Search, Plus } from './Icons';

// --- CUSTOM AUTOCOMPLETE (Combobox) ---
interface AutocompleteOption {
  value: string;
  label: string;
}

interface CustomAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
}

export const CustomAutocomplete: React.FC<CustomAutocompleteProps> = ({ value, onChange, options, placeholder, className = "", icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // On blur, if input doesn't match the controlled value exactly, we technically allow it (creation mode),
        // but usually we sync input to value. Here we assume onChange handles the "commit".
        if (inputValue !== value && value !== '') {
            setInputValue(value);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [inputValue, value]);

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(inputValue.toLowerCase())
  );

  const handleSelect = (val: string) => {
    onChange(val);
    setInputValue(val);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setIsOpen(true);
  };

  // Check if the current input exactly matches an option
  const exactMatch = options.some(opt => opt.toLowerCase() === inputValue.toLowerCase());

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div 
        className={`
          w-full bg-[rgba(58,59,57,0.5)] border rounded-xl px-4 py-3 flex items-center gap-3 transition-all group focus-within:border-[#d97757] focus-within:bg-[rgba(58,59,57,0.8)]
          ${isOpen ? 'border-[#d97757] bg-[rgba(58,59,57,0.8)]' : 'border-[#4a4b49] hover:border-gray-500'}
        `}
      >
        {icon && <span className="text-gray-500 group-focus-within:text-[#d97757] transition-colors">{icon}</span>}
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder || 'Selecione ou digite...'}
          className="bg-transparent border-none outline-none w-full text-[#faf9f5] placeholder-gray-500 text-sm"
        />
        <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (inputValue || filteredOptions.length > 0) && (
        <div className="absolute z-50 w-full mt-2 bg-[#2f302e] border border-[#4a4b49] rounded-xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar animate-fade-in">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <div
                key={opt}
                onClick={() => handleSelect(opt)}
                className={`
                  px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center justify-between
                  ${inputValue === opt ? 'bg-[#d97757]/20 text-[#d97757]' : 'text-gray-300 hover:bg-gray-800'}
                `}
              >
                {opt}
                {inputValue === opt && <Check size={14} />}
              </div>
            ))
          ) : null}
          
          {!exactMatch && inputValue.trim() !== '' && (
            <div
              onClick={() => handleSelect(inputValue)}
              className="px-4 py-2.5 text-sm cursor-pointer transition-colors text-[#d97757] hover:bg-[#d97757]/10 flex items-center gap-2 border-t border-gray-800"
            >
              <Plus size={14} />
              Criar "{inputValue}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- CUSTOM SELECT (Legacy Wrapper or kept for strict selection) ---
interface Option {
  value: string | number;
  label: string;
}

interface CustomSelectProps {
  value: string | number;
  onChange: (value: string) => void;
  options: Option[] | string[];
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options, placeholder, className = "", icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const normalizedOptions: Option[] = options.map(opt => 
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const selectedOption = normalizedOptions.find(o => String(o.value) === String(value));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full bg-[rgba(58,59,57,0.5)] border rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer transition-all
          ${isOpen ? 'border-[#d97757] bg-[rgba(58,59,57,0.8)]' : 'border-[#4a4b49] hover:border-gray-500'}
        `}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {icon && <span className="text-gray-500">{icon}</span>}
          <span className={`truncate ${!selectedOption ? 'text-gray-500' : 'text-[#faf9f5]'}`}>
            {selectedOption ? selectedOption.label : placeholder || 'Selecione'}
          </span>
        </div>
        <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-[#2f302e] border border-[#4a4b49] rounded-xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar animate-fade-in">
          {normalizedOptions.map((opt) => (
            <div
              key={String(opt.value)}
              onClick={() => {
                onChange(String(opt.value));
                setIsOpen(false);
              }}
              className={`
                px-4 py-2.5 text-sm cursor-pointer transition-colors
                ${String(value) === String(opt.value) ? 'bg-[#d97757]/20 text-[#d97757]' : 'text-gray-300 hover:bg-gray-800'}
              `}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- CUSTOM DATE PICKER ---
interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  placeholder?: string;
  className?: string;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({ value, onChange, placeholder = "Data", className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const dateValue = value ? new Date(value + 'T12:00:00') : null; 
  const [viewDate, setViewDate] = useState(dateValue || new Date());

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const handleNextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

  const handleDayClick = (day: number) => {
    const year = viewDate.getFullYear();
    const month = String(viewDate.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    onChange(`${year}-${month}-${dayStr}`);
    setIsOpen(false);
  };

  const renderCalendar = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const startDay = getFirstDayOfMonth(year, month);
    const days = [];

    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-8"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const isSelected = dateValue && 
        dateValue.getDate() === d && 
        dateValue.getMonth() === month && 
        dateValue.getFullYear() === year;

      const isToday = new Date().getDate() === d && 
        new Date().getMonth() === month && 
        new Date().getFullYear() === year;

      days.push(
        <button
          key={d}
          onClick={(e) => { e.preventDefault(); handleDayClick(d); }}
          className={`
            h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium transition-all
            ${isSelected 
              ? 'bg-[#d97757] text-white shadow-lg shadow-[#d97757]/30' 
              : isToday 
                ? 'bg-gray-800 text-[#d97757] border border-[#d97757]/50'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'}
          `}
        >
          {d}
        </button>
      );
    }
    return days;
  };

  const formatDateDisplay = (isoDate: string) => {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
  };

  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  return (
    <div className={`relative ${className}`} ref={containerRef}>
       <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full bg-[rgba(58,59,57,0.5)] border rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer transition-all
          ${isOpen ? 'border-[#d97757] bg-[rgba(58,59,57,0.8)]' : 'border-[#4a4b49] hover:border-gray-500'}
        `}
      >
        <Calendar size={16} className={value ? 'text-[#d97757]' : 'text-gray-500'} />
        <span className={`truncate ${!value ? 'text-gray-500' : 'text-[#faf9f5]'}`}>
          {value ? formatDateDisplay(value) : placeholder}
        </span>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-2 p-4 bg-[#2f302e] border border-[#4a4b49] rounded-2xl shadow-2xl w-64 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <button onClick={(e) => {e.preventDefault(); handlePrevMonth();}} className="p-1 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-bold text-white">{months[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
            <button onClick={(e) => {e.preventDefault(); handleNextMonth();}} className="p-1 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
             {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
               <span key={i} className="text-[10px] text-gray-500 font-bold">{d}</span>
             ))}
          </div>
          <div className="grid grid-cols-7 gap-1 place-items-center">
             {renderCalendar()}
          </div>
        </div>
      )}
    </div>
  );
};

// --- CONFIRMATION CARD (Bottom Centered) ---
interface ConfirmationCardProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export const ConfirmationCard: React.FC<ConfirmationCardProps> = ({ 
  isOpen, onClose, onConfirm, title, description, 
  confirmText = "Confirmar", cancelText = "Cancelar", isDestructive = false 
}) => {
  
  const [isVisible, setIsVisible] = useState(isOpen);

  useEffect(() => {
    if (isOpen) setIsVisible(true);
    else setTimeout(() => setIsVisible(false), 300); // Wait for animation
  }, [isOpen]);

  if (!isVisible) return null;

  return (
    <div className={`
      fixed bottom-8 left-1/2 -translate-x-1/2 z-[200]
      w-[90%] max-w-sm
      transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
      ${isOpen ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-10 opacity-0 scale-95'}
    `}>
       <div className="bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl p-6 relative overflow-hidden">
          {/* Decorative background blur based on type */}
          <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 opacity-20 pointer-events-none ${isDestructive ? 'bg-red-500' : 'bg-[#d97757]'}`}></div>

          <div className="relative z-10">
             <div className="flex flex-col items-center text-center mb-6">
                 <div className={`
                    w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg
                    ${isDestructive 
                        ? 'bg-red-500/10 text-red-500 ring-1 ring-red-500/20' 
                        : 'bg-[#d97757]/10 text-[#d97757] ring-1 ring-[#d97757]/20'}
                 `}>
                   <AlertTriangle size={28} strokeWidth={2} />
                 </div>
                 
                 <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                 <p className="text-sm text-gray-400 leading-relaxed max-w-[260px]">{description}</p>
             </div>

             <div className="grid grid-cols-2 gap-3">
                 <button 
                   onClick={onClose}
                   className="px-4 py-3 rounded-xl text-sm font-semibold text-gray-300 bg-gray-800 hover:bg-gray-700 hover:text-white border border-gray-700 transition-all"
                 >
                   {cancelText}
                 </button>
                 <button 
                   onClick={() => { onConfirm(); onClose(); }}
                   className={`
                     px-4 py-3 rounded-xl text-sm font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2
                     ${isDestructive 
                       ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20' 
                       : 'bg-[#d97757] hover:bg-[#c56a4d] shadow-[#d97757]/20'}
                   `}
                 >
                   {confirmText}
                   {isDestructive ? null : <Check size={18} />}
                 </button>
             </div>
          </div>
       </div>
    </div>
  );
};
