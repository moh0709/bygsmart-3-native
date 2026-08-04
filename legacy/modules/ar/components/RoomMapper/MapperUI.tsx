
import React from 'react';
import { MappedElementType } from '../../../../types';
import { PlusIcon, XIcon, CheckCircleIcon, ArrowLeftIcon, BuildingIcon, HomeIcon, LayersIcon, TrashIcon, EditIcon } from '../../../../components/icons';

interface MapperUIProps {
    currentMode: MappedElementType;
    onSetMode: (mode: MappedElementType) => void;
    onUndo: () => void;
    onReset: () => void;
    onClose: () => void;
    onFinish: () => void;
    canUndo: boolean;
    canFinish: boolean;
    stats: { length: number, count: number };
    isAR: boolean;
    liveDistance: number;
    isTracing: boolean;
    onToggleTrace: () => void;
}

export const MapperUI: React.FC<MapperUIProps> = ({ 
    currentMode, onSetMode, onUndo, onReset, onClose, onFinish, canUndo, canFinish, stats, isAR,
    liveDistance, isTracing, onToggleTrace
}) => {
    return (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-40">
            {/* Header */}
            <div className="flex justify-between items-start pointer-events-auto">
                <div className="flex gap-2">
                    <button onClick={onClose} className="bg-bg-dark/90 text-white p-3 rounded-full shadow-lg hover:bg-bg-dark-muted transition-colors">
                        <ArrowLeftIcon className="w-6 h-6"/>
                    </button>

                    <button onClick={onReset} className="bg-danger/90 text-white p-3 rounded-full shadow-lg hover:bg-danger-strong transition-colors" title="Nulstil måling">
                        <TrashIcon className="w-6 h-6"/>
                    </button>
                </div>

                <div className="bg-black/60 backdrop-blur-md rounded-xl p-3 text-white flex flex-col items-end">
                    {liveDistance > 0 && (
                        <div className="mb-2">
                            <span className="text-xs font-bold uppercase text-brand-primary mr-2">Måler...</span>
                            <span className="text-2xl font-bold text-white">{liveDistance.toFixed(2)}</span>
                            <span className="text-sm text-white/80 ml-1">m</span>
                        </div>
                    )}
                    <div className="flex gap-4 border-t border-white/20 pt-1">
                        <div>
                            <span className="text-sm font-bold">{stats.length.toFixed(2)}</span>
                            <span className="text-caption ml-1 opacity-70">m (total)</span>
                        </div>
                        <div>
                            <span className="text-sm font-bold">{stats.count}</span>
                            <span className="text-caption ml-1 opacity-70">emner</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Instruction Banner */}
            {!isAR && (
                <div className="flex justify-center">
                    <div className="bg-brand-primary/80 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg">
                        Klik i gitteret for at placere punkter
                    </div>
                </div>
            )}

            {/* Controls */}
            <div className="pointer-events-auto space-y-4 mb-safe-bottom">
                {/* Tools Row */}
                <div className="flex gap-3">
                     <button 
                        onClick={onToggleTrace}
                        disabled={!isAR}
                        className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg transition-all ${!isAR ? 'bg-bg-muted text-text-tertiary cursor-not-allowed' : isTracing ? 'bg-danger text-white animate-pulse' : 'bg-bg text-text-primary'}`}
                    >
                        <EditIcon className="w-5 h-5"/>
                        {isTracing ? 'Stop Trace' : 'Auto-Trace'}
                    </button>
                </div>

                {/* Mode Selector */}
                <div className="flex bg-white/90 backdrop-blur-md rounded-xl p-1.5 shadow-xl border border-white/20">
                    <button 
                        onClick={() => onSetMode('wall')} 
                        className={`flex-1 py-2 rounded-control flex flex-col items-center gap-1 transition-colors ${currentMode === 'wall' ? 'bg-brand-primary text-white shadow-md' : 'text-text-secondary hover:bg-bg-muted'}`}
                    >
                        <BuildingIcon className="w-5 h-5"/>
                        <span className="text-caption font-bold uppercase">Væg</span>
                    </button>
                    <button
                        onClick={() => onSetMode('window')}
                        className={`flex-1 py-2 rounded-control flex flex-col items-center gap-1 transition-colors ${currentMode === 'window' ? 'bg-info text-white shadow-md' : 'text-text-secondary hover:bg-bg-muted'}`}
                    >
                        <LayersIcon className="w-5 h-5"/>
                        <span className="text-caption font-bold uppercase">Vindue</span>
                    </button>
                    <button
                        onClick={() => onSetMode('door')}
                        className={`flex-1 py-2 rounded-control flex flex-col items-center gap-1 transition-colors ${currentMode === 'door' ? 'bg-warning text-white shadow-md' : 'text-text-secondary hover:bg-bg-muted'}`}
                    >
                        <HomeIcon className="w-5 h-5"/>
                        <span className="text-caption font-bold uppercase">Dør</span>
                    </button>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button 
                        onClick={onUndo} 
                        disabled={!canUndo}
                        className="flex-1 bg-bg/90 backdrop-blur-md text-text-primary font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform flex items-center justify-center gap-2"
                    >
                        <ArrowLeftIcon className="w-5 h-5"/> Fortryd
                    </button>
                    <button
                        onClick={onFinish}
                        disabled={!canFinish}
                        className="flex-[2] bg-success text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform flex items-center justify-center gap-2"
                    >
                        <CheckCircleIcon className="w-6 h-6"/> Gem Plan
                    </button>
                </div>
            </div>
        </div>
    );
};
