
import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Sparkles, 
  ArrowRight, 
  Shield, 
  Users, 
  Bot, 
  TrendingUp, 
  TrendingDown,
  CheckCircle,
  Calendar,
  Tag,
  DollarSign,
  LayoutDashboard,
  Plus,
  Table2,
  Bell,
  BrainCircuit,
  Briefcase,
  Wallet,
  Car,
  Send,
  Instagram,
  Twitter,
  Linkedin,
  Check,
  MessageSquare,
  ChevronDown
} from './Icons';

interface LandingPageProps {
  onLogin: () => void;
}

// --- COMPONENTE: DEMO INTERATIVA (HERO) ---
const AIInteractiveDemo = () => {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<'typing' | 'processing' | 'result' | 'reset'>('typing');
  const [exampleIndex, setExampleIndex] = useState(0);
  
  const examples = [
    {
      text: "Jantar no Outback 240 reais ontem",
      result: { 
        desc: "Jantar Outback", 
        val: "- R$ 240,00", 
        tag: "Alimentação", 
        date: "Ontem",
        isExpense: true,
        icon: <Tag size={12} className="text-[#d97757]" />
      }
    },
    {
      text: "Recebi 4500 de salário hoje",
      result: { 
        desc: "Salário Mensal", 
        val: "+ R$ 4.500,00", 
        tag: "Renda", 
        date: "Hoje",
        isExpense: false,
        icon: <DollarSign size={12} className="text-green-500" />
      }
    },
    {
      text: "Gasolina 200 reais posto shell",
      result: { 
        desc: "Posto Shell", 
        val: "- R$ 200,00", 
        tag: "Transporte", 
        date: "Hoje",
        isExpense: true,
        icon: <Car size={12} className="text-blue-400" />
      }
    }
  ];

  const currentExample = examples[exampleIndex];
  
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    if (phase === 'typing') {
      if (text.length < currentExample.text.length) {
        timeout = setTimeout(() => {
          setText(currentExample.text.slice(0, text.length + 1));
        }, 40); 
      } else {
        timeout = setTimeout(() => setPhase('processing'), 600);
      }
    } else if (phase === 'processing') {
      timeout = setTimeout(() => setPhase('result'), 1200); 
    } else if (phase === 'result') {
      timeout = setTimeout(() => setPhase('reset'), 3500); 
    } else if (phase === 'reset') {
      setText("");
      setPhase('typing');
      setExampleIndex((prev) => (prev + 1) % examples.length);
    }

    return () => clearTimeout(timeout);
  }, [text, phase, currentExample]);

  return (
    <div className="relative w-full max-w-md mx-auto animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden relative z-20">
        
        <div className="bg-gray-950 px-4 py-3 border-b border-gray-800 flex items-center gap-3">
           <div className="flex gap-1.5">
             <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
             <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
             <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
           </div>
           <div className="text-xs font-medium text-gray-500 ml-2">Finanças AI Assistant</div>
        </div>

        <div className="p-6 space-y-6 min-h-[320px] bg-gray-900">
           
           <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[#d97757] flex items-center justify-center text-white shrink-0 shadow-lg shadow-[#d97757]/20">
                 <Bot size={16} />
              </div>
              <div className="bg-gray-800 rounded-2xl rounded-tl-none p-3 text-sm text-gray-200 max-w-[85%] border border-gray-700">
                 Olá! O que você gastou ou recebeu hoje?
              </div>
           </div>

           {(text || phase !== 'typing') && (
             <div className="flex gap-3 flex-row-reverse">
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-white shrink-0 border border-gray-600">
                   <div className="text-xs font-bold">VC</div>
                </div>
                <div className="bg-[#d97757] rounded-2xl rounded-tr-none p-3 text-sm text-white max-w-[85%] shadow-lg transition-all duration-200">
                   {text}
                   {phase === 'typing' && <span className="animate-pulse ml-1">|</span>}
                </div>
             </div>
           )}

           {phase === 'processing' && (
             <div className="flex gap-3 animate-fade-in">
                <div className="w-8 h-8 rounded-full bg-[#d97757] flex items-center justify-center text-white shrink-0">
                   <Bot size={16} />
                </div>
                <div className="bg-gray-800 rounded-2xl rounded-tl-none p-3 flex items-center gap-2 border border-gray-700">
                   <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0s'}}></div>
                   <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s'}}></div>
                   <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s'}}></div>
                </div>
             </div>
           )}

           {phase === 'result' && (
              <div className="flex gap-3 animate-fade-in">
                 <div className="w-8 h-8 rounded-full bg-[#d97757] flex items-center justify-center text-white shrink-0">
                    <Bot size={16} />
                 </div>
                 <div className="space-y-2 w-full max-w-[85%]">
                    <div className="bg-gray-800 rounded-2xl rounded-tl-none p-3 text-sm text-gray-200 border border-gray-700">
                       Entendido! Lançamento criado:
                    </div>
                    
                    <div className="bg-gray-950 border border-gray-700 rounded-xl p-4 shadow-lg transform scale-95 origin-top-left animate-slide-up relative overflow-hidden">
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${currentExample.result.isExpense ? 'bg-red-500' : 'bg-green-500'}`}></div>
                        <div className="flex justify-between items-start mb-3 pl-2">
                           <div>
                             <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Descrição</p>
                             <p className="text-white font-bold">{currentExample.result.desc}</p>
                           </div>
                           <div className="text-right">
                             <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Valor</p>
                             <p className={`${currentExample.result.isExpense ? 'text-red-400' : 'text-green-400'} font-bold font-mono text-lg`}>
                               {currentExample.result.val}
                             </p>
                           </div>
                        </div>
                        <div className="flex gap-2 pl-2">
                           <span className="px-2 py-1 bg-gray-800/80 rounded-md text-xs text-gray-300 flex items-center gap-1.5 border border-gray-700">
                             {currentExample.result.icon} {currentExample.result.tag}
                           </span>
                           <span className="px-2 py-1 bg-gray-800/80 rounded-md text-xs text-gray-300 flex items-center gap-1.5 border border-gray-700">
                             <Calendar size={12} /> {currentExample.result.date}
                           </span>
                        </div>
                    </div>
                 </div>
              </div>
           )}

        </div>

        <div className="p-3 bg-gray-950 border-t border-gray-800 flex items-center gap-2">
           <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-500 hover:text-white transition-colors cursor-pointer">
              <Plus size={16} />
           </div>
           <div className="flex-1 h-10 bg-gray-900 rounded-full border border-gray-800 px-4 flex items-center text-sm text-gray-500 cursor-text">
              Digite uma transação...
           </div>
           <div className="w-10 h-10 rounded-full bg-[#d97757] text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform cursor-pointer">
              <Send size={16} />
           </div>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENTE: MOCKUP REALISTA (SISTEMA) ---
const RealisticDashboardPreview = () => {
  return (
    <div className="relative w-full max-w-6xl mx-auto mt-8 perspective-1000 group">
       <div className="bg-[#0f100f] border border-gray-800/80 rounded-xl shadow-2xl overflow-hidden transform rotate-x-12 group-hover:rotate-0 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]">
          
          {/* Browser Chrome */}
          <div className="h-9 bg-[#1a1a19] border-b border-gray-800 flex items-center px-4 gap-2 justify-between">
             <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#ff5f57]"></div>
                <div className="w-3 h-3 rounded-full bg-[#febc2e]"></div>
                <div className="w-3 h-3 rounded-full bg-[#28c840]"></div>
             </div>
             <div className="flex-1 flex justify-center">
                <div className="bg-[#0f100f] border border-gray-800 rounded-md px-3 py-0.5 text-[10px] text-gray-500 font-mono flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  app.financas.ai/dashboard
                </div>
             </div>
             <div className="w-10"></div> 
          </div>

          {/* App Interface */}
          <div className="flex h-[600px] text-[#faf9f5] font-sans">
             
             {/* 1. Sidebar (Replica) */}
             <div className="w-16 lg:w-64 bg-[#0a0a0a] border-r border-gray-800 hidden md:flex flex-col">
                <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-800/50">
                   <div className="w-8 h-8 bg-[#d97757] rounded-lg flex items-center justify-center text-white shadow-md">
                     <FileSpreadsheet size={18} strokeWidth={2.5} />
                   </div>
                   <span className="font-bold text-lg hidden lg:block">Finanças<span className="text-[#d97757]">.ai</span></span>
                </div>
                
                <div className="p-4 space-y-6">
                   <div className="space-y-1">
                      <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-800/50 text-white rounded-lg border border-gray-700/50">
                         <LayoutDashboard size={20} className="text-[#d97757]" />
                         <span className="font-medium text-sm hidden lg:block">Visão Geral</span>
                         <div className="ml-auto w-1 h-4 bg-[#d97757] rounded-full hidden lg:block"></div>
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2.5 text-gray-400 hover:bg-gray-800/30 rounded-lg">
                         <Table2 size={20} />
                         <span className="font-medium text-sm hidden lg:block">Lançamentos</span>
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2.5 text-gray-400 hover:bg-gray-800/30 rounded-lg">
                         <Bell size={20} />
                         <span className="font-medium text-sm hidden lg:block">Lembretes</span>
                         <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full hidden lg:block">2</span>
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2.5 text-gray-400 hover:bg-gray-800/30 rounded-lg">
                         <BrainCircuit size={20} />
                         <span className="font-medium text-sm hidden lg:block">Consultor IA</span>
                      </div>
                   </div>

                   <div className="pt-4 border-t border-gray-800/50">
                      <div className="flex items-center gap-3 px-3 py-3 bg-gradient-to-r from-[#d97757]/10 to-transparent border border-[#d97757]/20 rounded-xl">
                         <Bot size={20} className="text-[#d97757]" />
                         <div className="hidden lg:block">
                            <p className="text-xs font-bold text-white">Novo c/ IA</p>
                            <p className="text-[10px] text-gray-500">Digite para lançar</p>
                         </div>
                      </div>
                   </div>
                </div>
             </div>

             {/* 2. Main Content */}
             <div className="flex-1 bg-[#0f100f] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="h-16 border-b border-gray-800 flex items-center justify-between px-8 bg-[#0f100f]/80 backdrop-blur-sm sticky top-0 z-10">
                   <div>
                      <h2 className="font-bold text-lg">Dashboard</h2>
                      <p className="text-xs text-gray-500">Bem-vindo de volta, Carlos</p>
                   </div>
                   <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 border border-gray-700 shadow-inner"></div>
                   </div>
                </div>

                {/* Dashboard Body */}
                <div className="p-8 overflow-hidden flex-1">
                   {/* Stats Row */}
                   <div className="grid grid-cols-3 gap-6 mb-8">
                      <div className="bg-[#161716] p-5 rounded-xl border border-gray-800 shadow-sm relative overflow-hidden">
                         <p className="text-xs text-gray-400 font-medium mb-1">Saldo Total</p>
                         <p className="text-2xl font-bold text-white">R$ 12.450,20</p>
                         <div className="absolute right-4 top-4 p-2 bg-blue-900/20 rounded-lg text-blue-400">
                            <Wallet size={20} />
                         </div>
                      </div>
                      <div className="bg-[#161716] p-5 rounded-xl border border-gray-800 shadow-sm relative overflow-hidden">
                         <p className="text-xs text-gray-400 font-medium mb-1">Receitas</p>
                         <p className="text-2xl font-bold text-green-400">+ R$ 8.200,00</p>
                         <div className="absolute right-4 top-4 p-2 bg-green-900/20 rounded-lg text-green-400">
                            <TrendingUp size={20} />
                         </div>
                      </div>
                      <div className="bg-[#161716] p-5 rounded-xl border border-gray-800 shadow-sm relative overflow-hidden">
                         <p className="text-xs text-gray-400 font-medium mb-1">Despesas</p>
                         <p className="text-2xl font-bold text-red-400">- R$ 3.420,50</p>
                         <div className="absolute right-4 top-4 p-2 bg-red-900/20 rounded-lg text-red-400">
                            <TrendingDown size={20} />
                         </div>
                      </div>
                   </div>

                   {/* Chart & Table Mock */}
                   <div className="grid grid-cols-3 gap-6 h-full">
                      {/* Chart Area */}
                      <div className="col-span-2 bg-[#161716] border border-gray-800 rounded-xl p-6 flex flex-col">
                         <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-gray-300 text-sm">Fluxo de Caixa</h3>
                            <div className="flex gap-2">
                               <div className="w-3 h-3 rounded-full bg-green-500"></div>
                               <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            </div>
                         </div>
                         <div className="flex-1 flex items-end justify-between gap-4 px-2 pb-2">
                            {[60, 40, 75, 50, 80, 35, 90, 60, 85, 45, 95, 70].map((h, i) => (
                               <div key={i} className="w-full bg-gray-800 rounded-t-sm relative group">
                                  <div 
                                    className="absolute bottom-0 left-0 w-full bg-[#d97757] rounded-t-sm opacity-80 group-hover:opacity-100 transition-all" 
                                    style={{ height: `${h}%`}}
                                  ></div>
                               </div>
                            ))}
                         </div>
                      </div>

                      {/* Recent Transactions List */}
                      <div className="col-span-1 bg-[#161716] border border-gray-800 rounded-xl p-0 overflow-hidden flex flex-col">
                         <div className="p-4 border-b border-gray-800 bg-[#1a1b1a]">
                            <h3 className="font-bold text-gray-300 text-sm">Recentes</h3>
                         </div>
                         <div className="flex-1 p-2 space-y-1">
                            {[
                              { d: 'Uber', v: '- 24,90', c: 'Transporte', i: <Briefcase size={14}/> },
                              { d: 'Salário', v: '+ 4.500,00', c: 'Renda', i: <DollarSign size={14}/>, pos: true },
                              { d: 'Netflix', v: '- 55,90', c: 'Lazer', i: <Tag size={14}/> },
                              { d: 'Mercado', v: '- 420,15', c: 'Alim.', i: <Tag size={14}/> },
                              { d: 'Academia', v: '- 120,00', c: 'Saúde', i: <Tag size={14}/> },
                            ].map((t, i) => (
                               <div key={i} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-800/50 transition-colors cursor-default">
                                  <div className="flex items-center gap-3">
                                     <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center text-gray-400">
                                        {t.i}
                                     </div>
                                     <div>
                                        <p className="text-sm font-medium text-gray-200">{t.d}</p>
                                        <p className="text-[10px] text-gray-500">{t.c}</p>
                                     </div>
                                  </div>
                                  <span className={`text-xs font-mono font-bold ${t.pos ? 'text-green-400' : 'text-red-400'}`}>
                                     {t.v}
                                  </span>
                               </div>
                            ))}
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};

// --- COMPONENTE: PARTNERS STRIP ---
const PartnersStrip = () => (
  <div className="border-y border-white/5 bg-black/20 backdrop-blur-sm py-10">
     <div className="max-w-7xl mx-auto px-6 text-center">
        <p className="text-sm text-gray-500 uppercase tracking-widest mb-8 font-medium">
           Tecnologia segura confiada por profissionais de
        </p>
        <div className="flex flex-wrap justify-center gap-12 lg:gap-20 grayscale opacity-50 hover:opacity-100 transition-all duration-500">
           {/* Using Text as Logos with specific fonts/styles for mock purposes */}
           <div className="flex items-center gap-2 font-bold text-xl text-white"><div className="w-6 h-6 bg-white rounded-full"></div>TechFlow</div>
           <div className="flex items-center gap-2 font-bold text-xl text-white"><div className="w-6 h-6 border-2 border-white rounded-sm"></div>BankIO</div>
           <div className="flex items-center gap-2 font-bold text-xl text-white"><div className="w-0 h-0 border-l-[10px] border-l-transparent border-b-[16px] border-b-white border-r-[10px] border-r-transparent"></div>Vanguard</div>
           <div className="flex items-center gap-2 font-bold text-xl text-white"><div className="w-6 h-6 rounded-full border-2 border-white border-dashed"></div>SecurePay</div>
           <div className="flex items-center gap-2 font-bold text-xl text-white"><div className="w-6 h-6 bg-white rotate-45"></div>NovaFin</div>
        </div>
     </div>
  </div>
);

// --- COMPONENTE: FAQ (ACCORDIONS) ---
const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  
  const faqs = [
    { q: "Meus dados bancários estão seguros?", a: "Absolutamente. Utilizamos criptografia AES-256 de ponta a ponta. Seus dados são armazenados localmente no seu dispositivo quando possível e nunca vendemos suas informações para terceiros." },
    { q: "Como a IA categoriza meus gastos?", a: "Nossa IA analisa o texto natural que você digita (ex: 'Almoço R$ 40'). Ela identifica padrões, palavras-chave e contexto para atribuir a categoria correta (Alimentação), a data e o valor automaticamente." },
    { q: "Posso compartilhar com minha família?", a: "Sim! O plano 'Family' permite adicionar múltiplos membros, ver gráficos consolidados e criar metas de economia em conjunto, mantendo a privacidade de gastos individuais se desejado." },
    { q: "Preciso conectar minha conta bancária?", a: "Não. O Finanças.ai funciona com input manual inteligente. Isso garante maior privacidade e evita problemas de conexão com bancos. Você digita ou fala, e nós organizamos." }
  ];

  return (
    <div className="max-w-3xl mx-auto flex flex-col items-center">
       <div className="w-full relative z-10">
         {faqs.map((faq, i) => (
           <div key={i} className="mb-4 border border-gray-800 rounded-2xl bg-[#1a1a19] overflow-hidden">
              <button 
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left focus:outline-none hover:bg-gray-800/50 transition-colors"
              >
                 <span className={`font-bold ${openIndex === i ? 'text-[#d97757]' : 'text-gray-200'}`}>{faq.q}</span>
                 <ChevronDown size={20} className={`text-gray-500 transition-transform duration-300 ${openIndex === i ? 'rotate-180' : ''}`} />
              </button>
              <div 
                className={`transition-all duration-300 ease-in-out overflow-hidden ${openIndex === i ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}
              >
                 <div className="p-5 pt-0 text-gray-400 leading-relaxed border-t border-gray-800/50 mt-2">
                    {faq.a}
                 </div>
              </div>
           </div>
         ))}
       </div>
    </div>
  );
};

// --- COMPONENTE: PLANOS (PRICING) ---
const PricingSection = () => {
  return (
    <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
       {/* Free */}
       <div className="bg-[#1a1a19] border border-gray-800 rounded-3xl p-8 flex flex-col relative hover:border-gray-600 transition-colors">
          <h3 className="text-xl font-bold text-white mb-2">Starter</h3>
          <p className="text-gray-500 text-sm mb-6">Para quem está começando a se organizar.</p>
          <div className="mb-6">
             <span className="text-4xl font-bold text-white">R$ 0</span>
             <span className="text-gray-500">/mês</span>
          </div>
          <ul className="space-y-4 mb-8 flex-1">
             <li className="flex items-center gap-3 text-sm text-gray-300"><Check size={16} className="text-gray-500"/> Lançamentos Manuais</li>
             <li className="flex items-center gap-3 text-sm text-gray-300"><Check size={16} className="text-gray-500"/> Dashboards Básicos</li>
             <li className="flex items-center gap-3 text-sm text-gray-300"><Check size={16} className="text-gray-500"/> 1 Usuário</li>
          </ul>
          <button className="w-full py-3 rounded-xl border border-gray-700 text-white font-bold hover:bg-gray-800 transition-colors">
             Começar Grátis
          </button>
       </div>

       {/* Pro */}
       <div className="bg-gray-900 border border-[#d97757] rounded-3xl p-8 flex flex-col relative shadow-2xl shadow-[#d97757]/10 transform md:-translate-y-4">
          <div className="absolute top-0 right-0 bg-[#d97757] text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-2xl">
             MAIS POPULAR
          </div>
          <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
             Pro <Sparkles size={16} className="text-[#d97757]" />
          </h3>
          <p className="text-gray-400 text-sm mb-6">Poder total da IA para suas finanças.</p>
          <div className="mb-6">
             <span className="text-4xl font-bold text-white">R$ 29</span>
             <span className="text-gray-500">/mês</span>
          </div>
          <ul className="space-y-4 mb-8 flex-1">
             <li className="flex items-center gap-3 text-sm text-white"><CheckCircle size={16} className="text-[#d97757]"/> <span className="font-bold">IA Integrada ilimitada</span></li>
             <li className="flex items-center gap-3 text-sm text-white"><CheckCircle size={16} className="text-[#d97757]"/> Lançamentos por Texto</li>
             <li className="flex items-center gap-3 text-sm text-white"><CheckCircle size={16} className="text-[#d97757]"/> Consultor Financeiro IA</li>
             <li className="flex items-center gap-3 text-sm text-white"><CheckCircle size={16} className="text-[#d97757]"/> Metas e Lembretes</li>
          </ul>
          <button className="w-full py-3 rounded-xl bg-[#d97757] hover:bg-[#c56a4d] text-white font-bold transition-colors shadow-lg shadow-[#d97757]/25">
             Assinar Pro
          </button>
       </div>

       {/* Family */}
       <div className="bg-[#1a1a19] border border-gray-800 rounded-3xl p-8 flex flex-col relative hover:border-gray-600 transition-colors">
          <h3 className="text-xl font-bold text-white mb-2">Family</h3>
          <p className="text-gray-500 text-sm mb-6">Gestão completa para toda a casa.</p>
          <div className="mb-6">
             <span className="text-4xl font-bold text-white">R$ 49</span>
             <span className="text-gray-500">/mês</span>
          </div>
          <ul className="space-y-4 mb-8 flex-1">
             <li className="flex items-center gap-3 text-sm text-gray-300"><Check size={16} className="text-[#d97757]"/> Tudo do plano Pro</li>
             <li className="flex items-center gap-3 text-sm text-gray-300"><Check size={16} className="text-[#d97757]"/> Até 5 Membros</li>
             <li className="flex items-center gap-3 text-sm text-gray-300"><Check size={16} className="text-[#d97757]"/> Metas Compartilhadas</li>
             <li className="flex items-center gap-3 text-sm text-gray-300"><Check size={16} className="text-[#d97757]"/> Relatórios Unificados</li>
          </ul>
          <button className="w-full py-3 rounded-xl border border-gray-700 text-white font-bold hover:bg-gray-800 transition-colors">
             Assinar Family
          </button>
       </div>
    </div>
  );
};

// --- PÁGINA PRINCIPAL ---
export const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#faf9f5] font-sans overflow-x-hidden selection:bg-[#d97757]/30">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
           <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-[#d97757] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#d97757]/20">
                 <FileSpreadsheet size={22} strokeWidth={2.5} />
              </div>
              <span className="font-bold text-xl tracking-tight">
                Finanças<span className="text-[#d97757]">.ai</span>
              </span>
           </div>
           <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
              <a href="#features" className="hover:text-white transition-colors">Recursos</a>
              <a href="#system" className="hover:text-white transition-colors">Sistema</a>
              <a href="#pricing" className="hover:text-white transition-colors">Planos</a>
           </div>
           <div className="flex items-center gap-4">
              <button onClick={onLogin} className="text-sm font-bold text-gray-300 hover:text-white hidden sm:block">
                 Login
              </button>
              <button onClick={onLogin} className="px-6 py-2.5 bg-white text-black rounded-full font-bold text-sm hover:bg-gray-200 transition-colors shadow-lg shadow-white/10">
                 Começar
              </button>
           </div>
        </div>
      </nav>

      {/* Hero Section - REMOVED BACKGROUND BLURS */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6 overflow-hidden bg-[#0a0a0a]">
         <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center relative z-10">
            
            {/* Left: Content */}
            <div className="text-center lg:text-left relative z-20">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#d97757]/10 border border-[#d97757]/20 text-[#d97757] text-sm font-bold mb-8 animate-fade-in-up">
                  <Sparkles size={14} />
                  <span>Inteligência Artificial Financeira v2.0</span>
                </div>
                
                <h1 className="text-5xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1] animate-fade-in-up" style={{animationDelay: '0.1s'}}>
                  O fim das <br/>
                  planilhas chatas.
                </h1>
                
                <p className="text-xl text-gray-400 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed animate-fade-in-up" style={{animationDelay: '0.2s'}}>
                  Apenas diga o que gastou. Nossa IA categoriza, organiza e gera insights para você assumir o controle do seu dinheiro sem esforço.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center lg:items-start gap-4 animate-fade-in-up" style={{animationDelay: '0.3s'}}>
                  <button onClick={onLogin} className="w-full sm:w-auto px-8 py-4 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-2xl font-bold text-lg transition-all shadow-xl shadow-[#d97757]/30 flex items-center justify-center gap-2 group hover:-translate-y-1">
                      Criar Conta Grátis
                      <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button onClick={onLogin} className="w-full sm:w-auto px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white rounded-2xl font-bold text-lg transition-all border border-gray-700 flex items-center justify-center gap-2">
                      Ver Demo
                  </button>
                </div>
                
                <div className="mt-8 flex items-center justify-center lg:justify-start gap-6 text-sm text-gray-500 animate-fade-in-up" style={{animationDelay: '0.4s'}}>
                   <div className="flex items-center gap-2"><CheckCircle size={16} className="text-gray-600" /> Sem cartão necessário</div>
                   <div className="flex items-center gap-2"><Users size={16} className="text-gray-600" /> +10k Usuários</div>
                </div>
            </div>

            {/* Right: Interactive AI Demo */}
            <div className="relative">
               <AIInteractiveDemo />
            </div>
         </div>
      </section>

      {/* Partners Strip */}
      <PartnersStrip />

      {/* System Preview Section */}
      <section id="system" className="py-32 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 relative z-10">
             
             <div className="flex flex-col items-center text-center max-w-3xl mx-auto mb-12">
                <h2 className="text-3xl lg:text-5xl font-bold mb-6 tracking-tight relative z-10">Um sistema completo. <br/>E incrivelmente simples.</h2>
                <p className="text-gray-400 text-lg relative z-10">
                   Não é apenas um chat. É um dashboard financeiro profissional construído automaticamente pelas suas conversas.
                </p>
             </div>

             <RealisticDashboardPreview />
             
             {/* Feature Strip */}
             <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-8 pt-12">
                <div className="text-center p-6 bg-[#1a1a19] rounded-2xl border border-gray-800">
                   <div className="text-3xl font-bold text-white mb-1">100%</div>
                   <div className="text-sm text-gray-500 font-medium uppercase">Automático</div>
                </div>
                <div className="text-center p-6 bg-[#1a1a19] rounded-2xl border border-gray-800">
                   <div className="text-3xl font-bold text-white mb-1">AES-256</div>
                   <div className="text-sm text-gray-500 font-medium uppercase">Criptografia</div>
                </div>
                <div className="text-center p-6 bg-[#1a1a19] rounded-2xl border border-gray-800">
                   <div className="text-3xl font-bold text-white mb-1">24/7</div>
                   <div className="text-sm text-gray-500 font-medium uppercase">Disponibilidade</div>
                </div>
                <div className="text-center p-6 bg-[#1a1a19] rounded-2xl border border-gray-800">
                   <div className="text-3xl font-bold text-white mb-1">iOS/Web</div>
                   <div className="text-sm text-gray-500 font-medium uppercase">Plataforma</div>
                </div>
             </div>
          </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 relative overflow-hidden bg-[#0f100f] border-t border-gray-900">
          <div className="max-w-7xl mx-auto px-6">
             
             <div className="flex flex-col items-center text-center max-w-2xl mx-auto mb-20">
                <div className="inline-block px-3 py-1 rounded-full bg-gray-800 border border-gray-700 text-xs font-bold text-gray-300 mb-4 uppercase tracking-wider relative z-10">Recursos</div>
                <h2 className="text-3xl lg:text-4xl font-bold mb-6 relative z-10">Tudo o que você precisa para <br/>prosperar financeiramente</h2>
             </div>
             
             <div className="grid lg:grid-cols-3 gap-8">
                {[
                  { icon: <BrainCircuit size={24} />, title: "Consultor IA", desc: "Pergunte 'Como posso economizar?' e receba planos de ação personalizados baseados nos seus dados." },
                  { icon: <TrendingUp size={24} />, title: "Projeções Futuras", desc: "Saiba se vai fechar o mês no azul antes mesmo dele acabar. Previsibilidade total." },
                  { icon: <Users size={24} />, title: "Modo Família", desc: "Junte as finanças da casa. Crie metas conjuntas enquanto mantém gastos pessoais privados." },
                  { icon: <Shield size={24} />, title: "Privacidade Total", desc: "Seus dados são apenas seus. Sem venda de informações, sem anúncios, segurança bancária." },
                  { icon: <Bell size={24} />, title: "Lembretes Inteligentes", desc: "Nunca mais pague juros. O sistema avisa quando contas estão prestes a vencer." },
                  { icon: <MessageSquare size={24} />, title: "Input Natural", desc: "Esqueça formulários chatos. Apenas digite como se estivesse conversando com um amigo." }
                ].map((f, i) => (
                   <div key={i} className="bg-[#1a1a19] p-8 rounded-3xl border border-gray-800 hover:border-[#d97757]/30 transition-all hover:-translate-y-1 group relative overflow-hidden">
                      <div className="w-12 h-12 rounded-2xl bg-gray-800/50 flex items-center justify-center text-[#d97757] mb-6 group-hover:scale-110 transition-transform border border-gray-700">
                         {f.icon}
                      </div>
                      <h3 className="text-xl font-bold mb-3 text-gray-100">{f.title}</h3>
                      <p className="text-gray-400 leading-relaxed text-sm">{f.desc}</p>
                   </div>
                ))}
             </div>
          </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 relative overflow-hidden">
         <div className="max-w-7xl mx-auto px-6 relative z-10">
            
            <div className="flex flex-col items-center text-center mb-16">
              <h2 className="text-3xl lg:text-5xl font-bold mb-4 relative z-10">Planos transparentes</h2>
              <p className="text-gray-400 relative z-10">Escolha a melhor forma de organizar sua vida.</p>
            </div>
            <PricingSection />
         </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 bg-[#0f100f] border-t border-gray-900">
         <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
               <h2 className="text-3xl font-bold mb-4">Perguntas Frequentes</h2>
            </div>
            <FAQSection />
         </div>
      </section>

      {/* CTA Final */}
      <section className="py-24 relative overflow-hidden bg-black">
         <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
            <h2 className="text-4xl lg:text-6xl font-bold mb-8 text-white tracking-tight">Pronto para assumir o controle?</h2>
            <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
               Junte-se a milhares de pessoas que pararam de brigar com planilhas e começaram a usar inteligência.
            </p>
            <button onClick={onLogin} className="px-12 py-6 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-full font-bold text-xl transition-all shadow-2xl shadow-[#d97757]/40 hover:scale-105 flex items-center gap-3 mx-auto group">
               Criar Conta Grátis
               <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform"/>
            </button>
         </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-16 bg-[#0a0a0a]">
         <div className="max-w-7xl mx-auto px-6">
            <div className="grid md:grid-cols-4 gap-12 mb-12">
               <div className="col-span-2">
                  <div className="flex items-center gap-2 mb-6">
                     <div className="w-8 h-8 bg-[#d97757] rounded-lg flex items-center justify-center text-white">
                        <FileSpreadsheet size={18} strokeWidth={2.5} />
                     </div>
                     <span className="font-bold text-xl">Finanças.ai</span>
                  </div>
                  <p className="text-gray-500 max-w-xs mb-6">
                     A plataforma de gestão financeira pessoal mais inteligente do mercado. Simples, rápida e segura.
                  </p>
                  <div className="flex gap-4">
                     <a href="#" className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"><Instagram size={18} /></a>
                     <a href="#" className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"><Twitter size={18} /></a>
                     <a href="#" className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"><Linkedin size={18} /></a>
                  </div>
               </div>
               
               <div>
                  <h4 className="font-bold text-white mb-6">Produto</h4>
                  <ul className="space-y-4 text-sm text-gray-500">
                     <li><a href="#" className="hover:text-[#d97757] transition-colors">Recursos</a></li>
                     <li><a href="#" className="hover:text-[#d97757] transition-colors">Segurança</a></li>
                     <li><a href="#" className="hover:text-[#d97757] transition-colors">Planos</a></li>
                     <li><a href="#" className="hover:text-[#d97757] transition-colors">Changelog</a></li>
                  </ul>
               </div>

               <div>
                  <h4 className="font-bold text-white mb-6">Empresa</h4>
                  <ul className="space-y-4 text-sm text-gray-500">
                     <li><a href="#" className="hover:text-[#d97757] transition-colors">Sobre nós</a></li>
                     <li><a href="#" className="hover:text-[#d97757] transition-colors">Carreiras</a></li>
                     <li><a href="#" className="hover:text-[#d97757] transition-colors">Blog</a></li>
                     <li><a href="#" className="hover:text-[#d97757] transition-colors">Contato</a></li>
                  </ul>
               </div>
            </div>
            
            <div className="pt-8 border-t border-gray-900 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-600">
               <div>© 2025 Finanças.ai Pro. Todos os direitos reservados.</div>
               <div className="flex gap-6">
                  <a href="#" className="hover:text-gray-400">Privacidade</a>
                  <a href="#" className="hover:text-gray-400">Termos</a>
               </div>
            </div>
         </div>
      </footer>
    </div>
  );
};
