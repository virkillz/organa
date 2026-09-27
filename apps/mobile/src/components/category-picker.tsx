import Ionicons from '@expo/vector-icons/Ionicons';
import type { StockCategory } from '@organa/shared';
import type { ReactNode } from 'react';
import { FlatList, Modal, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/text';
import { colors, radius, space } from '@/theme/tokens';

/** Bottom-sheet list of options; `null` value means "all". */
export function OptionSheet<T extends string | null>({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
  header,
}: {
  header?: ReactNode;
  visible: boolean;
  title: string;
  options: { value: T; label: string; indent?: boolean }[];
  value: T;
  onSelect: (v: T) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <Text variant="heading" style={{ marginBottom: space.sm }}>
            {title}
          </Text>
          {header}
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={options}
            keyExtractor={(o) => String(o.value)}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                style={[styles.option, item.indent && { paddingLeft: space.lg }]}
                onPress={() => {
                  onSelect(item.value);
                  onClose();
                }}>
                <Text variant={item.value === value ? 'bodyStrong' : 'body'}>{item.label}</Text>
                {item.value === value ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Top-level categories followed by their sub-categories, indented. */
export function categoryOptions(categories: StockCategory[], withAll = true) {
  const top = categories.filter((c) => !c.parentId);
  const out: { value: string | null; label: string; indent?: boolean }[] = withAll ? [{ value: null, label: 'Semua stok' }] : [];
  for (const c of top) {
    out.push({ value: c.id, label: c.name });
    for (const sub of categories.filter((s) => s.parentId === c.id)) out.push({ value: sub.id, label: sub.name, indent: true });
  }
  return out;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, paddingBottom: space.xl, maxHeight: '70%' },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
});
