import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { TweakerItem } from 'panel'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

const frameData = [
  { frame: '01', gpu: 8.9, target: 16.7 },
  { frame: '02', gpu: 11.4, target: 16.7 },
  { frame: '03', gpu: 10.2, target: 16.7 },
  { frame: '04', gpu: 13.8, target: 16.7 },
  { frame: '05', gpu: 15.2, target: 16.7 },
  { frame: '06', gpu: 12.7, target: 16.7 },
  { frame: '07', gpu: 14.1, target: 16.7 },
  { frame: '08', gpu: 11.6, target: 16.7 },
]

const chartConfig = {
  gpu: { color: 'var(--chart-1)', label: 'GPU frame' },
  target: { color: 'var(--chart-4)', label: '16.7ms target' },
} satisfies ChartConfig

export function ShadcnChartItem() {
  return (
    <TweakerItem
      id="shadcn-frame-chart"
      contentLayout="block"
      description="Official shadcn chart composition on Recharts v3, embedded as a display item."
      label="Frame time"
      readOnly
      reorderable={false}
    >
      <ChartContainer
        className="col-span-full aspect-auto h-36 w-full"
        config={chartConfig}
        initialDimension={{ height: 144, width: 384 }}
      >
        <LineChart accessibilityLayer data={frameData} margin={{ left: 12, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} />
          <XAxis axisLine={false} dataKey="frame" tickLine={false} tickMargin={8} />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            domain={[0, 20]}
            tickMargin={6}
            tickLine={false}
            ticks={[0, 5, 10, 15, 20]}
            width={36}
          />
          <ChartTooltip content={<ChartTooltipContent indicator="line" />} cursor={false} />
          <Line
            dataKey="target"
            dot={false}
            stroke="var(--color-target)"
            strokeDasharray="4 4"
            strokeWidth={1}
            type="linear"
          />
          <Line
            activeDot={{ r: 3 }}
            dataKey="gpu"
            dot={false}
            stroke="var(--color-gpu)"
            strokeWidth={2}
            type="monotone"
          />
        </LineChart>
      </ChartContainer>
    </TweakerItem>
  )
}
