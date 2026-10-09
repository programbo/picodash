import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readSnapshot } from './install.mjs'
import { validVersion } from './pack.mjs'

export async function locateSnapshot(root) {
  const recommendation = JSON.parse(
    await readFile(join(root, 'docs/development/recommended-snapshot.json'), 'utf8'),
  )
  if (typeof recommendation?.version !== 'string' || !validVersion(recommendation.version))
    throw new Error('Invalid recommended snapshot version')
  const bundlePath = join(root, 'output/dogfood', recommendation.version)
  let snapshot
  try {
    snapshot = await readSnapshot(bundlePath)
  } catch (error) {
    throw new Error(
      `Recommended bundle unavailable or invalid: ${bundlePath}. Do not select a trial instead. ${error.message}`,
    )
  }
  if (snapshot.dirty || snapshot.version !== recommendation.version)
    throw new Error('Recommended bundle must match its pinned version and come from clean source')
  return {
    version: snapshot.version,
    sourceCommit: snapshot.sourceCommit,
    sourceCheckout: root,
    bundlePath,
    installer: join(bundlePath, 'install.mjs'),
    guide: join(root, 'docs/development/dogfooding.md'),
    recipes: join(root, 'docs/development/consumer-recipes.md'),
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  locateSnapshot(resolve(dirname(fileURLToPath(import.meta.url)), '../..'))
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}
