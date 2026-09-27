import { useSession } from './session';

/** The outlet the app is working in (owner's switcher, or the employee's own outlet). */
export function useOutletId(): string {
  return useSession((s) => s.activeOutletId) ?? '';
}
