import { createHash } from 'node:crypto'
import { access, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const archive = path.join(root, 'docs/archive/2026-11-13')
const manifest = JSON.parse(await readFile(path.join(archive, 'manifest.json'), 'utf8'))
for (const entry of manifest) {
  const file = path.resolve(archive, entry.archivedPath)
  if (!file.startsWith(archive + path.sep)) throw new Error('Archive path escapes its owner')
  const hash = createHash('sha256')
    .update(await readFile(file))
    .digest('hex')
  if (hash !== entry.sha256) throw new Error(`Archived bytes changed: ${entry.archivedPath}`)
}
async function markdown(directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'archive') continue
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) result.push(...(await markdown(file)))
    else if (file.endsWith('.md')) result.push(file)
  }
  return result
}
const files = [
  ...(await markdown(path.join(root, 'docs'))),
  ...[
    'README.md',
    'AGENTS.md',
    'TESTING.md',
    'CONTRIBUTING.md',
    'RELEASING.md',
    'SKILL.md',
    'CHANGELOG.md',
  ].map((file) => path.join(root, file)),
  ...['nexus', 'ui', 'dashpanel', 'dashstack', 'picodash', 'dev-bridge'].map((name) =>
    path.join(root, 'packages', name, 'README.md'),
  ),
]
const missing = []
for (const file of files) {
  const text = (await readFile(file, 'utf8')).replace(/```[^\n]*\n[\s\S]*?```/g, '')
  for (const [, target] of text.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g)) {
    if (/^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(target)) continue
    const clean = decodeURIComponent(target.split('#')[0])
    if (!clean) continue
    const destination = path.resolve(path.dirname(file), clean)
    try {
      await access(destination)
    } catch {
      missing.push(`${path.relative(root, file)} -> ${target}`)
    }
  }
}
if (missing.length) throw new Error(`Missing documentation links:\n${missing.join('\n')}`)
console.log(
  `Verified ${manifest.length} exact archive files and links in ${files.length} current Markdown files.`,
)
