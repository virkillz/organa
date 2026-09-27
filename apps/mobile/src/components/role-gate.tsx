import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';
import { homeRouteFor, MENU } from '@/lib/menu';
import { useSession } from '@/lib/session';

/** Sends users to their home screen if their role cannot open this route. The API enforces the same rules. */
export function RoleGate({ route, children }: { route: string; children: ReactNode }) {
  const role = useSession((s) => s.user?.role);
  const item = MENU.find((m) => m.route === route);
  if (!role) return null;
  if (!item || !item.roles.includes(role)) return <Redirect href={`/${homeRouteFor(role)}` as never} />;
  return children;
}
