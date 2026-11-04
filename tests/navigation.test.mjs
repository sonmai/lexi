import assert from 'node:assert/strict'
import { test } from 'node:test'
import { navigateFallbackDenylist } from '../vite.config.ts'

/** Same check Workbox uses: the pattern is tested against pathname + search. */
function appShell(url) {
  const { pathname, search } = new URL(url, 'https://lexi.wellprep.top')
  return !navigateFallbackDenylist.some((pattern) => pattern.test(pathname + search))
}

test('a navigation to a real file is not replaced by the empty app', () => {
  assert.equal(appShell('/dictionary/manifest.json'), false)
  assert.equal(appShell('/dictionary/data/62d059dbd631/ab.json'), false)
  assert.equal(appShell('/dictionary-sources/SKYPEDIA_ATTRIBUTION.md'), false)
})

test('dictionary lookups stay in the app', () => {
  assert.equal(appShell('/'), true)
  assert.equal(appShell('/?q=example'), true)
  assert.equal(appShell('/?q=hello&lang=ja'), true)
})
