
import { NavigateFunction } from 'react-router-dom';

export const navigateToAndHighlight = (
    navigate: NavigateFunction, 
    route: string, 
    highlightRef: string
): string => {
    console.log(`Navigating to ${route} and highlighting ${highlightRef}`);

    const path = route.startsWith('#') ? route.substring(1) : route;

    const performHighlight = () => {
        setTimeout(() => {
            highlightElement(undefined, highlightRef);
        }, 800); // Delay to allow render
    };

    const currentPath = window.location.hash.split('?')[0];
    // remove leading # if present for comparison
    const normalizedCurrent = currentPath.replace(/^#\/?/, '/').replace(/\/$/, '');
    const normalizedTarget = path.replace(/\/$/, '');
    
    if (normalizedCurrent === normalizedTarget) {
        performHighlight();
    } else {
        navigate(path);
        performHighlight();
    }
    return `Navigated to the requested section.`;
};


export const getImageType = (dataUrl: string): string => {
    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,/i);
    if (match && match[1]) {
        const type = match[1].toUpperCase();
        return type === 'JPG' ? 'JPEG' : type;
    }
    return 'PNG'; 
};

export const highlightElement = (refId?: string, textMatch?: string): string => {
    // Clear existing highlights first
    document.querySelectorAll('.bot-highlight').forEach(el => el.classList.remove('bot-highlight'));

    let element: HTMLElement | null = null;

    // 1. Try exact ID match if provided
    if (refId) {
        element = document.querySelector(`[data-ref-id="${refId}"]`) as HTMLElement;
        if (!element) element = document.getElementById(refId);
    }

    // 2. If not found, search by text content
    if (!element && textMatch) {
        const searchStr = textMatch.toLowerCase().trim();
        
        // Look for exact matches in interactive elements first
        const selectors = ['button', 'a', 'input', 'h1', 'h2', 'h3', 'span', 'div[role="button"]'];
        
        // Helper to check text
        const matchesText = (el: HTMLElement) => {
            const t = el.innerText || (el as HTMLInputElement).value || (el as HTMLInputElement).placeholder || el.getAttribute('aria-label') || '';
            return t.toLowerCase().includes(searchStr);
        }

        // Breadth-first search for visible elements matching text
        for (const sel of selectors) {
            const candidates = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
            // Prefer elements that start with the text or equal it
            element = candidates.find(el => {
                const t = (el.innerText || '').toLowerCase().trim();
                return t === searchStr && el.offsetParent !== null; // Visible
            }) || candidates.find(el => matchesText(el) && el.offsetParent !== null);
            
            if (element) break;
        }
    }

    if (element) {
        // Scroll Logic
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        
        // Highlight Logic
        element.classList.add('bot-highlight');
        
        // Remove after 4 seconds
        setTimeout(() => {
            element?.classList.remove('bot-highlight');
        }, 4000);
        
        return `Highlighted: ${textMatch || refId}`;
    }

    return "Could not find element.";
};
