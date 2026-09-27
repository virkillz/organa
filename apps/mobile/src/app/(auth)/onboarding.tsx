import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import { colors, fonts, space } from '@/theme/tokens';

type Page = { art: ReactNode; lead: string; highlight: string; trail?: string };

const PAGES: Page[] = [
  {
    art: <Image source={require('@/assets/images/onboarding/store.png')} style={{ width: 285, height: 270 }} contentFit="contain" />,
    lead: 'Kelola manajemen tokomu, kurangi limbah makanan dan ',
    highlight: 'hemat pengeluaranmu.',
  },
  {
    art: <Image source={require('@/assets/images/onboarding/kitchen.png')} style={{ width: 285, height: 270 }} contentFit="contain" />,
    lead: 'Optimalkan pengelolaan ',
    highlight: 'bahan makanan',
    trail: ' di dapurmu.',
  },
  {
    art: (
      <View style={{ width: 220, height: 220, borderRadius: 110, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="analytics" size={110} color={colors.primary} />
      </View>
    ),
    lead: 'Dapatkan ',
    highlight: 'saran cerdas',
    trail: ' untuk mengurangi kerugian setiap bulan.',
  },
];

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const markOnboardingSeen = useSession((s) => s.markOnboardingSeen);

  const next = async () => {
    if (index < PAGES.length - 1) {
      scroller.current?.scrollTo({ x: width * (index + 1), animated: true });
      setIndex(index + 1);
      return;
    }
    await markOnboardingSeen();
    router.replace('/welcome');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Image source={require('@/assets/images/logo-wordmark.png')} style={styles.logo} contentFit="contain" accessibilityLabel="Organa" />
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}>
        {PAGES.map((page, i) => (
          <View key={i} style={[styles.page, { width }]}>
            <View style={styles.art}>{page.art}</View>
            <Text style={styles.copy}>
              {page.lead}
              <Text style={[styles.copy, styles.highlight]}>{page.highlight}</Text>
              {page.trail}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {PAGES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
      <Button title={index === PAGES.length - 1 ? 'Mulai' : 'Lanjut'} onPress={next} style={styles.cta} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundAlt, paddingBottom: space.lg },
  logo: { width: 104, height: 24, marginLeft: space.lg, marginTop: space.sm },
  page: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  art: { height: 300, alignItems: 'center', justifyContent: 'center' },
  copy: { fontFamily: fonts.regular, fontSize: 20, lineHeight: 30, textAlign: 'center', marginTop: space.xl },
  highlight: { fontFamily: fonts.bold, color: colors.primary },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: space.lg },
  dot: { width: 26, height: 6, borderRadius: 3, backgroundColor: colors.line },
  dotActive: { backgroundColor: colors.primary },
  cta: { alignSelf: 'center', minWidth: 140 },
});
