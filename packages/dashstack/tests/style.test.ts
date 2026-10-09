import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vite-plus/test'

const stylesheetPath = fileURLToPath(new URL('../src/style.css', import.meta.url))

describe('DashStack stylesheet contract', () => {
  it('keeps decorative emphasis behind content and independent of hover and system focus', async () => {
    const css = await readFile(stylesheetPath, 'utf8')
    expect(css).toMatch(
      /\[data-picodash-dashlet-shell\]\[data-band\]::before\s*\{[^}]*inset-inline-start:\s*2px;[^}]*pointer-events:\s*none;/s,
    )
    expect(css).toMatch(/\[data-picodash-dashlet-shell\]:hover\s*\{[^}]*background-color:/s)
    expect(css).toMatch(
      /@media \(forced-colors: active\)\s*\{[^]*?\[data-picodash-dashlet-shell\]\[data-band\]::before\s*\{[^}]*display:\s*none;/s,
    )
    expect(css).toMatch(/\[data-picodash-dashlet-shell\]\[data-glow\]\s*\{\s*box-shadow:\s*none;/s)
    expect(css).toMatch(
      /\[data-picodash-dashlet-shell\]\[data-tint\]\s*\{\s*background-image:\s*none;/s,
    )
  })

  it('restores the original dense inspector rows with the accepted product tokens', async () => {
    const css = await readFile(stylesheetPath, 'utf8')
    expect(css).toContain('--picodash-dashlet-label-width: 10rem')
    expect(css).toContain('--picodash-dashlet-field-min-height: 6rem')
    expect(css).toContain('--_picodash-dashstack-control-min-inline-size: 6rem')
    expect(css).toContain('--_picodash-dashstack-trailing-max-inline-size: 8rem')
    expect(css).toMatch(
      /\[data-picodash-dashstack-rem-probe\]\s*\{[^}]*position:\s*fixed;[^}]*inline-size:\s*1rem;[^}]*block-size:\s*1rem;[^}]*visibility:\s*hidden;/s,
    )
    expect(css).toMatch(
      /\[data-picodash-dashstack-list\],\s*\[data-picodash-dashgroup-list\]\s*\{[^}]*display:\s*grid;[^}]*min\(30%,\s*var\(--picodash-dashlet-label-width\)\)[^}]*minmax\(0,\s*1fr\)[^}]*minmax\(min-content,\s*min\(18%,\s*var\(--_picodash-dashstack-trailing-max-inline-size\)\)\);/s,
    )
    expect(css).toMatch(
      /\[data-picodash-dashlet-shell\]\[data-layout='inline'\][^{]*\[data-picodash-dashlet-content-cell\]:nth-last-child\([\s\S]*data-picodash-dashlet-content-empty[\s\S]*max-inline-size:\s*var\(--_picodash-dashstack-trailing-max-inline-size\);[^}]*overflow-wrap:\s*anywhere;/s,
    )
    expect(css).toMatch(
      /\[data-picodash-dashlet-shell\]\[data-layout='inline'\]\s*>\s*\[data-picodash-dashlet-content\]\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*subgrid;/s,
    )
    expect(css).toMatch(
      /\[data-picodash-dashlet-shell\]\[data-layout='inline'\][^{]*\[data-picodash-dashlet-content-cell\]\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*subgrid;[^}]*min-inline-size:\s*0;/s,
    )
    expect(css).toMatch(
      /\[data-picodash-dashlet-shell\]\[data-layout='inline'\][^{]*\[data-picodash-dashlet-content-cell\]\[data-picodash-dashlet-content-single-root\][^{]*>\s*:not\(\[hidden\]\)\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/s,
    )
    expect(css).toMatch(
      /\[data-picodash-dashlet-shell\]\[data-layout='inline'\][^{]*\[data-picodash-dashlet-content-cell\]:not\(:has\(>\s*:not\(\[hidden\]\)\)\):not\(:empty\):not\([\s\S]*data-picodash-dashlet-content-empty[\s\S]*\{[^}]*display:\s*block;/s,
    )
    expect(css).toMatch(
      /\[data-picodash-dashlet-shell\]:not\(\[data-layout='inline'\]\)[^{]*\[data-picodash-dashlet-content-cell\]\s*\{[^}]*display:\s*contents;/s,
    )
    expect(css).toMatch(
      /\[data-picodash-dashlet-shell\]\[data-layout='inline'\][^{]*\[data-picodash-dashlet-content-whitespace\]\s*\{[^}]*display:\s*none;/s,
    )
    expect(css).toMatch(
      /\[data-picodash-dashlet-shell\]:not\(\[data-layout='inline'\]\)[^{]*\[data-picodash-dashlet-content-whitespace\]\s*\{[^}]*display:\s*contents;/s,
    )
    expect(css).toMatch(
      /\[data-picodash-dashlet-shell\]\[data-layout='inline'\][^{]*:is\([\s\S]*\[data-picodash-dashlet-content-cell\]:empty,[\s\S]*\[data-picodash-dashlet-content-cell\]\[data-picodash-dashlet-content-empty\][\s\S]*\)\s*\{[^}]*display:\s*none;/s,
    )
    expect(css).toMatch(
      /\[data-picodash-dashlet-content-cell\]:nth-child\([\s\S]*data-picodash-dashlet-content-empty[\s\S]*grid-column:\s*1\s*\/\s*-1;/s,
    )
    expect(css).toMatch(
      /\.picodash-dashstack-item:not\(\.picodash-dashstack-group-item\)\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*subgrid;/s,
    )
    expect(css).toMatch(
      /\.picodash-dashstack-group-item\s*>\s*\[data-picodash-dashgroup\]\s*\{[^}]*border:[^}]*background:\s*var\(--picodash-color-well\);/s,
    )
    expect(css).toMatch(/\[data-picodash-dashlet-shell\]\s*\{[^}]*box-sizing:\s*border-box;/s)
    expect(css).toMatch(
      /button:not\(\[data-picodash-reorder-handle\]\)::before\s*\{[^}]*mask:[^}]*transform:\s*rotate\(0deg\);/s,
    )
    expect(css).toMatch(
      /--_picodash-dashstack-row-hover:\s*color-mix\([^;]*var\(--picodash-color-surface-muted\)\s+65%,\s*transparent/s,
    )
    expect(css).toMatch(
      /--_picodash-dashstack-group-hover:\s*color-mix\([^;]*var\(--_picodash-group-label-color\)\s+10%,\s*transparent/s,
    )
    expect(css).not.toContain('container-type: inline-size')
    expect(css).not.toMatch(/\[data-picodash-dashstack-compact\]\s+\.picodash-dashstack-item/)
    expect(css).toMatch(
      /\[data-picodash-dashstack-list\]\s*\{[^}]*min-block-size:\s*0;[^}]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)\s+auto;/s,
    )
    expect(css).toMatch(
      /\[data-picodash-dashstack-band='automatic'\]\s*\{[^}]*align-content:\s*start;[^}]*overflow:\s*auto;[^}]*overscroll-behavior:\s*contain;/s,
    )
    expect(css).not.toContain('@container picodash-dashstack')
  })

  it('targets the rendered React Aria roots and state attributes', async () => {
    const css = await readFile(stylesheetPath, 'utf8')
    expect(css).toMatch(
      /\.picodash-dashstack-slider\s+\[data-picodash-dashstack-slider-thumb\]\s*\{[^}]*block-size:\s*var\(--picodash-control-height-md\);[^}]*inline-size:\s*var\(--picodash-control-height-md\);/s,
    )
    expect(css).toMatch(
      /\.picodash-dashstack-range-slider\s+\[data-picodash-dashstack-range-slider-thumb\]\s*\{/s,
    )
    expect(css).toMatch(
      /\.picodash-dashstack-segmented\s+\[data-picodash-dashstack-segment\]\[data-selected\]\s*\{/s,
    )
    expect(css).toMatch(/\[data-picodash-dashstack-switch-track\]\s*\{[^}]*position:\s*relative;/s)
    expect(css).toMatch(
      /\[data-picodash-dashstack-switch-marker\]\s*\{[^}]*position:\s*absolute;[^}]*inset-block-start:\s*50%;[^}]*inset-inline-start:\s*var\(--picodash-space-1\);[^}]*border-radius:\s*var\(--picodash-radius-control\);/s,
    )
    expect(css).toMatch(
      /\.picodash-dashstack-switch\[data-selected\]\s+\[data-picodash-dashstack-switch-marker\]\s*\{[^}]*--_picodash-switch-offset:\s*calc\(/s,
    )
    expect(css).toMatch(
      /\.picodash-dashstack-segmented\s+\[data-picodash-dashstack-segment\]\[data-focus-visible\]/s,
    )
    expect(css).toMatch(
      /\.picodash-dashstack-switch\[data-focus-visible\],[\s\S]*\.picodash-dashstack-checkbox\[data-focus-visible\],[\s\S]*\.picodash-dashstack-choice\[data-focus-visible\]/s,
    )
    expect(css).not.toMatch(
      /\.picodash-dashstack-(?:switch|checkbox|choice):focus-visible|\.picodash-dashstack-color-field:focus-within/,
    )
    expect(css).toMatch(
      /\.picodash-dashstack-color-field\s+\[data-focus-visible\]\s*\{[^}]*outline:\s*calc\(2 \* var\(--picodash-border-width-thin\)\) solid var\(--picodash-color-focus\);[^}]*outline-offset:\s*2px;/s,
    )
    expect(css).toMatch(
      /@media\s*\(pointer:\s*coarse\)[\s\S]*\.picodash-dashstack-slider\s+\[data-picodash-dashstack-slider-thumb\],[\s\S]*min-inline-size:\s*44px;[\s\S]*min-block-size:\s*44px;/s,
    )
    expect(css).not.toMatch(/\.picodash-dashstack-slider\s+\[role='slider'\]/)
    expect(css).not.toMatch(/\.picodash-dashstack-segmented\s+\[role='radio'\]/)
    expect(css).not.toMatch(/\.picodash-dashstack-segmented\s+\[aria-checked=/)
  })

  it('disables every DashStack transition when reduced motion is requested', async () => {
    const css = await readFile(stylesheetPath, 'utf8')
    const reducedMotion = css.match(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*)\}\s*$/u,
    )?.[1]
    expect(reducedMotion).toContain('[data-picodash-dashlet-shell]')
    expect(reducedMotion).toContain('.picodash-dashstack-group-item > [data-picodash-dashgroup]')
    expect(reducedMotion).toContain("[data-slot='dash-header']")
    expect(reducedMotion).toContain('transition: none;')
  })

  it('keeps selection structural across choice states and forced colors', async () => {
    const css = await readFile(stylesheetPath, 'utf8')

    expect(css).toMatch(
      /\[data-picodash-dashstack-checkbox-marker\]::before\s*\{[^}]*content:\s*'✓';[^}]*visibility:\s*hidden;/s,
    )
    expect(css).toMatch(
      /\.picodash-dashstack-checkbox\[data-selected\][^{]*\[data-picodash-dashstack-checkbox-marker\]::before,[\s\S]*\.picodash-dashstack-choice\[data-selected\][^{]*\[data-picodash-dashstack-checkbox-marker\]::before\s*\{[^}]*visibility:\s*visible;/s,
    )
    expect(css).toMatch(
      /\[data-picodash-dashstack-radio-marker\]::after\s*\{[^}]*background:\s*currentColor;[^}]*content:\s*'';[^}]*visibility:\s*hidden;/s,
    )
    expect(css).toMatch(
      /\.picodash-dashstack-choice\[data-selected\]\s+\[data-picodash-dashstack-radio-marker\]::after\s*\{[^}]*visibility:\s*visible;/s,
    )
    expect(css).toMatch(
      /\[data-picodash-dashstack-segment-marker\]::before\s*\{[^}]*content:\s*'✓';[^}]*visibility:\s*hidden;/s,
    )
    expect(css).toMatch(
      /\[data-picodash-dashstack-segment\]\[data-selected\][^{]*\[data-picodash-dashstack-segment-marker\]::before\s*\{[^}]*visibility:\s*visible;/s,
    )
    expect(css).toMatch(
      /\[data-picodash-dashstack-option-marker\]::before\s*\{[^}]*content:\s*'✓';[^}]*visibility:\s*hidden;/s,
    )
    expect(css).toMatch(
      /\.picodash-dashstack-listbox[\s\S]*\[role='option'\]\[data-selected\][\s\S]*\[data-picodash-dashstack-option-marker\]::before\s*\{[^}]*visibility:\s*visible;/s,
    )

    const markerRules = css.match(
      /[^{}]*(?:data-picodash-dashstack-checkbox-marker|data-picodash-dashstack-radio-marker|data-picodash-dashstack-segment-marker|data-picodash-dashstack-option-marker)[^{}]*\{[^{}]*\}/g,
    )
    expect(markerRules).not.toBeNull()
    expect(markerRules?.join('\n')).not.toMatch(
      /(?:^|[;{]\s*)(?:left|right|margin-left|margin-right|padding-left|padding-right)\s*:/,
    )
    expect(css).not.toMatch(
      /\[data-(?:disabled|readonly|focus-visible)\][^{]*(?:checkbox|radio|segment)-marker[^{}]*\{[^}]*(?:display:\s*none|visibility:\s*hidden|opacity:\s*0)/s,
    )
    expect(css).toMatch(
      /@media\s*\(forced-colors:\s*active\)[\s\S]*\[data-picodash-dashstack-checkbox-box\],[\s\S]*\[data-picodash-dashstack-radio-marker\]\s*\{[^}]*forced-color-adjust:\s*none;[^}]*border-color:\s*ButtonText;[^}]*background:\s*Canvas;/s,
    )
    expect(css).toMatch(
      /@media\s*\(forced-colors:\s*active\)[\s\S]*\.picodash-dashstack-checkbox\[data-selected\][^{]*\[data-picodash-dashstack-checkbox-box\],[\s\S]*background:\s*Highlight;[^}]*color:\s*HighlightText;/s,
    )
    expect(css).toMatch(
      /@media\s*\(forced-colors:\s*active\)[\s\S]*\[data-selected\]\[data-disabled\][^{]*(?:checkbox-box|radio-marker|segment-marker)[\s\S]*border-color:\s*GrayText;[^}]*color:\s*GrayText;/s,
    )
    expect(css).toMatch(
      /@media\s*\(forced-colors:\s*active\)[\s\S]*\.picodash-dashstack-listbox\s+\[role='option'\]\[data-selected\]\s*\{[^}]*forced-color-adjust:\s*none;[^}]*background:\s*Highlight;[^}]*color:\s*HighlightText;/s,
    )
    expect(css).toMatch(
      /@media\s*\(forced-colors:\s*active\)[\s\S]*\.picodash-dashstack-listbox\s+\[role='option'\]\[data-selected\]\[data-disabled\]\s*\{[^}]*background:\s*Canvas;[^}]*color:\s*GrayText;/s,
    )
  })

  it('styles the shell fallback and supplementary help without physical inline offsets', async () => {
    const css = await readFile(stylesheetPath, 'utf8')

    expect(css).toMatch(
      /\[data-picodash-dashlet-shell\]:focus-visible\s*\{[^}]*outline:\s*calc\(2 \* var\(--picodash-border-width-thin\)\) solid var\(--picodash-color-focus\);[^}]*outline-offset:\s*calc\(-2 \* var\(--picodash-border-width-thin\)\);/s,
    )
    const helpRule = css.match(/\[data-picodash-dashlet-help\]\s*\{[^}]+\}/s)?.[0]
    expect(helpRule).toMatch(/padding:\s*0;/)
    expect(helpRule).toMatch(/text-decoration:\s*underline dotted;/)
    expect(helpRule).not.toMatch(
      /(?:^|[;{]\s*)(?:left|right|margin-left|margin-right|padding-left|padding-right)\s*:/,
    )
    expect(css).toMatch(
      /\.picodash-dashlet-help-popover\s*\{[^}]*max-inline-size:[^;]+;[^}]*border:[^;]+;[^}]*background:\s*var\(--picodash-color-surface-raised\);[^}]*box-shadow:\s*var\(--picodash-shadow-elevated\);/s,
    )
    expect(css).toMatch(
      /@media\s*\(forced-colors:\s*active\)[\s\S]*\[data-picodash-dashlet-shell\]:focus-visible,[\s\S]*\[data-picodash-dashlet-help\]\[data-focus-visible\]\s*\{[^}]*outline-color:\s*Highlight;/s,
    )
  })

  it('aligns one pointer-inert Slider mark layer with logical track offsets', async () => {
    const css = await readFile(stylesheetPath, 'utf8')
    expect(css).toMatch(
      /\.picodash-dashstack-slider\s+\[data-picodash-dashstack-slider-marks\]\s*\{[^}]*position:\s*absolute;[^}]*inset-block-start:[^;]+;[^}]*inset-inline:\s*0;[^}]*pointer-events:\s*none;/s,
    )
    const markRule = css.match(
      /\.picodash-dashstack-slider\s+\[data-picodash-dashstack-slider-mark\]\s*\{[^}]+\}/s,
    )?.[0]
    expect(markRule).toMatch(
      /position:\s*absolute;[^}]*inset-inline-start:\s*var\(--_picodash-dashstack-slider-mark-position\);[^}]*display:\s*flex;[^}]*justify-content:\s*center;[^}]*inline-size:\s*0;/s,
    )
    expect(markRule).not.toMatch(/(?:^|[;{]\s*)(?:left|right)\s*:/)
    expect(markRule).not.toMatch(/transform:/)
  })

  it('gives native Stack controls 44 pixel coarse-pointer tracks and hit targets', async () => {
    const css = await readFile(stylesheetPath, 'utf8')
    expect(css).toMatch(
      /@media\s*\(pointer:\s*coarse\)\s*\{[^}]*\.picodash-dashstack\s*\{[^}]*--_picodash-dashstack-reorder-track:\s*44px;/s,
    )
    expect(css).toMatch(
      /@media\s*\(pointer:\s*coarse\)[\s\S]*\[data-picodash-reorder-handle\]\s*\{[^}]*min-inline-size:\s*44px;[^}]*min-block-size:\s*44px;/s,
    )
    expect(css).toMatch(
      /@media\s*\(pointer:\s*coarse\)\s*\{[^}]*\.picodash-dashstack-control,[\s\S]*min-inline-size:\s*44px;[^}]*min-block-size:\s*44px;/s,
    )
    expect(css).toMatch(
      /@media\s*\(pointer:\s*coarse\)[\s\S]*\.picodash-dashstack-switch,[\s\S]*\.picodash-dashstack-checkbox,[\s\S]*min-inline-size:\s*44px;[\s\S]*min-block-size:\s*44px;/s,
    )
    expect(css).toContain('> button:not([data-picodash-reorder-handle]),')
    expect(css).toContain('[data-picodash-dashlet-help],')
    expect(css).toContain('[data-picodash-dashlet-actions] > button,')
    expect(css).toMatch(
      /@media\s*\(pointer:\s*coarse\)[\s\S]*\.picodash-dashstack-listbox\s+\[role='option'\],[\s\S]*\[data-picodash-dashstack-tag-remove\],[\s\S]*min-inline-size:\s*44px;[\s\S]*min-block-size:\s*44px;/s,
    )

    for (const fieldClass of [
      '.picodash-dashstack-date-field',
      '.picodash-dashstack-time-field',
      '.picodash-dashstack-date-time-field',
      '.picodash-dashstack-date-range-field',
    ]) {
      expect(css).toMatch(
        new RegExp(
          `@media\\s*\\(pointer:\\s*coarse\\)[\\s\\S]*${fieldClass.replace('.', '\\.')}` +
            ` \\[role='spinbutton'\\][\\s\\S]*min-inline-size:\\s*44px;[\\s\\S]*min-block-size:\\s*44px;`,
        ),
      )
    }
    expect(css).toMatch(
      /@media\s*\(pointer:\s*coarse\)[\s\S]*\.picodash-dashstack-color-field input[\s\S]*min-inline-size:\s*44px;[\s\S]*min-block-size:\s*44px;/s,
    )
    expect(css).not.toMatch(
      /@media\s*\(pointer:\s*coarse\)[\s\S]*\.picodash-dashstack-(?:date|time|date-time|date-range)-field\s+[^[]*\[data-(?:separator|type)\]/s,
    )
  })
})
