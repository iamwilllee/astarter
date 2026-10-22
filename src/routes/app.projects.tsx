import { formText } from '@/lib/forms'
import { createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Plus, Search, FolderKanban, ArrowUpRight, Pencil, Trash2, Filter } from 'lucide-react'
import { PageHeading, Loading, ErrorNotice } from '@/components/common'
import { useI18n } from '@/components/providers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { api } from '@/lib/api'
import type { Project, ProjectInput } from '@/modules/projects/validation'

type Status = 'all' | ProjectInput['status']
export const Route = createFileRoute('/app/projects')({
  validateSearch: (search: Record<string, unknown>): { q?: string; status?: Status } => ({
    q: typeof search.q === 'string' ? search.q.slice(0, 80) : '',
    status: ['idea', 'building', 'live'].includes(String(search.status))
      ? (search.status as Status)
      : 'all',
  }),
  component: Projects,
})
const selectClass = 'h-9 rounded-lg border bg-card px-3 text-xs text-foreground'
function Projects() {
  const { t, locale } = useI18n()
  const { q = '', status = 'all' } = Route.useSearch()
  const navigate = Route.useNavigate()
  const viewer = getRouteApi('/app').useLoaderData()
  const router = useRouter()
  const cache = useQueryClient()
  const [editor, setEditor] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState<Project | null>(null)
  const params = new URLSearchParams({ q, status })
  const query = useQuery({
    queryKey: ['projects', q, status],
    queryFn: () => api<Project[]>(`/api/projects?${params}`),
  })
  const labels = {
    idea: t('idea'),
    building: t('building'),
    live: t('live'),
  }
  async function refresh() {
    await cache.invalidateQueries({ queryKey: ['projects'] })
    await router.invalidate()
  }
  const save = useMutation({
    mutationFn: (data: ProjectInput) =>
      api(editing ? `/api/projects/${editing.id}` : '/api/projects', {
        method: editing ? 'PATCH' : 'POST',
        data,
      }),
    onSuccess: async () => {
      setEditor(false)
      setEditing(null)
      await refresh()
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/projects/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setDeleting(null)
      await refresh()
    },
  })
  function openEditor(project: Project | null) {
    setEditing(project)
    save.reset()
    setEditor(true)
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    save.mutate({
      name: formText(data, 'name'),
      description: formText(data, 'description'),
      status: formText(data, 'status') as ProjectInput['status'],
    })
  }
  return (
    <>
      <PageHeading
        eyebrow="YOUR PROJECTS"
        title={t('your_projects')}
        description={t('a_place_for_every_idea_start_building_here')}
        action={
          <Button onClick={() => openEditor(null)}>
            <Plus size={15} />
            {t('new_project')}
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(event) => {
              void navigate({
                search: (previous) => ({ ...previous, q: event.target.value }),
                replace: true,
              })
            }}
            className="bg-card pl-9"
            placeholder={t('search_projects')}
            aria-label={t('search_projects_label')}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-muted-foreground" />
          <select
            aria-label={t('filter_project_status')}
            className={selectClass}
            value={status}
            onChange={(event) => {
              void navigate({
                search: (previous) => ({ ...previous, status: event.target.value as Status }),
              })
            }}
          >
            <option value="all">{t('all_statuses')}</option>
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <span className="ml-2 text-xs text-muted-foreground">
            {viewer.projectCount} / {viewer.billing.projectLimit}
          </span>
        </div>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <div className="space-y-3">
          <ErrorNotice>{query.error.message}</ErrorNotice>
          <Button
            variant="outline"
            onClick={() => {
              void query.refetch()
            }}
          >
            {t('retry')}
          </Button>
        </div>
      ) : !query.data.length ? (
        <section className="grid min-h-80 place-content-center rounded-xl border border-dashed bg-card/70 p-8 text-center">
          <span className="mx-auto mb-5 grid size-14 place-items-center rounded-xl border bg-background text-primary">
            <FolderKanban size={25} strokeWidth={1.4} />
          </span>
          <h2 className="text-base font-semibold">
            {q || status !== 'all'
              ? t('no_matching_projects')
              : t('your_first_project_starts_here')}
          </h2>
          <p className="mb-5 mt-2 text-xs leading-6 text-muted-foreground">
            {q || status !== 'all'
              ? t('try_a_different_search_or_filter')
              : t('a_name_and_an_idea_are_a_good_place_to_begin')}
          </p>
          {!q && status === 'all' && (
            <Button className="mx-auto" variant="outline" onClick={() => openEditor(null)}>
              <Plus size={14} />
              {t('create_your_first_project')}
            </Button>
          )}
        </section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {query.data.map((project) => (
            <article
              key={project.id}
              className="group flex min-h-56 flex-col rounded-xl border bg-card p-5 transition-shadow hover:shadow-sm"
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-lg border bg-background font-mono text-base text-primary">
                  {project.name.slice(0, 1).toUpperCase()}
                </span>
                <Badge
                  variant={project.status === 'live' ? 'default' : 'secondary'}
                  className="text-[10px]"
                >
                  {labels[project.status]}
                </Badge>
              </div>
              <h2 className="break-words text-sm font-semibold">{project.name}</h2>
              <p className="mb-5 mt-2 line-clamp-3 whitespace-pre-wrap break-words text-xs leading-6 text-muted-foreground">
                {project.description || t('add_a_few_words_about_your_idea')}
              </p>
              <div className="mt-auto flex items-center justify-between border-t pt-3">
                <span className="text-[10px] text-muted-foreground">
                  {t('updated')}
                  {new Date(project.updated_at).toLocaleDateString(
                    locale === 'zh' ? 'zh-CN' : 'en-US',
                  )}
                </span>
                <div className="flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${t('edit')} ${project.name}`}
                    onClick={() => openEditor(project)}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${t('delete')} ${project.name}`}
                    onClick={() => {
                      remove.reset()
                      setDeleting(project)
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="mt-6 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="size-1.5 rounded-full bg-primary" />
        {t('saved_in_d1_and_private_to_your_account_filters_are_stored_in_the_url')}
      </p>
      <Dialog
        open={editor}
        onOpenChange={(open) => {
          if (!save.isPending) setEditor(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t('edit_project') : t('give_your_idea_a_name')}</DialogTitle>
            <DialogDescription>
              {t('start_with_something_simple_you_can_change_it_anytime')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="project-name">{t('project_name')}</Label>
              <Input
                id="project-name"
                name="name"
                defaultValue={editing?.name ?? ''}
                placeholder={t('e_g_my_reading_list')}
                required
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-description">{t('a_short_description')}</Label>
              <textarea
                id="project-description"
                name="description"
                rows={3}
                defaultValue={editing?.description ?? ''}
                maxLength={500}
                className="w-full resize-y rounded-lg border bg-transparent px-3 py-2 text-sm"
                placeholder={t('what_would_you_like_to_build')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-status">{t('status')}</Label>
              <select
                id="project-status"
                name="status"
                defaultValue={editing?.status ?? 'idea'}
                className={`${selectClass} w-full`}
              >
                {Object.entries(labels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {save.error && <ErrorNotice>{save.error.message}</ErrorNotice>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditor(false)}
                disabled={save.isPending}
              >
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? t('saving') : t('save_project')}
                <ArrowUpRight size={14} />
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleting(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('delete_this_project')}</DialogTitle>
            <DialogDescription>
              {t('this_cannot_be_undone')}
              {deleting?.name}
            </DialogDescription>
          </DialogHeader>
          {remove.error && <ErrorNotice>{remove.error.message}</ErrorNotice>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={remove.isPending}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (deleting) remove.mutate(deleting.id)
              }}
            >
              {remove.isPending ? t('deleting') : t('delete_project')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
