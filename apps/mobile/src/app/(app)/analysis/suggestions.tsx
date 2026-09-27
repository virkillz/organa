import { Stack, useLocalSearchParams } from 'expo-router';
import { InsightView } from '@/components/insight-view';
import { monthLabel } from '@/lib/format';

export default function AnalysisSuggestions() {
  const { period } = useLocalSearchParams<{ period: string }>();
  const label = period.length === 4 ? `Analisis Tahunan ${period}` : `Analisis Bulanan ${monthLabel(period, true)} ${period.slice(0, 4)}`;
  return (
    <>
      <Stack.Screen options={{ title: 'Simpulan & Sugesti' }} />
      <InsightView kind="analysis" period={period} periodLabel={label} />
    </>
  );
}
