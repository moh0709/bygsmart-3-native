// modules/time -- public surface (ESLint boundary: only entry point).
export * from './services/timeEntries';
export * from './services/timerSafety';
export { default as TimeManagementTabContent } from './components/TimeManagementTabContent';
export type { TimerState } from './components/TimeManagementTabContent';
export { FloatingTimer } from './components/FloatingTimer';
