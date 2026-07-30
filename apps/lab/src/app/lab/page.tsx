import type { Metadata } from 'next'
import { ContractLab } from '@lab/components/contract-lab/contract-lab'

export const metadata: Metadata = {
  title: 'Contract Lab',
}

export default function ContractLabPage() {
  return <ContractLab />
}
