'use client'

import { useEffect, useMemo, useReducer, useState } from 'react'
import {
  CONTRACT_LAB_PRESETS,
  contractLabActions,
  contractLabReducer,
  createInitialContractLabState,
  installContractLabDriver,
  isContractLabPresetId,
  type ContractLabPresetId,
} from '@lab/lib/contract-lab'
import { ContractLabConsole } from './console'
import { ContractLabSpecimenHost } from './specimen-host'
import { ContractLabStatusStrip } from './status-strip'

const sessionPresetKey = 'picodash:contract-lab:preset'

export function ContractLab() {
  const [state, dispatch] = useReducer(contractLabReducer, undefined, createInitialContractLabState)
  const [hydrated, setHydrated] = useState(false)
  const [specimenAvailable, setSpecimenAvailable] = useState(true)
  const [consoleDiagnosticCount, setConsoleDiagnosticCount] = useState(0)
  const [specimenDiagnosticCount, setSpecimenDiagnosticCount] = useState(0)
  const [primaryPanelVisible, setPrimaryPanelVisible] = useState(true)
  const preset = useMemo(
    () =>
      CONTRACT_LAB_PRESETS.find((candidate) => candidate.id === state.activePreset) ??
      CONTRACT_LAB_PRESETS[0],
    [state.activePreset],
  )

  useEffect(() => {
    const storedPreset = window.sessionStorage.getItem(sessionPresetKey)
    if (isContractLabPresetId(storedPreset) && storedPreset !== state.activePreset) {
      dispatch(contractLabActions.loadPreset(storedPreset))
    }
    setHydrated(true)
  }, [])

  useEffect(
    () =>
      installContractLabDriver((action) => {
        dispatch(action)
        setSpecimenAvailable(true)
      }),
    [],
  )

  useEffect(() => {
    if (hydrated) {
      window.sessionStorage.setItem(sessionPresetKey, state.activePreset)
    }
  }, [hydrated, state.activePreset])

  function loadPreset(nextPreset: ContractLabPresetId) {
    dispatch(contractLabActions.loadPreset(nextPreset))
    setSpecimenAvailable(true)
  }

  function resetLab() {
    dispatch(contractLabActions.reset())
    setSpecimenAvailable(true)
  }

  return (
    <main
      className="bg-background text-foreground min-h-svh"
      data-contract-lab
      data-product-route="contract-lab"
    >
      <ContractLabStatusStrip
        diagnosticCount={consoleDiagnosticCount + specimenDiagnosticCount}
        lastOperation={state.lastOperation}
        presetLabel={preset.label}
        ready={hydrated}
        specimenAvailable={specimenAvailable}
        primaryPanelVisible={primaryPanelVisible}
      />

      <div className="relative isolate overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[2rem_2rem] opacity-25"
        />
        <div className="relative mx-auto grid max-w-[110rem] gap-4 p-4 sm:p-6 lg:grid-cols-[21rem_minmax(0,1fr)] lg:items-start">
          <ContractLabConsole
            activePreset={state.activePreset}
            onDiagnosticCountChange={setConsoleDiagnosticCount}
            onLoadPreset={loadPreset}
            onReset={resetLab}
            onToggleSpecimen={() => setSpecimenAvailable((available) => !available)}
            presets={CONTRACT_LAB_PRESETS}
            specimenAvailable={specimenAvailable}
          />

          {specimenAvailable ? (
            <ContractLabSpecimenHost
              key={`${preset.id}:${state.specimenRevision}`}
              onDiagnosticCountChange={setSpecimenDiagnosticCount}
              onPrimaryVisibilityChange={setPrimaryPanelVisible}
              preset={preset}
              revision={state.specimenRevision}
            />
          ) : (
            <section
              aria-labelledby="contract-lab-offline-title"
              className="border-border/80 bg-card/70 grid min-h-[32rem] place-items-center rounded-xl border border-dashed p-8 text-center"
              data-contract-lab-specimen-offline
            >
              <div className="max-w-md">
                <p className="text-muted-foreground font-mono text-[0.625rem] tracking-[0.16em] uppercase">
                  Destructive scenario
                </p>
                <h1 id="contract-lab-offline-title" className="mt-2 text-2xl font-semibold">
                  Specimen offline
                </h1>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  The independent status strip and Lab Console remain operable. Reopen the specimen
                  to resume the selected contract.
                </p>
                <button
                  className="border-border bg-background hover:bg-accent focus-visible:ring-ring mt-5 min-h-11 rounded-md border px-4 text-sm font-medium outline-none focus-visible:ring-2"
                  type="button"
                  onClick={() => setSpecimenAvailable(true)}
                >
                  Reopen primary specimen
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  )
}
