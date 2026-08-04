import React, { useState, useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';
import { Project, Task, Reminder } from '../../types';

interface ProjectData extends Project {
    tasks: Task[];
    reminders: Reminder[];
}

type CalendarEvent = 
    | { type: 'project'; data: Project; projectId: string; } 
    | { type: 'task'; data: Task; projectId: string; } 
    | { type: 'reminder'; data: Reminder; projectId: string; };

type ZoomLevel = 'year' | 'month' | 'week' | 'day';
type EventsByDate = Map<string, CalendarEvent[]>;

const getEventTitle = (event: CalendarEvent): string => {
    if (event.type === 'project') return event.data.name;
    return event.data.title;
};

// --- View Components ---

const YearView: React.FC<{ currentDate: Date; eventsByDate: EventsByDate; onMonthSelect: (date: Date) => void }> = ({ currentDate, eventsByDate, onMonthSelect }) => {
    const year = currentDate.getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));
    const today = new Date();

    return (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2 p-4">
            {months.map(month => {
                const monthStr = month.toLocaleString('da-DK', { month: 'short' });
                const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
                const daysInMonth = new Date(year, month.getMonth() + 1, 0).getDate();
                const hasEvents = Array.from({ length: daysInMonth }, (_, d) => {
                    const key = `${year}-${month.getMonth()}-${d + 1}`;
                    return eventsByDate.has(key);
                }).some(Boolean);

                return (
                    <button key={month.getMonth()} onClick={() => onMonthSelect(month)} className={`p-4 rounded-control text-center transition-colors ${isCurrentMonth ? 'bg-brand-primary/10 dark:bg-brand-primary/20' : 'hover:bg-bg-muted dark:hover:bg-bg-dark-muted'}`}>
                        <p className={`font-semibold ${isCurrentMonth ? 'text-brand-primary dark:text-brand-light' : 'text-text-primary dark:text-text-dark-primary'}`}>{monthStr.charAt(0).toUpperCase() + monthStr.slice(1)}</p>
                        {hasEvents && <div className="w-1.5 h-1.5 bg-brand-primary rounded-full mx-auto mt-1.5"></div>}
                    </button>
                );
            })}
        </div>
    );
};

const MonthView: React.FC<{ currentDate: Date; eventsByDate: EventsByDate; onDayClick: (date: Date) => void }> = ({ currentDate, eventsByDate, onDayClick }) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startingDayIndex = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    const calendarDays = Array.from({ length: 42 }, (_, i) => {
        const day = i - startingDayIndex + 1;
        if (day > 0 && day <= daysInMonth) {
            const date = new Date(year, month, day);
            const key = `${year}-${month}-${day}`;
            return { day, date, key, events: eventsByDate.get(key) || [] };
        }
        return null;
    });

    return (
        <div className="grid grid-cols-7 text-center text-sm border-t border-border dark:border-border-dark">
            {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map(day => <div key={day} className="font-semibold text-text-secondary dark:text-text-dark-secondary py-2 border-b border-border dark:border-border-dark">{day}</div>)}
            {calendarDays.map((dayInfo, index) => (
                <div key={index} className={`h-24 p-1 border-b border-r border-border dark:border-border-dark ${index % 7 === 6 ? 'border-r-0' : ''} bg-bg dark:bg-bg-dark-surface relative`}>
                    {dayInfo && (
                        <button onClick={() => dayInfo && onDayClick(dayInfo.date)} className="w-full h-full flex flex-col items-center hover:bg-bg-subtle dark:hover:bg-bg-dark-muted rounded-md transition-colors">
                            <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs ${dayInfo.key === todayKey ? 'bg-brand-primary text-white font-bold' : 'text-text-primary dark:text-text-dark-primary'}`}>{dayInfo.day}</span>
                            <div className="flex justify-center items-start flex-wrap gap-1 mt-1 px-1">
                                {dayInfo.events.slice(0, 4).map((e, i) => (
                                    <div key={`${e.type}-${e.data.id}-${i}`} className={`w-1.5 h-1.5 rounded-full ${e.type === 'project' ? 'bg-info' : e.type === 'task' ? 'bg-success' : 'bg-warning'}`} title={getEventTitle(e)}></div>
                                ))}
                            </div>
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
};

const WeekView: React.FC<{ currentDate: Date; eventsByDate: EventsByDate; onDayClick: (date: Date) => void }> = ({ currentDate, eventsByDate, onDayClick }) => {
    const dayOfWeek = currentDate.getDay();
    const startOfWeekIndex = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(currentDate);
        date.setDate(date.getDate() + startOfWeekIndex + i);
        const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        return { date, key, events: eventsByDate.get(key) || [] };
    });

    return (
        <div className="divide-y divide-border dark:divide-border-dark border-t border-border dark:border-border-dark">
            {weekDays.map(({ date, events }) => (
                <button key={date.toString()} onClick={() => onDayClick(date)} className="w-full flex p-3 hover:bg-bg-subtle dark:hover:bg-bg-dark-muted text-left transition-colors">
                    <div className="w-12 text-center flex-shrink-0">
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary">{date.toLocaleString('da-DK', { weekday: 'short' })}</p>
                        <p className="font-bold text-xl text-text-primary dark:text-text-dark-primary">{date.getDate()}</p>
                    </div>
                    <div className="pl-4 border-l border-border dark:border-border-dark flex-grow min-h-[4rem]">
                         {events.length > 0 && (
                            <div className="space-y-1">
                                {events.map(e => (
                                    <div key={`${e.type}-${e.data.id}`} className={`text-xs font-semibold p-2 rounded w-full truncate ${e.type === 'project' ? 'bg-info-subtle dark:bg-info-subtle-dark text-info-strong dark:text-info' : e.type === 'task' ? 'bg-success-subtle dark:bg-success-subtle-dark text-success-strong dark:text-success' : 'bg-warning-subtle dark:bg-warning-subtle-dark text-warning-strong dark:text-warning'}`}>
                                        {getEventTitle(e)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </button>
            ))}
        </div>
    );
};

const DayView: React.FC<{
    currentDate: Date;
    events: CalendarEvent[];
    onEventClick: (event: CalendarEvent) => void;
    onAddReminder: (date: Date, time: string) => void;
}> = ({ currentDate, events, onEventClick, onAddReminder }) => {
    const hours = Array.from({ length: 15 }, (_, i) => i + 7); // 7 AM to 9 PM

    const getEventStyle = (event: CalendarEvent): React.CSSProperties => {
        let startTime = new Date();
        if (event.type === 'reminder' && event.data.dateTime) {
            startTime = new Date(event.data.dateTime);
        } else {
            return { display: 'none' };
        }
        const startHour = startTime.getHours() + startTime.getMinutes() / 60;
        const topOffset = (startHour - 7) * 4; // 4rem (h-16) per hour
        return { top: `${topOffset}rem`, position: 'absolute', right: '0.5rem', left: '3.5rem', zIndex: 10 };
    };
    
    const allDayEvents = events.filter(e => e.type !== 'reminder' || !e.data.dateTime);
    const timedEvents = events.filter(e => e.type === 'reminder' && e.data.dateTime);

    return (
        <div className="border-t border-border dark:border-border-dark">
            {allDayEvents.length > 0 && (
                <div className="p-2 border-b border-border dark:border-border-dark">
                    <h4 className="font-semibold text-sm mb-1 px-2 text-text-primary dark:text-text-dark-primary">Hele dagen</h4>
                    <div className="space-y-1">
                        {allDayEvents.map((e, i) => (
                             <button key={i} onClick={() => onEventClick(e)} className={`w-full text-left text-sm font-semibold p-2 rounded-control truncate transition-colors ${e.type === 'project' ? 'bg-info-subtle dark:bg-info-subtle-dark text-info-strong dark:text-info hover:bg-info/20 dark:hover:bg-info/25' : 'bg-success-subtle dark:bg-success-subtle-dark text-success-strong dark:text-success hover:bg-success/20 dark:hover:bg-success/25'}`}>
                                {getEventTitle(e)}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            <div className="relative">
                {hours.map(hour => (
                    <button key={hour} onClick={() => onAddReminder(currentDate, `${hour.toString().padStart(2, '0')}:00`)} className="flex w-full h-16 border-b border-border dark:border-border-dark hover:bg-bg-subtle dark:hover:bg-bg-dark-muted transition-colors">
                        <div className="w-12 text-center text-xs text-text-secondary dark:text-text-dark-secondary pt-1 border-r border-border dark:border-border-dark flex-shrink-0">{hour}:00</div>
                        <div className="flex-grow"></div>
                    </button>
                ))}
                 {timedEvents.map((e, i) => (
                    <button key={i} onClick={() => onEventClick(e)} style={getEventStyle(e)} className={`p-2 rounded-control text-white text-sm font-semibold text-left shadow-lg ${e.type === 'reminder' ? 'bg-warning' : 'bg-text-tertiary'}`}>
                        <p className="font-bold">{getEventTitle(e)}</p>
                        {e.type === 'reminder' && e.data.dateTime && <p className="text-xs opacity-90">{new Date(e.data.dateTime).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}</p>}
                    </button>
                 ))}
            </div>
        </div>
    );
};

// --- Main Calendar Component ---

export const CalendarView: React.FC<{ 
    projectsWithData: ProjectData[], 
    openModal: (date: Date, time?: string) => void, 
    onEventClick: (event: CalendarEvent) => void 
}> = ({ projectsWithData, openModal, onEventClick }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('month');
    const [touchStart, setTouchStart] = useState<number | null>(null);

    const eventsByDate = useMemo<EventsByDate>(() => {
        const map: EventsByDate = new Map();
        projectsWithData.forEach(p => {
            const endDate = new Date(p.endDate);
            const key = `${endDate.getFullYear()}-${endDate.getMonth()}-${endDate.getDate()}`;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push({ type: 'project', data: p, projectId: p.id });

            p.tasks.forEach(t => {
                if (t.dueDate) {
                    const dueDate = new Date(t.dueDate);
                    const taskKey = `${dueDate.getFullYear()}-${dueDate.getMonth()}-${dueDate.getDate()}`;
                    if (!map.has(taskKey)) map.set(taskKey, []);
                    map.get(taskKey)!.push({ type: 'task', data: t, projectId: p.id });
                }
            });
            p.reminders.forEach(r => {
                if (r.dateTime) {
                    const reminderDate = new Date(r.dateTime);
                    const reminderKey = `${reminderDate.getFullYear()}-${reminderDate.getMonth()}-${reminderDate.getDate()}`;
                    if (!map.has(reminderKey)) map.set(reminderKey, []);
                    map.get(reminderKey)!.push({ type: 'reminder', data: r, projectId: p.id });
                }
            });
        });
        return map;
    }, [projectsWithData]);

    const navigateDate = (direction: 'prev' | 'next') => {
        setCurrentDate(d => {
            const newDate = new Date(d);
            const amount = direction === 'next' ? 1 : -1;
            switch(zoomLevel) {
                case 'year': newDate.setFullYear(newDate.getFullYear() + amount); break;
                case 'month': newDate.setMonth(newDate.getMonth() + amount); break;
                case 'week': newDate.setDate(newDate.getDate() + (7 * amount)); break;
                case 'day': newDate.setDate(newDate.getDate() + amount); break;
            }
            return newDate;
        });
    };
    
    const getWeekNumber = (d: Date): number => {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    };

    const headerText = {
        'year': currentDate.getFullYear(),
        'month': currentDate.toLocaleString('da-DK', { month: 'long', year: 'numeric' }),
        'week': `Uge ${getWeekNumber(currentDate)}, ${currentDate.getFullYear()}`,
        'day': currentDate.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' }),
    }[zoomLevel];

    const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStart === null) return;
        const diff = touchStart - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) navigateDate(diff > 0 ? 'next' : 'prev');
        setTouchStart(null);
    };

    return (
        <div className="bg-bg dark:bg-bg-dark-surface rounded-card shadow-sm border border-border dark:border-border-dark">
            <div className="flex justify-between items-center p-4">
                <div className="flex items-center space-x-1">
                    <button onClick={() => navigateDate('prev')} className="min-w-11 min-h-11 flex items-center justify-center rounded-full hover:bg-bg-muted dark:hover:bg-bg-dark-muted text-text-primary dark:text-text-dark-primary"><ChevronLeftIcon className="w-5 h-5"/></button>
                    <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 min-h-11 rounded-control border border-border dark:border-border-dark text-sm font-semibold hover:bg-bg-subtle dark:hover:bg-bg-dark-muted text-text-primary dark:text-text-dark-primary">I dag</button>
                    <button onClick={() => navigateDate('next')} className="min-w-11 min-h-11 flex items-center justify-center rounded-full hover:bg-bg-muted dark:hover:bg-bg-dark-muted text-text-primary dark:text-text-dark-primary"><ChevronRightIcon className="w-5 h-5"/></button>
                </div>
                <h3 className="text-lg font-bold hidden sm:block text-text-primary dark:text-text-dark-primary">{headerText}</h3>
                <select value={zoomLevel} onChange={(e) => setZoomLevel(e.target.value as ZoomLevel)} className="rounded-control border-border-strong dark:border-border-dark-strong shadow-sm focus:border-brand-primary focus:ring-brand-primary text-sm font-semibold py-1.5 pl-2 pr-7 min-h-11 bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary">
                    <option value="day">Dag</option>
                    <option value="week">Uge</option>
                    <option value="month">Måned</option>
                    <option value="year">År</option>
                </select>
            </div>
            <h3 className="text-lg font-bold sm:hidden text-center pb-2 text-text-primary dark:text-text-dark-primary">{headerText}</h3>
            <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                {zoomLevel === 'year' && <YearView currentDate={currentDate} eventsByDate={eventsByDate} onMonthSelect={(date) => { setCurrentDate(date); setZoomLevel('month'); }} />}
                {zoomLevel === 'month' && <MonthView currentDate={currentDate} eventsByDate={eventsByDate} onDayClick={(date) => { setCurrentDate(date); setZoomLevel('day'); }} />}
                {zoomLevel === 'week' && <WeekView currentDate={currentDate} eventsByDate={eventsByDate} onDayClick={(date) => { setCurrentDate(date); setZoomLevel('day'); }} />}
                {zoomLevel === 'day' && <DayView currentDate={currentDate} events={eventsByDate.get(`${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}`) || []} onEventClick={onEventClick} onAddReminder={(date, time) => openModal(date, time)} />}
            </div>
        </div>
    );
};