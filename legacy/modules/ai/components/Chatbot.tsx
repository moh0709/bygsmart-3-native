import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../ChatProvider';
import { handleUserMessage, QuotaExceededError } from '../services/gemini';
import { MessageCircleIcon, XIcon, MicIcon, SendIcon, FileTextIcon, CameraIcon } from '../../../components/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../ChatProvider';
import FilePicker from '../../../components/FilePicker';
import { Chip, Textarea } from '../../../components/ui';
import { useTTS } from '../hooks/useTTS';
import { HandsFreeOverlay } from './HandsFreeOverlay';
import { useToast } from '../../../contexts/ToastContext';

const Chatbot: React.FC<{ contextId: string }> = ({ contextId }) => {
    // Open-state lives in ChatProvider — toggled from the global top-bar AI button.
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [attachment, setAttachment] = useState<{ file: File, dataUrl: string } | null>(null);
    
    // Hands-free State
    const [isHandsFree, setIsHandsFree] = useState(false);
    const [hfStatus, setHfStatus] = useState<'listening' | 'thinking' | 'speaking'>('listening');
    const [hfTranscript, setHfTranscript] = useState('');

    const { speak, cancel: cancelSpeech, currentSubtitle, isSupported: ttsSupported } = useTTS();
    const { showToast } = useToast();

    const { getSession, addMessage, isChatOpen: isOpen, setChatOpen } = useChat();
    const navigate = useNavigate();
    const messages = getSession(contextId);

    // Chat is project-scoped: start closed on each project entry and close on exit.
    useEffect(() => {
        setChatOpen(false);
        return () => setChatOpen(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    // Refs for speech recognition
    const recognitionRef = useRef<any | null>(null);
    const isProcessingSpeech = useRef(false);
    
    // Refs for stable access inside event handlers to avoid stale closures
    const isHandsFreeRef = useRef(isHandsFree);
    const hfStatusRef = useRef(hfStatus);

    // Sync refs
    useEffect(() => { isHandsFreeRef.current = isHandsFree; }, [isHandsFree]);
    useEffect(() => { hfStatusRef.current = hfStatus; }, [hfStatus]);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    // Movable FAB state
    const [position, setPosition] = useState({ x: -9999, y: 16 });
    const [isDragging, setIsDragging] = useState(false);
    const [didDrag, setDidDrag] = useState(false);
    const dragStartOffset = useRef({ x: 0, y: 0 });
    const fabContainerRef = useRef<HTMLDivElement>(null);

    // --- SPEECH RECOGNITION SETUP ---
    useEffect(() => {
        // @ts-ignore
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false; // We restart manually to ensure clean state
            recognition.interimResults = true;
            recognition.lang = 'da-DK';

            recognition.onstart = () => {
                // console.log("Mic Started");
            };

            recognition.onresult = (event: any) => {
                // If we are not in listening mode (e.g. bot started speaking), ignore
                if (hfStatusRef.current !== 'listening') return;

                let final = '';
                let interim = '';
                
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        final += event.results[i][0].transcript;
                    } else {
                        interim += event.results[i][0].transcript;
                    }
                }

                if (isHandsFreeRef.current) {
                    setHfTranscript(interim || final);
                    
                    if (final && !isProcessingSpeech.current) {
                        // Got a full sentence, process it
                        handleHandsFreeSend(final);
                    }
                } else {
                     if (final) setUserInput(prev => prev + ' ' + final);
                }
            };
            
            recognition.onend = () => {
                 // console.log("Mic Ended. Status:", hfStatusRef.current, "Processing:", isProcessingSpeech.current);
                 
                 // Auto-restart if we should still be listening and haven't just sent a command
                 if (isHandsFreeRef.current && hfStatusRef.current === 'listening' && !isProcessingSpeech.current) {
                     try { 
                         recognition.start(); 
                     } catch (e) {
                         // ignore 'already started' errors
                     }
                 }
            };
            
            recognition.onerror = (event: any) => {
                // 'no-speech' happens if silence. 'aborted' happens if we stop it.
                if (event.error !== 'no-speech' && event.error !== 'aborted') {
                    console.warn("Speech recognition warning", event.error);
                }
            };

            recognitionRef.current = recognition;
        }
    }, []); // Init once

    // --- HANDS FREE LOGIC ---
    
    // Effect to manage Mic based on Status
    useEffect(() => {
        const recognition = recognitionRef.current;
        if (!recognition) return;

        if (isHandsFree && hfStatus === 'listening') {
            try { recognition.start(); } catch (e) {}
        } else {
            try { recognition.stop(); } catch (e) {}
        }
    }, [isHandsFree, hfStatus]);

    const handleHandsFreeSend = async (text: string) => {
        if (!text.trim()) return;
        
        // 1. State Transition: Thinking
        isProcessingSpeech.current = true;
        setHfStatus('thinking');
        try { recognitionRef.current?.stop(); } catch {}

        // 2. Add User Message
        const userMessage: Message = { 
            id: Date.now().toString(), 
            text: text, 
            role: 'user' 
        };
        addMessage(contextId, userMessage);

        // 3. Call API
        // Pass navigate to allow AI to control routing
        const currentHistory = getSession(contextId);
        let botResponse: { text: string; attachment?: { type: 'image'; dataUrl: string } };
        try {
            botResponse = await handleUserMessage(text, currentHistory, contextId, navigate);
        } catch (error) {
            if (error instanceof QuotaExceededError) {
                showToast('Du har nået din daglige AI-grænse. Opgrader for mere.', 'warning');
                setHfStatus('listening');
                setHfTranscript('');
                isProcessingSpeech.current = false;
                return;
            }
            botResponse = { text: 'Beklager, jeg kan ikke svare lige nu.' };
        }

        // 4. Add Bot Message
        const botMessage: Message = { 
            id: (Date.now() + 1).toString(), 
            text: botResponse.text, 
            role: 'bot',
            attachment: botResponse.attachment
        };
        addMessage(contextId, botMessage);

        // 5. State Transition: Speaking
        setHfStatus('speaking');
        speak(botResponse.text, () => {
             // On TTS Complete
             if (isHandsFreeRef.current) {
                setHfStatus('listening');
                setHfTranscript('');
                isProcessingSpeech.current = false;
                // UseEffect will restart mic
             }
        });
    };
    
    const toggleHandsFree = () => {
        if (!ttsSupported) {
            showToast('Din enhed understøtter ikke tale.', 'warning');
            return;
        }
        
        const newState = !isHandsFree;
        setIsHandsFree(newState);
        
        if (newState) {
            setChatOpen(false);
            setHfStatus('listening');
            setHfTranscript('');
            isProcessingSpeech.current = false;
        } else {
            cancelSpeech();
            isProcessingSpeech.current = false;
            try { recognitionRef.current?.stop(); } catch {}
        }
    };

    // ... Standard Chat Functions (Send, File, etc.) ...
    const handleSend = async () => {
        if ((!userInput.trim() && !attachment) || isLoading) return;
        
        const userMessage: Message = { 
            id: Date.now().toString(), 
            text: userInput, 
            role: 'user' as const,
            attachment: attachment ? { type: 'image', dataUrl: attachment.dataUrl } : undefined
        };
        addMessage(contextId, userMessage);
        
        const currentInput = userInput;
        const currentAttachmentFile = attachment?.file;
        setUserInput('');
        setAttachment(null);
        setIsLoading(true);

        const currentHistory = getSession(contextId);
        let botResponse: { text: string; attachment?: { type: 'image'; dataUrl: string } };
        try {
            botResponse = await handleUserMessage(
                currentInput || (currentAttachmentFile ? "Analyser dette billede." : ""),
                currentHistory, 
                contextId, 
                navigate, 
                currentAttachmentFile
            );
        } catch (error) {
            if (error instanceof QuotaExceededError) {
                showToast('Du har nået din daglige AI-grænse. Opgrader for mere.', 'warning');
                setIsLoading(false);
                return;
            }
            botResponse = { text: 'Beklager, jeg kan ikke svare lige nu.' };
        }

        const botMessage = { 
            id: (Date.now() + 1).toString(), 
            text: botResponse.text, 
            role: 'bot' as const,
            attachment: botResponse.attachment
        };
        addMessage(contextId, botMessage);
        setIsLoading(false);
    };
    
    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleFileSelect = (file: File) => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setAttachment({ file, dataUrl: e.target?.result as string });
            };
            reader.readAsDataURL(file);
        } else {
             setAttachment({ file, dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' }); 
        }
    };
    
    const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileSelect(file);
            if (!userInput) {
                setUserInput("Mål dimensionerne på dette billede");
            }
        }
    };

    const removeAttachment = () => setAttachment(null);
    // Braces matter: smooth scrollIntoView returns a Promise in newer Chrome
    // (scroll-completion promises). An implicit arrow return handed that Promise
    // to React as the effect "cleanup", which crashed the whole project page
    // with "TypeError: n is not a function" the moment the deps changed.
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isOpen]);
    
    // ... FAB Logic ...
    useEffect(() => {
        const container = fabContainerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        // Default: sit inside the global top bar, just left of the PRO badge /
        // notification bell (the chat is project-scoped). Still draggable.
        setPosition({ x: Math.max(16, window.innerWidth - rect.width - 106), y: 6 });
        const resizeHandler = () => {
            setPosition(p => ({ x: Math.min(p.x, window.innerWidth - 80), y: Math.min(p.y, window.innerHeight - 80) }));
        };
        window.addEventListener('resize', resizeHandler);
        return () => window.removeEventListener('resize', resizeHandler);
    }, []);

    const handleDragStart = useCallback((clientX: number, clientY: number) => {
        if (fabContainerRef.current) {
            const rect = fabContainerRef.current.getBoundingClientRect();
            setIsDragging(true);
            setDidDrag(false);
            dragStartOffset.current = { x: clientX - rect.left, y: clientY - rect.top };
        }
    }, []);

    const handleDragMove = useCallback((clientX: number, clientY: number) => {
        if (!isDragging || !fabContainerRef.current) return;
        if (!didDrag) setDidDrag(true);
        const rect = fabContainerRef.current.getBoundingClientRect();
        let newX = clientX - dragStartOffset.current.x;
        let newY = clientY - dragStartOffset.current.y;
        newX = Math.max(16, Math.min(newX, window.innerWidth - rect.width - 16));
        newY = Math.max(16, Math.min(newY, window.innerHeight - rect.height - 16));
        setPosition({ x: newX, y: newY });
    }, [isDragging, didDrag]);

    const handleDragEnd = useCallback(() => {
        if (!isDragging) return;
        setIsDragging(false);
        setTimeout(() => setDidDrag(false), 0);
    }, [isDragging]);

    const onMouseDown = (e: React.MouseEvent) => { handleDragStart(e.clientX, e.clientY); e.preventDefault(); };
    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY);
        if (isDragging) {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', handleDragEnd);
        }
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', handleDragEnd);
        };
    }, [isDragging, handleDragMove, handleDragEnd]);

    const onTouchStart = (e: React.TouchEvent) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    useEffect(() => {
        const onTouchMove = (e: TouchEvent) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
        if (isDragging) {
            window.addEventListener('touchmove', onTouchMove);
            window.addEventListener('touchend', handleDragEnd);
        }
        return () => {
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', handleDragEnd);
        };
    }, [isDragging, handleDragMove, handleDragEnd]);
    
    const openUpwards = position.y + (fabContainerRef.current?.clientHeight || 0) > window.innerHeight / 2;
    const snapRight = position.x + (fabContainerRef.current?.clientWidth || 0) / 2 > window.innerWidth / 2;

    return (
        <>
            {isHandsFree && (
                <HandsFreeOverlay 
                    status={hfStatus} 
                    transcript={hfTranscript} 
                    subtitle={currentSubtitle} 
                    onClose={toggleHandsFree}
                />
            )}

            {/* Chat panel — fixed just below the global top bar, opened from the
                AI button in that bar (ChatProvider open-state). No longer floating. */}
            <div
                className={`
                    fixed top-14 right-2 md:right-4 z-50 origin-top-right
                    ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}
                    ${isHandsFree ? 'hidden' : ''}
                    transition-all duration-200 ease-out
                    w-[calc(100vw-16px)] max-w-sm h-[70vh] max-h-[600px]
                    bg-bg dark:bg-bg-dark-surface border border-border dark:border-border-dark rounded-modal shadow-modal flex flex-col overflow-hidden
                `}
                data-no-snapshot="true"
            >
                    {/* Header */}
                    <div className="flex justify-between items-center px-4 py-3 border-b border-border dark:border-border-dark flex-shrink-0 bg-bg-subtle dark:bg-bg-dark-muted">
                        <div className="flex items-center gap-2">
                            <h3 className="text-heading text-text-primary dark:text-text-dark-primary">Assistent</h3>
                            <Chip onClick={toggleHandsFree} disabled={isLoading} icon={<MicIcon className="w-3.5 h-3.5" />} className="disabled:opacity-50">
                                Hands-free
                            </Chip>
                        </div>
                        <button type="button" onClick={() => setChatOpen(false)} aria-label="Luk chat" className="p-2 -m-1 rounded-control text-text-tertiary hover:text-text-primary hover:bg-bg-muted dark:text-text-dark-tertiary dark:hover:text-text-dark-primary dark:hover:bg-bg-dark-muted transition-colors duration-150"><XIcon className="w-5 h-5" /></button>
                    </div>
                    {/* Messages */}
                    <div className="flex-grow p-4 overflow-y-auto space-y-4 bg-bg-subtle dark:bg-bg-dark">
                        {messages.length === 0 && !isLoading && (
                            <div className="text-center h-full flex flex-col items-center justify-center">
                                <span className="flex w-14 h-14 items-center justify-center rounded-2xl bg-brand-subtle dark:bg-brand-subtle-dark text-brand-primary dark:text-brand-light mb-3" aria-hidden="true">
                                    <MessageCircleIcon className="w-7 h-7" />
                                </span>
                                <p className="text-heading text-text-primary dark:text-text-dark-primary">Hej! Hvordan kan jeg hjælpe?</p>
                                <div className="mt-4 flex flex-wrap justify-center gap-2">
                                    <Chip onClick={() => cameraInputRef.current?.click()} icon={<CameraIcon className="w-4 h-4" />}>Snap & Mål</Chip>
                                </div>
                            </div>
                        )}
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                {msg.role === 'bot' && <div className="w-7 h-7 bg-brand-subtle dark:bg-brand-subtle-dark text-brand-primary dark:text-brand-light rounded-full flex items-center justify-center flex-shrink-0 font-bold text-caption" aria-hidden="true">B</div>}
                                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === 'user' ? 'bg-brand-primary text-white rounded-br-none' : 'bg-bg-muted dark:bg-bg-dark-muted text-text-primary dark:text-text-dark-primary rounded-bl-none'}`}>
                                    {msg.role === 'user' && msg.attachment && (
                                        <div className="mb-2">
                                        {msg.attachment.dataUrl.startsWith('data:image') && !msg.attachment.dataUrl.includes('AAAAA') ?
                                            <img src={msg.attachment.dataUrl} alt="User attachment" className="rounded-control max-w-full h-auto border border-white/20"/> :
                                            <div className="flex items-center gap-2 text-caption bg-white/20 p-2 rounded-control"><FileTextIcon className="w-4 h-4"/> Fil vedhæftet</div>
                                        }
                                        </div>
                                    )}
                                    {msg.text && (msg.role === 'user' ? <span>{msg.text}</span> : <div className="prose prose-sm dark:prose-invert max-w-none prose-p:mb-2 last:prose-p:mb-0"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown></div>)}
                                    {msg.role === 'bot' && msg.attachment && (<div className="mt-2 border-t border-border dark:border-border-dark pt-2"><img src={msg.attachment.dataUrl} alt="Attachment" className="rounded-control max-w-full h-auto" /></div>)}
                                </div>
                            </div>
                        ))}
                        {isLoading && <div className="flex items-end gap-2"><div className="w-7 h-7 bg-brand-subtle dark:bg-brand-subtle-dark text-brand-primary dark:text-brand-light rounded-full flex items-center justify-center flex-shrink-0 font-bold text-caption" aria-hidden="true">B</div><div className="bg-bg-muted dark:bg-bg-dark-muted rounded-2xl rounded-bl-none px-4 py-3.5"><div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-text-tertiary dark:bg-text-dark-tertiary rounded-full animate-pulse delay-0"></span><span className="w-2 h-2 bg-text-tertiary dark:bg-text-dark-tertiary rounded-full animate-pulse delay-150"></span><span className="w-2 h-2 bg-text-tertiary dark:bg-text-dark-tertiary rounded-full animate-pulse delay-300"></span></div></div></div>}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="border-t border-border dark:border-border-dark flex-shrink-0 bg-bg dark:bg-bg-dark-surface">
                        {attachment && (
                            <div className="px-4 py-2.5 border-b border-border dark:border-border-dark flex items-center justify-between gap-2">
                                <span className="text-caption text-text-secondary dark:text-text-dark-secondary truncate">Fil valgt: {attachment.file.name}</span>
                                <button type="button" onClick={removeAttachment} aria-label="Fjern fil" className="p-1.5 rounded-control text-text-tertiary hover:text-danger transition-colors duration-150 shrink-0"><XIcon className="w-4 h-4"/></button>
                            </div>
                        )}
                        <div className="p-3 flex items-end gap-1.5">
                            <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} aria-label="Tag billede" onChange={handleCameraCapture} />
                            <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={isLoading} aria-label="Tag billede" className="w-11 h-11 flex items-center justify-center rounded-control text-text-secondary hover:text-brand-primary hover:bg-brand-subtle dark:text-text-dark-secondary dark:hover:bg-brand-subtle-dark transition-colors duration-150 disabled:opacity-50 shrink-0"><CameraIcon className="w-5 h-5" /></button>
                            <div className="shrink-0 mb-1"><FilePicker onFileSelect={handleFileSelect} accept="image/*,application/pdf" buttonStyle="icon"/></div>
                            <div className="flex-1 min-w-0">
                                <Textarea
                                    ref={textareaRef}
                                    value={userInput}
                                    onChange={(e) => setUserInput(e.target.value)}
                                    onKeyDown={handleInputKeyDown}
                                    placeholder={isLoading ? "Vent venligst..." : "Skriv en besked..."}
                                    aria-label="Besked til assistenten"
                                    disabled={isLoading}
                                    rows={1}
                                    className="resize-none overflow-y-auto hide-scrollbar min-h-11 max-h-28"
                                />
                            </div>
                            <button type="button" onClick={handleSend} disabled={isLoading || (!userInput.trim() && !attachment)} aria-label="Send besked" className="w-11 h-11 rounded-full bg-brand-primary text-white flex items-center justify-center shadow-sm hover:bg-brand-strong transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"><SendIcon className="w-4 h-4 ml-0.5" /></button>
                        </div>
                    </div>
            </div>
        </>
    );
};

export default Chatbot;
