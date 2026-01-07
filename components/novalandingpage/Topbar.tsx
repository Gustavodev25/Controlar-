import React, { useState, useEffect } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  AnimatePresence,
} from 'framer-motion';
import { Menu, X, ArrowRight } from 'lucide-react';
import logo from '../../assets/logo.png'; // ⚠️ Verifique o caminho
import { getAvatarColors, getInitials } from '../../utils/avatarUtils';

// --- TYPES ---
interface NavItemProps {
  children: React.ReactNode;
  href: string;
  isActive: boolean;
  onClick: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

// --- NAV ITEM ---
const NavItem: React.FC<NavItemProps> = ({ children, href, isActive, onClick }) => {
  return (
    <a
      href={href}
      onClick={onClick}
      className="relative px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors duration-300 group"
    >
      <div
        className="
          absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500
          bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.15)_0%,transparent_80%)]
          blur-[8px]
        "
      />
      {isActive && (
        <motion.div
          layoutId="nav-pill"
          className="absolute inset-0 bg-white/[0.06] rounded-lg -z-10 border border-white/[0.05] shadow-[0_0_20px_-5px_rgba(255,255,255,0.1)]"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </a>
  );
};

// --- TOPBAR ---
interface SubscribeData {
  planId: 'pro';
  billingCycle: 'monthly' | 'annual';
  couponCode?: string;
}

interface TopbarProps {
  onLogin: () => void;
  onSubscribe?: (data: SubscribeData) => void;
  hideNavigation?: boolean;
  user?: any;
  centerContent?: React.ReactNode;
}

export const Topbar: React.FC<TopbarProps> = ({ onLogin, onSubscribe, hideNavigation = false, user, centerContent }) => {
  const navLinks = [
    { name: 'Início', href: '#hero' },
    { name: 'Funcionalidades', href: '#features' },
    { name: 'Planos', href: '#pricing' },
    { name: 'Depoimentos', href: '#testimonials' },
    { name: 'FAQ', href: '#faq' },
  ];

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('Início');

  // Helper to handle smooth scroll
  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string, name: string) => {
    e.preventDefault();
    setActiveTab(name);
    setMobileMenuOpen(false); // Close mobile menu if open

    const element = document.querySelector(href);
    if (element) {
      const offsetTop = element.getBoundingClientRect().top + window.scrollY - 100; // Offset for fixed header
      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200; // Offset to trigger a bit earlier

      // Find the section active
      let currentSection = 'Início';

      navLinks.forEach((link) => {
        const sectionId = link.href.substring(1);
        const element = document.getElementById(sectionId);

        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (
            scrollPosition >= offsetTop &&
            scrollPosition < offsetTop + offsetHeight
          ) {
            currentSection = link.name;
          }
        }
      });

      if (currentSection !== activeTab) {
        setActiveTab(currentSection);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check on mount
    return () => window.removeEventListener('scroll', handleScroll);
  }, []); // Remove dependency on activeTab to avoid loop, let local var handle logic or set state only if changed

  const { scrollY } = useScroll();

  // Transforma o scroll em valores fluidos
  const width = useTransform(scrollY, [0, 100], ["min(95%, 1100px)", "min(90%, 750px)"]);
  const padding = useTransform(scrollY, [0, 100], ["0.7rem 1rem", "0.5rem 0.5rem"]);
  const background = useTransform(scrollY, [0, 100], ["rgba(10, 10, 10, 0.3)", "rgba(5, 5, 5, 0.6)"]);
  const backdropBlur = useTransform(scrollY, [0, 100], ["blur(10px)", "blur(24px)"]);
  const borderOpacity = useTransform(scrollY, [0, 100], [0.1, 0.2]);

  const [isScrolledDeep, setIsScrolledDeep] = useState(false);
  useEffect(() => {
    return scrollY.on("change", (latest) => setIsScrolledDeep(latest > 60));
  }, [scrollY]);

  // Física do Mouse
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 100, damping: 25, mass: 0.5 });
  const smoothY = useSpring(mouseY, { stiffness: 100, damping: 25, mass: 0.5 });

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <>
      {/* Container Principal Fixo - Layout Vertical */}
      <div className="fixed top-0 left-0 right-0 z-50 flex flex-col items-center pt-4 md:pt-6 px-4 pointer-events-none">

        {/* --- NAVBAR --- */}
        <motion.nav
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          style={{
            width,
            padding,
            backgroundColor: background,
            backdropFilter: backdropBlur,
            borderColor: useMotionTemplate`rgba(255, 255, 255, ${borderOpacity})`,
          }}
          transition={{ type: "spring", stiffness: 80, damping: 20 }}
          onMouseMove={handleMouseMove}
          className="
            pointer-events-auto relative flex items-center justify-between 
            rounded-[24px] border border-white/10
            shadow-[0_8px_40px_-10px_rgba(0,0,0,0.6)]
            overflow-hidden group z-50
          "
        >
          {/* Textura Noise */}
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] contrast-125" />

          {/* Spotlight Effect */}
          <motion.div
            className="pointer-events-none absolute -inset-px rounded-[24px] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{
              background: useMotionTemplate`radial-gradient(500px circle at ${smoothX}px ${smoothY}px, rgba(255, 255, 255, 0.06), transparent 80%)`,
            }}
          />
          {/* Borda Superior Brilhante */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />

          {/* Logo */}
          <div className="pl-2 md:pl-4 flex items-center gap-3 relative z-10">
            <a href="#" className="flex items-center gap-2 group/logo" onClick={(e) => { e.preventDefault(); setActiveTab(''); }}>
              <div className="relative w-8 h-8 flex items-center justify-center">
                <img src={logo} alt="Logo" className="h-6 w-auto object-contain opacity-90 group-hover/logo:opacity-100 transition-opacity" />
              </div>
              <div className={`flex flex-col overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${isScrolledDeep ? 'w-0 opacity-0' : 'w-24 opacity-100'}`}>
                <span className="font-bold text-white text-sm leading-tight tracking-wide">
                  Controlar<span className="text-[#D97757]">+</span>
                </span>
              </div>
            </a>
          </div>

          {/* Desktop Links OR Center Content */}
          <div className="hidden md:flex items-center absolute left-1/2 -translate-x-1/2 z-10">
            {!hideNavigation ? (
              <div className="flex items-center gap-1 p-1">
                {navLinks.map((link) => (
                  <NavItem
                    key={link.name}
                    href={link.href}
                    isActive={activeTab === link.name}
                    onClick={(e) => handleNavClick(e, link.href, link.name)}
                  >
                    {link.name}
                  </NavItem>
                ))}
              </div>
            ) : (
              centerContent
            )}
          </div>

          {/* Botões Direita */}
          <div className="pr-1 flex items-center gap-2 relative z-10">
            {user ? (
              // User Avatar Rendering
              (() => {
                const avatarColors = getAvatarColors(user.name || 'User');
                const hasCustomAvatar = user.avatarUrl && user.avatarUrl.includes('url');
                return (
                  <div className="flex items-center gap-3 pr-2">
                    <div className={`w-8 h-8 rounded-full ${hasCustomAvatar ? '' : avatarColors.bg} flex items-center justify-center text-xs font-bold ${hasCustomAvatar ? 'text-white' : avatarColors.text} shadow-md border border-white/10`}>
                      {!hasCustomAvatar && getInitials(user.name || 'User')}
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={onLogin}
                  className="hidden md:block text-sm font-medium text-gray-400 hover:text-white transition-colors px-2"
                >
                  Entrar
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    // Ir direto para checkout se onSubscribe disponível
                    if (onSubscribe) {
                      onSubscribe({
                        planId: 'pro',
                        billingCycle: 'monthly',
                        couponCode: 'FELIZ2026'
                      });
                    } else {
                      // Fallback: salvar pending_checkout e ir para login
                      const pendingCheckout = {
                        planId: 'pro',
                        billingCycle: 'monthly',
                        couponCode: 'FELIZ2026'
                      };
                      localStorage.setItem('pending_checkout', JSON.stringify(pendingCheckout));
                      onLogin();
                    }
                  }}
                  className="hidden md:flex items-center gap-2 px-5 py-2 rounded-xl bg-[#D97757] hover:bg-[#ff8660] text-white text-sm font-semibold transition-all shadow-[0_0_20px_-5px_rgba(217,119,87,0.4)] border border-white/10"
                >
                  <span>Assinar Pro</span>
                </motion.button>
              </div>
            )}

            {!hideNavigation && (
              <button
                className="md:hidden p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors backdrop-blur-md border border-white/5"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}
          </div>
        </motion.nav>

        {/* --- MENU MOBILE DROPDOWN (GLASSMORPHISM STYLE) --- */}
        {!hideNavigation && (
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.98, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, scale: 0.98, filter: "blur(10px)" }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="
                pointer-events-auto mt-2 w-full max-w-[90%] sm:max-w-sm
                rounded-2xl border border-white/10 
                shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] 
                overflow-hidden z-40 relative
              "
                style={{
                  backgroundColor: "rgba(10, 10, 10, 0.65)",
                  backdropFilter: "blur(24px) saturate(180%)",
                  WebkitBackdropFilter: "blur(24px) saturate(180%)",
                }}
              >
                {/* Textura Noise */}
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] contrast-125" />

                {/* Brilho de Borda Superior */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-70" />

                <div className="flex flex-col p-2 relative z-10">
                  {navLinks.map((link, i) => (
                    <motion.a
                      key={link.name}
                      initial={{ x: -10, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      href={link.href}
                      onClick={(e) => handleNavClick(e, link.href, link.name)}
                      className="
                      flex items-center justify-between p-3 rounded-xl 
                      text-gray-300 hover:text-white hover:bg-white/5 
                      transition-all group border border-transparent hover:border-white/5
                    "
                    >
                      <span className="font-medium">{link.name}</span>
                      <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-transform text-[#D97757]" />
                    </motion.a>
                  ))}

                  <div className="h-px bg-white/5 my-2 mx-2" />

                  {!user && (
                    <button
                      onClick={() => {
                        onLogin();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full p-3 mb-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-center transition-colors border border-white/5 hover:border-white/10"
                    >
                      Entrar
                    </button>
                  )}

                  <button
                    onClick={() => {
                      // Ir direto para checkout se onSubscribe disponível
                      if (onSubscribe) {
                        onSubscribe({
                          planId: 'pro',
                          billingCycle: 'monthly',
                          couponCode: 'FELIZ2026'
                        });
                      } else {
                        // Fallback: salvar pending_checkout e ir para login
                        const pendingCheckout = {
                          planId: 'pro',
                          billingCycle: 'monthly',
                          couponCode: 'FELIZ2026'
                        };
                        localStorage.setItem('pending_checkout', JSON.stringify(pendingCheckout));
                        onLogin();
                      }
                    }}
                    className="w-full p-3 rounded-xl bg-[#D97757] hover:bg-[#c56a4d] text-white font-bold text-center transition-colors shadow-lg shadow-[#D97757]/20">
                    Assinar Pro
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* CLICK OUTSIDE PARA FECHAR (INVISÍVEL) */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-transparent cursor-default"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </>
  );
};