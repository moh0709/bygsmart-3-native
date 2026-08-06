import { ProjectsScreen } from '../src/screens/ProjectsScreen';

// app-shell route → the real Projekter screen. Data comes from the RepositoryProvider
// mounted in _layout.
export default function Projects() {
  return <ProjectsScreen />;
}
