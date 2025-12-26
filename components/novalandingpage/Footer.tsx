import React from 'react';
import logo from '../../assets/logo.png';
import { Instagram } from 'lucide-react';

export const Footer: React.FC = () => {
    return (
        <footer className="w-full bg-[#1a0f0a] border-t border-white/5 pt-16 pb-8">
            <div className="container mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
                    {/* Brand Column */}
                    <div className="md:col-span-1 space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="relative w-8 h-8 flex items-center justify-center">
                                <img src={logo} alt="Logo" className="h-6 w-auto object-contain opacity-90" />
                            </div>
                            <span className="font-bold text-white text-lg tracking-wide">
                                Controlar<span className="text-[#D97757]">+</span>
                            </span>
                        </div>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Simplificando sua vida financeira com inteligência e clareza.
                            Assuma o controle do seu futuro hoje.
                        </p>
                    </div>

                    {/* Links Columns */}
                    <div className="col-span-1">
                        <h4 className="font-bold text-white mb-6">Produto</h4>
                        <ul className="space-y-4 text-sm text-gray-400">
                            <li><a href="#features" className="hover:text-[#D97757] transition-colors">Funcionalidades</a></li>
                            <li><a href="#pricing" className="hover:text-[#D97757] transition-colors">Planos</a></li>
                            <li><a href="#testimonials" className="hover:text-[#D97757] transition-colors">Depoimentos</a></li>
                        </ul>
                    </div>



                    {/* Socials Column */}
                    <div className="col-span-1">
                        <h4 className="font-bold text-white mb-6">Redes Sociais</h4>
                        <div className="flex gap-4">
                            <a
                                href="https://www.instagram.com/controlarmaisoficial/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-[#D97757] hover:text-white transition-all"
                            >
                                <Instagram size={18} />
                            </a>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
                    <p>&copy; {new Date().getFullYear()} Controlar+. Todos os direitos reservados.</p>
                    <p>Feito com ❤️ no Brasil.</p>
                </div>
            </div>
        </footer>
    );
};
