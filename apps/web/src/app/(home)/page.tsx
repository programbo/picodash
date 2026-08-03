import type { Metadata } from 'next'
import { EvaluationHomePage } from '@/components/home/evaluation-home-page'

export const metadata: Metadata = {
  title: 'Evaluation',
}

export default function EvaluationPage() {
  return <EvaluationHomePage />
}
