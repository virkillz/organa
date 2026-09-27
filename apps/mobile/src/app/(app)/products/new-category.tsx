import { useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { BoxField } from '@/components/ui/kit';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { space } from '@/theme/tokens';

/** Adds a product category (the grid's "Tambah Kategori" tile). */
export default function NewProductCategory() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await api.createProductCategory({ name: name.trim() });
      await queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
      setSaving(false);
    }
  };
  return (
    <View style={{ padding: space.md, gap: space.md }}>
      <Stack.Screen options={{ title: 'Tambah Kategori' }} />
      <BoxField label="Nama kategori" value={name} onChangeText={setName} autoFocus placeholder="mis. Pasta" />
      {error ? <Text variant="error">{error}</Text> : null}
      <Button title="SIMPAN" onPress={save} loading={saving} disabled={name.trim().length < 2} />
    </View>
  );
}
