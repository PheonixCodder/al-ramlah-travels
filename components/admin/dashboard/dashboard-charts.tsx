"use client"

import * as React from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface StatusDistributionItem {
  name: string
  count: number
  pkrValue: number
  color: string
}

interface PillarDemandItem {
  pillar: string
  inquiries: number
  fillColor: string
}

interface DashboardChartsProps {
  statusData: StatusDistributionItem[]
  pillarData: PillarDemandItem[]
}

export function DashboardCharts({
  statusData,
  pillarData,
}: DashboardChartsProps) {
  const formatPkrCompact = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`
    return `${val}`
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* 1. Pipeline Volume & Value Distribution (8 cols) */}
      <Card className="border-border bg-card shadow-xs lg:col-span-7">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-display text-base font-bold text-foreground">
                Inquiry Pipeline & Revenue Value (PKR)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Live volume and total monetary value across pipeline milestones
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-[280px] min-w-0 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
              <BarChart
                data={statusData}
                margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E6DEC8"
                  opacity={0.6}
                />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={{ stroke: "#E6DEC8" }}
                  tick={{ fill: "#686E65", fontSize: 11 }}
                />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  tickLine={false}
                  axisLine={{ stroke: "#E6DEC8" }}
                  tick={{ fill: "#686E65", fontSize: 10 }}
                  tickFormatter={formatPkrCompact}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#686E65", fontSize: 10 }}
                  allowDecimals={false}
                />
                <Tooltip
                  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                  formatter={(value: any, name: any) => {
                    if (name === "pkrValue") {
                      return [
                        `PKR ${Number(value).toLocaleString()}`,
                        "Pipeline Value",
                      ]
                    }
                    return [`${value} Inquiries`, "Count"]
                  }}
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "8px",
                    border: "1px solid #E6DEC8",
                    boxShadow: "0 4px 12px rgba(10,54,34,0.08)",
                    fontSize: "12px",
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="pkrValue"
                  name="pkrValue"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={45}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-xs text-muted-foreground">
            {statusData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.name}:</span>
                <span className="font-semibold text-foreground">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 2. Service Pillar Adoption (5 cols) */}
      <Card className="border-border bg-card shadow-xs lg:col-span-5">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-base font-bold text-foreground">
            Service Pillar Demand
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Pilgrim inclusion requests across the 5 travel pillars
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-[280px] min-w-0 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
              <BarChart
                data={pillarData}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="#E6DEC8"
                  opacity={0.6}
                />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={{ stroke: "#E6DEC8" }}
                  tick={{ fill: "#686E65", fontSize: 10 }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="pillar"
                  tickLine={false}
                  axisLine={{ stroke: "#E6DEC8" }}
                  tick={{ fill: "#1A1D1A", fontSize: 11, fontWeight: 500 }}
                  width={75}
                />
                <Tooltip
                  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                  formatter={(val: any) => [`${val} Inquiries`, "Demand"]}
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "8px",
                    border: "1px solid #E6DEC8",
                    fontSize: "12px",
                  }}
                />
                <Bar
                  dataKey="inquiries"
                  radius={[0, 6, 6, 0]}
                  maxBarSize={28}
                >
                  {pillarData.map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={entry.fillColor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
