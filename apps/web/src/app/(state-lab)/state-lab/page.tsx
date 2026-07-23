import { redirect } from 'next/navigation'

export default async function StateLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item)
    } else if (value !== undefined) {
      query.set(key, value)
    }
  }

  const search = query.toString()
  redirect(`/state-lab/provider${search ? `?${search}` : ''}`)
}
