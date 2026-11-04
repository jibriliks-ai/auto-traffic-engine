"use client";

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  Tooltip, Filler,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

export function ActivityChart({ data }: { data: { labels: string[]; values: number[] } }) {
  return (
    <div className="h-64">
      <Line
        data={{
          labels: data.labels,
          datasets: [
            {
              data: data.values,
              borderColor: "rgb(139, 92, 246)",
              backgroundColor: "rgba(139, 92, 246, 0.1)",
              fill: true,
              tension: 0.4,
              pointRadius: 0,
              pointHoverRadius: 5,
              borderWidth: 2,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { intersect: false, mode: "index" } },
          scales: {
            x: {
              grid: { display: false },
              ticks: { maxTicksLimit: 8, color: "rgb(148, 163, 184)" },
            },
            y: {
              beginAtZero: true,
              grid: { color: "rgba(148, 163, 184, 0.15)" },
              ticks: { maxTicksLimit: 4, color: "rgb(148, 163, 184)" },
            },
          },
        }}
      />
    </div>
  );
}