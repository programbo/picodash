import { describe, expect, test } from 'vite-plus/test'
import {
  createPicodashNexus,
  PicodashContractError,
  PicodashTransactionError,
} from '../src/index.ts'
import { asyncStandardSchema, syncStandardSchema } from './support/standard-schema-fixtures.js'

describe('Nexus callback and issue boundaries', () => {
  test('normalizes Standard Schema success, failure, paths, and vendor-code privacy', () => {
    const success = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        value: {
          defaultValue: 1,
          schema: syncStandardSchema<number>((value) => ({
            value: value as number,
            issues: undefined,
          })),
        },
      },
    })
    expect(success.getState().values.value).toBe(1)

    const symbol = Symbol('secret')
    const rejected = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        value: {
          defaultValue: 1,
          schema: syncStandardSchema<number>((value) =>
            value === 1
              ? { value, issues: undefined }
              : {
                  issues: [
                    { message: 'bad', path: [symbol, { key: 'nested' }], code: 'vendor-code' },
                  ],
                },
          ),
        },
      },
    })
    const result = rejected.setValues({ value: 2 })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.issues).toEqual([
        expect.objectContaining({
          code: 'schema_failed',
          path: ['values', 'value', 'Symbol(secret)', 'nested'],
        }),
      ])
      expect(JSON.stringify(result.error.issues)).not.toContain('vendor-code')
    }
  })

  test('uses a fallback issue for empty Standard Schema failures and rejects malformed shapes', () => {
    const empty = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        value: {
          defaultValue: 1,
          schema: syncStandardSchema<number>((value) => (value === 1 ? { value } : { issues: [] })),
        },
      },
    })
    const result = empty.setValues({ value: 2 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.issues[0]).toMatchObject({ code: 'schema_failed' })

    expect(() =>
      createPicodashNexus({
        valueOwner: 'nexus',
        fields: {
          value: {
            defaultValue: 1,
            schema: syncStandardSchema<number>(() => ({ value: 2, issues: [] })),
          },
        },
      }),
    ).toThrowError(PicodashContractError)
    expect(() =>
      createPicodashNexus({
        valueOwner: 'nexus',
        fields: {
          value: {
            defaultValue: 1,
            schema: asyncStandardSchema<number>(() => Promise.resolve({ value: 2 })),
          },
        },
      }),
    ).toThrowError(PicodashContractError)
    expect(() =>
      createPicodashNexus({
        valueOwner: 'nexus',
        fields: {
          value: {
            defaultValue: 1,
            schema: {
              '~standard': {
                version: 2,
                vendor: 'wrong-version',
                validate: () => ({ value: 1 }),
              },
            } as never,
          },
        },
      }),
    ).toThrowError(PicodashContractError)
  })

  test('rethrows contract errors from callbacks and hides ordinary causes', () => {
    let nexus: ReturnType<typeof createPicodashNexus>
    const contract = new PicodashContractError('reentrant-write')
    nexus = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        value: {
          defaultValue: 1,
          validate: (value) => {
            if ((value as number) === 2) throw contract
            return []
          },
        },
      },
    })
    expect(() => nexus.setValues({ value: 2 })).toThrow(contract)

    const ordinary = createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        value: {
          defaultValue: 1,
          validate: (value) => {
            if ((value as number) === 2) throw new Error('private cause')
            return []
          },
        },
      },
    })
    const rejected = ordinary.setValues({ value: 2 })
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(JSON.stringify(rejected.error)).not.toContain('private cause')
  })

  test('defensively freezes public transaction and contract errors', () => {
    const issues = [{ code: 'app:test', path: ['x'], message: 'no' }] as const
    const error = new PicodashTransactionError(issues)
    expect(Object.isFrozen(error)).toBe(true)
    expect(Object.isFrozen(error.issues)).toBe(true)
    expect(Object.isFrozen(error.issues[0])).toBe(true)
    expect(Object.isFrozen(error.issues[0]?.path)).toBe(true)
    expect(() => ((error.issues as unknown as { 0: unknown })[0] = null)).toThrow()

    const contract = new PicodashContractError('invalid-configuration', { detail: 'safe' }, issues)
    expect(Object.isFrozen(contract.context)).toBe(true)
    expect(Object.isFrozen(contract.issues)).toBe(true)
  })
})
