import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function Divider({ vertical }: { vertical?: boolean }) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="none"
      style={vertical ? { width: 1, alignSelf: 'stretch', backgroundColor: t.colors.border } : { height: 1, alignSelf: 'stretch', backgroundColor: t.colors.border }}
    />
  );
}
