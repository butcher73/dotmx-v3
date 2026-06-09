"use client";

import { useState, useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  ChartOptions,
} from "chart.js";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip
);

interface PortfolioValueChartProps {
  totalBalance: number;
}

type TimeRange = "1D" | "1W" | "1M" | "6M";

export function PortfolioValueChart({
  totalBalance,
}: PortfolioValueChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("1W");

  // Generate a flat line at current balance (no historical data available yet)
  const { data, labels } = useMemo(() => {
    const dataPoints =
      timeRange === "1D"
        ? 24
        : timeRange === "1W"
          ? 7
          : timeRange === "1M"
            ? 30
            : 180;
    const chartData: number[] = [];
    const chartLabels: string[] = [];

    for (let i = 0; i < dataPoints; i++) {
      // Show current balance as flat line (real historical data not available yet)
      chartData.push(totalBalance);

      if (timeRange === "1D") {
        chartLabels.push(`${i}:00`);
      } else if (timeRange === "1W") {
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        chartLabels.push(days[i] || `${i}`);
      } else {
        chartLabels.push(`${i + 1}`);
      }
    }

    return { data: chartData, labels: chartLabels };
  }, [timeRange, totalBalance]);

  const chartData = {
    labels,
    datasets: [
      {
        data,
        borderColor: "#fa5f1a",
        backgroundColor: (context: {
          chart: { ctx: CanvasRenderingContext2D };
        }) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 200);
          gradient.addColorStop(0, "rgba(250, 95, 26, 0.3)");
          gradient.addColorStop(1, "rgba(250, 95, 26, 0)");
          return gradient;
        },
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: "#fa5f1a",
        pointHoverBorderColor: "#fff",
        pointHoverBorderWidth: 2,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: "index",
        intersect: false,
        backgroundColor: "#1a1a1a",
        titleColor: "#fff",
        bodyColor: "#fff",
        borderColor: "#333",
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          label: (context) =>
            `$${(context.parsed.y ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: "#838383",
          maxTicksLimit: 8,
          font: {
            size: 10,
          },
        },
      },
      y: {
        display: false,
      },
    },
    interaction: {
      mode: "index",
      intersect: false,
    },
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-foreground-muted text-xs">
          Historical data coming soon
        </p>
        <div className="flex gap-6 text-xs">
          {(["1D", "1W", "1M", "6M"] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`font-medium transition-colors ${
                timeRange === range
                  ? "text-primary"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[200px]">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
