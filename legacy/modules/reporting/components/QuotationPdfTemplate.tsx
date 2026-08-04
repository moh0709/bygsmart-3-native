import React from 'react';
import { Quotation, QuotationLineItem, Project } from '../../../types';
import { BuildingIcon } from '../../../components/icons';

interface QuotationPdfTemplateProps {
    quotation: Quotation;
    lineItems: QuotationLineItem[];
    project: Project;
}

const kindLabel = (kind: QuotationLineItem['kind']) => {
    if (kind === 'MATERIAL') return 'Materiale';
    if (kind === 'LABOR') return 'Arbejde';
    return 'Andet';
};

const fmtCurrency = (amount: number, currency: string) =>
    `${amount.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

const statusLabel: Record<string, string> = {
    DRAFT: 'Kladde',
    SENT: 'Sendt',
    ACCEPTED: 'Accepteret',
    REJECTED: 'Afvist',
};

export const QuotationPdfTemplate: React.FC<QuotationPdfTemplateProps> = ({ quotation, lineItems, project }) => {
    return (
        <div id="quotation-pdf-container" className="bg-white text-black p-12 max-w-[210mm] mx-auto shadow-lg min-h-[297mm] flex flex-col font-sans text-sm">
            {/* Header */}
            <div className="flex justify-between items-start border-b-4 border-brand-primary pb-6 mb-8">
                <div className="flex items-center space-x-3">
                    <div className="bg-brand-primary p-3 rounded-lg">
                        <BuildingIcon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">TILBUD</h1>
                        <p className="text-xs text-gray-500 uppercase tracking-widest mt-0.5">BYG SMART Construction</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="font-bold text-lg">{quotation.number}</p>
                    <p className="text-xs text-gray-500">Dato: {new Date(quotation.createdAt).toLocaleDateString('da-DK')}</p>
                    {quotation.validUntil && (
                        <p className="text-xs text-gray-500">Gyldig til: {new Date(quotation.validUntil).toLocaleDateString('da-DK')}</p>
                    )}
                    <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-semibold">
                        {statusLabel[quotation.status] ?? quotation.status}
                    </span>
                </div>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Sælger / Entreprenør</p>
                    <p className="font-semibold text-gray-900">BYG SMART Construction</p>
                    <p className="text-gray-600 text-xs">{project.address}</p>
                </div>
                <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Køber / Bygherre</p>
                    <p className="font-semibold text-gray-900">{quotation.clientName || project.clientName}</p>
                    <p className="text-gray-600 text-xs">{project.address}</p>
                </div>
            </div>

            {/* Project reference */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 grid grid-cols-2 gap-4">
                <div>
                    <span className="text-xs text-gray-500 uppercase font-bold block mb-0.5">Projekt</span>
                    <span className="font-semibold text-gray-900">{project.name}</span>
                </div>
                <div>
                    <span className="text-xs text-gray-500 uppercase font-bold block mb-0.5">Projektnummer</span>
                    <span className="font-semibold text-gray-900">{project.projectNumber}</span>
                </div>
                <div>
                    <span className="text-xs text-gray-500 uppercase font-bold block mb-0.5">Tilbudstittel</span>
                    <span className="font-semibold text-gray-900">{quotation.title}</span>
                </div>
                <div>
                    <span className="text-xs text-gray-500 uppercase font-bold block mb-0.5">Adresse</span>
                    <span className="font-semibold text-gray-900">{project.address}</span>
                </div>
            </div>

            {/* Line items */}
            <div className="flex-grow mb-8">
                <h2 className="text-base font-bold text-brand-primary mb-3 uppercase tracking-wide border-b border-gray-200 pb-1">
                    Tilbudslinjer
                </h2>
                {lineItems.length === 0 ? (
                    <p className="text-gray-400 italic text-xs">Ingen linjer tilføjet.</p>
                ) : (
                    <table className="w-full text-xs border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="py-2 px-3 text-left font-bold text-gray-500 uppercase tracking-wide">Type</th>
                                <th className="py-2 px-3 text-left font-bold text-gray-500 uppercase tracking-wide">Beskrivelse</th>
                                <th className="py-2 px-3 text-right font-bold text-gray-500 uppercase tracking-wide">Antal</th>
                                <th className="py-2 px-3 text-right font-bold text-gray-500 uppercase tracking-wide">Enhed</th>
                                <th className="py-2 px-3 text-right font-bold text-gray-500 uppercase tracking-wide">Enhedspris</th>
                                <th className="py-2 px-3 text-right font-bold text-gray-500 uppercase tracking-wide">Linjetotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {lineItems.map((item, idx) => (
                                <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="py-2 px-3 text-gray-600">{kindLabel(item.kind)}</td>
                                    <td className="py-2 px-3 text-gray-900 font-medium">{item.description}</td>
                                    <td className="py-2 px-3 text-right text-gray-700">{item.quantity.toLocaleString('da-DK')}</td>
                                    <td className="py-2 px-3 text-right text-gray-600">{item.unit ?? '—'}</td>
                                    <td className="py-2 px-3 text-right text-gray-700">{fmtCurrency(item.unitPrice, quotation.currency)}</td>
                                    <td className="py-2 px-3 text-right font-semibold text-gray-900">{fmtCurrency(item.lineTotal, quotation.currency)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-8">
                <div className="w-64 space-y-1">
                    <div className="flex justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="font-semibold">{fmtCurrency(quotation.subtotal, quotation.currency)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">Moms ({quotation.vatRate}%)</span>
                        <span className="font-semibold">{fmtCurrency(quotation.vatTotal, quotation.currency)}</span>
                    </div>
                    <div className="flex justify-between py-2 bg-brand-primary/10 rounded px-2">
                        <span className="font-bold text-brand-primary">Total inkl. moms</span>
                        <span className="font-bold text-brand-primary text-base">{fmtCurrency(quotation.total, quotation.currency)}</span>
                    </div>
                </div>
            </div>

            {/* Notes */}
            {quotation.notes && (
                <div className="mb-8">
                    <h2 className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Bemærkninger</h2>
                    <p className="text-gray-600 whitespace-pre-line border-l-2 border-brand-primary pl-3">{quotation.notes}</p>
                </div>
            )}

            {/* Terms */}
            <div className="mb-8 text-xs text-gray-500 border border-gray-200 rounded-lg p-4">
                <p className="font-bold text-gray-700 mb-1">Betalingsbetingelser</p>
                <p>Betaling forfalder 14 dage efter fakturadato. Ved for sen betaling beregnes renter i henhold til renteloven.</p>
                <p className="mt-1">Tilbuddet er gældende i 30 dage fra tilbudsdato, med mindre andet er aftalt.</p>
            </div>

            {/* Signatures */}
            <div className="mt-auto pt-8 border-t-2 border-gray-200">
                <div className="grid grid-cols-2 gap-16">
                    <div>
                        <div className="h-14 border-b border-gray-400 mb-2"></div>
                        <p className="font-bold text-xs text-gray-700">Dato & Underskrift, Entreprenør</p>
                    </div>
                    <div>
                        <div className="h-14 border-b border-gray-400 mb-2"></div>
                        <p className="font-bold text-xs text-gray-700">Dato & Underskrift, Bygherre</p>
                    </div>
                </div>
                <div className="mt-6 text-center text-xs text-gray-400">
                    Genereret af BYG SMART | {new Date().toLocaleDateString('da-DK')}
                </div>
            </div>
        </div>
    );
};
