import { useRouter, type Href } from 'expo-router';
import { ProjectsScreen } from '../src/screens/ProjectsScreen';

// app-shell route → the real Projekter screen. Navigation lives here (not in the screen)
// so expo-router stays out of the screens element.
export default function Projects() {
  const router = useRouter();
  return <ProjectsScreen onOpenProject={(id) => router.navigate(`/project/${id}` as Href)} />;
}
