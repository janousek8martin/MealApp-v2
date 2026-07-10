import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import type { ProjectionPoint } from '@/domain/projection';
import { useTheme } from '@/theme/ThemeContext';

type ActualPoint = { week: number; weightKg: number };

type Props = {
  /** From domain/projection.ts's computeWeightProjection. */
  projection: ProjectionPoint[];
  /** Real weigh-ins, week-since-projection-start - overlaid as dots (Progress screen usage). */
  actualPoints?: ActualPoint[];
  height?: number;
};

const VIEW_WIDTH = 320;

function pathFor(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

/** Groups consecutive projection points sharing the same phase into runs, each including the boundary point from the previous run so segments connect with no visual gap. */
function phaseRuns(points: ProjectionPoint[]): ProjectionPoint[][] {
  const runs: ProjectionPoint[][] = [];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    if (runs.length === 0 || runs[runs.length - 1][0].phase !== curr.phase) {
      runs.push([prev, curr]);
    } else {
      runs[runs.length - 1].push(curr);
    }
  }
  return runs;
}

/**
 * Weight-vs-time line chart for a goal projection (see computeWeightProjection):
 * active weeks (deficit/surplus) draw a solid line, maintenance weeks a
 * dashed flat line - the visual distinction the plan called for. Optional
 * `actualPoints` overlays real weigh-ins (Progress screen) so a profile can
 * see how they're tracking against the plan.
 */
export function WeightProjectionChart({ projection, actualPoints, height = 160 }: Props) {
  const { colors } = useTheme();

  const { segments, xForWeek, yForWeight } = useMemo(() => {
    const allWeights = [...projection.map((p) => p.weightKg), ...(actualPoints ?? []).map((p) => p.weightKg)];
    const min = Math.min(...allWeights);
    const max = Math.max(...allWeights);
    const pad = Math.max((max - min) * 0.15, 0.5);
    const wMin = min - pad;
    const wMax = max + pad;
    const lastWeek = projection[projection.length - 1]?.week ?? 0;
    const wkMax = Math.max(lastWeek, 1);

    const xFor = (week: number) => (week / wkMax) * (VIEW_WIDTH - 24) + 12;
    const yFor = (weightKg: number) => height - 24 - ((weightKg - wMin) / (wMax - wMin)) * (height - 40);

    const runs = phaseRuns(projection).map((run) => ({
      phase: run[0].phase,
      d: pathFor(run.map((p) => ({ x: xFor(p.week), y: yFor(p.weightKg) }))),
    }));

    return { segments: runs, xForWeek: xFor, yForWeight: yFor };
  }, [projection, actualPoints, height]);

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${VIEW_WIDTH} ${height}`}>
        <Line x1={12} y1={height - 24} x2={VIEW_WIDTH - 12} y2={height - 24} stroke={colors.border} strokeWidth={1} />
        {segments.map((seg, i) => (
          <Path
            key={i}
            d={seg.d}
            stroke={seg.phase === 'maintenance' ? colors.textSecondary : colors.primary}
            strokeWidth={seg.phase === 'maintenance' ? 2 : 3}
            strokeDasharray={seg.phase === 'maintenance' ? '4 4' : undefined}
            strokeLinecap="round"
            fill="none"
          />
        ))}
        {(actualPoints ?? []).map((p, i) => (
          <Circle key={i} cx={xForWeek(p.week)} cy={yForWeight(p.weightKg)} r={4} fill={colors.secondary} />
        ))}
      </Svg>
    </View>
  );
}

export type { ActualPoint as WeightProjectionActualPoint };
