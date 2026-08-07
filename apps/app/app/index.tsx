import { useRouter, type Href } from 'expo-router';
import { MinDagScreen } from '../src/screens/MinDagScreen';

// Home route → Min Dag (the daily worklist). The P1 primitive gallery moved to /gallery.
// Nav callbacks are wired here so the screen stays free of expo-router (AR-05).
export default function Home() {
  const router = useRouter();
  return (
    <MinDagScreen
      onOpenProjects={() => router.navigate('/projects' as Href)}
      onOpenTasks={() => router.navigate('/tasks' as Href)}
    />
  );
}
