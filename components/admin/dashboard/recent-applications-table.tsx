import * as React from "react"
import Link from "next/link"
import { ArrowUpRight, ArrowRight, Clock, Users } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge, TabularPrice } from "@/components/layout/status-badge"
import type { ApplicationRowItem } from "@/components/admin/applications/applications-table"

export function RecentApplicationsTable({
  applications,
}: {
  applications: ApplicationRowItem[]
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card shadow-xs">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div>
          <h3 className="font-display text-base font-bold text-foreground">
            Recent Inquiry Feed
          </h3>
          <p className="text-xs text-muted-foreground">
            Latest customer inquiries submitted across public and partner channels
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs font-semibold hover:border-gold"
          render={<Link href="/admin/applications" />}
          nativeButton={false}
        >
          <span>View All Queue</span>
          <ArrowRight className="size-3.5" />
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-secondary/40">
            <TableRow>
              <TableHead className="text-xs font-semibold text-foreground">Reference</TableHead>
              <TableHead className="text-xs font-semibold text-foreground">Pilgrim</TableHead>
              <TableHead className="text-xs font-semibold text-foreground">Source</TableHead>
              <TableHead className="text-xs font-semibold text-foreground">Pilgrims</TableHead>
              <TableHead className="text-xs font-semibold text-foreground">Status</TableHead>
              <TableHead className="text-right text-xs font-semibold text-foreground">Amount</TableHead>
              <TableHead className="w-[80px] text-right text-xs font-semibold text-foreground">Worksheet</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.slice(0, 6).map((app) => {
              const latestQuote = app.quotes?.[0]
              const total =
                latestQuote?.grandTotalPkr || app.calculatedVisaTotalPkr || 0

              return (
                <TableRow key={app.id} className="hover:bg-muted/40 transition-colors">
                  <TableCell className="font-mono text-xs font-bold text-primary">
                    <Link
                      href={`/admin/applications/${app.id}`}
                      className="hover:underline"
                    >
                      {app.referenceNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-semibold text-foreground block">
                      {app.customerName}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {app.customerCity}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="border-border bg-secondary text-[10px] font-medium capitalize"
                    >
                      {app.source.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <span className="font-mono">{app.totalPassportCount}</span> Pax
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={app.status}
                      createdAt={app.createdAt}
                      showSlaWarning={true}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {total > 0 ? (
                      <TabularPrice amount={total} className="text-xs" />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      render={<Link href={`/admin/applications/${app.id}`} />}
                      nativeButton={false}
                      className="hover:text-primary"
                    >
                      <ArrowUpRight className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
