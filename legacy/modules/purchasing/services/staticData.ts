// This file contains static data that doesn't change and doesn't need to be in the database for the demo.
import type { Supplier, VendorItem } from '../../../types';

export const suppliers: Supplier[] = [
    { id: 'silvan', name: 'Silvan' },
    { id: 'bauhaus', name: 'Bauhaus' },
    { id: 'stark', name: 'Stark' },
    { id: 'xl-byg', name: 'XL-Byg' },
];

export const vendorItems: VendorItem[] = [
    // Silvan
    { id: 'si1', supplierId: 'silvan', itemNumber: '321001', name: 'Gipsplade 13mm', price: 89, unit: 'stk' },
    { id: 'si2', supplierId: 'silvan', itemNumber: '874200', name: 'Træskrue 5×60 mm', price: 149, unit: 'pakke' },
    { id: 'si3', supplierId: 'silvan', itemNumber: '990345', name: 'Spartelmasse 10L', price: 249, unit: 'spand' },
    // Bauhaus
    { id: 'bh1', supplierId: 'bauhaus', itemNumber: '550112', name: 'Cement 25kg', price: 54, unit: 'sæk' },
    { id: 'bh2', supplierId: 'bauhaus', itemNumber: '663840', name: 'Træbjælke 45×95', price: 38, unit: 'm' },
    { id: 'bh3', supplierId: 'bauhaus', itemNumber: '782100', name: 'Malerrulle Pro', price: 79, unit: 'stk' },
    // Stark
    { id: 'st1', supplierId: 'stark', itemNumber: '112340', name: 'Leca blokke', price: 12, unit: 'stk' },
    { id: 'st2', supplierId: 'stark', itemNumber: '448899', name: 'Tagpap Base', price: 499, unit: 'rulle' },
    { id: 'st3', supplierId: 'stark', itemNumber: '558220', name: 'Winkeljern 50mm', price: 19, unit: 'stk' },
    // XL-Byg
    { id: 'xl1', supplierId: 'xl-byg', itemNumber: '770009', name: 'Terrassedæk Planke', price: 65, unit: 'm' },
    { id: 'xl2', supplierId: 'xl-byg', itemNumber: '556743', name: 'Betonanker 10×120', price: 7, unit: 'stk' },
    { id: 'xl3', supplierId: 'xl-byg', itemNumber: '998221', name: 'Sandpapir korn 120', price: 12, unit: 'ark' },
];

const mockApiCall = <T>(data: T, delay = 50): Promise<T> =>
  new Promise(resolve => setTimeout(() => resolve(JSON.parse(JSON.stringify(data))), delay));

export const getSuppliers = (): Promise<Supplier[]> => mockApiCall(suppliers);

export const getVendorItemsBySupplier = (supplierId: string): Promise<VendorItem[]> => {
    return mockApiCall(vendorItems.filter(item => item.supplierId === supplierId));
};
