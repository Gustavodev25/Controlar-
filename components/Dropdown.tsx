import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface DropdownContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  close: () => void;
  triggerRef: React.RefObject<HTMLDivElement>;
}

const DropdownContext = createContext<DropdownContextType | undefined>(undefined);

export const Dropdown = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (triggerRef.current && triggerRef.current.contains(event.target as Node)) {
        return;
      }

      const target = event.target as HTMLElement;
      if (target.closest('[data-dropdown-content]')) {
        return;
      }

      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('resize', () => setIsOpen(false));
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', () => setIsOpen(false));
    };
  }, [isOpen]);

  const close = () => setIsOpen(false);

  return (
    <DropdownContext.Provider value={{ isOpen, setIsOpen, close, triggerRef }}>
      <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
};

export const DropdownTrigger = ({ children, className = "", asChild = false }: { children: React.ReactNode; className?: string; asChild?: boolean }) => {
  const context = useContext(DropdownContext);
  if (!context) throw new Error("DropdownTrigger must be used within a Dropdown");

  const handleClick = (e: React.MouseEvent) => {
    context.setIsOpen(!context.isOpen);
  };

  return (
    <div 
      ref={context.triggerRef}
      onClick={handleClick} 
      data-state={context.isOpen ? 'open' : 'closed'}
      className={`cursor-pointer inline-flex ${className}`}
    >
      {children}
    </div>
  );
};

export const DropdownContent = ({
  children,
  align = 'left',
  width = 'w-56',
  className = "",
  portal = true
}: {
  children: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
  className?: string;
  portal?: boolean;
}) => {
  const context = useContext(DropdownContext);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  
  if (!context) throw new Error("DropdownContent must be used within a Dropdown");

  const { isOpen, triggerRef } = context;

  useEffect(() => {
    if (isOpen && triggerRef.current) {
        const updateCoords = () => {
            const rect = triggerRef.current!.getBoundingClientRect();
            
            let left = rect.left;
            
            // Calculate absolute LEFT position based on alignment anchor points
            // Adjustments (shifts) will be handled by Framer Motion's 'x' prop
            if (align === 'right') {
                left = rect.right; 
            } else if (align === 'center') {
                left = rect.left + (rect.width / 2);
            }

            setCoords({
                top: rect.bottom + 8,
                left: left
            });
        };

        updateCoords();
        // Recalculate on scroll to stick to element
        window.addEventListener('scroll', updateCoords, true);
        return () => window.removeEventListener('scroll', updateCoords, true);
    }
  }, [isOpen, align, triggerRef]);

  // Determine X offset for alignment
  const xOffset = align === 'right' ? '-100%' : align === 'center' ? '-50%' : '0%';

  const style: React.CSSProperties = portal 
    ? {
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        zIndex: 9999,
        // We use motion x for alignment to avoid CSS transform conflicts or race conditions
      }
    : {};

  const content = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: -5, x: xOffset, scale: 0.95, filter: "blur(10px)", opacity: 0 }}
          animate={{ y: 0, x: xOffset, scale: 1, filter: "blur(0)", opacity: 1 }}
          exit={{ y: -5, x: xOffset, scale: 0.95, opacity: 0, filter: "blur(10px)" }}
          transition={{ duration: 0.4, ease: "circInOut", type: "spring", stiffness: 200, damping: 20 }}
          style={style}
          data-dropdown-content
          onMouseDown={(e) => e.stopPropagation()}
          className={`
            rounded-xl bg-[#30302E] backdrop-blur-sm shadow-[0_0_20px_rgba(0,0,0,0.2)] border border-[#373734] overflow-hidden ring-1 ring-white/5
            ${!portal ? 'absolute mt-2 z-50' : ''}
            ${!portal && align === 'right' ? 'right-0' : ''}
            ${!portal && align === 'center' ? 'left-1/2 -translate-x-1/2' : ''}
            ${width}
            ${className}
          `}
        >
          <div className="p-1 flex flex-col gap-1">
            {React.Children.map(children, (child, index) => {
               if (React.isValidElement(child)) {
                   // @ts-ignore
                   return React.cloneElement(child, { index });
               }
               return child;
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (portal) {
    return createPortal(content, document.body);
  }

  return content;
};

export const DropdownItem = ({ 
  children, 
  onClick, 
  className = "", 
  disabled = false,
  danger = false,
  icon: Icon,
  shortcut,
  index = 0
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  className?: string;
  disabled?: boolean;
  danger?: boolean;
  icon?: LucideIcon;
  shortcut?: string;
  index?: number;
}) => {
  const context = useContext(DropdownContext);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (onClick) {
      onClick();
    }
    context?.close();
  };

  const baseClass = "group flex items-center w-full px-3 py-2.5 text-sm rounded-lg outline-none transition-none select-none relative overflow-hidden cursor-pointer";
  const colorClass = disabled 
    ? "text-gray-500 cursor-not-allowed opacity-50" 
    : danger 
      ? "text-red-400"
      : "text-gray-200";

  return (
    <motion.button 
      onClick={handleClick}
      disabled={disabled}
      initial={{ opacity: 0, x: 10, scale: 0.95, filter: "blur(10px)" }}
      animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0)" }}
      exit={{ opacity: 0, x: 10, scale: 0.95, filter: "blur(10px)" }}
      transition={{ 
          duration: 0.3, 
          delay: index * 0.05, 
          ease: "easeInOut", 
          type: "spring",
          stiffness: 200,
          damping: 20
      }}
      whileHover={{ 
          backgroundColor: danger ? "rgba(239, 68, 68, 0.15)" : "rgba(255, 255, 255, 0.1)",
          transition: { duration: 0.2 } 
      }}
      whileTap={{ scale: 0.97 }}
      className={`${baseClass} ${colorClass} ${className}`}
    >
      {Icon && <Icon size={16} className={`mr-2.5 ${danger ? 'text-red-400' : 'text-gray-400 group-hover:text-white'} transition-colors`} />}
      <span className="flex-1 text-left truncate relative z-10 font-medium">{children}</span>
      {shortcut && <span className="ml-auto text-xs text-gray-500 group-hover:text-gray-300 relative z-10 font-sans opacity-70">{shortcut}</span>}
    </motion.button>
  );
};

export const DropdownSeparator = ({ className = "" }: { className?: string }) => (
  <div className={`-mx-1 my-1.5 h-px bg-gray-700/50 ${className}`} />
);

export const DropdownLabel = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider ${className}`}>
    {children}
  </div>
);