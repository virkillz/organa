import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { ExpiryList } from '@/components/expiry-list';
import { api } from '@/lib/api';
import { useOutletId } from '@/lib/hooks';

export default function Expired() {
  const outletId = useOutletId();
  const query = useQuery({ queryKey: ['expired', outletId], queryFn: () => api.expired(outletId), enabled: !!outletId });
  return (
    <>
      <Stack.Screen options={{ title: 'Telah Kedaluarsa' }} />
      <ExpiryList query={query} tone="navy" labels={['Telah\nKedaluarsa', 'Telah Rugi\n(bulan ini)']} />
    </>
  );
}
