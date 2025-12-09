import React, { useState, useEffect, useMemo } from 'react';
import {
  Send,
  Trash2,
  Save,
  LayoutDashboard,
  Type,
  Link,
  ImageIcon,
  Bold,
  Italic,
  Eye,
  Mail,
  Users,
  User as UserIcon,
  Underline,
  Strikethrough,
  List,
  Search,
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify
} from './Icons';
import { Logo } from './Logo';
import { User } from '../types';
import { getAllUsers } from '../services/database';
import { CustomSelect } from './UIComponents';

interface AdminEmailMessageProps {
  currentUser?: User | null;
}

type AlignType = 'left' | 'center' | 'right' | 'justify';

const AdminEmailMessage: React.FC<AdminEmailMessageProps> = ({ currentUser }) => {
  // Data State
  const [allUsers, setAllUsers] = useState<(User & { id: string })[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // Form State
  const [subject, setSubject] = useState('Novidades do Controlar+!');
  const [title, setTitle] = useState('Descubra o novo recurso de IA');
  const [body, setBody] = useState('Olá,\n\nEstamos felizes em anunciar que agora você pode contar com a ajuda do nosso assistente financeiro inteligente.\n\nAproveite para organizar suas finanças de uma forma totalmente nova.');
  const [buttonText, setButtonText] = useState('Ver Agora');
  const [buttonLink, setButtonLink] = useState('https://app.controlarmais.com.br');
  
  // Alignment State
  const [headerAlign, setHeaderAlign] = useState<AlignType>('center');
  const [titleAlign, setTitleAlign] = useState<AlignType>('center');
  const [bodyAlign, setBodyAlign] = useState<AlignType>('left');

  const [recipientType, setRecipientType] = useState<'all' | 'pro' | 'starter' | 'waitlist' | 'specific'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');

  // Preview options
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Sending State
  const [isSending, setIsSending] = useState(false);

  // Formatting Logic
  const textAreaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleFormat = (type: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'list' | 'link') => {
    const textarea = textAreaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = body.substring(start, end);
    let newText = '';

    switch (type) {
      case 'bold':
        newText = `<b>${selectedText}</b>`;
        break;
      case 'italic':
        newText = `<i>${selectedText}</i>`;
        break;
      case 'underline':
        newText = `<u>${selectedText}</u>`;
        break;
      case 'strikethrough':
        newText = `<s>${selectedText}</s>`;
        break;
      case 'list':
        // Simple list wrapping. For better UX, could split by line and wrap each.
        // But for this simple editor, just wrapping the block is a good start.
        newText = `<ul>\n<li>${selectedText}</li>\n</ul>`;
        break;
      case 'link':
        newText = `<a href="#">${selectedText}</a>`;
        break;
    }

    const newBody = body.substring(0, start) + newText + body.substring(end);
    setBody(newBody);

    // Restore focus
    setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + newText.length, start + newText.length);
    }, 0);
  };

  // Fetch Users
  useEffect(() => {
    const loadUsers = async () => {
      setIsLoadingUsers(true);
      const users = await getAllUsers();
      setAllUsers(users);
      setIsLoadingUsers(false);
    };
    loadUsers();
  }, []);

  // Filter users for search
  const filteredUsers = useMemo(() => {
    if (!userSearchTerm) return [];
    return allUsers
        .filter(u => !selectedUserIds.includes(u.id))
        .filter(u => 
            (u.email?.toLowerCase().includes(userSearchTerm.toLowerCase())) ||
            (u.displayName?.toLowerCase().includes(userSearchTerm.toLowerCase()))
        )
        .slice(0, 5);
  }, [allUsers, userSearchTerm, selectedUserIds]);

  const selectedUsersList = useMemo(() => {
      return allUsers.filter(u => selectedUserIds.includes(u.id));
  }, [allUsers, selectedUserIds]);

  // Computed Recipients
  const recipientCount = useMemo(() => {
    if (!allUsers.length) return 0;
    switch (recipientType) {
        case 'all': return allUsers.length;
        case 'pro': return allUsers.filter(u => u.subscription?.plan === 'pro' || u.subscription?.plan === 'family').length;
        case 'starter': return allUsers.filter(u => !u.subscription?.plan || u.subscription?.plan === 'starter').length;
        case 'waitlist': return 0;
        case 'specific': return selectedUserIds.length;
        default: return 0;
    }
  }, [allUsers, recipientType, selectedUserIds]);

  // Send Email Logic
  const handleSendEmail = async () => {
    if (recipientCount === 0) {
        alert('Selecione pelo menos um destinatário.');
        return;
    }

    setIsSending(true);

    try {
        // Gather emails
        let targetUsers: User[] = [];
        switch (recipientType) {
            case 'all': 
                targetUsers = allUsers; 
                break;
            case 'pro': 
                targetUsers = allUsers.filter(u => u.subscription?.plan === 'pro' || u.subscription?.plan === 'family'); 
                break;
            case 'starter': 
                targetUsers = allUsers.filter(u => !u.subscription?.plan || u.subscription?.plan === 'starter'); 
                break;
            case 'specific': 
                targetUsers = selectedUsersList; 
                break;
            default: targetUsers = [];
        }

        const recipients = targetUsers.map(u => u.email).filter(Boolean); // Ensure valid emails

        if (recipients.length === 0) {
            alert('Nenhum email válido encontrado para o público selecionado.');
            setIsSending(false);
            return;
        }

        const payload = {
            recipients,
            subject,
            title,
            body,
            buttonText,
            buttonLink,
            headerAlign,
            titleAlign,
            bodyAlign
        };

        const response = await fetch('/api/admin/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            alert(`Sucesso! ${data.message}`);
        } else {
            alert(`Erro: ${data.error || 'Falha ao enviar.'}`);
        }

    } catch (error) {
        console.error('Send Error:', error);
        alert('Erro de conexão ao enviar email.');
    } finally {
        setIsSending(false);
    }
  };

  // UI Components for Alignment
  const AlignControls = ({ value, onChange, label, allowJustify = true }: { value: AlignType, onChange: (v: AlignType) => void, label?: string, allowJustify?: boolean }) => (
      <div className="flex items-center gap-2">
          {label && <span className="text-[10px] uppercase font-bold text-gray-500 mr-1">{label}</span>}
          <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800">
              <button onClick={() => onChange('left')} className={`p-1 rounded ${value === 'left' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`} title="Esquerda"><AlignLeft size={14} /></button>
              <button onClick={() => onChange('center')} className={`p-1 rounded ${value === 'center' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`} title="Centro"><AlignCenter size={14} /></button>
              <button onClick={() => onChange('right')} className={`p-1 rounded ${value === 'right' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`} title="Direita"><AlignRight size={14} /></button>
              {allowJustify && (
                <button onClick={() => onChange('justify')} className={`p-1 rounded ${value === 'justify' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`} title="Justificado"><AlignJustify size={14} /></button>
              )}
          </div>
      </div>
  );

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Mensagem Email</h2>
          <p className="text-gray-400 text-sm mt-1">Crie e visualize campanhas de email marketing.</p>
        </div>
        <div className="flex gap-3">
           <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors text-sm font-medium border border-gray-700">
              <Save size={16} />
              Salvar Rascunho
           </button>
           <button 
              onClick={handleSendEmail}
              disabled={isSending || recipientCount === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#d97757] text-white hover:bg-[#c56a4d] transition-colors text-sm font-bold shadow-lg shadow-[#d97757]/20 disabled:opacity-50 disabled:cursor-not-allowed"
           >
              {isSending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Enviando...
                  </>
              ) : (
                  <>
                    <Send size={16} />
                    Enviar ({recipientCount})
                  </>
              )}
           </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
        
        {/* Left Side: Editor */}
        <div className="flex-1 flex flex-col gap-4 bg-gray-950 border border-gray-800 rounded-2xl p-6 shadow-xl overflow-y-auto custom-scrollbar">
            
            {/* Sender & Recipient Config */}
            <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800 mb-2 space-y-4">
                {/* Sender */}
                <div className="flex justify-between items-start">
                    <div>
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                            <UserIcon size={12} /> Remetente
                        </label>
                        <div className="text-sm text-white font-medium bg-gray-900 px-3 py-2.5 rounded-lg border border-gray-800 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            {currentUser?.email || 'admin@controlarmais.com.br'}
                        </div>
                    </div>
                    {/* Header Alignment */}
                    <div className="flex flex-col items-end gap-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Logo/Header</label>
                        <AlignControls value={headerAlign} onChange={setHeaderAlign} allowJustify={false} />
                    </div>
                </div>

                {/* Recipient Selector */}
                <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        <Users size={12} /> Destinatários
                    </label>
                    <CustomSelect 
                        value={recipientType}
                        onChange={(val) => setRecipientType(val as any)}
                        options={[
                            { value: 'all', label: 'Todos os Usuários' },
                            { value: 'pro', label: 'Assinantes Premium (Pro/Family)' },
                            { value: 'starter', label: 'Usuários Grátis (Starter)' },
                            { value: 'waitlist', label: 'Lista de Espera (Em breve)' },
                            { value: 'specific', label: 'Selecionar Usuários (Específico)' }
                        ]}
                        className="w-full text-sm"
                    />
                    
                    {/* Specific User Selection UI */}
                    {recipientType === 'specific' && (
                        <div className="mt-3 bg-gray-950 border border-gray-800 rounded-xl p-3 animate-fade-in">
                            <div className="relative mb-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                                <input 
                                    type="text"
                                    value={userSearchTerm}
                                    onChange={(e) => setUserSearchTerm(e.target.value)}
                                    placeholder="Buscar por nome ou email..."
                                    className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:border-[#d97757] outline-none transition-colors placeholder-gray-600"
                                />
                                {filteredUsers.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-gray-900 border border-gray-800 rounded-lg shadow-xl overflow-hidden max-h-40 overflow-y-auto">
                                        {filteredUsers.map(user => (
                                            <button 
                                                key={user.id}
                                                onClick={() => {
                                                    setSelectedUserIds([...selectedUserIds, user.id]);
                                                    setUserSearchTerm('');
                                                }}
                                                className="w-full text-left px-3 py-2 hover:bg-gray-800 transition-colors flex flex-col gap-0.5 border-b border-gray-800 last:border-0"
                                            >
                                                <span className="text-xs font-bold text-white">{user.displayName || 'Sem nome'}</span>
                                                <span className="text-[10px] text-gray-500">{user.email}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                                {selectedUsersList.length === 0 ? (
                                    <p className="text-[10px] text-gray-600 italic px-1">Nenhum usuário selecionado.</p>
                                ) : (
                                    selectedUsersList.map(user => (
                                        <div key={user.id} className="bg-gray-800 text-gray-300 text-[10px] px-2 py-1 rounded-md flex items-center gap-1.5 border border-gray-700">
                                            <span>{user.email}</span>
                                            <button 
                                                onClick={() => setSelectedUserIds(selectedUserIds.filter(id => id !== user.id))}
                                                className="hover:text-white"
                                            >
                                                <X size={10} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    <p className="text-[10px] text-gray-500 mt-2 text-right">
                        {isLoadingUsers ? 'Calculando público...' : `Total de destinatários: ${recipientCount}`}
                    </p>
                </div>
            </div>

            <div className="h-px bg-gray-800 my-2"></div>

            <div className="flex items-center gap-2 text-[#d97757] font-bold uppercase text-xs tracking-widest mb-2">
                <Type size={14} /> Editor de Conteúdo
            </div>

            {/* Subject */}
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Assunto do Email</label>
                <input 
                    type="text" 
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white focus:border-[#d97757] outline-none transition-colors placeholder-gray-600"
                    placeholder="Ex: Novidades Incríveis..."
                />
            </div>

            {/* Title */}
            <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Título Principal</label>
                    <AlignControls value={titleAlign} onChange={setTitleAlign} />
                </div>
                <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white focus:border-[#d97757] outline-none transition-colors placeholder-gray-600"
                    placeholder="Ex: Bem-vindo ao futuro..."
                />
            </div>

            {/* Body */}
            <div className="flex-1 min-h-[200px] flex flex-col">
                <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Corpo da Mensagem</label>
                    <AlignControls value={bodyAlign} onChange={setBodyAlign} />
                </div>
                <textarea 
                    ref={textAreaRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="flex-1 w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-white focus:border-[#d97757] outline-none transition-colors placeholder-gray-600 resize-none leading-relaxed font-mono text-sm"
                    placeholder="Escreva sua mensagem aqui..."
                />
                <div className="flex gap-2 mt-2 flex-wrap">
                    <button 
                        onClick={() => handleFormat('bold')}
                        className="p-2 rounded bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors" 
                        title="Negrito (<b>)"
                    >
                        <Bold size={14} />
                    </button>
                    <button 
                        onClick={() => handleFormat('italic')}
                        className="p-2 rounded bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors" 
                        title="Itálico (<i>)"
                    >
                        <Italic size={14} />
                    </button>
                    <button 
                        onClick={() => handleFormat('underline')}
                        className="p-2 rounded bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors" 
                        title="Sublinhado (<u>)"
                    >
                        <Underline size={14} />
                    </button>
                    <button 
                        onClick={() => handleFormat('strikethrough')}
                        className="p-2 rounded bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors" 
                        title="Riscado (<s>)"
                    >
                        <Strikethrough size={14} />
                    </button>
                    <button 
                        onClick={() => handleFormat('list')}
                        className="p-2 rounded bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors" 
                        title="Lista (<ul>)"
                    >
                        <List size={14} />
                    </button>
                    <button 
                        onClick={() => handleFormat('link')}
                        className="p-2 rounded bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors" 
                        title="Link (<a>)"
                    >
                        <Link size={14} />
                    </button>
                </div>
            </div>

            {/* Button Options */}
            <div className="grid grid-cols-2 gap-4 border-t border-gray-800 pt-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Texto do Botão</label>
                    <input 
                        type="text" 
                        value={buttonText}
                        onChange={(e) => setButtonText(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white focus:border-[#d97757] outline-none transition-colors placeholder-gray-600"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Link do Botão</label>
                    <input 
                        type="text" 
                        value={buttonLink}
                        onChange={(e) => setButtonLink(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white focus:border-[#d97757] outline-none transition-colors placeholder-gray-600"
                    />
                </div>
            </div>
        </div>

        {/* Right Side: Preview */}
        <div className="flex-1 flex flex-col bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden relative">
            {/* Preview Controls */}
            <div className="h-12 bg-gray-950 border-b border-gray-800 flex items-center justify-between px-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-wider">
                    <Eye size={14} /> Preview
                </div>
                <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800">
                    <button 
                        onClick={() => setPreviewDevice('desktop')}
                        className={`px-3 py-1 rounded text-xs font-medium transition-all ${previewDevice === 'desktop' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Desktop
                    </button>
                    <button 
                        onClick={() => setPreviewDevice('mobile')}
                        className={`px-3 py-1 rounded text-xs font-medium transition-all ${previewDevice === 'mobile' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Mobile
                    </button>
                </div>
            </div>

            {/* Preview Area Container */}
            <div className="flex-1 bg-gray-900/50 overflow-y-auto p-8 flex justify-center">
                
                {/* Email Canvas */}
                <div 
                    className={`bg-[#2F302E] text-white shadow-2xl transition-all duration-300 flex flex-col overflow-hidden border border-gray-700
                        ${previewDevice === 'mobile' ? 'w-[375px] rounded-[30px] my-auto min-h-[600px]' : 'w-[600px] rounded-lg my-8 min-h-[500px]'}
                    `}
                >
                    {/* Email Header - bg-[#363735] */}
                    <div className={`bg-[#363735] p-6 border-b border-gray-700 flex justify-${headerAlign === 'justify' ? 'between' : headerAlign}`}>
                        <Logo size={40} textClassName="text-2xl text-white" />
                    </div>

                    {/* Email Content */}
                    <div className="p-8 flex-1">
                        <h1 className={`text-2xl font-bold text-white mb-6 leading-tight text-${titleAlign}`}>
                            {title || 'Seu Título Aqui'}
                        </h1>
                        
                        <div 
                            className={`prose prose-invert max-w-none text-gray-300 leading-relaxed text-${bodyAlign}`}
                            dangerouslySetInnerHTML={{ 
                                __html: (body || 'O conteúdo do seu email aparecerá aqui...')
                                    .replace(/\n/g, '<br/>') 
                            }}
                        />

                        {/* CTA Button */}
                        <div className="mt-8 text-center">
                            <a 
                                href={buttonLink} 
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block bg-[#d97757] text-white font-bold py-3 px-8 rounded-full hover:bg-[#c56a4d] transition-colors no-underline shadow-md shadow-[#d97757]/20"
                            >
                                {buttonText || 'Clique Aqui'}
                            </a>
                        </div>
                    </div>

                    {/* Email Footer - bg-[#363735] */}
                    <div className="bg-[#363735] p-6 text-center text-xs text-gray-500 border-t border-gray-700">
                        <p>© {new Date().getFullYear()} Controlar+. Todos os direitos reservados.</p>
                        <p className="mt-2">
                            <a href="#" className="underline hover:text-gray-400">Descadastrar</a> • 
                            <a href="#" className="underline hover:text-gray-400 ml-2">Política de Privacidade</a>
                        </p>
                    </div>
                </div>

            </div>
        </div>

      </div>
    </div>
  );
};

export default AdminEmailMessage;
