import Ionicons from '@expo/vector-icons/Ionicons';
import { zodResolver } from '@hookform/resolvers/zod';
import { ownerLoginSchema, type OtpChannel } from '@organa/shared';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import type { z } from 'zod';
import { AuthScreen } from '@/components/auth-screen';
import { Button } from '@/components/ui/button';
import { Chip, UnderlineField } from '@/components/ui/fields';
import { Text } from '@/components/ui/text';
import { TextLink } from '@/components/ui/text-link';
import { api } from '@/lib/api';
import { applyApiError } from '@/lib/form';
import { colors, fonts, space } from '@/theme/tokens';

const CHANNELS: { value: OtpChannel; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'EMAIL', label: 'Email', icon: 'mail' },
  { value: 'WHATSAPP', label: 'WhatsApp', icon: 'logo-whatsapp' },
  { value: 'SMS', label: 'SMS', icon: 'chatbubble-ellipses' },
  { value: 'MISSED_CALL', label: 'Missed Call', icon: 'call' },
];

type Form = z.input<typeof ownerLoginSchema>;

export default function OwnerLogin() {
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(ownerLoginSchema),
    defaultValues: { email: '', password: '', otpChannel: 'EMAIL' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const challenge = await api.ownerLogin(values);
      router.push({ pathname: '/otp', params: challenge });
    } catch (e) {
      applyApiError(e, setError);
    }
  });

  return (
    <AuthScreen
      title={'Log in sebagai\nPemilik Bisnis'}
      subtitle="Masukkan email dan password kamu"
      footer={
        <>
          <Button title="LOGIN" onPress={onSubmit} loading={isSubmitting} />
          <View style={styles.divider} />
          <Button title="LOGIN KARYAWAN" onPress={() => router.replace('/employee-login')} />
          <TextLink prompt="Belum memiliki akun?" action="Daftar" onPress={() => router.push('/register')} />
        </>
      }>
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <UnderlineField
            placeholder="Email"
            keyboardType="email-address"
            autoComplete="email"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.email?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <UnderlineField
            placeholder="Password"
            secure
            autoComplete="password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            onSubmitEditing={onSubmit}
            error={errors.password?.message}
            trailing={
              <Pressable
                accessibilityRole="link"
                onPress={() => Alert.alert('Lupa password', 'Fitur reset password segera hadir.')}>
                <Text style={styles.forgot}>Lupa password?</Text>
              </Pressable>
            }
          />
        )}
      />
      <View style={{ gap: space.sm }}>
        <Text style={styles.otpLabel}>Kirim OTP via:</Text>
        <Controller
          control={control}
          name="otpChannel"
          render={({ field }) => (
            <View style={styles.chips} accessibilityRole="radiogroup">
              {CHANNELS.map((c) => {
                const selected = field.value === c.value;
                return (
                  <Chip
                    key={c.value}
                    label={c.label}
                    selected={selected}
                    onPress={() => field.onChange(c.value)}
                    icon={<Ionicons name={c.icon} size={18} color={selected ? colors.white : colors.navy} />}
                  />
                );
              })}
            </View>
          )}
        />
      </View>
      {errors.root ? <Text variant="error">{errors.root.message}</Text> : null}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  forgot: { fontFamily: fonts.medium, fontSize: 13, color: colors.primaryLight },
  otpLabel: { fontSize: 12, color: colors.navy },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  divider: { height: 1, backgroundColor: colors.line, marginHorizontal: space.md },
});
