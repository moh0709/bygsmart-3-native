
// BBR Service - Integration with Datafordeler and DAWA

const BBR_USER = '6RYKPaUNboL1fk3EQazGQjAALHq8UNh86f2QtPIk42vOU8AjxMKi5w42BWJ5dblUvdyPlu46b3vy6VaERlMuf7itb5FzHCBNE';
const BBR_PASS = '0FT66yFQZF8KfMEVhRW1Jtxfgropjjdz';

// DAWA API for address lookup (No key required for basic use)
const DAWA_API = 'https://api.dataforsyningen.dk/adgangsadresser';

// Datafordeler BBR Public REST Service
const DATAFORDELER_API = 'https://services.datafordeler.dk/BBR/BBRPublic/1/REST/bygning';

export interface BBRData {
    buildingYear: string;
    floors: string;
    area: string;
    usage: string;
    wallMaterial: string;
    roofMaterial: string;
    hasBasement: boolean;
    hasTerrace: boolean; // Inferred
}

// --- Mappings for BBR Codes ---
// Source: BBR Kodelister (Simplified)
const USAGE_CODES: Record<string, string> = {
    '110': 'Stuehus til landbrug',
    '120': 'Fritliggende enfamiliehus',
    '121': 'Sammenbygget enfamiliehus',
    '130': 'Række-, kæde- eller dobbelthus',
    '131': 'Rækkehus',
    '132': 'Dobbelthus',
    '140': 'Etagebolig',
    '150': 'Kollegium',
    '160': 'Døgninstitution',
    '190': 'Anden beboelse',
    '510': 'Sommerhus',
    '910': 'Garage',
    '920': 'Carport',
    '930': 'Udhus'
};

const WALL_MATERIALS: Record<string, string> = {
    '1': 'Mursten',
    '2': 'Træ',
    '3': 'Betonelementer',
    '4': 'Letbetonsten',
    '5': 'Fibercement',
    '6': 'Metalplader',
    '8': 'Glas',
    '10': 'Komposit',
    '11': 'PVC'
};

const ROOF_MATERIALS: Record<string, string> = {
    '1': 'Tagpap',
    '2': 'Fibercement (bølge)',
    '3': 'Betonsten',
    '4': 'Tegl',
    '5': 'Skifer',
    '6': 'Metal',
    '7': 'Stråtag',
    '10': 'Glas',
    '11': 'Grønne tage'
};

export const fetchBuildingData = async (addressQuery: string): Promise<BBRData | null> => {
    console.log(`[BBR Service] Looking up: ${addressQuery}`);

    try {
        // 1. Resolve Address to UUID using DAWA
        const addressId = await lookupAddressId(addressQuery);
        
        let buildings: any[] = [];

        if (addressId) {
             console.log(`[BBR Service] Found Address ID: ${addressId}`);
             // 2. Fetch Building Data from Datafordeler
             // NOTE: This will likely fail in a browser due to CORS/403 without a proxy.
             try {
                buildings = await fetchBbrData(addressId);
             } catch (bbrError) {
                 console.error("[BBR Service] Datafordeler API failed:", bbrError);
                 return null; // Propagate error to UI
             }
        } else {
             console.warn("[BBR Service] Address not found in DAWA.");
             return null;
        }

        if (!buildings || buildings.length === 0) {
             return null;
        }

        // 3. Select the primary building
        let primaryBuilding = buildings.find((b: any) => {
            const usage = b.bygningensAnvendelse || '';
            return usage.startsWith('1') || usage.startsWith('5');
        });

        // Fallback: If no residence found, take the largest building by area
        if (!primaryBuilding) {
            primaryBuilding = buildings.reduce((prev: any, current: any) => {
                return (prev.samletBygningsareal > current.samletBygningsareal) ? prev : current;
            }, buildings[0]);
        }

        return parseBbrObject(primaryBuilding);

    } catch (error) {
        console.error("[BBR Service] Fatal Error:", error);
        return null;
    }
};

// Helper: Lookup Address ID via DAWA
async function lookupAddressId(query: string): Promise<string | null> {
    try {
        // q=query, struktur=mini (lighter response)
        const response = await fetch(`${DAWA_API}?q=${encodeURIComponent(query)}&format=json&struktur=mini&per_side=1`);
        const data = await response.json();
        
        if (Array.isArray(data) && data.length > 0) {
            return data[0].id; // UUID for the Access Address (Adgangsadresse)
        }
        return null;
    } catch (e) {
        console.error("DAWA Lookup Failed", e);
        return null;
    }
}

// Helper: Fetch BBR Data via Datafordeler
async function fetchBbrData(addressId: string): Promise<any[]> {
    // Note: Using 'husnummer' parameter which corresponds to Adgangsadresse ID in BBR REST
    const url = `${DATAFORDELER_API}?husnummer=${addressId}&username=${BBR_USER}&password=${BBR_PASS}&format=JSON`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Datafordeler responded with ${response.status}`);
    }

    const json = await response.json();
    
    // Datafordeler Structure: Array of Events. We look for 'Beskeddata' -> 'Objektdata' -> 'Bygning'
    // Flattening the structure to get the actual building objects
    const buildings: any[] = [];

    if (Array.isArray(json)) {
        json.forEach((eventWrapper: any) => {
             const beskedData = eventWrapper?.Message?.Grunddatabesked?.Hændelsesbesked?.Beskeddata;
             if (Array.isArray(beskedData)) {
                 beskedData.forEach((item: any) => {
                     if (item.Objektdata && item.Objektdata.Bygning) {
                         buildings.push(item.Objektdata.Bygning);
                     }
                 });
             }
        });
    }
    
    return buildings;
}

// Helper: Parse Raw BBR Object
function parseBbrObject(b: any): BBRData {
    // Safely extract fields
    const year = b.opførelsesår ? b.opførelsesår.toString() : '';
    const floors = b.etager ? b.etager.toString() : '1';
    const area = b.samletBygningsareal ? b.samletBygningsareal.toString() : '0';
    const basementArea = b.kælderareal ? b.kælderareal : 0;
    
    // Map Codes
    const usageCode = b.bygningensAnvendelse ? b.bygningensAnvendelse.toString() : '';
    const usage = USAGE_CODES[usageCode] || `Bygningstype ${usageCode}`;
    
    const wallCode = b.ydervæggensMateriale ? b.ydervæggensMateriale.toString() : '';
    const wallMat = WALL_MATERIALS[wallCode] || 'Ukendt';

    const roofCode = b.tagdækningsmateriale ? b.tagdækningsmateriale.toString() : '';
    const roofMat = ROOF_MATERIALS[roofCode] || 'Ukendt';

    return {
        buildingYear: year,
        floors: floors,
        area: area,
        usage: usage,
        wallMaterial: wallMat,
        roofMaterial: roofMat,
        hasBasement: basementArea > 0,
        hasTerrace: false // BBR doesn't always reliably list terraces on the main building object
    };
}
