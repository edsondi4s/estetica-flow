import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { MessageSquare, Search, Phone, RefreshCw, Send, Bot, User, Loader2, ChevronLeft, Wifi, Trash2, CheckSquare, Square, X, Check } from 'lucide-react';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
}

interface Contact {
    sender_number: string;
    last_message: string;
    last_message_at: string;
    unread_count: number;
    client_name?: string;
}

function formatPhone(num: string) {
    const n = num.replace(/\D/g, '').split('@')[0];
    if (n.length === 13) return `+${n.slice(0, 2)} (${n.slice(2, 4)}) ${n.slice(4, 5)} ${n.slice(5, 9)}-${n.slice(9)}`;
    if (n.length === 12) return `+${n.slice(0, 2)} (${n.slice(2, 4)}) ${n.slice(4, 8)}-${n.slice(8)}`;
    if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 3)} ${n.slice(3, 7)}-${n.slice(7)}`;
    if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
    return num;
}

function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function Chat() {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [search, setSearch] = useState('');
    const [isLoadingContacts, setIsLoadingContacts] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [showMobileChat, setShowMobileChat] = useState(false);
    const [isAiTyping, setIsAiTyping] = useState(false);
    const [realtimeConnected, setRealtimeConnected] = useState(false);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedNumbers, setSelectedNumbers] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const selectedContactRef = useRef<Contact | null>(null);
    const lastMessageIdRef = useRef<string | null>(null);
    const lastUserMsgRef = useRef<string | null>(null);
    const viewedTimestampsRef = useRef<Record<string, string>>({});

    const fetchContacts = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('ai_chat_history')
            .select('sender_number, content, created_at, role')
            .eq('user_id', user.id)
            .in('role', ['user', 'assistant'])
            .order('created_at', { ascending: false });

        if (!data) return;

        const seen = new Set<string>();
        const uniqueContacts: Omit<Contact, 'client_name'>[] = [];
        const unreadMap: Record<string, number> = {};

        for (const row of data) {
            const num = row.sender_number;
            if (!seen.has(num)) {
                seen.add(num);
                uniqueContacts.push({
                    sender_number: num,
                    last_message: row.content,
                    last_message_at: row.created_at,
                    unread_count: 0,
                });
            }
            const viewedAt = viewedTimestampsRef.current[num];
            if (row.role === 'user' && (!viewedAt || row.created_at > viewedAt)) {
                unreadMap[num] = (unreadMap[num] || 0) + 1;
            }
        }

        const phones = uniqueContacts.map(c => c.sender_number.split('@')[0]);
        const { data: clients } = await supabase.from('clients').select('phone, name').in('phone', phones).eq('user_id', user.id);
        const clientMap = new Map((clients || []).map(c => [c.phone, c.name]));

        const enriched: Contact[] = uniqueContacts.map(c => ({
            ...c,
            client_name: clientMap.get(c.sender_number.split('@')[0]) || undefined,
            unread_count: unreadMap[c.sender_number] || 0,
        }));

        setContacts(enriched);
        setFilteredContacts(prev => {
            const q = search.toLowerCase();
            if (!q) return enriched;
            return enriched.filter(c =>
                c.sender_number.includes(q) ||
                (c.client_name || '').toLowerCase().includes(q) ||
                c.last_message.toLowerCase().includes(q)
            );
        });
        setIsLoadingContacts(false);
    }, [search]);

    useEffect(() => { fetchContacts(); }, [fetchContacts]);

    useEffect(() => {
        const q = search.toLowerCase();
        if (!q) setFilteredContacts(contacts);
        else setFilteredContacts(contacts.filter(c =>
            c.sender_number.includes(q) ||
            (c.client_name || '').toLowerCase().includes(q) ||
            c.last_message.toLowerCase().includes(q)
        ));
    }, [search, contacts]);

    const fetchMessages = useCallback(async (contact: Contact, isInitial = false) => {
        if (isInitial) setIsLoadingMessages(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('ai_chat_history')
            .select('id, role, content, created_at')
            .eq('user_id', user.id)
            .eq('sender_number', contact.sender_number)
            .in('role', ['user', 'assistant'])
            .order('created_at', { ascending: true });

        const fetched = (data as ChatMessage[]) || [];
        const lastId = fetched[fetched.length - 1]?.id ?? null;

        if (lastId !== lastMessageIdRef.current) {
            lastMessageIdRef.current = lastId;
            setMessages(fetched);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

            const lastMsg = fetched[fetched.length - 1];
            if (lastMsg?.role === 'assistant') {
                setIsAiTyping(false);
                lastUserMsgRef.current = null;
            }
        }

        if (isInitial) setIsLoadingMessages(false);
    }, []);

    useEffect(() => {
        if (!selectedContact) return;

        selectedContactRef.current = selectedContact;
        lastMessageIdRef.current = null;
        lastUserMsgRef.current = null;
        setIsAiTyping(false);

        viewedTimestampsRef.current[selectedContact.sender_number] = new Date().toISOString();

        fetchMessages(selectedContact, true);

        const channel = supabase
            .channel(`chat_${selectedContact.sender_number}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'ai_chat_history',
                    filter: `sender_number=eq.${selectedContact.sender_number}`,
                },
                (payload) => {
                    const newMsg = payload.new as ChatMessage;
                    if (!newMsg || !['user', 'assistant'].includes(newMsg.role)) return;

                    if (newMsg.role === 'user') {
                        setIsAiTyping(true);
                        lastUserMsgRef.current = newMsg.id;
                    }

                    setMessages(prev => {
                        if (prev.some(m => m.id === newMsg.id)) return prev;
                        const updated = [...prev, newMsg];
                        lastMessageIdRef.current = newMsg.id;
                        if (newMsg.role === 'assistant') setIsAiTyping(false);
                        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                        return updated;
                    });

                    fetchContacts();
                }
            )
            .subscribe((status) => {
                setRealtimeConnected(status === 'SUBSCRIBED');
            });

        return () => {
            supabase.removeChannel(channel);
            setRealtimeConnected(false);
        };
    }, [selectedContact, fetchMessages, fetchContacts]);

    const handleSelectContact = (contact: Contact) => {
        if (isSelectionMode) {
            toggleNumberSelection(contact.sender_number);
            return;
        }
        setSelectedContact(contact);
        setShowMobileChat(true);
        viewedTimestampsRef.current[contact.sender_number] = new Date().toISOString();
        setContacts(prev => prev.map(c =>
            c.sender_number === contact.sender_number ? { ...c, unread_count: 0 } : c
        ));
    };

    const toggleNumberSelection = (num: string) => {
        setSelectedNumbers(prev => {
            const next = new Set(prev);
            if (next.has(num)) next.delete(num);
            else next.add(num);
            return next;
        });
    };

    const handleSelectAll = () => {
        if (selectedNumbers.size === filteredContacts.length) {
            setSelectedNumbers(new Set());
        } else {
            setSelectedNumbers(new Set(filteredContacts.map(c => c.sender_number)));
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedNumbers.size === 0) return;
        if (!confirm(`Deseja excluir as ${selectedNumbers.size} conversas selecionadas? Esta ação não pode ser desfeita.`)) return;

        setIsDeleting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('ai_chat_history')
                .delete()
                .eq('user_id', user.id)
                .in('sender_number', Array.from(selectedNumbers));

            if (error) throw error;

            if (selectedContact && selectedNumbers.has(selectedContact.sender_number)) {
                setSelectedContact(null);
                setMessages([]);
            }

            setSelectedNumbers(new Set());
            setIsSelectionMode(false);
            await fetchContacts();
        } catch (err) {
            console.error('Error deleting chats:', err);
            alert('Erro ao excluir conversas.');
        } finally {
            setIsDeleting(false);
        }
    };

    const displayName = (contact: Contact) =>
        contact.client_name || formatPhone(contact.sender_number);

    const totalUnread = contacts.reduce((sum, c) => sum + c.unread_count, 0);

    return (
        <div className="flex h-[calc(100vh-4rem)] bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-xl border border-slate-200 dark:border-slate-800">
            {/* LEFT: Contact List */}
            <div className={`
                flex flex-col w-full md:w-80 lg:w-96 border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0
                ${showMobileChat ? 'hidden md:flex' : 'flex'}
            `}>
                {/* Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 relative z-10">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl relative">
                                <MessageSquare className="w-5 h-5 text-green-600 dark:text-green-400" />
                                {totalUnread > 0 && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                        {totalUnread > 9 ? '9+' : totalUnread}
                                    </span>
                                )}
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-900 dark:text-white">Chat WhatsApp</h2>
                                <p className="text-xs text-slate-500">{contacts.length} conversa{contacts.length !== 1 ? 's' : ''}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => {
                                    setIsSelectionMode(!isSelectionMode);
                                    setSelectedNumbers(new Set());
                                }}
                                className={`p-2 rounded-lg transition-colors ${isSelectionMode ? 'bg-slate-100 dark:bg-slate-800 text-primary' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                title={isSelectionMode ? "Cancelar seleção" : "Selecionar conversas"}
                            >
                                {isSelectionMode ? <X className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={fetchContacts}
                                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                title="Atualizar"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar contato..."
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 text-slate-900 dark:text-white placeholder-slate-400 transition"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {/* Bulk Actions Bar */}
                {isSelectionMode && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-2 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 animate-in slide-in-from-top duration-200">
                        <button
                            onClick={handleSelectAll}
                            className="text-xs font-bold text-primary flex items-center gap-2 hover:opacity-80"
                        >
                            {selectedNumbers.size === filteredContacts.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                            {selectedNumbers.size === filteredContacts.length ? 'Desmarcar Tudo' : 'Selecionar Tudo'}
                        </button>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-slate-500">{selectedNumbers.size} selecionadas</span>
                            <button
                                onClick={handleDeleteSelected}
                                disabled={selectedNumbers.size === 0 || isDeleting}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 to-red-100 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                Excluir
                            </button>
                        </div>
                    </div>
                )}

                {/* Contact List */}
                <div className="flex-1 overflow-y-auto">
                    {isLoadingContacts ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                        </div>
                    ) : filteredContacts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-center px-6">
                            <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
                            <p className="text-sm text-slate-500 font-medium">Nenhuma conversa ainda</p>
                            <p className="text-xs text-slate-400 mt-1">As conversas do WhatsApp aparecerão aqui</p>
                        </div>
                    ) : (
                        filteredContacts.map(contact => (
                            <button
                                key={contact.sender_number}
                                onClick={() => handleSelectContact(contact)}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-slate-50 dark:border-slate-800/50 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50
                                    ${selectedContact?.sender_number === contact.sender_number && !isSelectionMode ? 'bg-green-50 dark:bg-green-900/10 border-l-2 border-l-green-500' : ''}
                                    ${isSelectionMode && selectedNumbers.has(contact.sender_number) ? 'bg-primary/5' : ''}
                                `}
                            >
                                {/* Selection Indicator */}
                                {isSelectionMode && (
                                    <div className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${selectedNumbers.has(contact.sender_number) ? 'bg-primary border-primary text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                                        {selectedNumbers.has(contact.sender_number) && <Check className="w-3 h-3 stroke-[3]" />}
                                    </div>
                                )}

                                {/* Avatar */}
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-sm relative">
                                    {(contact.client_name || contact.sender_number).charAt(0).toUpperCase()}
                                    {contact.unread_count > 0 && !isSelectionMode && (
                                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white dark:border-slate-900 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                            {contact.unread_count > 9 ? '9+' : contact.unread_count}
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <span className={`text-sm truncate ${contact.unread_count > 0 ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-200'}`}>
                                            {displayName(contact)}
                                        </span>
                                        <span className="text-[10px] text-slate-400 shrink-0 ml-2">{formatTime(contact.last_message_at)}</span>
                                    </div>
                                    <p className={`text-xs truncate ${contact.unread_count > 0 ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                                        {contact.last_message}
                                    </p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* RIGHT: Chat Area */}
            <div className={`flex-1 flex flex-col h-full ${selectedContact && showMobileChat ? 'flex' : 'hidden md:flex'}`}>
                {!selectedContact ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50 dark:bg-slate-800/20">
                        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-3xl flex items-center justify-center mb-5 shadow-inner">
                            <MessageSquare className="w-10 h-10 text-green-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">
                            Selecione uma conversa
                        </h3>
                        <p className="text-sm text-slate-500 max-w-xs">
                            Clique em um contato à esquerda para visualizar o histórico de mensagens do WhatsApp.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Chat Header */}
                        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                            <button
                                onClick={() => { setShowMobileChat(false); setSelectedContact(null); }}
                                className="md:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-bold shrink-0 shadow-sm">
                                {displayName(selectedContact).charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-900 dark:text-white truncate">{displayName(selectedContact)}</p>
                                <div className="flex items-center gap-1.5">
                                    <Phone className="w-3 h-3 text-slate-400" />
                                    <p className="text-xs text-slate-500">{formatPhone(selectedContact.sender_number)}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Realtime indicator */}
                                <div className="hidden sm:flex items-center gap-1.5 mr-2">
                                    <Wifi className={`w-3.5 h-3.5 ${realtimeConnected ? 'text-green-500' : 'text-slate-300 dark:text-slate-600'}`} />
                                    <span className={`text-[10px] uppercase tracking-wider font-bold ${realtimeConnected ? 'text-green-500' : 'text-slate-400'}`}>
                                        {realtimeConnected ? 'Conectado' : 'Conectando'}
                                    </span>
                                </div>

                                <button
                                    onClick={() => handleDeleteSelected()}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    title="Excluir conversa"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>

                                <button
                                    onClick={() => selectedContact && fetchMessages(selectedContact)}
                                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                    title="Atualizar mensagens"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 bg-slate-50 dark:bg-slate-800/20">
                            {isLoadingMessages ? (
                                <div className="flex justify-center items-center h-40">
                                    <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex justify-center">
                                    <p className="text-xs text-slate-400 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full shadow-sm">Nenhuma mensagem nesta conversa</p>
                                </div>
                            ) : (
                                messages.map((msg, index) => {
                                    const isUser = msg.role === 'user';
                                    const showDate = index === 0 ||
                                        new Date(messages[index - 1].created_at).toDateString() !== new Date(msg.created_at).toDateString();

                                    return (
                                        <div key={msg.id}>
                                            {showDate && (
                                                <div className="flex justify-center my-3">
                                                    <span className="text-xs text-slate-500 bg-white dark:bg-slate-800 px-3 py-1 rounded-full shadow-sm border border-slate-100 dark:border-slate-700">
                                                        {new Date(msg.created_at).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                                                    </span>
                                                </div>
                                            )}
                                            <div className={`flex items-end gap-2 ${isUser ? 'flex-row' : 'flex-row-reverse'}`}>
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-sm mb-1
                                                    ${isUser
                                                        ? 'bg-gradient-to-br from-green-400 to-emerald-600 text-white'
                                                        : 'bg-gradient-to-br from-violet-500 to-purple-700 text-white'
                                                    }`}>
                                                    {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                                                </div>
                                                <div className={`max-w-[72%] ${isUser ? 'items-start' : 'items-end'} flex flex-col`}>
                                                    <div className={`px-4 py-2.5 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap break-words
                                                        ${isUser
                                                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-tl-sm border border-slate-100 dark:border-slate-700'
                                                            : 'bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-tr-sm'
                                                        }`}>
                                                        {msg.content}
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                                                        {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}

                            {/* AI Typing Indicator */}
                            {isAiTyping && (
                                <div className="flex items-end gap-2 flex-row-reverse">
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shrink-0 shadow-sm mb-1">
                                        <Bot className="w-3.5 h-3.5 text-white" />
                                    </div>
                                    <div className="bg-gradient-to-br from-violet-500 to-purple-600 px-4 py-3 rounded-2xl rounded-tr-sm shadow-sm">
                                        <div className="flex gap-1 items-center h-4">
                                            <span className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                            <span className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                            <span className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Footer - Read-only notice */}
                        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3">
                            <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                <Send className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                                <span className="text-sm text-slate-400 dark:text-slate-500 select-none">
                                    Visualização apenas — respostas são enviadas via IA automaticamente
                                </span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
