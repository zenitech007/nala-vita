"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { THEMES } from "@/lib/themes";

export interface IntakeDatum {
  name: string;
  newPatients: number;
  aiDiagnoses: number;
}

interface Props {
  data: IntakeDatum[];
}

export default function PatientIntakeChart({ data }: Props) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" strokeOpacity={0.2} />

          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#6B7280", fontSize: 12 }}
            dy={10}
          />

          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />

          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(30, 31, 34, 0.9)",
              borderColor: "#374151",
              borderRadius: "8px",
              color: "#F3F4F6",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            }}
            itemStyle={{ color: "#E5E7EB" }}
          />

          <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />

          {/* TODO Phase 4+: hook into a ThemeContext so this stroke colour live-tints with the selected theme */}
          <Line
            type="monotone"
            name="New Patients"
            dataKey="newPatients"
            stroke={THEMES.rose.primary}
            strokeWidth={3}
            activeDot={{ r: 6, strokeWidth: 0 }}
            dot={{ r: 3, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            name="AI Diagnoses"
            dataKey="aiDiagnoses"
            stroke="#8B5CF6"
            strokeWidth={3}
            activeDot={{ r: 6, strokeWidth: 0 }}
            dot={{ r: 3, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
