import { Redirect } from 'expo-router';
import { homeRouteFor } from '@/lib/menu';
import { useSession } from '@/lib/session';

export default function AppIndex() {
  const role = useSession((s) => s.user?.role);
  if (!role) return null;
  return <Redirect href={`/${homeRouteFor(role)}` as never} />;
}
