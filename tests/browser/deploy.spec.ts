import { expect, test, type Page } from '@playwright/test'

/** Serves one deployed data version at a time; files of other versions 404 like after a real deploy. */
async function serveDeployments(page: Page) {
  const deployment = { version: 'v1' }
  const files = (version: string) => ({
    [`/dictionary/data/${version}/index.json`]: ['example'],
    [`/dictionary/data/${version}/ex.json`]: {
      example: {
        headword: 'example', en: [],
        vi: [{ definition: version === 'v1' ? 'Nghĩa bản cũ' : 'Nghĩa bản mới', partOfSpeech: 'noun' }],
      },
    },
  })
  await page.route('**/dictionary/**', (route) => {
    const path = new URL(route.request().url()).pathname
    const { version } = deployment
    if (path === '/dictionary/manifest.json') {
      return route.fulfill({
        json: {
          version, count: 1, index: `/dictionary/data/${version}/index.json`,
          chunks: [`/dictionary/data/${version}/ex.json`], chunkStrategy: 'prefix2', bytes: 2_000_000,
        },
      })
    }
    const body = files(version)[path]
    return body ? route.fulfill({ json: body }) : route.fulfill({ status: 404, body: 'Not found' })
  })
  return deployment
}

test('a lookup uses the deployed dictionary on the next visit', async ({ page }) => {
  const deployment = await serveDeployments(page)
  await page.goto('/?q=example')
  await expect(page.getByText('Nghĩa bản cũ')).toBeVisible()
  await expect(page.getByRole('button', { name: /offline/i })).toHaveCount(0)

  deployment.version = 'v2'
  await page.goto('/?q=example')
  await expect(page.getByText('Nghĩa bản mới')).toBeVisible()
})

test('a previously downloaded copy is discarded', async ({ page }) => {
  const deployment = await serveDeployments(page)
  deployment.version = 'v2'
  await page.goto('/')
  await page.evaluate(async () => {
    localStorage.setItem('lexi-offline-v1', '{"en":{"version":"v1"}}')
    const dictionary = await caches.open('lexi-dictionary-v2')
    await dictionary.put('/dictionary/data/v1/ex.json', new Response('{}', {
      headers: { 'content-type': 'application/json' },
    }))
    const manifest = await caches.open('lexi-manifest-v1')
    await manifest.put('/dictionary/manifest.json', new Response('{}', {
      headers: { 'content-type': 'application/json' },
    }))
  })

  await page.goto('/?q=example')
  await expect(page.getByText('Nghĩa bản mới')).toBeVisible()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('lexi-offline-v1'))).toBeNull()
  await expect.poll(() => page.evaluate(async () => {
    const names = await caches.keys()
    return names.filter((name) => name === 'lexi-dictionary-v2' || name === 'lexi-manifest-v1')
  })).toEqual([])
})
