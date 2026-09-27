import type { AppNotification } from '@organa/shared';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';
import { api } from './api';
import { useSession } from './session';

const POLL_MS = 15_000;

/**
 * expo-notifications throws on import in Expo Go on Android (SDK 53+), so it is loaded only
 * in development/production builds. Alerts always show as an in-app banner as well.
 */
const canNotify = !(Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient);
type NotificationsModule = typeof import('expo-notifications');
let notifications: NotificationsModule | null = null;
if (canNotify) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  notifications = require('expo-notifications') as NotificationsModule;
  notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/** Alerts waiting to be shown in the in-app banner. */
export const useAlertBanner = create<{ queue: AppNotification[]; push: (a: AppNotification[]) => void; dismiss: () => void }>((set) => ({
  queue: [],
  push: (a) => set((s) => ({ queue: [...s.queue, ...a] })),
  dismiss: () => set((s) => ({ queue: s.queue.slice(1) })),
}));

/**
 * Polls the outlet's stock alerts so the kitchen sees "stok kritis" right after a sale on the
 * cashier's tablet. Remote push needs a development build, so polling is used for the demo.
 */
export function useStockAlerts() {
  const outletId = useSession((s) => s.activeOutletId);
  const role = useSession((s) => s.user?.role);
  const since = useRef<string | null>(null);

  useEffect(() => {
    // Cashiers already see alerts on the success screen.
    if (!outletId || role === 'CASHIER') return;
    let cancelled = false;
    since.current = new Date().toISOString();

    if (notifications) {
      const n = notifications;
      (async () => {
        const perm = await n.getPermissionsAsync();
        if (!perm.granted && perm.canAskAgain) await n.requestPermissionsAsync();
        if (Platform.OS === 'android') await n.setNotificationChannelAsync('stock', { name: 'Peringatan stok', importance: n.AndroidImportance.HIGH });
      })().catch(() => {});
    }

    const poll = async () => {
      if (cancelled || AppState.currentState !== 'active') return;
      try {
        const rows = await api.alerts(outletId, since.current ?? undefined);
        if (!rows.length) return;
        since.current = rows[0]!.createdAt;
        const newest = [...rows].reverse();
        useAlertBanner.getState().push(newest);
        for (const a of newest) {
          await notifications?.scheduleNotificationAsync({
            content: { title: a.title, body: a.body, data: { kind: a.kind } },
            trigger: Platform.OS === 'android' ? { channelId: 'stock' } : null,
          });
        }
      } catch {
        // Offline or signed out; try again on the next tick.
      }
    };
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [outletId, role]);
}
