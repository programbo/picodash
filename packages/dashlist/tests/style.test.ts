import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vite-plus/test'

const stylesheetPath = fileURLToPath(new URL('../src/style.css', import.meta.url))

describe('DashList stylesheet contract', () => {
  it('restores the original dense inspector rows with the accepted product tokens', async () => {
    const css = await readFile(stylesheetPath, 'utf8')
    expect(css).toContain('--picodash-dashlet-label-width: 10rem')
    expect(css).toContain('--picodash-dashlet-field-min-height: 6rem')
    expect(css).toContain('--_picodash-dashlist-control-min-inline-size: 6rem')
    expect(css).toContain('--_picodash-dashlist-trailing-max-inline-size: 8rem')
    expect(css).toMatch(
      /\[data-picodash-dashlist-rem-probe\]\s*\{[^}]*position:\s*fixed;[^}]*inline-size:\s*1rem;[^}]*block-size:\s*1rem;[^}]*visibility:\s*hidden;/s,
    )
    expect(css).toMatch(
      /\[data-picodash-dashlist-list\],\s*\[data-picodash-dashgroup-list\]\s*\{[^}]*display:\s*grid;[^}]*clamp\(6rem,\s*30%,\s*var\(--picodash-dashlet-label-width\)\)[^}]*minmax\(var\(--_picodash-dashlist-control-min-inline-size\),\s*1fr\)[^}]*fit-content\(var\(--_picodash-dashlist-trailing-max-inline-size\)\);/s,
    )
    expect(css).toMatch(
      /\[data-picodash-dashlet-shell\]\[data-layout='inline'\][^{]*\[data-picodash-dashlet-content-cell\]:nth-last-child\([\s\S]*data-picodash-dashlet-content-empty[\s\S]*max-inline-size:\s*var\(--_picodash-dashlist-trailing-max-inline-size\);[^}]*overflow-wrap:\s*anywhere;/s,
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
      /\.picodash-dashlist-item:not\(\.picodash-dashlist-group-item\)\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*subgrid;/s,
    )
    expect(css).toMatch(
      /\.picodash-dashlist-group-item\s*>\s*\[data-picodash-dashgroup\]\s*\{[^}]*border:[^}]*background:\s*var\(--picodash-color-well\);/s,
    )
    expect(css).toMatch(/\[data-picodash-dashlet-shell\]\s*\{[^}]*box-sizing:\s*border-box;/s)
    expect(css).toMatch(
      /button:not\(\[data-picodash-reorder-handle\]\)::before\s*\{[^}]*border-right:[^}]*border-bottom:[^}]*transform:\s*rotate\(45deg\);/s,
    )
    expect(css).toMatch(
      /--_picodash-dashlist-row-hover:\s*color-mix\([^;]*var\(--picodash-color-surface-muted\)\s+65%,\s*transparent/s,
    )
    expect(css).toMatch(
      /--_picodash-dashlist-group-hover:\s*color-mix\([^;]*var\(--picodash-color-surface-muted\)\s+80%,\s*transparent/s,
    )
    expect(css).not.toContain('container-type: inline-size')
    expect(css).toMatch(
      /\[data-picodash-dashlist-list\]\[data-picodash-dashlist-compact\],[\s\S]*grid-template-columns:\s*var\(--_picodash-dashlist-reorder-track\)\s+minmax\(0,\s*1fr\);/s,
    )
    expect(css).toMatch(
      /:is\(\[data-picodash-dashlist-list\],\s*\[data-picodash-dashgroup-list\]\)\[data-picodash-dashlist-compact\][^{]*>\s*\.picodash-dashlist-item[^{]*\[data-picodash-dashlet-shell\]\[data-layout='inline'\][^{]*\[data-picodash-dashlet-content\]\s*\{[^}]*display:\s*block;/s,
    )
  })

  it('gives native List controls 44 pixel coarse-pointer tracks and hit targets', async () => {
    const css = await readFile(stylesheetPath, 'utf8')
    expect(css).toMatch(
      /@media\s*\(pointer:\s*coarse\)\s*\{[^}]*\.picodash-dashlist\s*\{[^}]*--_picodash-dashlist-reorder-track:\s*44px;/s,
    )
    expect(css).toMatch(
      /@media\s*\(pointer:\s*coarse\)[\s\S]*\[data-picodash-reorder-handle\]\s*\{[^}]*min-inline-size:\s*44px;[^}]*min-block-size:\s*44px;/s,
    )
    expect(css).toContain('> button:not([data-picodash-reorder-handle]),')
    expect(css).toContain('[data-picodash-dashlet-actions] > button,')
  })
})
