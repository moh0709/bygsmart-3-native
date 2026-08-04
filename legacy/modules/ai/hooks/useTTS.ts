
import { useState, useEffect, useRef, useCallback } from 'react';

interface UseTTSReturn {
    speak: (text: string, onComplete?: () => void) => void;
    cancel: () => void;
    isSpeaking: boolean;
    currentSubtitle: string;
    isSupported: boolean;
}

export const useTTS = (): UseTTSReturn => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [currentSubtitle, setCurrentSubtitle] = useState('');
    const [isSupported, setIsSupported] = useState(false);
    
    const synth = useRef<SpeechSynthesis | null>(null);
    const onCompleteRef = useRef<(() => void) | undefined>(undefined);
    const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
    const isCancelledRef = useRef(false); // Track cancellation state explicitly

    // Initialize and Load Voices
    useEffect(() => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            synth.current = window.speechSynthesis;
            setIsSupported(true);
            
            const loadVoices = () => {
                const voices = synth.current?.getVoices() || [];
                if (voices.length > 0) {
                    // Filter Danish voices
                    const danish = voices.filter(v => v.lang.includes('da'));
                    
                    // Prioritize High Quality
                    // 1. "Google" (Chrome often has 'Google Dansk')
                    // 2. "Sara" or "Magnus" (Apple/Microsoft common names)
                    // 3. Any Danish
                    let best = danish.find(v => v.name.includes('Google') && v.lang === 'da-DK');
                    if (!best) best = danish.find(v => v.name.includes('Premium') || v.name.includes('Enhanced'));
                    if (!best) best = danish[0];
                    
                    selectedVoiceRef.current = best || null;
                }
            };

            // Chrome loads voices asynchronously
            if (synth.current.onvoiceschanged !== undefined) {
                synth.current.onvoiceschanged = loadVoices;
            }
            loadVoices(); // Try immediately too
        }
    }, []);

    const cancel = useCallback(() => {
        if (synth.current) {
            isCancelledRef.current = true; // Mark as explicitly cancelled
            synth.current.cancel();
            setIsSpeaking(false);
            setCurrentSubtitle('');
            if (onCompleteRef.current) {
                onCompleteRef.current = undefined;
            }
        }
    }, []);

    const speak = useCallback((text: string, onComplete?: () => void) => {
        if (!synth.current) {
            if (onComplete) onComplete();
            return;
        }

        // Reset flags
        isCancelledRef.current = false;
        
        // Stop any previous speech immediately
        synth.current.cancel();

        // Clean text: Remove markdown links [Label](url) -> Label and syntax
        const cleanText = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                              .replace(/[*#`_]/g, ''); 

        onCompleteRef.current = onComplete;
        setIsSpeaking(true);

        // Split into chunks for better subtitle sync and to avoid browser limits
        // Split by punctuation
        const chunks = cleanText.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [cleanText];
        
        let chunkIndex = 0;

        const speakNextChunk = () => {
            // If the user cancelled specificially, do not proceed
            if (isCancelledRef.current) {
                return; 
            }

            if (chunkIndex >= chunks.length) {
                setIsSpeaking(false);
                setCurrentSubtitle('');
                if (onCompleteRef.current) {
                    const cb = onCompleteRef.current;
                    onCompleteRef.current = undefined;
                    cb();
                }
                return;
            }

            const chunkText = chunks[chunkIndex].trim();
            if (!chunkText) {
                chunkIndex++;
                speakNextChunk();
                return;
            }

            const utterance = new SpeechSynthesisUtterance(chunkText);
            utterance.lang = 'da-DK';
            utterance.rate = 1.0; 
            utterance.pitch = 1.0;
            
            if (selectedVoiceRef.current) {
                utterance.voice = selectedVoiceRef.current;
            }

            utterance.onstart = () => {
                // Only update UI if not cancelled
                if (!isCancelledRef.current) {
                    setCurrentSubtitle(chunkText);
                }
            };
            
            utterance.onend = () => {
                if (!isCancelledRef.current) {
                    chunkIndex++;
                    speakNextChunk();
                }
            };

            utterance.onerror = (e) => {
                // 'interrupted' or 'canceled' are expected when we stop speech manually.
                // We only want to log genuine errors.
                if (e.error !== 'interrupted' && e.error !== 'canceled') {
                    console.error("TTS Error:", e.error);
                }
                
                // If it was a real error, try to skip to next chunk to recover
                if (!isCancelledRef.current) {
                    chunkIndex++;
                    speakNextChunk();
                }
            };

            try {
                synth.current!.speak(utterance);
            } catch (e) {
                console.error("TTS Speak Exception:", e);
                setIsSpeaking(false);
            }
        };

        speakNextChunk();

    }, [cancel]);

    return { speak, cancel, isSpeaking, currentSubtitle, isSupported };
};
