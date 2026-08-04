import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

/** First-class error state with a retry affordance. Never a bare thrown error on screen. */
export function ErrorState({ title = 'Noget gik galt', description, onRetry, retryLabel = 'Prøv igen' }: ErrorStateProps) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{ alignItems: 'center', justifyContent: 'center', gap: t.spacing.sm, padding: t.spacing.xl, flex: 1 }}
    >
      <Text style={{ fontSize: 40 }}>⚠️</Text>
      <Text variant="title" color="danger" center>
        {title}
      </Text>
      {description ? (
        <Text variant="body" color="textSecondary" center>
          {description}
        </Text>
      ) : null}
      {onRetry ? <Button title={retryLabel} variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}
