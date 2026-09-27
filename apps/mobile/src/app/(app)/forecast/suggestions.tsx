import { Stack, useLocalSearchParams } from 'expo-router';
import { InsightView } from '@/components/insight-view';
import { monthLabel } from '@/lib/format';

export default function ForecastSuggestions() {
  const { month } = useLocalSearchParams<{ month: string }>();
  return (
    <>
      <Stack.Screen options={{ title: 'Simpulan & Sugesti' }} />
      <InsightView kind="forecast" period={month} periodLabel={`Prediksi ${monthLabel(month, true)} ${month.slice(0, 4)}`} />
    </>
  );
}
