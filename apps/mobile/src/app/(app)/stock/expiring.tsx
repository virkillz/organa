import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { ExpiryList } from '@/components/expiry-list';
import { api } from '@/lib/api';
import { useOutletId } from '@/lib/hooks';

export default function Expiring() {
  const outletId = useOutletId();
  const query = useQuery({ queryKey: ['expiring', outletId], queryFn: () => api.expiring(outletId), enabled: !!outletId });
  return (
    <>
      <Stack.Screen options={{ title: 'Potensi Kedaluarsa' }} />
      <ExpiryList query={query} tone="warning" labels={['Potensi\nKedaluarsa', 'Potensi\nKerugian']} />
    </>
  );
}
