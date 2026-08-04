import { Stack } from 'expo-router';

// Root layout for the universal app. A single native stack is enough to prove
// expo-router file-based routing resolves and renders on every target.
export default function RootLayout() {
  return <Stack />;
}
