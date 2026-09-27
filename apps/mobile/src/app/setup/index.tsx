import { Redirect } from 'expo-router';
import { useSession } from '@/lib/session';

export default function SetupIndex() {
  const needsBusinessSetup = useSession((s) => s.user?.needsBusinessSetup);
  return <Redirect href={needsBusinessSetup ? '/setup/business' : '/setup/employees'} />;
}
