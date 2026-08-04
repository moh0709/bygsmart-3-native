import { StyleSheet, Text, View } from 'react-native';
import { PLACEHOLDER_CORE } from '@bygsmart/core';

// The minimal home screen. Importing PLACEHOLDER_CORE from @bygsmart/core proves
// that Metro resolves a workspace package across the monorepo boundary, and that
// the app-shell -> core dependency is allowed by eslint-plugin-boundaries.
export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>BygSmart 3.0 Native</Text>
      <Text style={styles.subtitle}>workspace: {PLACEHOLDER_CORE}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    opacity: 0.7,
  },
});
