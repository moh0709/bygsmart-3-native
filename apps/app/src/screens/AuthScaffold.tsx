// Shared chrome for the pre-auth screens (Login/Register/Forgot/MFA challenge): the 2.1
// brand lockup + tagline over a centered, width-capped card. Keeps every auth screen
// visually identical without repeating the lockup. AR-05: ui/i18n only.
import type { ReactNode } from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import { Screen, VStack, HStack, Text, Card, BrandMark, useTheme, elevate } from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';

export function AuthScaffold({ children, footer }: { children: ReactNode; footer?: ReactNode }): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Screen padding="none">
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <VStack gap="xl" style={{ width: '100%', maxWidth: 420 }}>
          <VStack gap="sm" style={{ alignItems: 'center' }}>
            <HStack gap="md" style={{ alignItems: 'center' }}>
              <View
                style={{
                  backgroundColor: theme.colors.primary,
                  padding: theme.spacing.md,
                  borderRadius: theme.radii.lg,
                  ...elevate(theme.elevation.card),
                }}
              >
                <BrandMark size={30} color={theme.colors.primaryText} />
              </View>
              <Text variant="title" style={{ letterSpacing: 1 }}>
                BYG SMART
              </Text>
            </HStack>
            <Text variant="label" color="textSecondary" center>
              {t('login.subtitle')}
            </Text>
          </VStack>

          <Card padded>{children}</Card>

          {footer}
        </VStack>
      </ScrollView>
    </Screen>
  );
}

/** Inline brand text link, optionally preceded by muted prefix copy. >=44dp target. */
export function AuthLink({
  prefix,
  label,
  onPress,
}: {
  prefix?: string;
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  return (
    <HStack gap="xs" style={{ justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
      {prefix ? (
        <Text variant="label" color="textSecondary">
          {prefix}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="link"
        onPress={onPress}
        style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: theme.spacing.xs }}
      >
        <Text variant="label" color="primary" style={{ fontWeight: '700' }}>
          {label}
        </Text>
      </Pressable>
    </HStack>
  );
}
