import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, Building, AlertTriangle, Check, Loader2 } from './Icons';
import { useToasts } from './Toast';
import axios from 'axios';

interface BankConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: any) => void;
  userId: string;
}

type ConnectionStatus = 'idle' | 'connecting' | 'waiting_auth' | 'success' | 'error';

export const BankConnectModal: React.FC<BankConnectModalProps> = ({ isOpen, onClose, onSuccess, userId }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const toast = useToasts();

  // Animation Logic
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (isOpen) {
      setIsVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      timeoutId = setTimeout(() => {
        setIsVisible(false);
        setStatus('idle'); // Reset status on close
      }, 300);
    }
    return () => clearTimeout(timeoutId);
  }, [isOpen]);

  if (!isVisible) return null;

  const handleConnect = async () => {
    setStatus('connecting');
    try {
      // 1. Get the Link URL from Backend
      const redirectUri = window.location.origin;
      const response = await axios.post('/api/klavi/create-link', {
        redirectUri,
        userId
      });

      const { url } = response.data;

      if (!url) {
        throw new Error("URL de conexão não recebida.");
      }

      // 2. Open Popup
      const width = 600;
      const height = 700;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;

      const popup = window.open(
        url,
        'KlaviConnect',
        `width=${width},height=${height},top=${top},left=${left},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      );

      if (window.focus && popup) popup.focus();

      setStatus('waiting_auth');

      // 3. Listen for message from popup
      const handleMessage = (event: MessageEvent) => {
        const allowedOrigins = [
          window.location.origin,
          'https://schematically-oscitant-herbert.ngrok-free.dev'
        ];

        if (!allowedOrigins.includes(event.origin)) return;

        if (event.data && event.data.type === 'KLAVI_SUCCESS') {
          console.log("Success Message Received:", event.data);
          window.removeEventListener('message', handleMessage);
          setStatus('success');

          setTimeout(() => {
            onSuccess(event.data);
            handleClose();
          }, 1500);
        }
      };

      window.addEventListener('message', handleMessage);

      // Optional: Detect popup close (polling)
      const timer = setInterval(() => {
        if (popup && popup.closed) {
          clearInterval(timer);
          window.removeEventListener('message', handleMessage);
          if (status !== 'success') {
            // If closed without success
            setStatus('idle');
          }
        }
      }, 1000);

    } catch (error) {
      console.error("Erro ao iniciar conexão:", error);
      toast.error("Erro ao conectar com o banco via Klavi.");
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const handleClose = () => {
    if (status === 'waiting_auth') {
      if (confirm("Cancelar a conexão em andamento?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  return createPortal(
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ease-in-out ${isAnimating ? 'bg-black/90 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-0'}`}>
      <div className={`bg-gray-950 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-800 flex flex-col relative transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}`}>

        {/* Background Effects */}
        <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#d97757]/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gray-700/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
        </div>

        {/* Header */}
        <div className="p-5 border-b border-gray-800/50 flex justify-between items-center relative z-10">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building className="text-[#d97757]" size={24} />
            Conectar Banco
          </h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 relative z-10">

          {status === 'idle' && (
            <>
              <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
                <div className="flex gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg h-fit text-emerald-500">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-200 text-sm">Ambiente Seguro (Open Finance)</h3>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      Você será redirecionado para um ambiente seguro da Klavi para selecionar seu banco e autorizar o compartilhamento.
                    </p>
                  </div>
                </div>
              </div>

              <ul className="space-y-3 text-sm text-gray-400 px-2">
                <li className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d97757]"></span>
                  Importação automática de saldo e transações.
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d97757]"></span>
                  Suporte a Nubank, Itaú, Bradesco e +40 instituições.
                </li>
              </ul>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex gap-2 items-start">
                <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-200/80 leading-tight">
                  Pode ser necessário confirmar a autorização no app do seu banco.
                </p>
              </div>
            </>
          )}

          {status === 'connecting' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 size={48} className="text-[#d97757] animate-spin" />
              <p className="text-gray-300 font-medium">Iniciando conexão segura...</p>
            </div>
          )}

          {status === 'waiting_auth' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6 text-center">
              <div className="relative">
                <div className="absolute inset-0 bg-[#d97757]/20 rounded-full blur-xl animate-pulse"></div>
                <div className="relative bg-gray-900 p-4 rounded-full border border-gray-800">
                  <Building size={40} className="text-[#d97757]" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Janela de Conexão Aberta</h3>
                <p className="text-sm text-gray-400 mt-2 max-w-xs mx-auto">
                  Por favor, selecione seu banco e complete a autenticação na janela que se abriu.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-900 px-3 py-1.5 rounded-full border border-gray-800 animate-pulse">
                <Loader2 size={12} className="animate-spin" />
                Aguardando confirmação...
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center animate-scale-in">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 mb-2 ring-1 ring-emerald-500/50">
                <Check size={32} strokeWidth={3} />
              </div>
              <h3 className="text-2xl font-bold text-white">Conectado!</h3>
              <p className="text-gray-400">Sincronizando seus dados...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 mb-2">
                <X size={32} />
              </div>
              <h3 className="text-lg font-bold text-white">Erro na Conexão</h3>
              <p className="text-sm text-gray-400">Não foi possível conectar. Tente novamente.</p>
            </div>
          )}

        </div>

        {/* Footer */}
        {status === 'idle' && (
          <div className="p-6 border-t border-gray-800/50 bg-gray-900/30 flex justify-end gap-3 relative z-10">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConnect}
              className="px-6 py-2.5 bg-[#d97757] hover:bg-[#c56a4d] text-[#faf9f5] rounded-xl text-sm font-bold shadow-lg shadow-[#d97757]/20 transition-all flex items-center gap-2"
            >
              Conectar Agora
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
