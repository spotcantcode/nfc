import { requirePageAdmin } from "@/lib/auth";
import { listTags, stats } from "@/lib/tags";
import { config } from "@/lib/config";
import { Dashboard } from "@/components/dashboard";
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Layout checks do not protect nested page data fetching; authorize here too.
  await requirePageAdmin();
  const params = await searchParams;
  const text = (key: string, fallback: string) =>
    typeof params[key] === "string" ? (params[key] as string) : fallback;
  const filters = {
    page: Math.max(1, Math.min(10000, Math.floor(Number(text("page", "1")) || 1))),
    q: text("q", "").slice(0, 100),
    status: text("status", "all"),
    sort: text("sort", "created_at"),
    direction: text("direction", "desc"),
  };
  const [result, totals] = await Promise.all([
    listTags(filters.page, filters.q, filters.status, filters.sort, filters.direction),
    stats(),
  ]);
  return (
    <Dashboard
      tags={result.tags}
      count={result.count}
      stats={totals}
      baseUrl={config().appUrl}
      filters={filters}
      key={`${filters.q}:${filters.status}:${filters.sort}:${filters.page}`}
    />
  );
}
