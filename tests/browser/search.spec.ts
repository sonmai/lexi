import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Keep the real lookup and autocomplete code, with deterministic network data.
  await page.route('**/dictionary/manifest.json', route => route.fulfill({
    json: { version: 'test', count: 2, index: '/dictionary/words.json', chunks: ['/dictionary/data/test/e.json'] },
  }))
  await page.route('**/dictionary/words.json', route => route.fulfill({ json: ['example', 'excellent'] }))
  await page.route('**/dictionary/data/test/e.json', route => route.fulfill({
    json: Object.fromEntries(['example', 'excellent'].map(headword => [headword, {
      headword, vi: [{ definition: 'Nghĩa tiếng Việt', partOfSpeech: 'noun' }],
      en: [{ definition: 'English definition', partOfSpeech: 'noun' }],
    }])),
  }))
})

test('empty URLs stay idle without a default lookup', async ({ page }) => {
  const lookups: string[] = []
  page.on('request', request => {
    if (request.url().includes('/dictionary/data/')) lookups.push(request.url())
  })
  for (const url of ['/', '/?q=', '/?q=%20%20']) {
    await page.goto(url)
    await expect(page.getByRole('combobox')).toHaveValue('')
    await expect(page.getByText('2 mục từ', { exact: true })).toBeVisible()
    await expect(page.locator('.result-region')).toBeEmpty()
    await expect(page.locator('.result-region')).toHaveAttribute('aria-busy', 'false')
    await page.getByRole('button', { name: 'Tra từ', exact: true }).click()
    await expect(page.locator('.result-region')).toBeEmpty()
  }
  expect(lookups).toEqual([])
})

test('autocomplete, shortcuts and history preserve the empty home state', async ({ page }) => {
  await page.goto('/')
  const input = page.getByRole('combobox')
  await expect(page.getByText('2 mục từ', { exact: true })).toBeVisible()
  await page.keyboard.press('Control+k')
  await expect(input).toBeFocused()
  await input.fill('ex')
  await expect(page.getByRole('option')).toHaveCount(2)
  await input.press('ArrowDown')
  await input.press('Enter')
  await expect(page.getByRole('heading', { name: 'excellent', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\?q=excellent$/)
  await page.goBack()
  await expect(input).toHaveValue('')
  await expect(page.locator('.result-region')).toBeEmpty()
  await page.goForward()
  await expect(input).toHaveValue('excellent')
  await expect(page.getByRole('heading', { name: 'excellent', exact: true })).toBeVisible()
  await page.keyboard.press('Meta+k')
  await expect(input).toBeFocused()
  await input.fill('ex')
  await input.press('ArrowUp')
  await expect(page.getByRole('option', { name: 'excellent' })).toHaveAttribute('aria-selected', 'true')
  await input.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
})

test('deep links still load words and unknown words still show not found', async ({ page }) => {
  await page.goto('/?q=example')
  await expect(page.getByRole('combobox')).toHaveValue('example')
  await expect(page.getByRole('heading', { name: 'example', exact: true })).toBeVisible()
  await page.goto('/?q=unknown')
  await expect(page.getByRole('heading', { name: 'Không tìm thấy từ', exact: true })).toBeVisible()
})
