
// A utility to "see" the screen for the AI

interface UIElement {
    type: string;
    text: string;
    role?: string;
    refId?: string;
    value?: string;
}

export const getScreenContext = (): string => {
    // Selectors for interesting elements
    const interactiveSelectors = [
        'button', 
        'a[href]', 
        'input', 
        'textarea', 
        'select', 
        '[role="button"]',
        '[data-ref-id]',
        'h1', 'h2', 'h3' // Headings for context
    ].join(', ');

    const elements = Array.from(document.querySelectorAll(interactiveSelectors));
    const visibleElements: UIElement[] = [];

    // Helper to check visibility
    const isVisible = (el: HTMLElement) => {
        return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    };

    elements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        if (!isVisible(htmlEl)) return;

        // Skip elements inside the chat window itself to avoid recursion/confusion
        if (htmlEl.closest('[data-no-snapshot="true"]')) return;

        let text = htmlEl.innerText || (htmlEl as HTMLInputElement).placeholder || (htmlEl as HTMLInputElement).value || htmlEl.getAttribute('aria-label') || "";
        text = text.replace(/\s+/g, ' ').trim();

        // Skip empty elements unless they have a specific ref-id (like an icon button)
        if (!text && !htmlEl.getAttribute('data-ref-id')) return; 

        visibleElements.push({
            type: htmlEl.tagName.toLowerCase(),
            text: text.substring(0, 50), // Truncate for token efficiency
            refId: htmlEl.getAttribute('data-ref-id') || undefined,
            value: (htmlEl as HTMLInputElement).value || undefined
        });
    });

    // Construct a prompt-friendly description
    let contextStr = "CURRENT SCREEN CONTEXT (What you can see):\n";
    
    visibleElements.forEach(el => {
        const idPart = el.refId ? ` (ID: ${el.refId})` : '';
        const valPart = el.value ? ` [Current Value: ${el.value}]` : '';
        contextStr += `- [${el.type.toUpperCase()}] "${el.text}"${idPart}${valPart}\n`;
    });

    if (visibleElements.length === 0) {
        contextStr += "No interactive elements detected on this screen.";
    }

    return contextStr;
};
