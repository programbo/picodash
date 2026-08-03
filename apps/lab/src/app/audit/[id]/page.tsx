import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AuditReport } from '@lab/components/audit/audit-report'
import { getAuditReport } from '@lab/lib/audits'

interface AuditPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: AuditPageProps): Promise<Metadata> {
  const { id } = await params
  const report = getAuditReport(id)

  return {
    title: report?.title ?? 'Audit not found',
    description: report?.summary,
  }
}

export default async function AuditPage({ params }: AuditPageProps) {
  const { id } = await params
  const report = getAuditReport(id)

  if (!report) {
    notFound()
  }

  return <AuditReport report={report} />
}
