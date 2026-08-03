import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vite-plus/test'

import { Body, type BodyProps } from './body.tsx'
import { Footer, type FooterProps } from './footer.tsx'
import { Frame, type FrameProps } from './frame.tsx'
import {
  Actions,
  type ActionsProps,
  Description,
  type DescriptionProps,
  Header,
  type HeaderProps,
  Heading,
  type HeadingProps,
} from './header.tsx'
import {
  EmptyState,
  type EmptyStateProps,
  ErrorState,
  type ErrorStateProps,
  LoadingState,
  type LoadingStateProps,
} from './states.tsx'
import { Toolbar, type ToolbarProps } from './toolbar.tsx'

test('composes a semantic dashlet from optional anatomy slots', () => {
  const markup = renderToStaticMarkup(
    <Frame aria-labelledby="latency-heading" className="custom-frame">
      <Header>
        <Heading id="latency-heading">Latency</Heading>
        <Description>Recent request duration</Description>
        <Actions>
          <button type="button">Refresh</button>
        </Actions>
      </Header>
      <Body>42 ms</Body>
      <Footer>Updated now</Footer>
    </Frame>,
  )

  expect(markup).toContain('<section')
  expect(markup).toContain('aria-labelledby="latency-heading"')
  expect(markup).toContain('data-slot="dashlet-frame"')
  expect(markup).toContain('data-slot="dashlet-header"')
  expect(markup).toContain('data-slot="dashlet-heading"')
  expect(markup).toContain('data-slot="dashlet-description"')
  expect(markup).toContain('data-slot="dashlet-actions"')
  expect(markup).toContain('data-slot="dashlet-body"')
  expect(markup).toContain('data-slot="dashlet-footer"')
  expect(markup).toContain('<h3')
  expect(markup).toContain('<footer')
  expect(markup).toContain('custom-frame')
})

test('provides accessible state and toolbar defaults', () => {
  const empty = renderToStaticMarkup(<EmptyState>No results</EmptyState>)
  const loading = renderToStaticMarkup(<LoadingState>Loading metrics</LoadingState>)
  const error = renderToStaticMarkup(<ErrorState>Metrics unavailable</ErrorState>)
  const toolbar = renderToStaticMarkup(
    <Toolbar>
      <button type="button">Refresh</button>
    </Toolbar>,
  )

  expect(empty).toContain('data-slot="dashlet-empty-state"')
  expect(empty).toContain('role="status"')
  expect(empty).toContain('aria-live="polite"')
  expect(loading).toContain('data-slot="dashlet-loading-state"')
  expect(loading).toContain('aria-busy="true"')
  expect(error).toContain('data-slot="dashlet-error-state"')
  expect(error).toContain('role="alert"')
  expect(toolbar).toContain('data-slot="dashlet-toolbar"')
  expect(toolbar).toContain('role="toolbar"')
  expect(toolbar).toContain('aria-label="Dashlet actions"')
})

test('exports named prop types for every anatomy component', () => {
  const props = [
    { 'aria-label': 'Metric' } satisfies FrameProps,
    { className: 'header' } satisfies HeaderProps,
    { id: 'heading' } satisfies HeadingProps,
    { children: 'Description' } satisfies DescriptionProps,
    { children: 'Actions' } satisfies ActionsProps,
    { children: 'Body' } satisfies BodyProps,
    { children: 'Footer' } satisfies FooterProps,
    { 'aria-label': 'Tools' } satisfies ToolbarProps,
    { children: 'Empty' } satisfies EmptyStateProps,
    { children: 'Loading' } satisfies LoadingStateProps,
    { children: 'Error' } satisfies ErrorStateProps,
  ]

  expect(props).toHaveLength(11)
})
