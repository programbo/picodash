/** Keep net attribute changes, ignoring temporary geometry probes and no-op DOM writes. */
export function settledMutationRecords(records: readonly MutationRecord[]): MutationRecord[] {
  const attributes = new Map<Node, Map<string, MutationRecord>>()
  const settled: MutationRecord[] = []
  for (const record of records) {
    if (record.type !== 'attributes' || record.attributeName === null) {
      settled.push(record)
      continue
    }
    let targetAttributes = attributes.get(record.target)
    if (!targetAttributes) {
      targetAttributes = new Map()
      attributes.set(record.target, targetAttributes)
    }
    // The first old value is the state before this delivery's writes, including restorations.
    const key = JSON.stringify([record.attributeNamespace, record.attributeName])
    if (!targetAttributes.has(key)) targetAttributes.set(key, record)
  }
  for (const targetAttributes of attributes.values()) {
    for (const record of targetAttributes.values()) {
      const target = record.target
      if (
        'getAttributeNS' in target &&
        typeof target.getAttributeNS === 'function' &&
        record.attributeName !== null &&
        target.getAttributeNS(record.attributeNamespace, record.attributeName) !== record.oldValue
      )
        settled.push(record)
    }
  }
  return settled
}
