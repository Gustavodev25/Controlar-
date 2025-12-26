import React, { useState } from 'react';
import { 
  motion, 
  useScroll, 
  useMotionValueEvent, 
  useMotionTemplate, 
  useMotionValue, 
  useSpring, 
  AnimatePresence 
} from 'framer-motion';
import { Menu, X, ArrowRight } from 'lucide-react';
import logo from '../../assets/logo.png'; // ⚠️ Verifique o caminho

// --- NAV ITEM (Ajustado para ser uma luz difusa, não um bloco) ---
const NavItem = ({ children, href, isActive, onClick }: any) => {
  return (
    <a
      href={href}
      onClick={onClick}
      className="relative px-5 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors duration-300 z-10 group"
    >
      {/* MUDANÇA AQUI:
        Em vez de um background sólido, usamos um gradiente radial com opacidade muito baixa (0.06 -> 0).
        Adicionamos blur-lg para que as bordas não fiquem marcadas.
        Isso cria o efeito de "luz fraca" e não de "caixa cinza".
      */}
      <div 
        className="
          absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out
          bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_0%,transparent_70%)]
          blur-[6px]
        " 
      />
      
      {/* Estado Ativo (Selecionado) também mais suave */}
      {isActive && (
        <motion.div
          layoutId="nav-pill"
          className="absolute inset-0 bg-white/[0.04] rounded-lg -z-10 shadow-[inset_0_0_10px_rgba(255,255,255,0.02)]"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
      
      <span className="relative z-10">{children}</span>
    </a>
  );
};

// --- TOPBAR ---
export const Topbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(null); // Pode começar null ou com um valor
  
  const { scrollY } = useScroll();
  
  // --- FÍSICA DO MOUSE ---
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Mantendo bem suave
  const smoothX = useSpring(mouseX, { stiffness: 100, damping: 25, mass: 0.5 });
  const smoothY = useSpring(mouseY, { stiffness: 100, damping: 25, mass: 0.5 });

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 20);
  });

  const navLinks = [
    { name: 'Funcionalidades', href: '#features' },
    { name: 'Planos', href: '#pricing' },
    { name: 'Sobre', href: '#about' },
  ];

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 px-4 pointer-events-none">
        
        <motion.nav
          initial={{ y: -100, opacity: 0 }}
          animate={{ 
            y: 0, 
            opacity: 1, 
            width: scrolled ? "min(90%, 750px)" : "min(95%, 1000px)",
            padding: scrolled ? "0.5rem" : "0.6rem 0.8rem",
          }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          onMouseMove={handleMouseMove}
          className="
            pointer-events-auto relative flex items-center justify-between 
            rounded-[24px] 
            border border-white/10 
            shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.05)]
            backdrop-blur-2xl overflow-hidden group
          "
          style={{
            // Fundo um pouco mais transparente para ajudar na leveza
            backgroundColor: scrolled ? "rgba(5, 5, 5, 0.6)" : "rgba(10, 10, 10, 0.4)",
            backdropFilter: "blur(20px) saturate(160%)",
          }}
        >
          
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] brightness-100 contrast-150" />

          <motion.div
            className="pointer-events-none absolute -inset-px rounded-[24px] opacity-0 transition-opacity duration-700 group-hover:opacity-100"
            style={{
              background: useMotionTemplate`
                radial-gradient(
                  600px circle at ${smoothX}px ${smoothY}px,
                  rgba(217, 119, 87, 0.04),
                  transparent 80%
                )
              `,
            }}
          />
          
          <motion.div
            className="pointer-events-none absolute -inset-px rounded-[24px] opacity-0 transition-opacity duration-700 group-hover:opacity-100"
            style={{
              background: useMotionTemplate`
                radial-gradient(
                  300px circle at ${smoothX}px ${smoothY}px,
                  rgba(255, 255, 255, 0.08),
                  transparent 80%
                )
              `,
              maskImage: "linear-gradient(black, black) content-box, linear-gradient(black, black)",
              WebkitMaskImage: "linear-gradient(black, black) content-box, linear-gradient(black, black)",
              maskComposite: "exclude",
              WebkitMaskComposite: "xor",
              padding: "1px",
            }}
          />

          {/* LOGO */}
          <div className="pl-3 flex items-center gap-3 relative z-10">
            <a href="#" className="flex items-center gap-2 group/logo">
              <img src={logo} alt="Logo" className="h-6 w-auto relative opacity-90 group-hover/logo:opacity-100 transition-opacity" />
              <div className={`flex flex-col overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${scrolled ? 'w-0 opacity-0' : 'w-24 opacity-100'}`}>
                <span className="font-bold text-white text-sm leading-tight tracking-tight whitespace-nowrap">
                  Controlar<span className="text-[#D97757]">+</span>
                </span>
              </div>
            </a>
          </div>

          {/* LINKS CENTRAIS */}
          <div className="hidden md:flex items-center absolute left-1/2 -translate-x-1/2 z-10">
            {navLinks.map((link) => (
            <NavItem 
                key={link.name} 
                href={link.href}
                isActive={activeTab === link.name}
                onClick={(e: any) => {
                    e.preventDefault();
                    setActiveTab(link.name);
                }}
            >
                {link.name}
            </NavItem>
            ))}
          </div>

          {/* AÇÕES DIREITA */}
          <div className="pr-1 flex items-center gap-2 relative z-10">
            <button className="hidden md:flex items-center gap-2 px-5 py-1.5 rounded-lg bg-[#D97757] hover:bg-[#c56a4d] text-white text-sm font-semibold transition-all shadow-[0_0_10px_-3px_rgba(217,119,87,0.3)] hover:shadow-[0_0_20px_-5px_rgba(217,119,87,0.5)] active:scale-[0.98]">
              <span>Entrar</span>
            </button>
            
            <button
                className="md:hidden p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors backdrop-blur-md"
                onClick={() => setMobileMenuOpen(true)}
            >
                <Menu className="w-5 h-5" />
            </button>
          </div>

        </motion.nav>
      </div>

      {/* MENU MOBILE */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex flex-col justify-end sm:justify-center items-center p-4"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setMobileMenuOpen(false)} />

            <motion.div
              initial={{ y: 20, scale: 0.95, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 20, scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden"
            >
              <div className="flex justify-between items-center mb-6 relative z-10">
                <span className="text-lg font-bold text-white">Menu</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col gap-1 relative z-10">
                {navLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all group"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="font-medium text-base">{link.name}</span>
                    <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-[#D97757]" />
                  </a>
                ))}
              </div>

              <button className="w-full mt-6 py-3 rounded-lg bg-[#D97757] text-white font-bold">
                Começar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};