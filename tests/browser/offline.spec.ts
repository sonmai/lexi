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

const cachedPaths = (page: Page) => page.evaluate(async () => {
  const cache = await caches.open('lexi-dictionary-v2')
  return (await cache.keys()).map((request) => new URL(request.url).pathname).sort()
})

test('an offline copy stays in use after a deploy until the user updates it', async ({ page }) => {
  const deployment = await serveDeployments(page)
  await page.goto('/')
  const offline = page.locator('.offline-action')
  await expect(offline).toHaveText('Tải từ điển offline · 2 MB')
  await offline.click()
  await expect(offline).toHaveText('Đã tải offline')
  await expect(offline).toBeDisabled()

  deployment.version = 'v2'
  await page.goto('/?q=example')
  await expect(page.getByText('Nghĩa bản cũ')).toBeVisible()
  await expect(offline).toHaveText('Cập nhật bản offline · 2 MB')

  await offline.click()
  await expect(offline).toHaveText('Đã tải offline')
  expect(await cachedPaths(page)).toEqual(['/dictionary/data/v2/ex.json', '/dictionary/data/v2/index.json'])
  await page.reload()
  await expect(page.getByText('Nghĩa bản mới')).toBeVisible()
})

test('an evicted offline copy falls back to the deployed data', async ({ page }) => {
  const deployment = await serveDeployments(page)
  await page.goto('/')
  await page.locator('.offline-action').click()
  await expect(page.locator('.offline-action')).toHaveText('Đã tải offline')

  await page.evaluate(() => caches.delete('lexi-dictionary-v2'))
  deployment.version = 'v2'
  await page.goto('/?q=example')
  await expect(page.getByText('Nghĩa bản mới')).toBeVisible()
  await expect(page.locator('.offline-action')).toHaveText('Tải từ điển offline · 2 MB')
})
