'use client';

import { cn } from '@doccov/ui/lib/utils';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface CoverageDataPoint {
  version: string;
  date: string;
  coverageScore: number;
  documentedExports: number;
  totalExports: number;
  driftCount: number;
}

interface CoverageChartProps {
  data: CoverageDataPoint[];
  height?: number;
  showGrid?: boolean;
  showArea?: boolean;
  className?: string;
}

// Custom tooltip
function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: CoverageDataPoint }>;
}) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload as CoverageDataPoint;

  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
      <div className="font-mono font-medium text-foreground mb-1">{data.version}</div>
      <div className="text-muted-foreground text-xs mb-2">{data.date}</div>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Coverage</span>
          <span className="font-mono font-medium tabular-nums">{data.coverageScore}%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Documented</span>
          <span className="font-mono tabular-nums">
            {data.documentedExports}/{data.totalExports}
          </span>
        </div>
        {data.driftCount > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Drift issues</span>
            <span className="font-mono tabular-nums text-warning">{data.driftCount}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function CoverageChart({
  data,
  height = 200,
  showGrid = true,
  showArea = true,
  className,
}: CoverageChartProps) {
  // Find regressions (coverage drops)
  const _regressionPoints = data.reduce<number[]>((acc, point, index) => {
    if (index > 0 && point.coverageScore < data[index - 1].coverageScore) {
      acc.push(point.coverageScore);
    }
    return acc;
  }, []);

  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={height}>
        {showArea ? (
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            {showGrid && (
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            )}
            <XAxis
              dataKey="version"
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              dy={8}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}%`}
              width={48}
            />
            <Tooltip content={<ChartTooltip />} />
            <defs>
              <linearGradient id="coverageGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--success)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--success)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="coverageScore"
              stroke="var(--success)"
              strokeWidth={2}
              fill="url(#coverageGradient)"
              dot={(props: { cx?: number; cy?: number; payload?: CoverageDataPoint }) => {
                const { cx, cy, payload } = props;
                if (cx == null || cy == null || !payload) return null;
                // Highlight regression points
                const isRegression =
                  data.indexOf(payload) > 0 &&
                  payload.coverageScore < data[data.indexOf(payload) - 1].coverageScore;

                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isRegression ? 5 : 4}
                    fill={isRegression ? 'var(--warning)' : 'var(--success)'}
                    stroke={isRegression ? 'var(--warning)' : 'var(--success)'}
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{
                r: 6,
                stroke: 'var(--background)',
                strokeWidth: 2,
              }}
            />
            {/* 100% target line */}
            <ReferenceLine
              y={100}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
            />
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            {showGrid && (
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            )}
            <XAxis
              dataKey="version"
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              dy={8}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}%`}
              width={48}
            />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="monotone"
              dataKey="coverageScore"
              stroke="var(--success)"
              strokeWidth={2}
              dot={{ fill: 'var(--success)', r: 4 }}
              activeDot={{ r: 6, stroke: 'var(--background)', strokeWidth: 2 }}
            />
            <ReferenceLine
              y={100}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
