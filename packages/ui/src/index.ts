// @bygsmart/ui — universal responsive primitives (RN + RNW).
// Every primitive: token-driven, responsive-aware, a11y role, >=48dp targets (P6).
export * from './theme/ThemeProvider';
export * from './theme/elevation';
export * from './hooks/useBreakpoint';
export * from './hooks/useFontScale';
export * from './primitives/Text';
export * from './primitives/Box';
export * from './primitives/Stack';
export * from './primitives/Button';
export * from './primitives/Card';
export * from './primitives/Alert';
export * from './primitives/Screen';
export * from './primitives/Spinner';
export * from './primitives/Badge';
export * from './primitives/Divider';
export * from './primitives/EmptyState';
export * from './primitives/ErrorState';
export * from './primitives/OfflineBanner';
export * from './primitives/TextField';
export * from './primitives/Checkbox';
export * from './primitives/Switch';
export * from './primitives/RadioGroup';
export * from './primitives/SegmentedControl';
export * from './primitives/Chip';
export * from './primitives/Avatar';
export * from './primitives/IconButton';
export * from './primitives/ListItem';
export * from './primitives/ProgressBar';
export * from './primitives/Grid';
export * from './primitives/TwoPane';
export * from './icons/iconRegistry';
export * from './icons/Icon';
// Brand logo mark (react-native-svg like Icon — not loaded in the jsdom render harness).
export * from './brand/BrandMark';
export * from './navigation/NavShell';
// P1 1.7 Gantt canary — throwaway universality probe, delete with the planning module.
export * from './canary/GanttView';
