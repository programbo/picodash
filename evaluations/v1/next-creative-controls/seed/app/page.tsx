'use client'

import { useState } from 'react'

type SceneValues = {
  bloom: boolean
  exposure: number
  quality: 'draft' | 'balanced' | 'final'
  temperature: number
  vignette: number
}

const initialScene: SceneValues = {
  bloom: true,
  exposure: 1.2,
  quality: 'balanced',
  temperature: 6500,
  vignette: 0.25,
}

export default function CreativeStudio() {
  const [scene, setScene] = useState<SceneValues>(initialScene)

  return (
    <main className="studio-shell">
      <section
        className="scene"
        data-testid="scene-preview"
        style={{
          filter: `brightness(${scene.exposure})`,
          background: `radial-gradient(circle at 50% 40%, hsl(205 90% ${
            55 + scene.temperature / 1000
          }%), hsl(246 44% ${12 - scene.vignette * 8}%))`,
        }}
      >
        <p>Aurora study</p>
        <h1>Shape the atmosphere.</h1>
        <output data-testid="scene-summary">
          {scene.exposure.toFixed(1)} EV · {scene.temperature} K · vignette{' '}
          {scene.vignette.toFixed(2)}
        </output>
      </section>

      <form className="host-controls" aria-label="Host creative controls">
        <label>
          Exposure
          <input
            data-testid="host-exposure"
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={scene.exposure}
            onChange={(event) =>
              setScene((current) => ({ ...current, exposure: Number(event.target.value) }))
            }
          />
        </label>
        <label>
          Temperature
          <input
            data-testid="host-temperature"
            type="number"
            min="2000"
            max="12000"
            step="100"
            value={scene.temperature}
            onChange={(event) =>
              setScene((current) => ({ ...current, temperature: Number(event.target.value) }))
            }
          />
        </label>
      </form>
    </main>
  )
}
