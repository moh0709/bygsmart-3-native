// ─────────────────────────────────────────────────────────────────────────────
// THE GANTT CANARY (P1 1.7) — a DELIBERATELY THROWAWAY prototype.
//
// Purpose (Build Plan §risk R3): stress the hardest thing about "one universal
// codebase" — a data-dense, absolutely-positioned, 2-D-scrolling custom canvas —
// on the React Native Web renderer, BEFORE committing the planning module to it.
// It either de-risks universality or tells us to plan `.web.tsx` for planning now.
// The verdict is recorded in docs/mobile-fork/P1_GANTT_CANARY.md (a G1 gate item).
//
// This is NOT production planning UI: no gestures, no virtualization, no real
// date math. It exercises the RENDER path only, which is where RNW diverges.
// Delete after the planning module's real implementation lands.
// ─────────────────────────────────────────────────────────────────────────────
import { ScrollView, View } from 'react-native';
import { useTheme, type Theme } from '../theme/ThemeProvider';
import { Text } from '../primitives/Text';

export type GanttTone = 'primary' | 'success' | 'warning' | 'danger';

export interface GanttBar {
  /** Day offset (integer) from column 0. */
  start: number;
  /** Exclusive end day offset; width = end - start. */
  end: number;
  label: string;
  tone?: GanttTone;
}

export interface GanttRow {
  id: string;
  label: string;
  bars: GanttBar[];
}

export interface GanttViewProps {
  rows: GanttRow[];
  /** Number of day columns to draw. */
  days: number;
  /** Column drawn as "today" (vertical marker). */
  todayColumn?: number;
  dayWidth?: number;
  rowHeight?: number;
  labelWidth?: number;
}

const TONE: Record<GanttTone, keyof Theme['colors']> = {
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

/** Throwaway universality probe — see file header. */
export function GanttView({
  rows,
  days,
  todayColumn,
  dayWidth = 44,
  rowHeight = 44,
  labelWidth = 140,
}: GanttViewProps) {
  const t = useTheme();
  const gridWidth = days * dayWidth;
  const headerHeight = 32;
  const dayCols = Array.from({ length: days }, (_, i) => i);

  return (
    // Outer vertical scroll moves labels + grid together; inner horizontal scroll
    // pans only the grid. Nested opposite-axis ScrollViews are the classic RNW
    // divergence point — the canary's core question.
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexDirection: 'row' }}>
      {/* Frozen label column */}
      <View style={{ width: labelWidth, borderRightWidth: 1, borderRightColor: t.colors.border }}>
        <View style={{ height: headerHeight, justifyContent: 'center', paddingHorizontal: t.spacing.sm }}>
          <Text variant="caption" color="textSecondary">
            Opgave
          </Text>
        </View>
        {rows.map((row) => (
          <View
            key={row.id}
            style={{ height: rowHeight, justifyContent: 'center', paddingHorizontal: t.spacing.sm, borderTopWidth: 1, borderTopColor: t.colors.border }}
          >
            <Text variant="label" numberOfLines={1}>
              {row.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Horizontally scrollable timeline */}
      <ScrollView horizontal showsHorizontalScrollIndicator style={{ flex: 1 }}>
        <View style={{ width: gridWidth }}>
          {/* Header: day columns + weekend shading */}
          <View style={{ flexDirection: 'row', height: headerHeight }}>
            {dayCols.map((d) => (
              <View
                key={d}
                style={{
                  width: dayWidth,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: d % 7 >= 5 ? t.colors.surfaceAlt : 'transparent',
                }}
              >
                <Text variant="caption" color="textSecondary">
                  {d + 1}
                </Text>
              </View>
            ))}
          </View>

          {/* Rows with absolutely-positioned bars over a column grid */}
          {rows.map((row) => (
            <View
              key={row.id}
              style={{ height: rowHeight, borderTopWidth: 1, borderTopColor: t.colors.border }}
            >
              {/* Column grid lines / weekend shading */}
              <View style={{ ...absFill, flexDirection: 'row' }}>
                {dayCols.map((d) => (
                  <View
                    key={d}
                    style={{
                      width: dayWidth,
                      height: '100%',
                      borderRightWidth: 1,
                      borderRightColor: t.colors.border + '55',
                      backgroundColor: d % 7 >= 5 ? t.colors.surfaceAlt + '80' : 'transparent',
                    }}
                  />
                ))}
              </View>

              {/* Bars */}
              {row.bars.map((bar, i) => {
                const c = t.colors[TONE[bar.tone ?? 'primary']];
                return (
                  <View
                    key={i}
                    accessibilityRole="text"
                    accessibilityLabel={`${row.label}: ${bar.label}`}
                    style={{
                      position: 'absolute',
                      left: bar.start * dayWidth + 2,
                      top: rowHeight * 0.2,
                      width: Math.max(0, (bar.end - bar.start) * dayWidth - 4),
                      height: rowHeight * 0.6,
                      borderRadius: t.radii.sm,
                      backgroundColor: c + '2A',
                      borderWidth: 1,
                      borderColor: c,
                      justifyContent: 'center',
                      paddingHorizontal: t.spacing.xs,
                      overflow: 'hidden',
                    }}
                  >
                    <Text variant="caption" numberOfLines={1} style={{ color: c }}>
                      {bar.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}

          {/* Today marker spanning the full height */}
          {todayColumn != null ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: todayColumn * dayWidth,
                width: 2,
                backgroundColor: t.colors.danger,
              }}
            />
          ) : null}
        </View>
      </ScrollView>
    </ScrollView>
  );
}

const absFill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;
