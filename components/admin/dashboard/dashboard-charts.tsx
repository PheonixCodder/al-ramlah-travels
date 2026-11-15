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
  Legend,
} from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export interface StatusDistributionItem {
  name: string
  count: number
  pkrValue: number
  color: string
}

export interface PillarDemandItem {
  pillar: string
  inquiries: number
  fillColor: string
}

export interface MonthlyRevenueTrajectoryItem {
  monthKey: string
  monthLabel: string
  collectedPkr: number
  approvedPkr: number
  quotedPkr: number
}

export interface LeadSourceBreakdownItem {
  source: string
  inquiries: number
  approvedCount: number
  fillColor: string
}

export interface DashboardChartsProps {
  statusData: StatusDistributionItem[]
  pillarData: PillarDemandItem[]
  monthlyTrajectoryData?: MonthlyRevenueTrajectoryItem[]
  leadSourceData?: LeadSourceBreakdownItem[]
}

const emptySubscribe = () => () => {}

type TooltipScalar = number | string | ReadonlyArray<number | string> | undefined

function toFiniteNumber(value: TooltipScalar): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function DashboardCharts({
  statusData,
  pillarData,
  monthlyTrajectoryData = [],
  leadSourceData = [],
}: DashboardChartsProps) {
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )

  const formatPkrCompact = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`
    return `${val}`
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* 1. Pipeline Volume & Value Distribution (7 cols) */}
        <Card className="min-w-0 border-border bg-card shadow-xs lg:col-span-7">
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
            <div className="h-[280px] min-h-[280px] min-w-0 w-full">
              {mounted ? (
                <ResponsiveContainer
                  width="100%"
                  height={280}
                  minWidth={0}
                  initialDimension={{ width: 520, height: 280 }}
                >
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
                      formatter={(
                        value: TooltipScalar,
                        name: number | string | undefined
                      ) => {
                        const numeric = toFiniteNumber(value)
                        if (name === "pkrValue") {
                          return [
                            `PKR ${numeric.toLocaleString("en-PK")}`,
                            "Pipeline Value",
                          ]
                        }
                        return [`${numeric} Inquiries`, "Dossiers"]
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
                      maxBarSize={42}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                    <Bar
                      yAxisId="right"
                      dataKey="count"
                      name="count"
                      fill="#C5A059"
                      opacity={0.35}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={18}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] w-full animate-pulse rounded-lg bg-muted/30" />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-xs text-muted-foreground">
              {statusData.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>{item.name}:</span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 2. Service Pillar Adoption (5 cols) */}
        <Card className="min-w-0 border-border bg-card shadow-xs lg:col-span-5">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base font-bold text-foreground">
              Service Pillar Demand
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Pilgrim inclusion requests across the 5 travel pillars
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[280px] min-h-[280px] min-w-0 w-full">
              {mounted ? (
                <ResponsiveContainer
                  width="100%"
                  height={280}
                  minWidth={0}
                  initialDimension={{ width: 380, height: 280 }}
                >
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
                      formatter={(val: TooltipScalar) => [
                        `${toFiniteNumber(val)} Inquiries`,
                        "Demand",
                      ]}
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
              ) : (
                <div className="h-[280px] w-full animate-pulse rounded-lg bg-muted/30" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Monthly Revenue Trajectory (PKT) & Lead Source Breakdown (`T-086`) */}
      {(monthlyTrajectoryData.length > 0 || leadSourceData.length > 0) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Card className="min-w-0 border-border bg-card shadow-xs lg:col-span-7">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base font-bold text-foreground">
                Monthly Revenue Trajectory (PKT)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                6-month Asia/Karachi comparison of verified cash collected vs approved bookings
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-[260px] min-h-[260px] min-w-0 w-full">
                {mounted ? (
                  <ResponsiveContainer
                    width="100%"
                    height={260}
                    minWidth={0}
                    initialDimension={{ width: 520, height: 260 }}
                  >
                    <BarChart
                      data={monthlyTrajectoryData}
                      margin={{ top: 16, right: 20, left: 0, bottom: 16 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#E6DEC8"
                        opacity={0.6}
                      />
                      <XAxis
                        dataKey="monthLabel"
                        tickLine={false}
                        axisLine={{ stroke: "#E6DEC8" }}
                        tick={{ fill: "#686E65", fontSize: 11 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={{ stroke: "#E6DEC8" }}
                        tick={{ fill: "#686E65", fontSize: 10 }}
                        tickFormatter={formatPkrCompact}
                      />
                      <Tooltip
                        formatter={(
                          val: TooltipScalar,
                          name: number | string | undefined
                        ) => {
                          const amount = toFiniteNumber(val)
                          const label =
                            name === "collectedPkr"
                              ? "Collected Cash"
                              : name === "approvedPkr"
                                ? "Approved Bookings"
                                : "Quoted Pipeline"
                          return [
                            `PKR ${amount.toLocaleString("en-PK")}`,
                            label,
                          ]
                        }}
                        contentStyle={{
                          backgroundColor: "#FFFFFF",
                          borderRadius: "8px",
                          border: "1px solid #E6DEC8",
                          fontSize: "12px",
                        }}
                      />
                      <Legend
                        formatter={(value: string) =>
                          value === "collectedPkr"
                            ? "Collected Cash"
                            : value === "approvedPkr"
                              ? "Approved Bookings"
                              : "Quoted Pipeline"
                        }
                        wrapperStyle={{ fontSize: "11px" }}
                      />
                      <Bar
                        dataKey="collectedPkr"
                        fill="#0F4C31"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={26}
                      />
                      <Bar
                        dataKey="approvedPkr"
                        fill="#C5A059"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={26}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[260px] w-full animate-pulse rounded-lg bg-muted/30" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-border bg-card shadow-xs lg:col-span-5">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base font-bold text-foreground">
                Lead Source Breakdown
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Origination volume across Builder, Group Batches, Hajj & WhatsApp Intake
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-[260px] min-h-[260px] min-w-0 w-full">
                {mounted ? (
                  <ResponsiveContainer
                    width="100%"
                    height={260}
                    minWidth={0}
                    initialDimension={{ width: 380, height: 260 }}
                  >
                    <BarChart
                      data={leadSourceData}
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
                        dataKey="source"
                        tickLine={false}
                        axisLine={{ stroke: "#E6DEC8" }}
                        tick={{ fill: "#1A1D1A", fontSize: 11, fontWeight: 500 }}
                        width={95}
                      />
                      <Tooltip
                        formatter={(
                          val: TooltipScalar,
                          name: number | string | undefined
                        ) => [
                          `${toFiniteNumber(val)} Dossiers`,
                          name === "approvedCount" ? "Approved" : "Total Leads",
                        ]}
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
                        maxBarSize={24}
                      >
                        {leadSourceData.map((entry, index) => (
                          <Cell key={`src-${index}`} fill={entry.fillColor} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[260px] w-full animate-pulse rounded-lg bg-muted/30" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
