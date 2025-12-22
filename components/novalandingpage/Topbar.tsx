import React, { useState, useRef } from 'react';
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import logo from '../../assets/logo.png'; // ⚠️ Verifique o caminho

// --- HOVER BUTTON ---
const HoverButton = ({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }) => {
  const [hovered, setHovered] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <button
      ref={buttonRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`
        relative overflow-hidden rounded-full px-8 py-2.5 text-sm font-semibold text-white transition-all duration-300
        bg-[#D97757]/20 border border-[#D97757]/30 hover:bg-[#D97757]/30 hover:border-[#D97757]/50
        shadow-[0_0_20px_-5px_rgba(217,119,87,0.3)] hover:shadow-[0_0_25px_-5px_rgba(217,119,87,0.5)]
        whitespace-nowrap flex-shrink-0 group ${className}
      `}
      {...props}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
      <div
        className={`absolute inset-0 bg-gradient-to-r from-[#D97757]/0 via-[#D97757]/40 to-[#D97757]/0 transition-transform duration-700 ease-in-out ${hovered ? 'translate-x-full' : '-translate-x-full'}`}
      />
    </button>
  );
};

// --- TOPBAR ---
export const Topbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 50);
  });

  const navLinks = [
    { name: 'Funcionalidades', href: '#features' },
    { name: 'Planos', href: '#pricing' },
    { name: 'Sobre', href: '#about' },
    { name: 'Blog', href: '#blog' },
  ];

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center items-start pt-6 px-4 pointer-events-none">
        <motion.nav
          initial={{ y: -100, opacity: 0 }}
          animate={{
            y: 0,
            opacity: 1,
            // CORREÇÃO DO PULO: A lógica de Max-Width agora é feita via animação, não via CSS Class.
            // Quando no topo: min(100%, 1440px) -> Ocupa tudo, mas respeita o limite de 1440px.
            // Quando scroll: min(95%, 1000px) -> Vira a pílula.
            width: scrolled ? "min(95%, 1000px)" : "min(100%, 1440px)",

            borderRadius: scrolled ? "24px" : "0px",
            backgroundColor: scrolled ? "rgba(15, 15, 15, 0.65)" : "transparent",
            backdropFilter: scrolled ? "blur(24px) saturate(180%)" : "blur(0px)",
            borderColor: scrolled ? "rgba(255, 255, 255, 0.08)" : "transparent",
            boxShadow: scrolled
              ? "0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.15), inset 0 -1px 1px rgba(0,0,0,0.3)"
              : "none",
            padding: scrolled ? "0.75rem 1.5rem" : "1.5rem 2.5rem",
            marginTop: scrolled ? "0rem" : "-1rem"
          }}
          // Layout dependency ajuda a suavizar mudanças de renderização
          layout
          transition={{ duration: 0.5, type: "spring", stiffness: 100, damping: 30 }}
          className="pointer-events-auto flex items-center justify-between border border-transparent overflow-hidden relative"
        >
          {/* Ambient Glows - Visible only when scrolled */}
          <div className={`absolute top-0 left-0 w-[300px] h-[100px] bg-[#D97757]/20 blur-[60px] -translate-x-1/2 -translate-y-12 pointer-events-none transition-opacity duration-500 ${scrolled ? 'opacity-100' : 'opacity-0'}`} />
          <div className={`absolute top-0 right-0 w-[300px] h-[100px] bg-[#D97757]/20 blur-[60px] translate-x-1/2 -translate-y-12 pointer-events-none transition-opacity duration-500 ${scrolled ? 'opacity-100' : 'opacity-0'}`} />

          {/* LOGO */}
          <a href="#" className="flex-shrink-0 flex items-center gap-3 group relative z-10 no-underline">
            <img src={logo} alt="Controlar Logo" className="h-8 w-auto" />
            <span className="text-xl font-bold tracking-tight text-white group-hover:text-gray-100 transition-colors">
              Controlar<span className="text-[#D97757]">+</span>
            </span>
          </a>

          {/* DESKTOP NAV */}
          <div className="hidden md:flex items-center gap-2 relative z-10">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all rounded-full"
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* ACTIONS */}
          <div className="hidden md:flex items-center gap-6 flex-shrink-0 relative z-10">
            <HoverButton className="whitespace-nowrap">
              Começar Agora
            </HoverButton>
          </div>

          {/* MOBILE TOGGLE */}
          <button
            className="md:hidden p-2 text-gray-300 hover:text-white transition-colors relative z-10"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
        </motion.nav>
      </div>

      {/* MOBILE MENU */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(20px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[60] bg-black/60 flex flex-col p-6"
          >
            <div className="absolute inset-0 bg-[#0a0a0a]/90 -z-10" />
            <div className="flex justify-between items-center mb-10">
              <span className="text-xl font-bold text-white flex items-center gap-2">
                <img src={logo} alt="Logo" className="h-6 w-auto opacity-80" />
                Menu
              </span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-gray-400 hover:text-white bg-white/5 rounded-full border border-white/10 hover:bg-white/10 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex flex-col gap-6">
              {navLinks.map((link, idx) => (
                <motion.a
                  key={link.name}
                  href={link.href}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 + idx * 0.1 }}
                  className="text-2xl font-semibold text-gray-300 hover:text-[#D97757] transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.name}
                </motion.a>
              ))}
            </div>
            <div className="mt-auto flex flex-col gap-4">
              <button className="w-full py-4 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 transition-colors">
                Entrar
              </button>
              <button className="w-full py-4 rounded-xl bg-[#D97757] text-white font-bold shadow-lg shadow-[#D97757]/20 hover:bg-[#c56a4d] transition-colors">
                Começar Agora
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};