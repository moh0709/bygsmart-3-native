import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** First-class empty state (phase-readiness X: states as primitives, not per-screen). */
export function EmptyState({ title, description, icon = '📭', actionLabel, onAction }: EmptyStateProps) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: t.spacing.sm, padding: t.spacing.xl, flex: 1 }}>
      <Text style={{ fontSize: 40 }}>{icon}</Text>
      <Text variant="title" center>
        {title}
      </Text>
      {description ? (
        <Text variant="body" color="textSecondary" center>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button title={actionLabel} variant="secondary" onPress={onAction} /> : null}
    </View>
  );
}
