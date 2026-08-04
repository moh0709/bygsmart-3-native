
export const calculateToolResult = (toolId: string, inputs: Record<string, string>, customPriceFactor?: number) => {
    const val = (id: string) => parseFloat(inputs[id]) || 0;
    let result = "0";
    let resultNum = 0;
    let price = 0;
    let hours = 0;
    
    // Default pricing metadata
    let priceFactor = 0;
    let priceUnit = 'kr./enhed';

    // Helper to determine factor
    const useFactor = (defaultFactor: number, unit: string) => {
        priceFactor = customPriceFactor !== undefined ? customPriceFactor : defaultFactor;
        priceUnit = unit;
        return priceFactor;
    };

    if (toolId === 'tool-roof-area') {
        const L = val('inp_len');
        const W = val('inp_wid'); 
        const pitch = val('inp_pit');
        if (L > 0 && W > 0) {
            const pitchRad = (pitch * Math.PI) / 180;
            const cosPitch = Math.cos(pitchRad) || 1;
            const area = (L * W) / cosPitch;
            resultNum = area;
            result = area.toFixed(1);
            
            const factor = useFactor(500, 'kr./m²');
            price = area * factor;
            hours = area * 0.8;
        }
    } else if (toolId === 'tool-rafter') {
        const L = val('inp_len');
        const dist = val('inp_dist');
        if (L > 0 && dist > 0) {
            const count = Math.ceil(L / dist) + 1;
            resultNum = count;
            result = count.toFixed(0);
            
            const factor = useFactor(400, 'kr./stk');
            price = count * factor; 
            hours = count * 2;
        }
    } else if (toolId === 'tool-insulation-roof') {
        const L = val('inp_iso_len');
        const W = val('inp_iso_wid');
        const waste = val('inp_iso_wastage');
        if (L > 0 && W > 0) {
            const area = L * W * (1 + waste/100);
            resultNum = area;
            result = area.toFixed(1);
            
            const factor = useFactor(150, 'kr./m²');
            price = area * factor;
            hours = area * 0.3;
        }
    } else if (toolId === 'tool-wall-area') {
        const area = val('inp_area');
        const deduction = val('inp_windows');
        if (area > 0) {
            const net = area * (1 - deduction/100);
            resultNum = net;
            result = net.toFixed(1);
            
            const factor = useFactor(120, 'kr./m²');
            price = net * factor;
            hours = net * 0.5;
        }
    } else if (toolId === 'tool-bricks') {
        const area = val('inp_b_area');
        const waste = val('inp_b_waste');
        if (area > 0) {
            const count = area * 63 * (1 + waste/100);
            resultNum = count;
            result = count.toFixed(0);
            
            const factor = useFactor(8, 'kr./stk');
            price = count * factor;
            hours = area * 1.5;
        }
    } else {
        // Fallback for generic tools not explicitly handled
        const product = Object.values(inputs).map(v => parseFloat(v) || 0).reduce((a, b) => a * (b > 0 ? b : 1), 1);
        if (product > 0 && product < 100000) {
             resultNum = product;
             result = product.toFixed(1);
             
             const factor = useFactor(100, 'kr./enhed');
             price = product * factor;
             hours = product * 0.1;
        }
    }

    return { result, price, hours, priceFactor, priceUnit, resultNum };
};
