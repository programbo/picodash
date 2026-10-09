export type TargetResult =
  | { readonly status: 'ready'; readonly value: number }
  | { readonly status: 'pending'; readonly lastValue?: number }
  | { readonly status: 'no-fit'; readonly message?: string }
  | { readonly status: 'error'; readonly message: string }

export function targetResultValue(result: TargetResult): number | undefined {
  const value =
    result.status === 'ready'
      ? result.value
      : result.status === 'pending'
        ? result.lastValue
        : undefined
  if (value !== undefined && !Number.isFinite(value))
    throw new TypeError('Actual values must be finite.')
  return value
}

export function targetResultMessage(result: TargetResult): string {
  switch (result.status) {
    case 'ready':
      return ''
    case 'pending':
      return 'Calculating'
    case 'no-fit':
      return result.message ?? 'No feasible result'
    case 'error':
      return result.message
  }
}
