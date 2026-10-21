import { ArrowLeft, Newspaper } from "lucide-react"
import { Link, useParams } from "react-router"
import { useNewsItem } from "@/api/hooks"
import { isNotFound } from "@/api/types"
import { ErrorState, NotFoundState, PageSkeleton } from "@/components/league/states"
import { useLeagueMeta } from "@/hooks/use-document-meta"
import { formatDate } from "@/lib/format"
import { newsMeta } from "@/lib/seo"

export default function NewsItemPage() {
  const { slug = "" } = useParams()
  const { data, isLoading, error, refetch } = useNewsItem(slug)
  useLeagueMeta((league) => (data ? newsMeta(data, league) : undefined))
  if (isLoading) return <PageSkeleton />
  if (isNotFound(error) || (!error && !data))
    return <NotFoundState icon={Newspaper} title="Yangilik topilmadi" description="Havola eskirgan yoki yangilik o‘chirilgan bo‘lishi mumkin." backTo="/yangiliklar" backLabel="Barcha yangiliklar" />
  if (error || !data) return <ErrorState message={error?.message} onRetry={() => refetch()} className="container-page" />
  return (
    <article className="container-page pt-5 md:pt-8">
      <div className="mx-auto max-w-2xl">
        <Link to="/yangiliklar" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Yangiliklar
        </Link>
        <time dateTime={data.publishedAt} className="block text-sm text-muted-foreground">
          {formatDate(data.publishedAt, { weekday: true, year: true })}
        </time>
        <h1 className="mt-1 font-display text-3xl md:text-5xl">{data.title}</h1>
        <p className="mt-3 text-md text-muted-foreground md:text-lg">{data.excerpt}</p>
        <div className="mt-6 space-y-4 border-t border-border pt-6 text-base leading-7 md:text-lg md:leading-8">
          {data.body.split(/\n{2,}/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </div>
    </article>
  )
}
