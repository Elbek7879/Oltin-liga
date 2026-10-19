import { Megaphone, Newspaper } from "lucide-react"
import { Link } from "react-router"
import { useNews } from "@/api/hooks"
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from "@/components/league/states"
import { formatDate } from "@/lib/format"

export default function NewsPage() {
  const { data = [], isLoading, error, refetch } = useNews()
  return (
    <div className="container-page pt-5 md:pt-8">
      <PageHeader title="Yangiliklar va e’lonlar" description="Liga hayotidagi muhim voqealar, o‘yinlar jadvali o‘zgarishlari va e’lonlar" />
      <div className="mx-auto max-w-3xl">
        {isLoading ? (
          <div className="panel"><ListSkeleton rows={4} /></div>
        ) : error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : data.length === 0 ? (
          <div className="panel"><EmptyState icon={Newspaper} title="Hozircha yangiliklar yo‘q" /></div>
        ) : (
          <ul className="space-y-3">
            {data.map((n) => (
              <li key={n.id}>
                <Link to={`/yangiliklar/${n.slug}`} className="panel block p-4 transition-colors hover:border-pitch-300 md:p-5">
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <time dateTime={n.publishedAt}>{formatDate(n.publishedAt, { year: true })}</time>
                    {n.important && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 font-semibold text-gold-text">
                        <Megaphone className="size-3" aria-hidden="true" /> Muhim
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block font-display text-xl">{n.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground md:text-base">{n.excerpt}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
