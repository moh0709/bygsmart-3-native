import { useRouter } from 'expo-router';
import { MfaEnrollScreen } from '../src/screens/MfaEnrollScreen';

// app-shell route → in-app TOTP enrollment (reached from Mere).
export default function MfaEnroll() {
  const router = useRouter();
  return <MfaEnrollScreen onDone={() => router.back()} />;
}
