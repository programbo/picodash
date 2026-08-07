export type AuditSeverity = 'critical' | 'high' | 'medium' | 'note'

export interface AuditEvidence {
  alt: string
  caption: string
  height: number
  src: string
  width: number
}

export interface AuditFinding {
  actual: string
  evidence: readonly AuditEvidence[]
  expected: string
  id: string
  sourceUrl: string
  state: string
  severity: AuditSeverity
  steps: readonly string[]
  title: string
  viewport: string
}

export interface AuditCoverageItem {
  evidenceSrc: string
  label: string
  outcome: string
  status: 'issue' | 'pass'
}

export interface AuditReport {
  capturedAt: string
  coverage: readonly AuditCoverageItem[]
  findings: readonly AuditFinding[]
  id: string
  scope: string
  summary: string
  title: string
}

const assetRoot = '/audits/homepage-examples-2026-07-31'

const homepageExamplesAudit: AuditReport = {
  id: 'homepage-examples-2026-07-31',
  title: 'Homepage and examples visual audit',
  scope: 'Every panel and Dashlet on the production homepage and examples route.',
  capturedAt: '2026-07-31',
  summary:
    'The homepage has four material presentation failures. Its mobile canvas clips, while three panel specimens constrain otherwise useful Dashlets until controls collapse or disappear. The four examples remain usable at the audited mobile viewport, but repeat their identity inside already-labelled cards.',
  findings: [
    {
      id: 'H-01',
      severity: 'critical',
      title: 'The homepage is clipped to a desktop-width canvas on mobile',
      sourceUrl: 'http://localhost:6030/',
      viewport: '390 × 844',
      state: 'Initial load, no interaction',
      actual:
        'Navigation, headline, body copy, action buttons, and the host scene all continue beyond the right viewport edge. The page exposes only the left slice of its content.',
      expected:
        'The homepage should reflow within 390 CSS pixels without hiding primary copy or actions.',
      steps: [
        'Open the homepage at 390 × 844.',
        'Observe the first viewport without scrolling or opening a panel.',
      ],
      evidence: [
        {
          src: `${assetRoot}/home-mobile-clipping.png`,
          alt: 'Annotated mobile homepage showing content clipped beyond the right viewport edge.',
          caption:
            'Annotated initial viewport. Red outlines show the elements extending into the clipped area.',
          width: 390,
          height: 844,
        },
      ],
    },
    {
      id: 'H-02',
      severity: 'critical',
      title: 'The built-in specimen compresses controls into unusable columns',
      sourceUrl: 'http://localhost:6030/',
      viewport: '1440 × 900',
      state: 'Explore demo open; Common inputs expanded',
      actual:
        'The narrow right-hand panel retains a multi-column item layout. Textareas wrap almost one character per line, labels collide with help buttons, numeric values are squeezed against the edge, and slider tracks become nearly indistinguishable.',
      expected:
        'Built-in controls should adopt a single-column or otherwise panel-aware layout at this width.',
      steps: [
        'Open the homepage at 1440 × 900.',
        'Choose “Explore demo”.',
        'Inspect the expanded Common inputs section.',
      ],
      evidence: [
        {
          src: `${assetRoot}/built-in-panel.png`,
          alt: 'Built-in Items panel with compressed labels, inputs, textareas, and sliders.',
          caption: 'Clean capture of the panel and its host page.',
          width: 1440,
          height: 900,
        },
        {
          src: `${assetRoot}/built-in-panel-annotated.png`,
          alt: 'Annotated Built-in Items panel showing the bounds of every compressed control.',
          caption: 'Annotated capture makes the density and collisions explicit.',
          width: 1440,
          height: 900,
        },
      ],
    },
    {
      id: 'H-03',
      severity: 'high',
      title: 'Creative controls hide the compound Dashlet actions',
      sourceUrl: 'http://localhost:6030/',
      viewport: '1440 × 900',
      state: 'Scrolled to Scenario 1; creative panel open',
      actual:
        'The panel ends at the scenario frame boundary immediately after the readout rows. The five profile actions are below the visible panel area, and the capture provides no visible scroll affordance.',
      expected:
        'The compound Dashlet should either fit its specimen or clearly expose an internal scroll path to every action.',
      steps: [
        'Open the homepage at 1440 × 900.',
        'Scroll to Creative controls.',
        'Inspect the bottom edge of the open panel.',
      ],
      evidence: [
        {
          src: `${assetRoot}/creative-panel.png`,
          alt: 'Creative controls panel ending after its readout rows with its action row out of view.',
          caption:
            'The panel ends at the specimen boundary before the compound Dashlet is complete.',
          width: 1440,
          height: 900,
        },
      ],
    },
    {
      id: 'H-04',
      severity: 'critical',
      title: 'Monitoring sliders collapse to dots and telemetry is cut off',
      sourceUrl: 'http://localhost:6030/',
      viewport: '1440 × 900',
      state: 'Scrolled to Application monitoring; panel open',
      actual:
        'Both sliders render as isolated circular thumbs with no usable track. The Runtime telemetry Dashlet begins at the bottom edge and is visibly truncated.',
      expected:
        'Writable ranges should retain a readable track and value relationship, and the full telemetry Dashlet should remain inspectable.',
      steps: [
        'Open the homepage at 1440 × 900.',
        'Scroll to Application monitoring.',
        'Inspect Sample interval, Target fps, and Runtime telemetry.',
      ],
      evidence: [
        {
          src: `${assetRoot}/monitoring-panel.png`,
          alt: 'Monitoring panel with two sliders reduced to dots and Runtime telemetry clipped.',
          caption:
            'The panel is present, but its core range controls no longer communicate a range.',
          width: 1440,
          height: 900,
        },
      ],
    },
    {
      id: 'H-05',
      severity: 'high',
      title: 'Debug controls are truncated before their action set',
      sourceUrl: 'http://localhost:6030/',
      viewport: '1440 × 900',
      state: 'Scrolled to Scenario 3; debug panel launched',
      actual:
        'The panel stops after the Policy window row. The action set described by the specimen is below the frame and there is no visible indication that more content can be reached.',
      expected:
        'The launched panel should expose all adapter actions or present an unmistakable internal scrolling affordance.',
      steps: [
        'Open the homepage at 1440 × 900.',
        'Scroll to Debug and rollout controls.',
        'Choose “Launch debug panel”.',
      ],
      evidence: [
        {
          src: `${assetRoot}/debug-panel.png`,
          alt: 'Debug feature controls panel cut off after the Policy window row.',
          caption: 'The specimen frame ends before the panel’s action controls.',
          width: 1440,
          height: 900,
        },
      ],
    },
    {
      id: 'E-01',
      severity: 'medium',
      title: 'Example cards repeat each recipe name inside the panel',
      sourceUrl: 'http://localhost:6030/examples',
      viewport: '390 × 844',
      state: 'Each example scrolled into view with its panel open',
      actual:
        'Each recipe name appears as the card title, panel title, and a right-aligned in-panel label. The repeated label consumes scarce mobile space without adding state or context.',
      expected:
        'The card and panel hierarchy should identify the recipe once per meaningful level; the inner label should add distinct context or be removed.',
      steps: [
        'Open the examples route at 390 × 844.',
        'Scroll through all four open recipe panels.',
        'Compare the card title, panel title, and inner top-right label.',
      ],
      evidence: [
        {
          src: `${assetRoot}/examples-performance.png`,
          alt: 'Performance example repeating Performance health in its card and panel.',
          caption: 'Performance health.',
          width: 390,
          height: 844,
        },
        {
          src: `${assetRoot}/examples-media.png`,
          alt: 'Media example repeating Media transport in its card and panel.',
          caption: 'Media transport.',
          width: 390,
          height: 844,
        },
        {
          src: `${assetRoot}/examples-deployment.png`,
          alt: 'Deployment example repeating Deployment status in its card and panel.',
          caption: 'Deployment status.',
          width: 390,
          height: 844,
        },
        {
          src: `${assetRoot}/examples-map.png`,
          alt: 'Map example repeating Map overlay in its card and panel.',
          caption: 'Map overlay.',
          width: 390,
          height: 844,
        },
      ],
    },
  ],
  coverage: [
    {
      label: 'Built-in Items',
      status: 'issue',
      outcome: 'Control layout collapses in the fixed specimen width.',
      evidenceSrc: `${assetRoot}/built-in-panel.png`,
    },
    {
      label: 'Creative controls',
      status: 'issue',
      outcome: 'Compound Dashlet actions fall below the visible panel.',
      evidenceSrc: `${assetRoot}/creative-panel.png`,
    },
    {
      label: 'Monitoring controls',
      status: 'issue',
      outcome: 'Slider tracks collapse and telemetry is truncated.',
      evidenceSrc: `${assetRoot}/monitoring-panel.png`,
    },
    {
      label: 'Debug feature controls',
      status: 'issue',
      outcome: 'The lower action set is truncated.',
      evidenceSrc: `${assetRoot}/debug-panel.png`,
    },
    {
      label: 'Performance health',
      status: 'pass',
      outcome: 'Usable at 390 px; shared title repetition remains.',
      evidenceSrc: `${assetRoot}/examples-performance.png`,
    },
    {
      label: 'Media transport',
      status: 'pass',
      outcome: 'Usable at 390 px; shared title repetition remains.',
      evidenceSrc: `${assetRoot}/examples-media.png`,
    },
    {
      label: 'Deployment status',
      status: 'pass',
      outcome: 'Usable at 390 px; shared title repetition remains.',
      evidenceSrc: `${assetRoot}/examples-deployment.png`,
    },
    {
      label: 'Map overlay',
      status: 'pass',
      outcome: 'Usable at 390 px; shared title repetition remains.',
      evidenceSrc: `${assetRoot}/examples-map.png`,
    },
  ],
}

const auditReports = new Map<string, AuditReport>([
  [homepageExamplesAudit.id, homepageExamplesAudit],
])

export function getAuditReport(id: string) {
  return auditReports.get(id)
}
