import { useRouter } from 'expo-router';
import { ChangePasswordScreen } from '../src/screens/ChangePasswordScreen';

// app-shell route → change password (reached from Mere).
export default function ChangePassword() {
  const router = useRouter();
  return <ChangePasswordScreen onDone={() => router.back()} />;
}
