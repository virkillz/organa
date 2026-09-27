import { Redirect } from 'expo-router';
import { useSession } from '@/lib/session';

/** Entry point when signed out: onboarding once, then employee login on shared devices, else the welcome screen. */
export default function AuthIndex() {
  const onboardingSeen = useSession((s) => s.onboardingSeen);
  const deviceToken = useSession((s) => s.deviceToken);
  if (!onboardingSeen) return <Redirect href="/onboarding" />;
  if (deviceToken) return <Redirect href="/employee-login" />;
  return <Redirect href="/welcome" />;
}
