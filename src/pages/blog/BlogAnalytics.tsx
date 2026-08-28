import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Eye, Share2, FileText, BookMarked, Archive } from "lucide-react";
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionError } from "@/components/shared/SectionError";
import { SectionEmpty } from "@/components/shared/SectionEmpty";
import api from "@/lib/axios";

const CATEGORY_COLORS = ["hsl(var(--chart-5))", "hsl(var(--status-active))", "#d45a0a", "hsl(var(--status-approved))", "#eab308", "#ec4899", "#06b6d4"];

export default function BlogAnalytics() {
  const navigate = useNavigate();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "blog-analytics"],
    queryFn: () => api.get("/blog/admin/analytics").then((r) => r.data),
  });

  const totals = data?.data?.totals;
  const topViewed = data?.data?.topViewed || [];
  const categoryDistribution = data?.data?.categoryDistribution || [];

  const kpis = [
    { label: "Total Articles", value: totals?.totalArticles ?? 0, icon: FileText, color: "text-status-approved", bg: "bg-surface-muted" },
    { label: "Published", value: totals?.publishedCount ?? 0, icon: BookMarked, color: "text-status-active", bg: "bg-surface-muted" },
    { label: "Drafts", value: totals?.draftCount ?? 0, icon: FileText, color: "text-status-pending", bg: "bg-surface-muted" },
    { label: "Archived", value: totals?.archivedCount ?? 0, icon: Archive, color: "text-text-secondary", bg: "bg-surface-muted" },
    { label: "Total Views", value: totals?.totalViews ?? 0, icon: Eye, color: "text-status-processing", bg: "bg-surface-muted" },
    { label: "Total Shares", value: totals?.totalShares ?? 0, icon: Share2, color: "text-status-rejected", bg: "bg-surface-muted" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface-base text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary">
          <ArrowLeft className="h-4 w-4 text-text-primary" />
        </button>
        <h1 className="text-lg font-semibold text-text-primary">Blog Analytics</h1>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <SectionError message="Failed to load blog analytics" onRetry={() => refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {kpis.map((kpi) => (
              <Card key={kpi.label} className="border-l-2 border-l-primary/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${kpi.bg}`}>
                      <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                    </div>
                    <div>
                      <p className="text-xs text-text-secondary">{kpi.label}</p>
                      <p className="text-xl font-bold text-text-primary">{kpi.value.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-l-2 border-l-green-500/60">
              <CardHeader className="border-b border-border pb-3">
                <CardTitle className="text-sm font-semibold text-text-primary">Top Viewed Articles</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {topViewed.length === 0 ? (
                  <SectionEmpty message="No article view data yet" />
                ) : (
                  <div className="divide-y divide-border">
                    {topViewed.map((article: Record<string, unknown>, i: number) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-medium text-text-secondary w-5 shrink-0">#{i + 1}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text-primary truncate">{article.title as string}</p>
                            {!!article.category && (
                              <p className="text-xs text-text-secondary">{article.category as string}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-4">
                          <Eye className="h-3.5 w-3.5 text-text-secondary" />
                          <span className="text-sm font-semibold text-text-primary">{article.viewCount as string}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-l-2 border-l-green-500/60">
              <CardHeader className="border-b border-border pb-3">
                <CardTitle className="text-sm font-semibold text-text-primary">Articles by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {categoryDistribution.length === 0 ? (
                  <SectionEmpty message="No categories with articles yet" />
                ) : (
                  <div className="flex flex-col items-center">
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={categoryDistribution}
                          dataKey="articleCount"
                          nameKey="categoryName"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          innerRadius={50}
                        >
                          {categoryDistribution.map((_: Record<string, unknown>, i: number) => (
                            <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-3 mt-2">
                      {categoryDistribution.map((cat: Record<string, unknown>, i: number) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                          <span className="text-xs text-text-secondary">{cat.categoryName as string} ({cat.articleCount as number})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
