import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

export const guideFiles = [
  ['dogfooding.md', 'GUIDE.md'],
  ...[
    'consumer-recipes.md',
    'numeric-targets.md',
    'linked-controls.md',
    'open-ended-ranges.md',
    'agent-dev-bridge.md',
    'dock-reactive-layout.md',
    'index.md',
  ].map((file) => [file, file]),
]
const links = /\[([^\]]+)\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g
const external = (target) => /^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(target)
const inside = (root, file) => {
  const path = relative(root, file)
  return path !== '..' && !path.startsWith('../') && !path.startsWith('/')
}

/** Ship the linked Markdown contract snapshot, not an unrelated source/test tree. */
export async function packGuides(root, output, examples) {
  const destinations = new Map(
    guideFiles.map(([source, destination]) => [
      resolve(root, 'docs/development', source),
      join(output, destination),
    ]),
  )
  const publicExamples = new Map(
    examples.map((file) => [
      resolve(root, 'packages/picodash/tests/dogfood', file),
      join(output, 'example', file),
    ]),
  )
  const queue = [...destinations.keys()]
  for (const source of queue) {
    const destination = destinations.get(source)
    const text = await readFile(source, 'utf8')
    const rewritten = text.replace(links, (original, label, target) => {
      if (external(target)) return original
      const [path, fragment] = target.split('#', 2)
      const file = resolve(dirname(source), decodeURIComponent(path))
      if (!inside(root, file)) throw new Error(`Guide link escapes source: ${source}: ${target}`)
      let mapped = destinations.get(file) ?? publicExamples.get(file)
      if (!mapped && file.endsWith('.md')) {
        const sourcePath = relative(root, file)
        mapped = join(
          output,
          'docs',
          sourcePath.startsWith('docs/') ? sourcePath.slice(5) : sourcePath,
        )
        destinations.set(file, mapped)
        queue.push(file)
      }
      if (!mapped)
        return `${label} (source checkout: \`${relative(root, file)}${fragment ? '#' + fragment : ''}\`)`
      const link = relative(dirname(destination), mapped).split('\\').join('/')
      return `[${label}](${link}${fragment ? '#' + fragment : ''})`
    })
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, rewritten)
  }
  return destinations.size
}

/** Reject missing or escaping local links in the actual portable Markdown tree. */
export async function checkGuideLinks(directory) {
  const markdown = []
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const file = join(path, entry.name)
      if (entry.isDirectory()) await visit(file)
      else if (entry.isFile() && entry.name.endsWith('.md')) markdown.push(file)
    }
  }
  await visit(directory)
  for (const file of markdown) {
    const text = await readFile(file, 'utf8')
    for (const [, , target] of text.matchAll(links)) {
      if (external(target)) continue
      const path = target.split('#', 1)[0]
      if (!path) continue
      const destination = resolve(dirname(file), decodeURIComponent(path))
      if (!inside(directory, destination))
        throw new Error(
          `Portable guide link escapes bundle: ${relative(directory, file)}: ${target}`,
        )
      try {
        if (!(await stat(destination)).isFile()) throw new Error('not a file')
      } catch {
        throw new Error(`Missing portable guide link: ${relative(directory, file)}: ${target}`)
      }
    }
  }
  return markdown.length
}
