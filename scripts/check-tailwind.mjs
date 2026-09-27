// Fails when app code uses Tailwind arbitrary values (p-[16px], text-[13px], shadow-[...]).
// Variant selectors stay allowed: data-[state=on]:, aria-[...]:, has-data-[...]:, [&_svg]:.
// src/components/ui is shadcn-generated and skipped; see docs/styling.md.
// Run: npm run lint:tw
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'src'
const SKIP = [join('src', 'components', 'ui')]
const ARBITRARY = /(?<![\w-])(?:[\w-]+:)*!?[a-z][\w-]*-\[[^\]\s]+\]/g
const VARIANT = /^(?:[\w-]+:)*!?(?:data|aria|has-data|group-data|peer-data|in-data|supports|min|max)-\[/

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (SKIP.some((s) => path.startsWith(s))) continue
    if (statSync(path).isDirectory()) yield* files(path)
    else if (/\.(tsx?|jsx?)$/.test(name)) yield path
  }
}

let count = 0
for (const file of files(ROOT)) {
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    for (const [match] of line.matchAll(ARBITRARY)) {
      if (VARIANT.test(match)) continue // a selector variant, not a value
      console.log(`${file}:${i + 1}  ${match}`)
      count++
    }
  })
}

if (count) {
  console.log(`\n${count} arbitrary Tailwind value(s). Use a scale class or add a token to @theme in src/index.css.`)
  process.exit(1)
}
console.log('No arbitrary Tailwind values.')
