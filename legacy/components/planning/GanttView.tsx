
import React, { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } from 'react';
import { Project, Task, Reminder } from '../../types';
import { ZoomInIcon, ZoomOutIcon, MaximizeIcon, MinimizeIcon, ChevronRightIcon } from '../icons';

interface ProjectData extends Project {
    tasks: Task[];
    reminders: Reminder[];
}

export type GanttZoomLevel = 'week' | 'month' | 'quarter';

const Tooltip: React.FC<{ tooltipId: string; targetRect: DOMRect | null; projects: ProjectData[] }> = ({ tooltipId, targetRect, projects }) => {
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: -9999, left: -9999 });

    const tooltipData = useMemo(() => {
        const [type, id] = tooltipId.split(/-(.+)/);
        if (type === 'project') {
            const project = projects.find(p => p.id === id);
            if (!project) return null;
            return {
                type: 'Projekt',
                title: project.name,
                fields: [
                    { label: 'Status', value: project.status },
                    { label: 'Fremgang', value: `${project.progress}%` },
                    { label: 'Periode', value: `${new Date(project.startDate).toLocaleDateString('da-DK')} - ${new Date(project.endDate).toLocaleDateString('da-DK')}` },
                    { label: 'Kunde', value: project.clientName },
                    { label: 'Team', value: project.team.map(t => t.initials).join(', ') }
                ]
            };
        } else if (type === 'task') {
            let task: Task | undefined;
            let projectName = '';
            for (const p of projects) {
                const found = p.tasks.find(t => t.id === id);
                if (found) { task = found; projectName = p.name; break; }
            }
            if (!task) return null;
            return {
                type: 'Opgave',
                title: task.title,
                fields: [
                    { label: 'Status', value: task.status },
                    { label: 'Forfalder', value: new Date(task.dueDate).toLocaleDateString('da-DK') },
                    { label: 'Tildelt', value: task.assignees.map(a => a.name).join(', ') },
                    { label: 'Projekt', value: projectName, isSubtle: true }
                ]
            };
        }
        return null;
    }, [tooltipId, projects]);

    useLayoutEffect(() => {
        if (tooltipRef.current && targetRect) {
            const tooltipNode = tooltipRef.current;
            const { width: tooltipWidth, height: tooltipHeight } = tooltipNode.getBoundingClientRect();
            const { innerWidth, innerHeight } = window;
            const margin = 8;
            let top = targetRect.top - tooltipHeight - margin;
            if (top < margin) top = targetRect.bottom + margin;
            if (top + tooltipHeight > innerHeight - margin) top = innerHeight - tooltipHeight - margin;
            let left = targetRect.left + targetRect.width / 2;
            if (left - tooltipWidth / 2 < margin) left = margin + tooltipWidth / 2;
            if (left + tooltipWidth / 2 > innerWidth - margin) left = innerWidth - margin - tooltipWidth / 2;
            setPosition({ top, left });
        }
    }, [targetRect]);

    if (!tooltipData || !targetRect) return null;

    return (
        <div ref={tooltipRef} style={{ position: 'fixed', top: `${position.top}px`, left: `${position.left}px`, transform: 'translate(-50%, 0)', zIndex: 60, pointerEvents: 'none', opacity: position.top > -1 ? 1 : 0 }} className="bg-bg-dark text-white text-sm rounded-control px-3 py-2 shadow-lg transition-opacity duration-200 w-64 space-y-1">
            <h4 className="font-bold border-b border-border-dark-strong pb-1 mb-1">{tooltipData.title} <span className="text-xs opacity-70 font-normal">({tooltipData.type})</span></h4>
            {tooltipData.fields.map(field => field.value ? (<div key={field.label} className={field.isSubtle ? 'text-xs opacity-80' : 'flex justify-between'}><span className="font-semibold opacity-80 shrink-0">{field.label}:</span><span className="text-right pl-2 truncate">{field.value}</span></div>) : null)}
        </div>
    );
};

export const GanttView: React.FC<{ 
    projectsWithData: ProjectData[], 
    onProjectClick: (id: string) => void,
    isFullScreen: boolean;
    onToggleFullScreen: (isFs: boolean) => void;
    zoomLevel: GanttZoomLevel;
    onZoomChange: (level: GanttZoomLevel) => void;
}> = ({ projectsWithData: projects, onProjectClick, isFullScreen, onToggleFullScreen, zoomLevel, onZoomChange }) => {
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
    const [activeTooltip, setActiveTooltip] = useState<{ id: string, rect: DOMRect, type: 'hover' | 'click' } | null>(null);
    const timelineContainerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
    const projectTextRefs = useRef<Map<string, HTMLSpanElement | null>>(new Map());
    const containerRef = useRef<HTMLDivElement>(null);

    const handleToggleFS = useCallback(async () => {
        if (!document.fullscreenElement && containerRef.current) {
            try { await containerRef.current.requestFullscreen(); } catch (err) { console.error(err); }
        } else if (document.fullscreenElement) {
            await document.exitFullscreen();
        }
    }, []);

    useEffect(() => {
        const handleChange = () => onToggleFullScreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleChange);
        return () => document.removeEventListener('fullscreenchange', handleChange);
    }, [onToggleFullScreen]);
    
    useEffect(() => {
        const container = timelineContainerRef.current;
        if (!container) return;
        let animationFrameId: number;
        const handleScroll = () => {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(() => {
                const containerRect = container.getBoundingClientRect();
                projectTextRefs.current.forEach((textEl, projectId) => {
                    if (!textEl) return;
                    const barEl = itemRefs.current.get(`project-${projectId}`);
                    if (!barEl) return;
                    const barRect = barEl.getBoundingClientRect();
                    if (barRect.width < textEl.offsetWidth + 16) { textEl.style.transform = 'translateX(0px)'; return; }
                    if (barRect.left < containerRect.left) {
                        const scrollOffset = containerRect.left - barRect.left;
                        const maxTranslate = barRect.width - textEl.offsetWidth - 16;
                        textEl.style.transform = `translateX(${Math.min(scrollOffset, maxTranslate)}px)`;
                    } else { textEl.style.transform = 'translateX(0px)'; }
                });
            });
        };
        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => { container.removeEventListener('scroll', handleScroll); cancelAnimationFrame(animationFrameId); };
    }, [projects, zoomLevel]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            if (!target.closest('[data-gantt-item="true"]')) setActiveTooltip(prev => (prev?.type === 'click' ? null : prev));
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleProjectExpansion = (projectId: string) => {
        setExpandedProjects(prev => {
            const newSet = new Set(prev);
            if (newSet.has(projectId)) newSet.delete(projectId); else newSet.add(projectId);
            return newSet;
        });
    };
    
    const handleItemClick = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const element = itemRefs.current.get(id);
        if (!element) return;
        setActiveTooltip(prev => {
            if (prev?.id === id && prev.type === 'click') return null;
            return { id, rect: element.getBoundingClientRect(), type: 'click' };
        });
    };
    
    const handleMouseEnter = (id: string) => {
        const element = itemRefs.current.get(id);
        if (!element) return;
        setActiveTooltip(prev => { if (prev?.type === 'click') return prev; return { id, rect: element.getBoundingClientRect(), type: 'hover' }; });
    };

    const handleMouseLeave = () => setActiveTooltip(prev => (prev?.type === 'hover' ? null : prev));
    
    const zoomLevels: GanttZoomLevel[] = ['quarter', 'month', 'week'];
    const handleZoomIn = () => { const i = zoomLevels.indexOf(zoomLevel); if (i < zoomLevels.length - 1) onZoomChange(zoomLevels[i + 1]); };
    const handleZoomOut = () => { const i = zoomLevels.indexOf(zoomLevel); if (i > 0) onZoomChange(zoomLevels[i - 1]); };

    const { timelineStart, totalDays, headerTop, headerBottom, pixelsPerDay } = useMemo(() => {
        if (projects.length === 0) return { timelineStart: new Date(), totalDays: 30, headerTop: [], headerBottom: [], pixelsPerDay: 10 };
        
        const todayTime = new Date().getTime();
        const dates = projects.flatMap(p => {
            const s = new Date(p.startDate).getTime();
            const e = new Date(p.endDate).getTime();
            return [isNaN(s) ? todayTime : s, isNaN(e) ? todayTime + 86400000 : e];
        });
        
        const minTime = Math.min(...dates);
        const maxTime = Math.max(...dates);
        const timelineStart = new Date(minTime);
        timelineStart.setDate(timelineStart.getDate() - 7);
        const timelineEnd = new Date(maxTime);
        timelineEnd.setDate(timelineEnd.getDate() + 7);
        
        const totalDays = Math.max(1, (timelineEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24));
        const pixelsPerDay = { week: 30, month: 10, quarter: 3 }[zoomLevel];
        const headerTop: {label: string, width: number}[] = [];
        const headerBottom: {label: string, width: number}[] = [];
        
        let currentDate = new Date(timelineStart);
        // Helper to get ISO week
        const getWeek = (d: Date) => { const date = new Date(d.getTime()); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7); const week1 = new Date(date.getFullYear(), 0, 4); return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7); };

        if (zoomLevel === 'week') {
            let currentMonth = -1;
            for(let i = 0; i < totalDays; i++) {
                if (currentDate.getMonth() !== currentMonth) {
                    currentMonth = currentDate.getMonth();
                    const daysLeft = new Date(currentDate.getFullYear(), currentMonth + 1, 0).getDate() - currentDate.getDate() + 1;
                    headerTop.push({ label: currentDate.toLocaleString('da-DK', { month: 'long', year: 'numeric' }), width: Math.min(daysLeft, totalDays - i) * pixelsPerDay });
                }
                headerBottom.push({ label: currentDate.getDate().toString(), width: pixelsPerDay });
                currentDate.setDate(currentDate.getDate() + 1);
            }
        } else if (zoomLevel === 'month') {
            let currentMonth = -1;
            currentDate = new Date(timelineStart);
            while(currentDate <= timelineEnd) {
                if (currentDate.getMonth() !== currentMonth) {
                    currentMonth = currentDate.getMonth();
                    const daysInMonth = new Date(currentDate.getFullYear(), currentMonth + 1, 0).getDate();
                    headerTop.push({ label: currentDate.toLocaleString('da-DK', { month: 'long', year: 'numeric' }), width: daysInMonth * pixelsPerDay });
                }
                const week = getWeek(currentDate);
                headerBottom.push({label: `Uge ${week}`, width: 7 * pixelsPerDay });
                currentDate.setDate(currentDate.getDate() + 7);
            }
        } else { 
             let currentYear = -1;
             currentDate = new Date(timelineStart);
             while(currentDate <= timelineEnd) {
                if (currentDate.getFullYear() !== currentYear) {
                    currentYear = currentDate.getFullYear();
                    const daysInYear = ((currentYear % 4 === 0 && currentYear % 100 > 0) || currentYear % 400 === 0) ? 366 : 365;
                    headerTop.push({ label: currentYear.toString(), width: daysInYear * pixelsPerDay });
                }
                const monthName = currentDate.toLocaleString('da-DK', { month: 'short' });
                const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
                headerBottom.push({ label: monthName, width: daysInMonth * pixelsPerDay });
                currentDate.setMonth(currentDate.getMonth() + 1);
             }
        }
        return { timelineStart, totalDays, headerTop, headerBottom, pixelsPerDay };
    }, [projects, zoomLevel]);
    
    const today = new Date();
    const todayOffsetDays = (today.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24);
    const showTodayMarker = todayOffsetDays >= 0 && todayOffsetDays <= totalDays;
    const getProjectStatusColor = (status: string) => status === 'Afsluttet' ? 'bg-success' : 'bg-brand-primary';
    const getTaskStatusColor = (status: Task['status']): string => {
        switch(status) { case 'Udført': return 'bg-success opacity-80'; case 'Igangværende': return 'bg-info'; case 'Forfalden': return 'bg-danger'; default: return 'bg-text-tertiary'; }
    }

    const ganttItems: ({ type: 'project', data: ProjectData } | { type: 'task', data: Task, project: ProjectData })[] = [];
    projects.forEach(p => {
        ganttItems.push({type: 'project', data: p});
        if (expandedProjects.has(p.id)) p.tasks.forEach(t => ganttItems.push({type: 'task', data: t, project: p}));
    });

    return (
        <div ref={containerRef} className={`bg-bg dark:bg-bg-dark-surface rounded-card shadow-sm border border-border dark:border-border-dark p-4 ${isFullScreen ? 'h-screen w-screen flex flex-col overflow-hidden fixed inset-0 z-[9999]' : ''}`}>
            {activeTooltip && <Tooltip key={activeTooltip.id} tooltipId={activeTooltip.id} targetRect={activeTooltip.rect} projects={projects} />}
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
                <div className="flex items-center space-x-1">
                   <button onClick={handleZoomOut} disabled={zoomLevel === 'quarter'} className="min-w-11 min-h-11 flex items-center justify-center rounded-md hover:bg-bg-muted dark:hover:bg-bg-dark-muted disabled:opacity-40"><ZoomOutIcon className="w-5 h-5"/></button>
                   <span className="text-sm font-semibold w-20 text-center capitalize text-text-primary dark:text-text-dark-primary">{{week: 'Uge', month: 'Måned', quarter: 'Kvartal'}[zoomLevel]}</span>
                   <button onClick={handleZoomIn} disabled={zoomLevel === 'week'} className="min-w-11 min-h-11 flex items-center justify-center rounded-md hover:bg-bg-muted dark:hover:bg-bg-dark-muted disabled:opacity-40"><ZoomInIcon className="w-5 h-5"/></button>
                </div>
                <button onClick={handleToggleFS} className="min-w-11 min-h-11 flex items-center justify-center rounded-md hover:bg-bg-muted dark:hover:bg-bg-dark-muted">{isFullScreen ? <MinimizeIcon className="w-5 h-5"/> : <MaximizeIcon className="w-5 h-5"/>}</button>
            </div>

             <div className={`flex ${isFullScreen ? 'flex-grow overflow-hidden' : ''}`}>
                <div className={`w-48 flex-shrink-0 border-r border-border dark:border-border-dark pr-2 ${isFullScreen ? 'overflow-y-auto' : ''}`}>
                    <div className="h-12 border-b border-border dark:border-border-dark"></div>
                    {ganttItems.map(item => (
                        <div key={item.data.id} className={`h-12 flex items-center ${item.type === 'task' ? 'pl-5' : ''}`}>
                             {item.type === 'project' ? (
                                 <button onClick={() => toggleProjectExpansion(item.data.id)} className="flex items-center space-x-1 text-left w-full group">
                                     <ChevronRightIcon className={`w-4 h-4 transition-transform flex-shrink-0 text-text-secondary ${expandedProjects.has(item.data.id) ? 'rotate-90' : ''}`} />
                                     <p className="font-semibold text-sm truncate text-text-primary dark:text-text-dark-primary group-hover:text-brand-primary">{item.data.name}</p>
                                 </button>
                             ) : <p className="text-sm truncate text-text-secondary dark:text-text-dark-secondary">{item.data.title}</p>}
                        </div>
                    ))}
                </div>
                <div ref={timelineContainerRef} className="flex-grow overflow-auto">
                    <div style={{ width: `${totalDays * pixelsPerDay}px` }}>
                        <div className="sticky top-0 bg-bg dark:bg-bg-dark-surface z-20">
                            <div className="flex h-6 items-end border-b border-border dark:border-border-dark">
                                {headerTop.map((item, i) => <div key={i} className="flex-shrink-0 border-r border-border dark:border-border-dark text-center font-semibold text-xs text-text-secondary" style={{ width: `${item.width}px` }}>{item.label}</div>)}
                            </div>
                             <div className="flex h-6 items-end border-b border-border dark:border-border-dark">
                                {headerBottom.map((item, i) => <div key={i} className="flex-shrink-0 border-r border-border dark:border-border-dark text-center font-semibold text-xs text-text-secondary" style={{ width: `${item.width}px` }}>{item.label}</div>)}
                            </div>
                        </div>
                        <div className="relative" style={{ height: `${ganttItems.length * 48}px`}}>
                            {showTodayMarker && <div className="absolute top-0 bottom-0 w-0.5 bg-danger z-10" style={{ left: `${todayOffsetDays * pixelsPerDay}px` }}><div className="absolute -top-1.5 -translate-x-1/2 left-1/2 w-2 h-2 bg-danger rounded-full"></div></div>}
                            {ganttItems.map((item, index) => {
                                if (item.type === 'project') {
                                    const project = item.data;
                                    let start = new Date(project.startDate).getTime(); if (isNaN(start)) start = new Date().getTime();
                                    let end = new Date(project.endDate).getTime(); if (isNaN(end)) end = start + 86400000 * 30;
                                    const offset = (start - timelineStart.getTime()) / (1000 * 60 * 60 * 24);
                                    const dur = (end - start) / (1000 * 60 * 60 * 24) + 1;
                                    return (
                                        <div data-gantt-item="true" key={project.id} ref={el => { if(el) itemRefs.current.set(`project-${project.id}`, el); else itemRefs.current.delete(`project-${project.id}`); }} onClick={(e) => handleItemClick(`project-${project.id}`, e)} onMouseEnter={() => handleMouseEnter(`project-${project.id}`)} onMouseLeave={handleMouseLeave} className="absolute h-12 p-1.5 cursor-pointer" style={{ top: `${index * 48}px`, left: `${offset * pixelsPerDay}px`, width: `${dur * pixelsPerDay}px` }}>
                                            <div className={`w-full h-full rounded-md text-white text-xs font-bold px-2 flex items-center relative overflow-hidden ${getProjectStatusColor(project.status)}`}>
                                                <div className="absolute left-0 top-0 bottom-0 bg-black/20" style={{ width: `${project.progress}%` }}></div>
                                                <span ref={el => { if(el) projectTextRefs.current.set(project.id, el); else projectTextRefs.current.delete(project.id); }} className="relative inline-block transition-transform duration-100 ease-out whitespace-nowrap">{project.name}</span>
                                            </div>
                                        </div>
                                    );
                                } else {
                                    const task = item.data;
                                    if (!task.dueDate) return null;
                                    const dur = Math.max(1, zoomLevel === 'week' ? 2 : 1);
                                    const start = new Date(task.dueDate).getTime() - (dur-1)*86400000;
                                    const offset = (start - timelineStart.getTime()) / (1000 * 60 * 60 * 24);
                                    if (offset < -dur || offset > totalDays) return null;
                                    return (
                                        <div data-gantt-item="true" key={task.id} ref={el => { if(el) itemRefs.current.set(`task-${task.id}`, el); else itemRefs.current.delete(`task-${task.id}`); }} onClick={(e) => handleItemClick(`task-${task.id}`, e)} onMouseEnter={() => handleMouseEnter(`task-${task.id}`)} onMouseLeave={handleMouseLeave} className="absolute h-12 p-2.5 cursor-pointer" style={{ top: `${index * 48}px`, left: `${offset * pixelsPerDay}px`, width: `${dur * pixelsPerDay}px` }}>
                                            <div className={`w-full h-full rounded ${getTaskStatusColor(task.status)} flex items-center px-2`}><p className="text-xs text-white font-semibold truncate">{task.title}</p></div>
                                        </div>
                                    );
                                }
                            })}
                        </div>
                    </div>
                </div>
             </div>
        </div>
    );
};
