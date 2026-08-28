import { LineChart, Line, ResponsiveContainer } from "recharts";
import { chartColors } from "./chartTheme";

interface SparklineChartProps {
  data: number[];
  color?: string;
  height?: number;
}

export function SparklineChart({ data, color = chartColors.green, height = 40 }: SparklineChartProps) {
  const chartData = data.map((value, index) => ({ value, index }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
