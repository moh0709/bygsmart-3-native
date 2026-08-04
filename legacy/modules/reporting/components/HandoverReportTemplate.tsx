import React, { useState, useEffect } from 'react';
import { Project } from '../../../types';
import { HandoverReportContent } from '../../ai';
import { BuildingIcon } from '../../../components/icons';

interface HandoverReportTemplateProps {
    project: Project;
    content: HandoverReportContent;
}

export const HandoverReportTemplate: React.FC<HandoverReportTemplateProps> = ({ project, content }) => {
    return (
        <div id="handover-report-container" className="bg-white text-black p-12 max-w-[210mm] mx-auto shadow-lg min-h-[297mm] flex flex-col font-sans">
            {/* Header */}
            <div className="flex justify-between items-center border-b-4 border-brand-primary pb-6 mb-8">
                <div className="flex items-center space-x-3">
                    <div className="bg-brand-primary p-3 rounded-lg">
                        <BuildingIcon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">OVERDRAGELSESRAPPORT</h1>
                        <p className="text-sm text-gray-500 uppercase tracking-widest mt-1">BYG SMART Construction</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="font-bold text-lg">{project.name}</p>
                    <p className="text-sm text-gray-500">Dato: {new Date().toLocaleDateString('da-DK')}</p>
                </div>
            </div>

            {/* Project Details Grid */}
            <div className="grid grid-cols-2 gap-x-12 gap-y-4 mb-10 text-sm">
                <div className="border-b border-gray-200 pb-2">
                    <span className="font-bold text-gray-500 uppercase text-xs block mb-1">Bygherre</span>
                    <span className="text-gray-900 text-base font-medium">{project.clientName}</span>
                </div>
                <div className="border-b border-gray-200 pb-2">
                    <span className="font-bold text-gray-500 uppercase text-xs block mb-1">Projekt ID</span>
                    <span className="text-gray-900 text-base font-medium">{project.projectNumber}</span>
                </div>
                <div className="border-b border-gray-200 pb-2">
                    <span className="font-bold text-gray-500 uppercase text-xs block mb-1">Adresse</span>
                    <span className="text-gray-900 text-base font-medium">{project.address}</span>
                </div>
                <div className="border-b border-gray-200 pb-2">
                    <span className="font-bold text-gray-500 uppercase text-xs block mb-1">Periode</span>
                    <span className="text-gray-900 text-base font-medium">{project.startDate} — {project.endDate}</span>
                </div>
            </div>

            {/* Content Sections */}
            <div className="space-y-8 flex-grow">
                <section>
                    <h2 className="text-xl font-bold text-brand-primary mb-3 uppercase tracking-wide border-b border-gray-200 pb-1">Resumé</h2>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">{content.executiveSummary}</p>
                </section>

                <section>
                    <h2 className="text-xl font-bold text-brand-primary mb-3 uppercase tracking-wide border-b border-gray-200 pb-1">Projektforløb</h2>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">{content.projectFlow}</p>
                </section>

                <section>
                    <h2 className="text-xl font-bold text-brand-primary mb-3 uppercase tracking-wide border-b border-gray-200 pb-1">Statusoversigt</h2>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">{content.statusOverview}</p>
                </section>

                {content.unfinishedTasks.length > 0 && (
                    <section>
                        <h2 className="text-xl font-bold text-brand-primary mb-3 uppercase tracking-wide border-b border-gray-200 pb-1">Mangelliste / Udeståender</h2>
                        <div className="overflow-hidden rounded-lg border border-gray-200">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-12">Status</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Opgave</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Konsekvens / Note</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {content.unfinishedTasks.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="h-4 w-4 border-2 border-gray-400 rounded"></div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.task}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{item.impact}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                <section>
                    <h2 className="text-xl font-bold text-brand-primary mb-3 uppercase tracking-wide border-b border-gray-200 pb-1">Konklusion & Garanti</h2>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">{content.finalConclusion}</p>
                </section>
            </div>

            {/* Footer / Signatures */}
            <div className="mt-16 pt-8 border-t-2 border-gray-300">
                <div className="grid grid-cols-2 gap-16">
                    <div>
                        <div className="h-16 border-b border-gray-400 mb-2"></div>
                        <p className="font-bold text-sm text-gray-900">Dato & Underskrift, Entreprenør</p>
                    </div>
                    <div>
                        <div className="h-16 border-b border-gray-400 mb-2"></div>
                        <p className="font-bold text-sm text-gray-900">Dato & Underskrift, Bygherre</p>
                    </div>
                </div>
                <div className="mt-8 text-center text-xs text-gray-400">
                    Genereret af BYG SMART | {new Date().toLocaleDateString('da-DK')}
                </div>
            </div>
        </div>
    );
};