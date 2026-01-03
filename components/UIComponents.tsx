import React, { useState, useEffect, useRef, useMemo, type JSX } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ChevronDown, Calendar, ChevronLeft, ChevronRight, AlertTriangle, Check, Search, Plus, X } from './Icons';

// --- UTILS ---
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

// --- TEXT SHIMMER ---
interface TextShimmerProps {
  children: string;
  as?: React.ElementType;
  className?: string;
  duration?: number;
  spread?: number;
}

export function TextShimmer({
  children,
  as: Component = 'p',
  className,
  duration = 2,
  spread = 2,
}: TextShimmerProps) {
  const MotionComponent = motion(Component as keyof JSX.IntrinsicElements);

  const dynamicSpread = useMemo(() => {
    return children.length * spread;
  }, [children, spread]);

  return (
    <MotionComponent
      className={cn(
        'relative inline-block bg-[length:250%_100%,auto] bg-clip-text',
        'text-transparent [--base-color:#a1a1aa] [--base-gradient-color:#000]',
        '[--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--base-gradient-color),#0000_calc(50%+var(--spread)))] [background-repeat:no-repeat,padding-box]',
        'dark:[--base-color:#71717a] dark:[--base-gradient-color:#ffffff] dark:[--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--base-gradient-color),#0000_calc(50%+var(--spread)))]',
        className
      )}
      initial={{ backgroundPosition: '100% center' }}
      animate={{ backgroundPosition: '0% center' }}
      transition={{
        repeat: Infinity,
        duration,
        ease: 'linear',
      }}
      style={
        {
          '--spread': `${dynamicSpread}px`,
          backgroundImage: `var(--bg), linear-gradient(var(--base-color), var(--base-color))`,
        } as React.CSSProperties
      }
    >
      {children}
    </MotionComponent>
  );
}

// --- ESTILOS DAS ANIMAÇÕES ---
// Você pode mover isso para o seu arquivo CSS global se preferir
const styles = `
  /* Animação de abertura vertical (Dropdowns) */
  @keyframes expandVertical {
    0% {
      opacity: 0;
      transform: scaleY(0.8) translateY(-10px);
    }
    100% {
      opacity: 1;
      transform: scaleY(1) translateY(0);
    }
  }
  
  .animate-dropdown-open {
    transform-origin: top center;
    animation: expandVertical 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  /* Animação surgindo de baixo (Modal/Card) */
  @keyframes expandUp {
    0% {
      opacity: 0;
      transform: scaleY(0.8) translateY(20px);
    }
    100% {
      opacity: 1;
      transform: scaleY(1) translateY(0);
    }
  }

  .animate-modal-up {
    transform-origin: bottom center;
    animation: expandUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  /* Animação de expansão de altura (Accordion/Relative DatePicker) */
  @keyframes expandHeight {
    from {
      max-height: 0;
      opacity: 0;
      margin-top: 0;
      padding-top: 0;
      padding-bottom: 0;
    }
    to {
      max-height: 350px;
      opacity: 1;
      margin-top: 0.5rem; /* mt-2 equivalent */
      padding-top: 1rem; /* p-4 equivalent */
      padding-bottom: 1rem;
    }
  }

  .animate-expand-height {
    animation: expandHeight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    overflow: hidden;
  }

  /* Custom Scrollbar */
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 4px;
  }
`;

// Helper para injetar estilos (opcional se você colocar no CSS global)
const InjectStyles = () => <style>{styles}</style>;

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
        if (inputValue !== value && value !== '') {
          setInputValue(value);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [inputValue, value]);

  const filteredOptions = (options || []).filter(opt =>
    (opt || "").toLowerCase().includes((inputValue || "").toLowerCase())
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

  const exactMatch = (options || []).some(opt => (opt || "").toLowerCase() === (inputValue || "").toLowerCase());

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <InjectStyles />
      <div
        className={`
          w-full bg-[rgba(58,59,57,0.5)] border rounded-xl px-4 h-11 flex items-center gap-3 transition-all group focus-within:border-[#d97757] focus-within:bg-[rgba(58,59,57,0.8)] focus-within:ring-2 focus-within:ring-[#d97757]/20
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
        <div className="absolute z-50 w-full mt-2 bg-[#30302E] border border-[#373734] rounded-xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar animate-dropdown-open">
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

// --- CUSTOM SELECT ---
interface Option {
  value: string | number;
  label: React.ReactNode | string;
}

interface CustomSelectProps {
  value: string | number;
  onChange: (value: string) => void;
  options: Option[] | string[];
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
  portal?: boolean;
}

import { AnimatePresence } from 'framer-motion';

export const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options, placeholder, className = "", icon, portal = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const normalizedOptions: Option[] = options.map(opt =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const selectedOption = normalizedOptions.find(o => String(o.value) === String(value));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // Check if clicking inside the portal dropdown
        const target = event.target as HTMLElement;
        if (target.closest('[data-select-portal]')) return;
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && portal && containerRef.current) {
      const updatePosition = () => {
        const rect = containerRef.current!.getBoundingClientRect();
        setCoords({
          top: rect.bottom + 8,
          left: rect.left,
          width: rect.width
        });
      };
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [isOpen, portal]);

  const dropdownContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          data-select-portal
          initial={{ y: -5, scale: 0.95, filter: "blur(10px)", opacity: 0 }}
          animate={{ y: 0, scale: 1, filter: "blur(0)", opacity: 1 }}
          exit={{ y: -5, scale: 0.95, opacity: 0, filter: "blur(10px)" }}
          transition={{ duration: 0.4, ease: "circInOut", type: "spring", stiffness: 200, damping: 20 }}
          style={portal ? { position: 'fixed', top: coords.top, left: coords.left, width: coords.width, zIndex: 9999 } : undefined}
          className={portal
            ? "bg-[#30302E] border border-[#373734] rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.2)] ring-1 ring-white/5 max-h-60 overflow-y-auto custom-scrollbar"
            : "absolute z-50 w-full mt-2 bg-[#30302E] border border-[#373734] rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.2)] ring-1 ring-white/5 max-h-60 overflow-y-auto custom-scrollbar"
          }
        >
          <div className="p-1">
            {normalizedOptions.map((opt, index) => (
              <motion.div
                key={String(opt.value)}
                initial={{ opacity: 0, x: 10, scale: 0.95, filter: "blur(10px)" }}
                animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0)" }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.03,
                  ease: "easeInOut",
                  type: "spring",
                  stiffness: 200,
                  damping: 20
                }}
                onClick={() => {
                  onChange(String(opt.value));
                  setIsOpen(false);
                }}
                className={`
                  px-3 py-2.5 text-sm cursor-pointer rounded-lg transition-colors flex items-center justify-between
                  ${String(value) === String(opt.value)
                    ? 'bg-[#d97757]/20 text-[#d97757]'
                    : 'text-gray-300 hover:bg-white/10'}
                `}
              >
                <div className="font-medium">{opt.label}</div>
                {String(value) === String(opt.value) && <Check size={14} />}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full bg-[rgba(58,59,57,0.5)] border rounded-xl px-4 h-11 flex items-center justify-between cursor-pointer transition-all
          ${isOpen ? 'border-[#d97757] bg-[rgba(58,59,57,0.8)]' : 'border-[#4a4b49] hover:border-gray-500'}
        `}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {icon && <span className="text-gray-500">{icon}</span>}
          <div className={`truncate ${!selectedOption ? 'text-gray-500' : 'text-[#faf9f5]'} flex-1`}>
            {selectedOption ? selectedOption.label : placeholder || 'Selecione'}
          </div>
        </div>
        <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {portal ? createPortal(dropdownContent, document.body) : dropdownContent}
    </div>
  );
};

// --- CUSTOM MONTH PICKER ---
interface CustomMonthPickerProps {
  value: string; // Format: YYYY-MM
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  portal?: boolean;
}

export const CustomMonthPicker: React.FC<CustomMonthPickerProps> = ({ value, onChange, placeholder = "Mês de referência", className = "", portal = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  // State to track the year currently being viewed in the popup
  const [viewYear, setViewYear] = useState<number>(() => {
    return value ? parseInt(value.split('-')[0]) : new Date().getFullYear();
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        if (target.closest('[data-monthpicker-portal]')) return;
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && portal && containerRef.current) {
      const updatePosition = () => {
        const rect = containerRef.current!.getBoundingClientRect();
        const dropdownWidth = 256;
        const viewportWidth = window.innerWidth;
        let left = rect.left;
        if (left + dropdownWidth > viewportWidth - 8) {
          left = viewportWidth - dropdownWidth - 8;
        }
        if (left < 8) left = 8;
        setCoords({
          top: rect.bottom + 8,
          left
        });
      };
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [isOpen, portal]);

  const handleMonthSelect = (monthIndex: number) => {
    const monthStr = String(monthIndex + 1).padStart(2, '0');
    onChange(`${viewYear}-${monthStr}`);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  const handleCurrentMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    setViewYear(y);
    onChange(`${y}-${m}`);
    setIsOpen(false);
  };

  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const fullMonths = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  // Helper to format display text (e.g. "novembro de 2025")
  const getDisplayText = () => {
    if (!value) return placeholder;
    const [y, m] = value.split('-');
    const monthIndex = parseInt(m) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${fullMonths[monthIndex]} de ${y}`;
    }
    return value;
  };

  const selectedYear = value ? parseInt(value.split('-')[0]) : null;
  const selectedMonthIndex = value ? parseInt(value.split('-')[1]) - 1 : null;
  const currentMonthIndex = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const dropdownContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          data-monthpicker-portal
          initial={{ y: -5, scale: 0.95, filter: "blur(10px)", opacity: 0 }}
          animate={{ y: 0, scale: 1, filter: "blur(0)", opacity: 1 }}
          exit={{ y: -5, scale: 0.95, opacity: 0, filter: "blur(10px)" }}
          transition={{ duration: 0.4, ease: "circInOut", type: "spring", stiffness: 200, damping: 20 }}
          style={portal ? { position: 'fixed', top: coords.top, left: coords.left, zIndex: 9999, width: 256 } : undefined}
          className={portal
            ? "bg-[#30302E] border border-[#373734] rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.2)] ring-1 ring-white/5 p-4"
            : "absolute z-50 mt-2 p-4 bg-[#30302E] border border-[#373734] rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.2)] ring-1 ring-white/5 w-64"
          }
        >
          {/* Year Navigation Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="flex items-center justify-between mb-2 px-1"
          >
            <span className="text-lg font-bold text-white tracking-wide">{viewYear}</span>
            <div className="flex gap-1">
              <button
                onClick={(e) => { e.preventDefault(); setViewYear(prev => prev - 1); }}
                className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={(e) => { e.preventDefault(); setViewYear(prev => prev + 1); }}
                className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </motion.div>

          {/* Separator Line */}
          <div className="h-px w-full bg-gray-700/50 mb-4"></div>

          {/* Month Grid */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {months.map((m, i) => {
              const isSelected = selectedYear === viewYear && selectedMonthIndex === i;
              const isCurrent = currentYear === viewYear && currentMonthIndex === i;

              return (
                <motion.button
                  key={m}
                  initial={{ opacity: 0, scale: 0.8, filter: "blur(5px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0)" }}
                  transition={{
                    delay: 0.05 + i * 0.02,
                    type: "spring",
                    stiffness: 200,
                    damping: 20
                  }}
                  onClick={(e) => { e.preventDefault(); handleMonthSelect(i); }}
                  className={`
                      h-9 rounded-lg text-sm font-medium transition-all border
                      ${isSelected
                      ? 'bg-[#d97757]/20 text-[#d97757] border-[#d97757] shadow-lg shadow-[#d97757]/20'
                      : isCurrent
                        ? 'bg-gray-800 text-[#d97757] border-[#d97757]/50'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white border-transparent'}
                    `}
                >
                  {m}
                </motion.button>
              );
            })}
          </div>

          {/* Footer Actions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex justify-between items-center text-xs font-medium pt-2 border-t border-gray-700/50"
          >
            <button
              onClick={handleClear}
              className="text-gray-500 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-800"
            >
              Limpar
            </button>
            <button
              onClick={handleCurrentMonth}
              className="text-[#d97757] hover:text-[#e68e70] transition-colors px-2 py-1 rounded hover:bg-[#d97757]/10"
            >
              Este mês
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full bg-[rgba(58,59,57,0.5)] border rounded-xl px-4 h-11 flex items-center gap-3 cursor-pointer transition-all group
          ${isOpen ? 'border-[#d97757] bg-[rgba(58,59,57,0.8)]' : 'border-[#4a4b49] hover:border-gray-500'}
        `}
      >
        <Calendar size={16} className={value ? 'text-[#d97757]' : 'text-gray-500'} />
        <span className={`truncate ${!value ? 'text-gray-500' : 'text-[#faf9f5]'} flex-1`}>
          {getDisplayText()}
        </span>
        {value ? (
          <div
            onClick={handleClear}
            className="p-1 rounded-full hover:bg-gray-700 text-gray-500 hover:text-white transition-colors"
          >
            <X size={12} />
          </div>
        ) : (
          <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </div>

      {portal ? createPortal(dropdownContent, document.body) : dropdownContent}
    </div>
  );
};

// --- CUSTOM DATE PICKER (Full Date) ---
interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  placeholder?: string;
  className?: string;
  dropdownMode?: 'absolute' | 'relative' | 'fixed';
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({ value, onChange, placeholder = "Data", className = "", dropdownMode = 'absolute' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const dateValue = value ? new Date(value + 'T12:00:00') : null;
  const [viewDate, setViewDate] = useState(dateValue || new Date());

  const formatDateDisplay = (isoDate: string) => {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
  };

  const [inputValue, setInputValue] = useState('');

  // Sync input value when external value changes
  useEffect(() => {
    setInputValue(value ? formatDateDisplay(value) : '');
    if (value) {
      setViewDate(new Date(value + 'T12:00:00'));
    }
  }, [value]);

  // Effect 1: Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // If clicking inside the input container, do nothing (handled by onClick)
      if (containerRef.current && containerRef.current.contains(event.target as Node)) {
        return;
      }
      // If clicking inside the dropdown content (handled by stopPropagation on the content),
      // the event shouldn't even reach here if we use stopPropagation there.
      // But just in case, we rely on the stopPropagation in the render.
      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Effect 2: Handle fixed positioning
  useEffect(() => {
    if (isOpen && dropdownMode === 'fixed' && containerRef.current) {
      const updatePosition = () => {
        const rect = containerRef.current!.getBoundingClientRect();
        const dropdownWidth = 256;
        const dropdownHeight = 320;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const padding = 8;

        let left = rect.left;
        if (left + dropdownWidth > viewportWidth - padding) {
          left = viewportWidth - dropdownWidth - padding;
        }
        if (left < padding) {
          left = padding;
        }

        let top = rect.bottom + 8;
        if (top + dropdownHeight > viewportHeight - padding) {
          top = rect.top - dropdownHeight - 8;
          if (top < padding) {
            top = Math.max(padding, (viewportHeight - dropdownHeight) / 2);
          }
        }

        setCoords({ top, left });
      };
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [isOpen, dropdownMode]);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const handleNextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

  const handlePrevYear = () => setViewDate(new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), 1));
  const handleNextYear = () => setViewDate(new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1));

  const handleDayClick = (day: number) => {
    const year = viewDate.getFullYear();
    const month = String(viewDate.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const isoDate = `${year}-${month}-${dayStr}`;

    onChange(isoDate);
    setInputValue(`${dayStr}/${month}/${year}`);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;

    // Auto-masking for DD/MM/YYYY
    // Only allow digits and slashes (though we will strip non-digits to re-format)
    const numeric = val.replace(/\D/g, '');

    if (numeric.length > 8) return; // Max 8 digits

    if (numeric.length <= 2) {
      val = numeric;
    } else if (numeric.length <= 4) {
      val = `${numeric.slice(0, 2)}/${numeric.slice(2)}`;
    } else {
      val = `${numeric.slice(0, 2)}/${numeric.slice(2, 4)}/${numeric.slice(4, 8)}`;
    }

    setInputValue(val);

    if (val.length === 10) {
      const [dStr, mStr, yStr] = val.split('/');
      const d = parseInt(dStr, 10);
      const m = parseInt(mStr, 10);
      const y = parseInt(yStr, 10);

      if (d > 0 && d <= 31 && m > 0 && m <= 12 && y > 1900 && y < 2100) {
        const isoDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        // Verify validity (e.g. prevents 31/02)
        const checkDate = new Date(isoDate + 'T12:00:00');
        if (checkDate.getDate() === d && checkDate.getMonth() + 1 === m) {
          onChange(isoDate);
          setViewDate(checkDate);
        }
      }
    } else if (val === '') {
      onChange('');
    }
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
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDayClick(d); }}
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

  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const dropdownContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          data-datepicker-portal
          initial={{ y: -5, scale: 0.95, filter: "blur(10px)", opacity: 0 }}
          animate={{ y: 0, scale: 1, filter: "blur(0)", opacity: 1 }}
          exit={{ y: -5, scale: 0.95, opacity: 0, filter: "blur(10px)" }}
          transition={{ duration: 0.4, ease: "circInOut", type: "spring", stiffness: 200, damping: 20 }}
          style={dropdownMode === 'fixed'
            ? (isMobile
              ? { position: 'fixed', top: coords.top, left: 8, right: 8, zIndex: 9999 }
              : { position: 'fixed', top: coords.top, left: Math.max(8, Math.min(coords.left, window.innerWidth - 270)), zIndex: 9999 }
            )
            : undefined
          }
          onMouseDown={(e) => e.stopPropagation()}
          className={
            dropdownMode === 'fixed'
              ? "bg-[#30302E] border border-[#373734] rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.2)] ring-1 ring-white/5 p-4 max-w-[280px] mx-auto"
              : (dropdownMode === 'absolute'
                ? "absolute z-50 mt-2 p-4 bg-[#30302E] border border-[#373734] rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.2)] ring-1 ring-white/5 w-64 right-0"
                : "bg-[#30302E]/50 border border-[#373734] rounded-2xl w-full mt-2 p-4")
          }
        >
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="flex flex-col gap-2 mb-4"
          >
            {/* Year Navigation */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePrevYear(); }}
                className="p-1 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-sm font-bold text-gray-200">{viewDate.getFullYear()}</span>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleNextYear(); }}
                className="p-1 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePrevMonth(); }}
                className="p-1 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-bold text-white uppercase tracking-wider">{months[viewDate.getMonth()]}</span>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleNextMonth(); }}
                className="p-1 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </motion.div>
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
              <span key={i} className="text-[10px] text-gray-500 font-bold">{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 place-items-center">
            {renderCalendar()}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div
        className={`
          w-full bg-[rgba(58,59,57,0.5)] border rounded-xl px-4 h-11 flex items-center gap-3 cursor-text transition-all
          ${isOpen ? 'border-[#d97757] bg-[rgba(58,59,57,0.8)]' : 'border-[#4a4b49] hover:border-gray-500'}
        `}
        onClick={() => {
          // If input isn't focused, focus it? 
          // Clicking container anywhere should focus input or open calendar.
          // Since input is full width/height (almost), clicking it handles focus.
          // This handler handles clicking the icon or padding.
          setIsOpen(true);
        }}
      >
        <Calendar size={16} className={value ? 'text-[#d97757]' : 'text-gray-500'} />
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          maxLength={10}
          className="bg-transparent border-none outline-none w-full text-[#faf9f5] placeholder-gray-500 text-sm font-medium"
        />
        {/* Clear Button if needed? Or just let user delete text */}
        {value && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
              setInputValue('');
            }}
            className="text-gray-500 hover:text-white p-1 rounded-full hover:bg-gray-700/50"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {dropdownMode === 'fixed' ? createPortal(dropdownContent, document.body) : dropdownContent}
    </div>
  );
};

// --- CURRENCY INPUT ---
interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number | undefined;
  onValueChange: (value: number) => void;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({ value, onValueChange, className = "", ...props }) => {
  // Local state for the display string (what the user sees/types)
  const [displayValue, setDisplayValue] = useState('');

  // Update local state when the external value prop changes
  useEffect(() => {
    if (value !== undefined && !isNaN(value)) {
      const formatted = value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const currentNum = parseCurrency(displayValue);
      if (Math.abs(currentNum - value) > 0.001) { // float comparison
        setDisplayValue(formatted);
      }
    } else if (value === 0) {
      setDisplayValue('0,00');
    }
  }, [value]);

  const parseCurrency = (val: string): number => {
    // Remove thousands separators (dots) and replace decimal separator (comma) with dot
    const clean = val.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;

    // Allow only numbers, dots and commas
    val = val.replace(/[^0-9.,]/g, '');

    // Prevent multiple commas
    const parts = val.split(',');
    if (parts.length > 2) {
      val = parts[0] + ',' + parts.slice(1).join('');
    }

    setDisplayValue(val);

    const num = parseCurrency(val);
    onValueChange(num);
  };

  const handleBlur = () => {
    // On blur, format nicely
    const num = parseCurrency(displayValue);
    const formatted = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    setDisplayValue(formatted);
    onValueChange(num);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
      {...props}
    />
  );
};
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
      ${isOpen ? '' : 'pointer-events-none'}
    `}>
      <InjectStyles />
      <div className={`
          bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl p-6 relative overflow-hidden
          ${isOpen ? 'animate-modal-up' : 'opacity-0 translate-y-4 transition-all duration-300 ease-in'}
       `}>
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

export const Tooltip = ({ children, content, className = "" }: { children: React.ReactNode; content: string; className?: string }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const updatePosition = () => {
        const rect = triggerRef.current!.getBoundingClientRect();
        setCoords({
          top: rect.top - 40,
          left: rect.left + rect.width / 2
        });
      };
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isVisible]);

  const tooltip = (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 5, opacity: 0, scale: 0.95, filter: "blur(10px)", x: "-50%" }}
          animate={{ y: -5, opacity: 1, scale: 1, filter: "blur(0px)", x: "-50%" }}
          exit={{ y: 5, opacity: 0, scale: 0.95, filter: "blur(10px)", x: "-50%" }}
          transition={{ duration: 0.4, ease: "circInOut", type: "spring", stiffness: 200, damping: 20 }}
          style={{ top: coords.top, left: coords.left, position: 'fixed' }}
          className="px-3 py-1.5 bg-[#30302E] border border-[#373734] text-xs font-medium text-white rounded-lg shadow-xl whitespace-nowrap z-[9999] pointer-events-none ring-1 ring-white/5 origin-bottom"
        >
          {content}
          {/* Arrow pointing down */}
          <div
            className="absolute left-1/2 -translate-x-1/2 -bottom-[6px] w-0 h-0"
            style={{
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #30302E',
            }}
          />
          {/* Arrow border */}
          <div
            className="absolute left-1/2 -translate-x-1/2 -bottom-[7px] w-0 h-0 -z-10"
            style={{
              borderLeft: '7px solid transparent',
              borderRight: '7px solid transparent',
              borderTop: '7px solid #373734',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <div
        ref={triggerRef}
        className={`relative flex items-center justify-center ${className}`}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>
      {createPortal(tooltip, document.body)}
    </>
  );
};

// --- TOOLTIP ICON (Para botões de ícone com tooltip acima) ---
interface TooltipIconProps {
  children: React.ReactNode;
  content: string;
  className?: string;
  offset?: number; // Distância do tooltip em relação ao ícone
}

export const TooltipIcon: React.FC<TooltipIconProps> = ({
  children,
  content,
  className = "",
  offset = 40
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const updatePosition = () => {
        const rect = triggerRef.current!.getBoundingClientRect();
        setCoords({
          top: rect.top - offset,
          left: rect.left + rect.width / 2
        });
      };
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isVisible, offset]);

  const tooltip = (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 5, opacity: 0, scale: 0.95, filter: "blur(10px)", x: "-50%" }}
          animate={{ y: 0, opacity: 1, scale: 1, filter: "blur(0px)", x: "-50%" }}
          exit={{ y: 5, opacity: 0, scale: 0.95, filter: "blur(10px)", x: "-50%" }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          style={{ top: coords.top, left: coords.left, position: 'fixed' }}
          className="px-3 py-1.5 bg-[#30302E] border border-[#373734] text-xs font-medium text-white rounded-lg shadow-xl whitespace-nowrap z-[9999] pointer-events-none ring-1 ring-white/5"
        >
          {content}
          {/* Arrow pointing down */}
          <div
            className="absolute left-1/2 -translate-x-1/2 -bottom-[6px] w-0 h-0"
            style={{
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #30302E',
            }}
          />
          {/* Arrow border */}
          <div
            className="absolute left-1/2 -translate-x-1/2 -bottom-[7px] w-0 h-0 -z-10"
            style={{
              borderLeft: '7px solid transparent',
              borderRight: '7px solid transparent',
              borderTop: '7px solid #373734',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <div
        ref={triggerRef}
        className={`inline-flex items-center justify-center ${className}`}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>
      {createPortal(tooltip, document.body)}
    </>
  );
};