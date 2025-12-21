'use client';

import { cn } from '@doccov/ui/lib/utils';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface SignalDataPoint {
  version: string;
  date: string;
  descriptionPercent: number;
  paramsPercent: number;
  returnsPercent: number;
  examplesPercent: number;
}

interface SignalBreakdownChartProps {
  data: SignalDataPoint[];
  height?: number;
  className?: string;
}

const signalColors = {
  description: '#22c55e', // green
  params: '#3b82f6', // blue
  returns: '#8b5cf6', // purple
  examples: '#f59e0b', // amber
};

// Custom tooltip
function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: SignalDataPoint }>;
}) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload as SignalDataPoint;

  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
      <div className="font-mono font-medium text-foreground mb-2">{data.version}</div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: signalColors.description }}
            />
            <span className="text-muted-foreground">Descriptions</span>
          </div>
          <span className="font-mono tabular-nums">{data.descriptionPercent}%</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: signalColors.params }}
            />
            <span className="text-muted-foreground">Params</span>
          </div>
          <span className="font-mono tabular-nums">{data.paramsPercent}%</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: signalColors.returns }}
            />
            <span className="text-muted-foreground">Returns</span>
          </div>
          <span className="font-mono tabular-nums">{data.returnsPercent}%</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: signalColors.examples }}
            />
            <span className="text-muted-foreground">Examples</span>
          </div>
          <span className="font-mono tabular-nums">{data.examplesPercent}%</span>
        </div>
      </div>
    </div>
  );
}

// Custom legend
function ChartLegend() {
  return (
    <div className="flex items-center justify-center gap-4 mt-2 text-xs">
      <div className="flex items-center gap-1.5">
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: signalColors.description }}
        />
        <span className="text-muted-foreground">Descriptions</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ backgroundColor: signalColors.params }} />
        <span className="text-muted-foreground">Params</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ backgroundColor: signalColors.returns }} />
        <span className="text-muted-foreground">Returns</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ backgroundColor: signalColors.examples }} />
        <span className="text-muted-foreground">Examples</span>
      </div>
    </div>
  );
}

export function SignalBreakdownChart({ data, height = 200, className }: SignalBreakdownChartProps) {
  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
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
            dataKey="descriptionPercent"
            stroke={signalColors.description}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="paramsPercent"
            stroke={signalColors.params}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="returnsPercent"
            stroke={signalColors.returns}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="examplesPercent"
            stroke={signalColors.examples}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <ChartLegend />
    </div>
  );
}
