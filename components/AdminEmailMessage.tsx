import React, { useState, useEffect, useMemo } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';
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
    AlignJustify,
    Bell,
    Sparkles,
    AlertTriangle,
    Info,
    Calendar,
    Upload
} from './Icons';
import { Logo } from './Logo';
import { User, AppNotification, PromoPopup } from '../types';
import { getAllUsers, addNotification, addPromoPopup, getWaitlistEntries, saveEmailDraft, getEmailDraft } from '../services/database';
import { CustomSelect } from './UIComponents';
import { useToasts } from './Toast';

interface AdminEmailMessageProps {
    currentUser?: (User & { id: string }) | null;
}

type AlignType = 'left' | 'center' | 'right' | 'justify';

export const AdminEmailMessage: React.FC<AdminEmailMessageProps> = ({ currentUser }) => {
    // Data State
    const [allUsers, setAllUsers] = useState<(User & { id: string })[]>([]);
    const [waitlistEntries, setWaitlistEntries] = useState<any[]>([]); // Store waitlist data
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const toast = useToasts();

    // Form State
    const [subject, setSubject] = useState('Novidades do Controlar+!');
    const [title, setTitle] = useState('Descubra o novo recurso de IA');
    const [body, setBody] = useState('Olá,\n\nEstamos felizes em anunciar que agora você pode contar com a ajuda do nosso assistente financeiro inteligente.\n\nAproveite para organizar suas finanças de uma forma totalmente nova.');
    const [boxContent, setBoxContent] = useState(''); // New state for highlighted content
    const [buttonText, setButtonText] = useState('Ver Agora');
    const [buttonLink, setButtonLink] = useState('https://app.controlarmais.com.br');

    // Alignment State
    const [headerAlign, setHeaderAlign] = useState<AlignType>('left');
    const [titleAlign, setTitleAlign] = useState<AlignType>('left');
    const [bodyAlign, setBodyAlign] = useState<AlignType>('left');

    const [recipientType, setRecipientType] = useState<'all' | 'pro' | 'starter' | 'waitlist' | 'specific'>('all');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [userSearchTerm, setUserSearchTerm] = useState('');

    // Preview options
    const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

    // Delivery Method State
    const [deliveryMethod, setDeliveryMethod] = useState<'email' | 'notification' | 'popup'>('notification');
    const [notificationType, setNotificationType] = useState<'system' | 'alert' | 'update'>('system');
    const [popupImageUrl, setPopupImageUrl] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
    // Fetch Users & Waitlist
    useEffect(() => {
        const loadData = async () => {
            setIsLoadingUsers(true);
            try {
                const [users, waitlist] = await Promise.all([
                    getAllUsers(),
                    getWaitlistEntries()
                ]);
                setAllUsers(users);
                setWaitlistEntries(waitlist);

                // Load Draft
                if (currentUser?.id) {
                    const draft = await getEmailDraft(currentUser.id);
                    if (draft) {
                        setSubject(draft.subject || '');
                        setTitle(draft.title || '');
                        setBody(draft.body || '');
                        setBoxContent(draft.boxContent || '');
                        setButtonText(draft.buttonText || '');
                        setButtonLink(draft.buttonLink || '');
                        setHeaderAlign(draft.headerAlign || 'left');
                        setTitleAlign(draft.titleAlign || 'left');
                        setBodyAlign(draft.bodyAlign || 'left');
                        setRecipientType(draft.recipientType || 'all');
                        setDeliveryMethod(draft.deliveryMethod || 'notification');
                        setNotificationType(draft.notificationType || 'system');
                        setPopupImageUrl(draft.popupImageUrl || '');
                        setSelectedUserIds(draft.selectedUserIds || []);

                        toast.info('Rascunho restaurado com sucesso.');
                    }
                }
            } catch (error) {
                console.error("Error loading data:", error);
                toast.error("Erro ao carregar dados.");
            } finally {
                setIsLoadingUsers(false);
            }
        };
        loadData();
    }, [currentUser]);

    // Save Draft Logic
    const handleSaveDraft = async () => {
        if (!currentUser?.id) return;

        try {
            const draftData = {
                subject,
                title,
                body,
                boxContent,
                buttonText,
                buttonLink,
                headerAlign,
                titleAlign,
                bodyAlign,
                recipientType,
                deliveryMethod,
                notificationType,
                popupImageUrl,
                selectedUserIds
            };

            await saveEmailDraft(currentUser.id, draftData);
            toast.success('Rascunho salvo com sucesso!');
        } catch (error) {
            console.error('Error saving draft:', error);
            toast.error('Erro ao salvar rascunho.');
        }
    };

    // Filter users for search
    const filteredUsers = useMemo(() => {
        if (!userSearchTerm) return [];
        return allUsers
            .filter(u => !selectedUserIds.includes(u.id))
            .filter(u =>
                (u.email?.toLowerCase().includes(userSearchTerm.toLowerCase())) ||
                (u.name?.toLowerCase().includes(userSearchTerm.toLowerCase()))
            )
            .slice(0, 5);
    }, [allUsers, userSearchTerm, selectedUserIds]);

    const selectedUsersList = useMemo(() => {
        return allUsers.filter(u => selectedUserIds.includes(u.id));
    }, [allUsers, selectedUserIds]);

    // Computed Recipients
    const recipientCount = useMemo(() => {
        // If loading, 0
        if (isLoadingUsers) return 0;

        switch (recipientType) {
            case 'all': return allUsers.length;
            case 'pro': return allUsers.filter(u => u.subscription?.plan === 'pro' || u.subscription?.plan === 'family').length;
            case 'starter': return allUsers.filter(u => !u.subscription?.plan || u.subscription?.plan === 'starter').length;
            case 'waitlist': return waitlistEntries.length;
            case 'specific': return selectedUserIds.length;
            default: return 0;
        }
    }, [allUsers, waitlistEntries, recipientType, selectedUserIds, isLoadingUsers]);

    // Send Message Logic (Email or Notification)
    const handleSend = async () => {
        if (recipientCount === 0) {
            toast.warning('Selecione pelo menos um destinatário.');
            return;
        }

        // Validation for Waitlist: Can only send EMAIL
        if (recipientType === 'waitlist' && deliveryMethod !== 'email') {
            toast.warning('Usuários da Lista de Espera não possuem conta no app. Envie apenas por Email.');
            return;
        }

        setIsSending(true);

        try {
            // Gather target users with their IDs
            let targetUsers: (Partial<User> & { id: string, email: string })[] = [];

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
                case 'waitlist':
                    // Map waitlist entries to a minimal user structure compatible with sending logic
                    targetUsers = waitlistEntries.map(entry => ({
                        id: entry.id,
                        email: entry.email,
                        name: entry.name,
                        // Add mock properties if needed for strict User typing, 
                        // but logic below only needs id and email mostly.
                    }));
                    break;
                case 'specific':
                    targetUsers = selectedUsersList;
                    break;
                default: targetUsers = [];
            }

            if (targetUsers.length === 0) {
                toast.warning('Nenhum usuário encontrado para o público selecionado.');
                setIsSending(false);
                return;
            }

            if (deliveryMethod === 'notification') {
                // Send in-app notifications
                let successCount = 0;
                let errorCount = 0;

                for (const user of targetUsers) {
                    try {
                        const notification: Omit<AppNotification, 'id'> = {
                            type: notificationType,
                            title: title,
                            message: body.replace(/\n/g, ' ').substring(0, 500), // Limit message length
                            date: new Date().toISOString(),
                            read: false,
                            archived: false
                        };

                        await addNotification(user.id, notification);
                        successCount++;
                    } catch (err) {
                        console.error(`Failed to send notification to user ${user.id}:`, err);
                        errorCount++;
                    }
                }

                if (errorCount === 0) {
                    toast.success(`Sucesso! ${successCount} notificações enviadas no sistema.`);
                } else {
                    toast.info(`Enviado: ${successCount} notificações. Falhas: ${errorCount}`);
                }
            } else if (deliveryMethod === 'popup') {
                // Send promo popups
                let successCount = 0;
                let errorCount = 0;
                let finalImageUrl = popupImageUrl;

                // Upload image if selected
                if (selectedFile) {
                    try {
                        const storageRef = ref(storage, `popups/${Date.now()}_${selectedFile.name}`);
                        await uploadBytes(storageRef, selectedFile);
                        finalImageUrl = await getDownloadURL(storageRef);
                    } catch (uploadError) {
                        console.error("Error uploading image:", uploadError);
                        toast.error("Erro ao fazer upload da imagem. O popup será enviado sem imagem.");
                        finalImageUrl = '';
                    }
                }

                // Map notificationType to popup type
                const popupType = notificationType === 'alert' ? 'promo' : notificationType === 'update' ? 'update' : 'info';

                for (const user of targetUsers) {
                    try {
                        const popup: Omit<PromoPopup, 'id'> = {
                            title: title,
                            message: body.replace(/\n/g, ' ').substring(0, 300),
                            imageUrl: finalImageUrl || null,
                            buttonText: buttonText || null,
                            buttonLink: buttonLink || null,
                            type: popupType,
                            dismissible: true,
                            createdAt: new Date().toISOString(),
                            dismissed: false
                        };

                        await addPromoPopup(user.id, popup);
                        successCount++;
                    } catch (err) {
                        console.error(`Failed to send popup to user ${user.id}:`, err);
                        errorCount++;
                    }
                }

                if (errorCount === 0) {
                    toast.success(`Sucesso! ${successCount} popups enviados.`);
                } else {
                    toast.info(`Enviado: ${successCount} popups. Falhas: ${errorCount}`);
                }
            } else {
                // Send Email
                const recipients = targetUsers.map(u => u.email).filter(Boolean);

                if (recipients.length === 0) {
                    toast.warning('Nenhum email válido encontrado para o público selecionado.');
                    setIsSending(false);
                    return;
                }

                const payload = {
                    recipients,
                    subject,
                    title,
                    body,
                    boxContent, // Include in payload
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
                    toast.success(`Sucesso! ${data.message}`);
                } else {
                    toast.error(`Erro: ${data.error || 'Falha ao enviar.'}`);
                }
            }

        } catch (error) {
            console.error('Send Error:', error);
            toast.error(`Erro de conexão ao enviar ${deliveryMethod === 'notification' ? 'notificação' : 'email'}.`);
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
                    <h2 className="text-2xl font-bold text-white tracking-tight">Mensagens</h2>
                    <p className="text-gray-400 text-sm mt-1">Envie notificações, popups ou comunicados para os usuários.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleSaveDraft}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors text-sm font-medium border border-gray-700"
                    >
                        <Save size={16} />
                        Salvar Rascunho
                    </button>
                    <button
                        onClick={handleSend}
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
                                {deliveryMethod === 'notification' ? <Bell size={16} /> : <Send size={16} />}
                                {deliveryMethod === 'notification' ? 'Notificar' : 'Enviar'} ({recipientCount})
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">

                {/* Left Side: Editor */}
                <div className="flex-1 flex flex-col gap-4 bg-gray-950 border border-gray-800 rounded-2xl p-6 shadow-xl overflow-y-auto custom-scrollbar">

                    {/* Delivery Method Selector - Outside the config card */}
                    <div className="mb-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                            <Send size={12} /> Método de Envio
                        </label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setDeliveryMethod('notification')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition-all text-sm font-medium ${deliveryMethod === 'notification'
                                    ? 'bg-[#d97757]/20 border-[#d97757] text-[#d97757]'
                                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-300'
                                    }`}
                            >
                                <Bell size={18} />
                                <div className="text-left">
                                    <div className="font-bold">Notificação</div>
                                    <div className="text-[10px] opacity-70">Central de avisos</div>
                                </div>
                            </button>
                            <button
                                onClick={() => setDeliveryMethod('popup')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition-all text-sm font-medium ${deliveryMethod === 'popup'
                                    ? 'bg-[#d97757]/20 border-[#d97757] text-[#d97757]'
                                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-300'
                                    }`}
                            >
                                <Sparkles size={18} />
                                <div className="text-left">
                                    <div className="font-bold">Popup</div>
                                    <div className="text-[10px] opacity-70">Modal com imagem</div>
                                </div>
                            </button>
                            <button
                                onClick={() => setDeliveryMethod('email')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition-all text-sm font-medium ${deliveryMethod === 'email'
                                    ? 'bg-[#d97757]/20 border-[#d97757] text-[#d97757]'
                                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-300'
                                    }`}
                            >
                                <Mail size={18} />
                                <div className="text-left">
                                    <div className="font-bold">Email</div>
                                    <div className="text-[10px] opacity-70">Campanha marketing</div>
                                </div>
                            </button>
                        </div>

                        {/* Notification Type - only show when notification is selected */}
                        {deliveryMethod === 'notification' && (
                            <div className="mt-3 animate-fade-in">
                                <label className="text-[10px] font-bold text-gray-600 uppercase mb-2 block">Tipo de Notificação</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setNotificationType('system')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${notificationType === 'system'
                                            ? 'bg-blue-500/20 border border-blue-500/50 text-blue-400'
                                            : 'bg-gray-900 border border-gray-800 text-gray-500 hover:text-gray-400'
                                            }`}
                                    >
                                        Sistema
                                    </button>
                                    <button
                                        onClick={() => setNotificationType('update')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${notificationType === 'update'
                                            ? 'bg-purple-500/20 border border-purple-500/50 text-purple-400'
                                            : 'bg-gray-900 border border-gray-800 text-gray-500 hover:text-gray-400'
                                            }`}
                                    >
                                        Atualização
                                    </button>
                                    <button
                                        onClick={() => setNotificationType('alert')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${notificationType === 'alert'
                                            ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-400'
                                            : 'bg-gray-900 border border-gray-800 text-gray-500 hover:text-gray-400'
                                            }`}
                                    >
                                        Alerta
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="h-px bg-gray-800"></div>

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
                            {/* Header Alignment - only for email */}
                            {deliveryMethod === 'email' && (
                                <div className="flex flex-col items-end gap-2">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Logo/Header</label>
                                    <AlignControls value={headerAlign} onChange={setHeaderAlign} allowJustify={false} />
                                </div>
                            )}
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
                                                        <span className="text-xs font-bold text-white">{user.name || 'Sem nome'}</span>
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

                    {/* Email-only: Subject */}
                    {deliveryMethod === 'email' && (
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
                    )}

                    {/* Popup-only: Image Upload */}
                    {deliveryMethod === 'popup' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Imagem do Popup (opcional)</label>

                            {!popupImageUrl ? (
                                <label className="block w-full cursor-pointer">
                                    <div className="bg-gray-900 border border-gray-800 border-dashed rounded-xl p-4 text-center hover:border-[#d97757] transition-colors group">
                                        <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-[#d97757]/10 group-hover:text-[#d97757] transition-colors text-gray-500">
                                            <Upload size={20} />
                                        </div>
                                        <p className="text-xs font-medium text-gray-300">Clique para selecionar uma imagem</p>
                                        <p className="text-[10px] text-gray-500 mt-1">PNG, JPG ou GIF (max. 2MB)</p>
                                    </div>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                if (file.size > 2 * 1024 * 1024) {
                                                    toast.warning('Imagem muito grande. Máximo 2MB.');
                                                    return;
                                                }
                                                // Keep previewing with FileReader for speed
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    setPopupImageUrl(reader.result as string);
                                                };
                                                reader.readAsDataURL(file);
                                                setSelectedFile(file);
                                            }
                                        }}
                                    />
                                </label>
                            ) : (
                                <div className="relative w-full rounded-xl overflow-hidden border border-gray-700 bg-gray-900 group">
                                    <div className="h-40 w-full relative">
                                        <img src={popupImageUrl} alt="Selected" className="w-full h-full object-cover opacity-80 group-hover:opacity-40 transition-opacity" />
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => {
                                                    setPopupImageUrl('');
                                                    setSelectedFile(null);
                                                }}
                                                className="bg-red-500/90 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-red-500 shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all"
                                            >
                                                <Trash2 size={14} /> Remover
                                            </button>
                                        </div>
                                    </div>
                                    <div className="px-3 py-2 bg-gray-800/50 border-t border-gray-700 flex justify-between items-center">
                                        <span className="text-[10px] text-gray-400">Imagem carregada</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Title */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                                {deliveryMethod === 'notification' ? 'Título da Notificação' : deliveryMethod === 'popup' ? 'Título do Popup' : 'Título Principal'}
                            </label>
                            {deliveryMethod === 'email' && <AlignControls value={titleAlign} onChange={setTitleAlign} />}
                        </div>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white focus:border-[#d97757] outline-none transition-colors placeholder-gray-600"
                            placeholder={deliveryMethod === 'notification' ? 'Ex: Nova funcionalidade disponível!' : 'Ex: Bem-vindo ao futuro...'}
                        />
                    </div>

                    {/* Body */}
                    <div className="flex-1 min-h-[200px] flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                                {deliveryMethod === 'notification' ? 'Mensagem' : 'Corpo da Mensagem'}
                            </label>
                            {deliveryMethod === 'email' && <AlignControls value={bodyAlign} onChange={setBodyAlign} />}
                        </div>
                        <textarea
                            ref={textAreaRef}
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            className="flex-1 w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-white focus:border-[#d97757] outline-none transition-colors placeholder-gray-600 resize-none leading-relaxed font-mono text-sm"
                            placeholder={deliveryMethod === 'notification' ? 'Escreva a mensagem da notificação...' : 'Escreva sua mensagem aqui...'}
                        />
                        {/* Email-only: Formatting buttons */}
                        {deliveryMethod === 'email' && (
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
                        )}
                    </div>



                    {/* Box Content Input (Email Only) */}
                    {deliveryMethod === 'email' && (
                        <div className="mt-4">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                Conteúdo em Destaque (Opcional)
                            </label>
                            <input
                                type="text"
                                value={boxContent}
                                onChange={(e) => setBoxContent(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white focus:border-[#d97757] outline-none transition-colors placeholder-gray-600 font-mono"
                                placeholder="Ex: CUPOM2025, Código: 12345..."
                            />
                            <p className="text-[10px] text-gray-600 mt-1">Aparecerá em uma caixa destacada no centro do email.</p>
                        </div>
                    )}

                    {/* Email & Popup: Button Options */}
                    {(deliveryMethod === 'email' || deliveryMethod === 'popup') && (
                        <div className="grid grid-cols-2 gap-4 border-t border-gray-800 pt-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                    Texto do Botão {deliveryMethod === 'popup' && '(opcional)'}
                                </label>
                                <input
                                    type="text"
                                    value={buttonText}
                                    onChange={(e) => setButtonText(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white focus:border-[#d97757] outline-none transition-colors placeholder-gray-600"
                                    placeholder={deliveryMethod === 'popup' ? 'Ex: Conferir Novidades' : ''}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                    Link do Botão {deliveryMethod === 'popup' && '(opcional)'}
                                </label>
                                <input
                                    type="text"
                                    value={buttonLink}
                                    onChange={(e) => setButtonLink(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white focus:border-[#d97757] outline-none transition-colors placeholder-gray-600"
                                    placeholder={deliveryMethod === 'popup' ? 'https://...' : ''}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Side: Preview */}
                <div className="flex-1 flex flex-col bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden relative">
                    {/* Preview Controls */}
                    <div className="h-12 bg-gray-950 border-b border-gray-800 flex items-center justify-between px-4">
                        <div className="flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-wider">
                            <Eye size={14} /> Preview {deliveryMethod === 'notification' ? '(Notificação)' : deliveryMethod === 'popup' ? '(Popup Modal)' : '(Email)'}
                        </div>
                        {deliveryMethod === 'email' && (
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
                        )}
                    </div>

                    {/* Preview Area Container */}
                    <div className="flex-1 bg-gray-900/50 overflow-y-auto p-8 flex justify-center items-start">

                        {deliveryMethod === 'notification' ? (
                            /* Notification Preview */
                            <div className="w-full max-w-md">
                                <div className="bg-[#30302E] border border-[#373734] rounded-2xl shadow-xl overflow-hidden">
                                    {/* Header */}
                                    <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950/50">
                                        <h3 className="font-bold text-white flex items-center gap-2">
                                            <Bell size={16} className="text-[#d97757]" />
                                            Central de Notificações
                                        </h3>
                                        <span className="text-[10px] px-2 py-1 rounded-full bg-[#d97757]/20 text-[#d97757] font-bold">1 nova</span>
                                    </div>

                                    {/* Notification Item Preview */}
                                    <div className="p-2">
                                        <div className={`m-1 p-3 rounded-xl border transition-colors bg-gray-800/40 border-gray-800`}>
                                            <div className="flex items-start gap-3">
                                                <div className={`p-2 rounded-lg shrink-0 ${notificationType === 'update'
                                                    ? 'bg-purple-500/20 text-purple-400'
                                                    : notificationType === 'alert'
                                                        ? 'bg-yellow-500/20 text-yellow-400'
                                                        : 'bg-blue-500/20 text-blue-400'
                                                    }`}>
                                                    {notificationType === 'update' ? (
                                                        <Sparkles size={16} />
                                                    ) : notificationType === 'alert' ? (
                                                        <AlertTriangle size={16} />
                                                    ) : (
                                                        <Info size={16} />
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between mb-1">
                                                        <h4 className="text-sm font-bold text-white">
                                                            {title || 'Título da Notificação'}
                                                        </h4>
                                                        <div className="w-2 h-2 rounded-full bg-[#d97757]"></div>
                                                    </div>
                                                    <p className="text-xs text-gray-500">
                                                        {body ? body.substring(0, 150).replace(/\n/g, ' ') : 'Mensagem da notificação aparecerá aqui...'}
                                                        {body && body.length > 150 && '...'}
                                                    </p>
                                                    <p className="text-[10px] text-gray-600 mt-2 flex items-center gap-1">
                                                        <Calendar size={10} /> Agora
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Info Footer */}
                                    <div className="px-4 py-3 bg-gray-950/30 border-t border-gray-800">
                                        <p className="text-[10px] text-gray-600 text-center">
                                            Esta notificação aparecerá na Central de Notificações do usuário
                                        </p>
                                    </div>
                                </div>

                                {/* Type Legend */}
                                <div className="mt-4 flex justify-center gap-4 text-[10px] text-gray-500">
                                    <span className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div> Sistema
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full bg-purple-500"></div> Atualização
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div> Alerta
                                    </span>
                                </div>
                            </div>
                        ) : deliveryMethod === 'popup' ? (
                            /* Popup Preview - Horizontal style */
                            <div className="w-full max-w-lg">
                                <p className="text-[10px] text-gray-600 text-center mb-4">
                                    Preview: popup no canto inferior direito
                                </p>
                                <div className="relative bg-[#30302E] rounded-2xl overflow-hidden shadow-2xl border border-[#373734] flex flex-col">
                                    {/* Close Button */}
                                    <button className="absolute top-3 right-3 z-20 p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                                        <X size={16} />
                                    </button>

                                    {/* Image - Stacked on top */}
                                    {popupImageUrl && (
                                        <div className="w-full h-48 relative shrink-0">
                                            <img
                                                src={popupImageUrl}
                                                alt="Preview"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    )}

                                    {/* Content */}
                                    <div className="p-6 flex-1 flex flex-col justify-center">
                                        {/* Title */}
                                        <h3 className="text-white font-bold text-lg mb-2 leading-tight pr-6">
                                            {title || <span className="text-gray-500">Título do Popup</span>}
                                        </h3>

                                        {/* Message */}
                                        <p className="text-gray-400 text-sm leading-relaxed mb-4">
                                            {body || 'A mensagem do popup aparecerá aqui...'}
                                        </p>

                                        {/* Button */}
                                        {buttonText && (
                                            <button className="self-start py-2 px-5 rounded-lg border border-white/20 text-white font-bold text-sm hover:bg-white/10 transition-colors">
                                                {buttonText}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Email Canvas */
                            <div
                                className={`bg-[#30302E] text-white shadow-2xl transition-all duration-300 flex flex-col overflow-hidden border border-[#373734]
                                    ${previewDevice === 'mobile' ? 'w-[375px] rounded-[30px] my-auto min-h-[600px]' : 'w-[600px] rounded-lg my-8 min-h-[500px]'}
                                `}
                            >
                                {/* Email Header - Transparent as requested */}
                                <div className={`bg-transparent p-6 flex justify-${headerAlign === 'justify' ? 'between' : headerAlign}`}>
                                    <div className="text-2xl font-bold text-white tracking-tight">
                                        Controlar<span className="text-[#d97757]">+</span>
                                    </div>
                                </div>

                                {/* Email Content */}
                                <div className="px-8 pb-8 flex-1">
                                    <h1 className={`text-2xl font-bold text-white mb-2 leading-tight text-${titleAlign}`}>
                                        {title || 'Seu Título Aqui'}
                                    </h1>

                                    <div
                                        className={`max-w-none text-gray-300 leading-relaxed text-${bodyAlign}`}
                                        dangerouslySetInnerHTML={{
                                            __html: (body || 'O conteúdo do seu email aparecerá aqui...')
                                                .replace(/\n/g, '<br/>')
                                        }}
                                    />

                                    {/* Highlighted Box Content */}
                                    {boxContent && (
                                        <div className="my-8 text-center">
                                            <div className="inline-block bg-gradient-to-br from-[#363735] to-[#30302E] py-5 px-10 rounded-xl border border-[#4a4a48]">
                                                <span className="text-3xl font-bold tracking-[0.2em] text-[#d97757] font-mono">
                                                    {boxContent}
                                                </span>
                                            </div>
                                        </div>
                                    )}

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

                                {/* Email Footer - Transparent as requested */}
                                <div className="bg-transparent p-6 text-center text-xs text-gray-500">
                                    <p>© {new Date().getFullYear()} Controlar+. Todos os direitos reservados.</p>
                                    <p className="mt-2">
                                        <a href="#" className="underline hover:text-gray-400">Descadastrar</a> •
                                        <a href="#" className="underline hover:text-gray-400 ml-2">Política de Privacidade</a>
                                    </p>
                                </div>
                            </div>
                        )}

                    </div>
                </div>

            </div>
        </div >
    );
};

export default AdminEmailMessage;
