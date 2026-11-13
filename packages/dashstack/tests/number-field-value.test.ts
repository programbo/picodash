import { describe, expect, it } from 'vite-plus/test'
import { createNumberFieldValueAdapter } from '../src/number-field-value.ts'

describe('tiny NumberField formatted-value adapter', () => {
  it('round-trips localized and affixed scientific notation', () => {
    const formats: readonly Intl.NumberFormatOptions[] = [
      { notation: 'scientific', maximumFractionDigits: 3 },
      { notation: 'engineering', maximumFractionDigits: 3 },
      { notation: 'scientific', style: 'percent', maximumFractionDigits: 3 },
      {
        notation: 'scientific',
        style: 'currency',
        currency: 'SEK',
        maximumFractionDigits: 3,
      },
      {
        notation: 'scientific',
        style: 'unit',
        unit: 'meter',
        maximumFractionDigits: 3,
      },
    ]

    for (const locale of ['en-US', 'de-DE', 'ar-EG'])
      for (const format of formats) {
        const formatted = new Intl.NumberFormat(locale, format).format(1.5e-308)
        expect(createNumberFieldValueAdapter(locale, format).normalize(formatted)).toBe(1.5e-308)
      }
  })
})
