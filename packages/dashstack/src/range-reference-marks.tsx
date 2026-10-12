/** Fixed scale references, separate from editable thumbs and the actual-result pointer. */
export function RangeReferenceMarks({ positions }: { readonly positions: readonly string[] }) {
  return (
    <span aria-hidden="true" data-picodash-range-reference-marks>
      {[...new Set(positions)].map((position) => (
        <span
          key={position}
          data-picodash-range-reference-mark
          style={{ insetInlineStart: position }}
        />
      ))}
    </span>
  )
}
