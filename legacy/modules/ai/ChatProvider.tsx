import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';

export interface Message {
    id: string;
    text: string;
    role: 'user' | 'bot';
    attachment?: {
        type: 'image';
        dataUrl: string;
    }
}

interface ChatSession {
    [contextId: string]: Message[];
}

interface ChatContextType {
    getSession: (contextId: string) => Message[];
    addMessage: (contextId: string, message: Message) => void;
    clearSession: (contextId: string) => void;
    /** Whether the AI chat panel is open (toggled from the global top bar). */
    isChatOpen: boolean;
    setChatOpen: (open: boolean) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const CHAT_STORAGE_KEY = 'bygSmartChatSessions';

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [sessions, setSessions] = useState<ChatSession>(() => {
        try {
            const storedSessions = localStorage.getItem(CHAT_STORAGE_KEY);
            return storedSessions ? JSON.parse(storedSessions) : {};
        } catch (error) {
            console.error('Error loading chat sessions from localStorage', error);
            return {};
        }
    });

    useEffect(() => {
        try {
            // Create a lightweight copy for storage to avoid QuotaExceededError
            const sessionsToSave: ChatSession = {};
            Object.keys(sessions).forEach(key => {
                // Limit history to last 50 messages per context
                const recentMessages = sessions[key].slice(-50);
                
                sessionsToSave[key] = recentMessages.map(msg => {
                    // Strip large image data from storage persistence
                    if (msg.attachment?.dataUrl && msg.attachment.dataUrl.length > 500) {
                        return {
                            ...msg,
                            attachment: {
                                ...msg.attachment,
                                dataUrl: '' // Clear data for storage, UI handles empty dataUrl gracefully
                            }
                        };
                    }
                    return msg;
                });
            });
            
            localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(sessionsToSave));
        } catch (error) {
            // If still failing, try to clear older sessions or just log warning
            console.warn('Error saving chat sessions to localStorage - likely quota exceeded', error);
        }
    }, [sessions]);

    const getSession = (contextId: string): Message[] => {
        return sessions[contextId] || [];
    };

    const addMessage = (contextId: string, message: Message) => {
        setSessions(prevSessions => {
            const currentSession = prevSessions[contextId] || [];
            return {
                ...prevSessions,
                [contextId]: [...currentSession, message],
            };
        });
    };
    
    const clearSession = (contextId: string) => {
        setSessions(prevSessions => {
            const newSessions = { ...prevSessions };
            delete newSessions[contextId];
            return newSessions;
        });
    }

    const [isChatOpen, setChatOpen] = useState(false);

    const value = { getSession, addMessage, clearSession, isChatOpen, setChatOpen };

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = () => {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
};