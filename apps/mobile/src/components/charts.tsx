import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { Text } from '@/components/ui/text';
import { colors, fonts } from '@/theme/tokens';

type Point = { label: string; value: number };
const PAD = { top: 28, right: 12, bottom: 24, left: 12 };

/** Compact axis labels: 1.2jt, 850rb. */
export function shortRupiah(n: number): string {
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',')}jt`;
  if (Math.abs(n) >= 1e3) return `${Math.round(n / 1e3)}rb`;
  return String(Math.round(n));
}

function useWidth() {
  const [width, setWidth] = useState(0);
  return { width, onLayout: (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width) };
}

/** Readout shown above a chart for the tapped point (touch stand-in for a hover tooltip). */
function Readout({ text }: { text: string | null }) {
  return <Text style={styles.readout}>{text ?? 'Ketuk grafik untuk melihat nilai'}</Text>;
}

/**
 * Single-series area line. Points from `estimateFrom` on are drawn dashed and hollow
 * (a forecast continuing the same series), so the estimate is never colour-only.
 */
export function AreaChart({
  data,
  height = 170,
  estimateFrom,
  format,
  accessibilityLabel,
}: {
  data: Point[];
  height?: number;
  estimateFrom?: number;
  format: (v: number) => string;
  accessibilityLabel: string;
}) {
  const { width, onLayout } = useWidth();
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value)) * 1.1;
  const innerW = Math.max(1, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length === 1 ? innerW / 2 : (i * innerW) / (data.length - 1));
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const split = estimateFrom ?? data.length;

  const path = (from: number, to: number) =>
    data
      .slice(from, to)
      .map((d, i) => `${i === 0 ? 'M' : 'L'}${x(from + i).toFixed(1)},${y(d.value).toFixed(1)}`)
      .join(' ');
  const solid = path(0, Math.min(split, data.length));
  const area = split > 1 ? `${solid} L${x(split - 1)},${PAD.top + innerH} L${x(0)},${PAD.top + innerH} Z` : '';
  const dashed = estimateFrom !== undefined ? path(Math.max(0, split - 1), data.length) : '';
  const sel = selected !== null ? data[selected] : undefined;

  return (
    <View onLayout={onLayout} accessible accessibilityLabel={`${accessibilityLabel}. ${data.map((d) => `${d.label} ${format(d.value)}`).join(', ')}`}>
      <Readout text={sel ? `${sel.label}${selected! >= split ? ' (prediksi)' : ''}: ${format(sel.value)}` : null} />
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.primaryLight} stopOpacity={0.35} />
              <Stop offset="1" stopColor={colors.primaryLight} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>
          {[0.5, 1].map((f) => (
            <Line key={f} x1={PAD.left} x2={width - PAD.right} y1={y((max / 1.1) * f)} y2={y((max / 1.1) * f)} stroke={colors.line} strokeWidth={1} strokeDasharray="3 4" />
          ))}
          {[0.5, 1].map((f) => (
            <SvgText key={`t${f}`} x={PAD.left} y={y((max / 1.1) * f) - 4} fontSize={10} fill={colors.muted} fontFamily={fonts.regular}>
              {shortRupiah((max / 1.1) * f)}
            </SvgText>
          ))}
          {estimateFrom !== undefined && estimateFrom < data.length ? (
            <Rect x={x(estimateFrom) - innerW / Math.max(1, data.length - 1) / 2} y={PAD.top} width={width - PAD.right - (x(estimateFrom) - innerW / Math.max(1, data.length - 1) / 2)} height={innerH} fill={colors.surfaceTint} />
          ) : null}
          {area ? <Path d={area} fill="url(#fill)" /> : null}
          <Path d={solid} stroke={colors.primary} strokeWidth={2} fill="none" strokeLinejoin="round" />
          {dashed ? <Path d={dashed} stroke={colors.primary} strokeWidth={2} strokeDasharray="5 4" fill="none" /> : null}
          {data.map((d, i) => (
            <Circle
              key={i}
              cx={x(i)}
              cy={y(d.value)}
              r={selected === i ? 6 : 4}
              fill={i >= split ? colors.white : colors.primary}
              stroke={i >= split ? colors.primary : colors.white}
              strokeWidth={2}
            />
          ))}
          {sel ? <Line x1={x(selected!)} x2={x(selected!)} y1={PAD.top} y2={PAD.top + innerH} stroke={colors.navy} strokeWidth={1} opacity={0.4} /> : null}
          {data.map((d, i) => (
            <SvgText key={`l${i}`} x={x(i)} y={height - 6} fontSize={10} fill={colors.navy} textAnchor="middle" fontFamily={fonts.regular}>
              {d.label}
            </SvgText>
          ))}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
      {/* Tap targets wider than the marks: one column per point. */}
      <View style={[StyleSheet.absoluteFill, { top: 20, flexDirection: 'row', paddingHorizontal: PAD.left - innerW / Math.max(1, data.length - 1) / 2 }]}>
        {data.map((d, i) => (
          <Pressable key={i} accessibilityLabel={`${d.label} ${format(d.value)}`} style={{ flex: 1 }} onPress={() => setSelected(selected === i ? null : i)} />
        ))}
      </View>
    </View>
  );
}

/** Single-series vertical bars with 4px rounded tops anchored to the baseline. */
export function BarChart({ data, height = 150, format, accessibilityLabel, highlightLast }: { data: Point[]; height?: number; format: (v: number) => string; accessibilityLabel: string; highlightLast?: boolean }) {
  const { width, onLayout } = useWidth();
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const innerW = Math.max(1, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const slot = innerW / data.length;
  const barW = Math.min(28, slot - 6);
  const sel = selected !== null ? data[selected] : undefined;

  return (
    <View onLayout={onLayout} accessible accessibilityLabel={`${accessibilityLabel}. ${data.map((d) => `${d.label} ${format(d.value)}`).join(', ')}`}>
      <Readout text={sel ? `${sel.label}: ${format(sel.value)}` : null} />
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke={colors.line} strokeWidth={1} />
          {data.map((d, i) => {
            const h = Math.max(d.value > 0 ? 3 : 0, (d.value / max) * innerH);
            const bx = PAD.left + i * slot + (slot - barW) / 2;
            const by = PAD.top + innerH - h;
            const r = Math.min(4, h / 2, barW / 2);
            // Rounded top corners only; the bottom sits flat on the baseline.
            const p = `M${bx},${by + h} L${bx},${by + r} Q${bx},${by} ${bx + r},${by} L${bx + barW - r},${by} Q${bx + barW},${by} ${bx + barW},${by + r} L${bx + barW},${by + h} Z`;
            const active = selected === i || (selected === null && highlightLast && i === data.length - 1);
            return <Path key={i} d={p} fill={active ? colors.primary : colors.primaryTint} />;
          })}
          {data.map((d, i) => (
            <SvgText key={`l${i}`} x={PAD.left + i * slot + slot / 2} y={height - 6} fontSize={10} fill={colors.navy} textAnchor="middle" fontFamily={fonts.regular}>
              {d.label}
            </SvgText>
          ))}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
      <View style={[StyleSheet.absoluteFill, { top: 20, flexDirection: 'row', paddingHorizontal: PAD.left }]}>
        {data.map((d, i) => (
          <Pressable key={i} accessibilityLabel={`${d.label} ${format(d.value)}`} style={{ flex: 1 }} onPress={() => setSelected(selected === i ? null : i)} />
        ))}
      </View>
    </View>
  );
}

/** Share bar for a ranked list row (value / total). */
export function ShareBar({ share }: { share: number }) {
  return (
    <View style={styles.shareTrack}>
      <View style={[styles.shareFill, { width: `${Math.max(2, Math.round(share * 100))}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { fontFamily: fonts.medium, fontSize: 12, color: colors.navy, textAlign: 'center', minHeight: 18 },
  shareTrack: { height: 8, borderRadius: 4, backgroundColor: colors.suggestionBg, overflow: 'hidden' },
  shareFill: { height: 8, borderRadius: 4, backgroundColor: colors.primaryLight },
});
