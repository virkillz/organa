import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { TextLink } from '@/components/ui/text-link';
import { Text } from '@/components/ui/text';
import { colors, space } from '@/theme/tokens';

export default function Welcome() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.hero}>
        <Logo size={150} />
      </View>
      <Text style={styles.copy}>Selamat datang, silakan log in sebagai pemilik atau sebagai karyawan.</Text>
      <View style={styles.actions}>
        <Button variant="light" title="Log in sebagai Pemilik" onPress={() => router.push('/owner-login')} />
        <Text style={styles.or}>Atau</Text>
        <Button variant="light" title="Log in sebagai Karyawan" onPress={() => router.push('/employee-login')} />
      </View>
      <View style={styles.register}>
        <TextLink tone="onPrimary" prompt="Belum memiliki akun?" action="Daftar" onPress={() => router.push('/register')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primaryDark, paddingHorizontal: space.lg },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: space.lg },
  copy: { color: colors.white, textAlign: 'center', fontSize: 16, lineHeight: 24, marginVertical: space.lg },
  actions: { gap: space.sm },
  or: { color: colors.white, textAlign: 'center', fontSize: 12 },
  register: { marginTop: space.sm, marginBottom: space.xl * 2 },
});
