import { useLocalSearchParams, useRouter } from 'expo-router';
import { ProjectDetailScreen } from '../../src/screens/ProjectDetailScreen';

// app-shell dynamic route → project detail. Reads the id param and supplies navigation.
export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return <ProjectDetailScreen projectId={String(id)} onBack={() => router.back()} />;
}
