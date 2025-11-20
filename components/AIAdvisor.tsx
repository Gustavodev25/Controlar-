
import React, { useState } from 'react';
import { Transaction } from '../types';
import { analyzeFinances } from '../services/geminiService';
import { 
  BrainCircuit, 
  Sparkles, 
  Lightbulb, 
  Target, 
  FileText, 
  ArrowRight, 
  Bot,
  TrendingUp,
  TrendingDown,
  Check
} from './Icons';

interface AIAdvisorProps {
  transactions: Transaction[];
}

export const AIAdvisor: React.FC<AIAdvisorProps> = ({ transactions }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentFocus, setCurrentFocus] = useState<'general' | 'savings' | 'future' | null>(null);

  const handleAnalyze = async (focus: 'general' | 'savings' | 'future') => {
    setIsAnalyzing(true);
    setCurrentFocus(focus);
    setAnalysis(null);
    
    try {
      const result = await analyzeFinances(transactions, focus);
      setAnalysis(result.analysis);
    } catch (error) {
      setAnalysis("Desculpe, tive um problema ao analisar seus dados. Tente novamente.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Simple Markdown Parser to make the text look beautiful
  const renderMarkdown = (text: string) => {
    if (!text) return null;

    const lines = text.split('\n');
    
    return lines.map((line, index) => {
      if (line.startsWith('###')) {
        return <h3 key={index} className="text-lg font-bold text-[#d97757] mt-6 mb-3 border-b border-[#d97757]/20 pb-1">{line.replace('###', '').trim()}</h3>;
      }
      if (line.startsWith('##')) {
        return <h2 key={index} className="text-xl font-bold text-white mt-8 mb-4">{line.replace('##', '').trim()}</h2>;
      }
      if (line.trim().startsWith('- ')) {
        const content = line.trim().substring(2);
        const parts = content.split(/(\*\*.*?\*\*)/g);
        return (
          <li key={index} className="ml-4 mb-2 text-gray-300 list-disc marker:text-[#d97757] pl-2">
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="text-gray-100 font-semibold">{part.replace(/\*\*/g, '')}</strong>;
              }
              return part;
            })}
          </li>
        );
      }
      if (line.trim() === '') {
        return <div key={index} className="h-2"></div>;
      }
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <p key={index} className="text-gray-300 mb-2 leading-relaxed">
          {parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={i} className="text-[#e68e70] font-semibold">{part.replace(/\*\*/g, '')}</strong>;
            }
            return part;
          })}
        </p>
      );
    });
  };

  return (
    <div className="w-full h-full p-0 lg:p-6 animate-fade-in flex flex-col gap-6">
      
      {/* Header Section */}
      <div className="mb-2 text-center lg:text-left shrink-0">
        <h2 className="text-2xl font-bold text-white flex items-center justify-center lg:justify-start gap-3 mb-2">
          <div className="p-2 bg-[#d97757]/20 rounded-lg shadow-lg shadow-[#d97757]/10 border border-[#d97757]/20">
            <BrainCircuit size={24} className="text-[#d97757]" />
          </div>
          Consultor IA
        </h2>
        <p className="text-gray-400 max-w-2xl">
          Inteligência Artificial para analisar seus dados e gerar relatórios personalizados.
        </p>
      </div>

      {/* Main Interaction Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">
        
        {/* Left Sidebar: Controls */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Action Buttons */}
          <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-800 p-5 shadow-lg sticky top-0">
             <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Gerar Relatório</h3>
             
             <div className="space-y-3">
               <button 
                 onClick={() => handleAnalyze('general')}
                 disabled={isAnalyzing}
                 className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${currentFocus === 'general' && isAnalyzing ? 'bg-[#d97757]/20 border-[#d97757] text-[#e68e70]' : 'bg-gray-800/50 border-gray-700/50 text-gray-300 hover:bg-gray-800 hover:border-gray-600'}`}
               >
                 <span className="flex items-center gap-2 font-medium text-sm">
                   <Sparkles size={16} /> Visão Geral
                 </span>
                 {currentFocus === 'general' && isAnalyzing && <div className="w-4 h-4 border-2 border-[#d97757] border-t-transparent rounded-full animate-spin"></div>}
               </button>

               <button 
                 onClick={() => handleAnalyze('savings')}
                 disabled={isAnalyzing}
                 className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${currentFocus === 'savings' && isAnalyzing ? 'bg-[#d97757]/20 border-[#d97757] text-[#e68e70]' : 'bg-gray-800/50 border-gray-700/50 text-gray-300 hover:bg-gray-800 hover:border-gray-600'}`}
               >
                 <span className="flex items-center gap-2 font-medium text-sm">
                   <TrendingDown size={16} /> Economia
                 </span>
                 {currentFocus === 'savings' && isAnalyzing && <div className="w-4 h-4 border-2 border-[#d97757] border-t-transparent rounded-full animate-spin"></div>}
               </button>

               <button 
                 onClick={() => handleAnalyze('future')}
                 disabled={isAnalyzing}
                 className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${currentFocus === 'future' && isAnalyzing ? 'bg-[#d97757]/20 border-[#d97757] text-[#e68e70]' : 'bg-gray-800/50 border-gray-700/50 text-gray-300 hover:bg-gray-800 hover:border-gray-600'}`}
               >
                 <span className="flex items-center gap-2 font-medium text-sm">
                   <TrendingUp size={16} /> Projeção
                 </span>
                 {currentFocus === 'future' && isAnalyzing && <div className="w-4 h-4 border-2 border-[#d97757] border-t-transparent rounded-full animate-spin"></div>}
               </button>
             </div>
          </div>

          {/* Capabilities Cards */}
          {!analysis && (
            <div className="grid gap-3 opacity-60 hover:opacity-100 transition-opacity">
              <div className="bg-gray-900/30 border border-gray-800/50 p-4 rounded-xl flex items-center gap-3">
                  <div className="p-2 bg-gray-800 rounded-lg text-gray-400 shrink-0"><FileText size={16} /></div>
                  <div>
                    <h4 className="font-semibold text-gray-300 text-xs">Resumos</h4>
                    <p className="text-[10px] text-gray-500">Entenda seus gastos do mês.</p>
                  </div>
              </div>
              <div className="bg-gray-900/30 border border-gray-800/50 p-4 rounded-xl flex items-center gap-3">
                  <div className="p-2 bg-gray-800 rounded-lg text-gray-400 shrink-0"><Lightbulb size={16} /></div>
                  <div>
                    <h4 className="font-semibold text-gray-300 text-xs">Dicas</h4>
                    <p className="text-[10px] text-gray-500">Sugestões para economizar.</p>
                  </div>
              </div>
              <div className="bg-gray-900/30 border border-gray-800/50 p-4 rounded-xl flex items-center gap-3">
                  <div className="p-2 bg-gray-800 rounded-lg text-gray-400 shrink-0"><Target size={16} /></div>
                  <div>
                    <h4 className="font-semibold text-gray-300 text-xs">Metas</h4>
                    <p className="text-[10px] text-gray-500">Planejamento futuro.</p>
                  </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Content: Results - IMPROVED VISUALS */}
        <div className="lg:col-span-9 h-full min-h-[400px] flex flex-col">
          <div className="bg-[#262726] rounded-2xl border border-gray-800/60 p-8 relative shadow-2xl overflow-hidden flex-1 flex flex-col">
             
             {/* Subtle Gradient Background to fix "Black Hole" look */}
             <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-[#262726] to-gray-900 pointer-events-none"></div>
             
             {/* Decorative Orbs */}
             <div className="absolute top-0 right-0 w-96 h-96 bg-[#d97757]/5 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none"></div>
             <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-900/5 rounded-full blur-[80px] -ml-16 -mb-16 pointer-events-none"></div>

             {/* Content Logic */}
             {!analysis && !isAnalyzing && (
                <div className="relative z-10 h-full flex flex-col items-center justify-center text-center p-4">
                   <div className="w-24 h-24 bg-gray-800/40 rounded-3xl flex items-center justify-center mb-6 border border-gray-700/50 shadow-xl backdrop-blur-sm">
                     <Bot size={40} className="text-gray-500" />
                   </div>
                   <h3 className="text-xl font-bold text-gray-200 mb-2">Nenhum relatório gerado</h3>
                   <p className="max-w-sm text-sm text-gray-500 mb-8 leading-relaxed">
                     Selecione uma das opções no menu lateral para que a IA analise suas transações e gere insights financeiros.
                   </p>
                </div>
             )}

             {isAnalyzing && (
               <div className="relative z-10 h-full flex flex-col items-center justify-center text-center p-4">
                  <div className="relative w-20 h-20 mb-6">
                    <div className="absolute inset-0 rounded-full border-4 border-gray-800"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-[#d97757] border-t-transparent animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <BrainCircuit size={24} className="text-[#d97757]" />
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Analisando dados...</h3>
                  <p className="text-gray-400 text-sm max-w-xs">
                    Verificando transações e calculando métricas.
                  </p>
               </div>
             )}

             {analysis && !isAnalyzing && (
               <div className="relative z-10 animate-slide-up h-full flex flex-col">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-6 shrink-0">
                    <div className="flex items-center gap-3">
                       <div className="p-1.5 bg-green-500/10 rounded-lg border border-green-500/20">
                         <Check size={16} className="text-green-400" />
                       </div>
                       <span className="text-sm font-medium text-green-400 uppercase tracking-wide">Relatório Concluído</span>
                    </div>
                    <span className="text-xs text-gray-500 font-mono">{new Date().toLocaleDateString()}</span>
                  </div>
                  
                  <div className="prose prose-invert max-w-none overflow-y-auto no-scrollbar flex-1">
                    {renderMarkdown(analysis)}
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-800 flex justify-end opacity-70 shrink-0">
                    <button 
                      onClick={() => setAnalysis(null)}
                      className="text-xs font-medium text-gray-400 hover:text-white flex items-center gap-1 transition-colors px-3 py-2 rounded-lg hover:bg-gray-800"
                    >
                      Nova Consulta <ArrowRight size={12} />
                    </button>
                  </div>
               </div>
             )}
          </div>
        </div>

      </div>
    </div>
  );
};
