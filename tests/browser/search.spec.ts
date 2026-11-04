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
  // The previous query can still be showing one stale suggestion when ArrowUp arrives.
  await expect(page.getByRole('option')).toHaveCount(2)
  await input.press('ArrowUp')
  await expect(page.getByRole('option', { name: 'excellent' })).toHaveAttribute('aria-selected', 'true')
  await input.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
})

test('home lists recent lookups, which can be cleared', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Gõ một từ tiếng Anh để bắt đầu' })).toBeVisible()
  await page.goto('/?q=excellent')
  await expect(page).toHaveTitle('excellent · Lexi')
  await page.goto('/?q=example')
  await expect(page.getByRole('heading', { name: 'example', exact: true })).toBeVisible()
  await page.goto('/')
  await expect(page).toHaveTitle('Lexi · Từ điển Anh–Việt, Nhật–Việt')
  const recent = page.getByRole('region', { name: 'Tra gần đây' })
  await expect(recent.getByRole('button').filter({ hasNotText: 'Xoá' })).toHaveText(['example', 'excellent'])
  await recent.getByRole('button', { name: 'excellent' }).click()
  await expect(page.getByRole('heading', { name: 'excellent', exact: true })).toBeVisible()
  await page.goBack()
  await page.getByRole('button', { name: 'Xoá lịch sử' }).click()
  await expect(page.getByRole('heading', { name: 'Gõ một từ tiếng Anh để bắt đầu' })).toBeVisible()
})

test('touch devices explain saved words without a keyboard shortcut', async ({ page }) => {
  // This browser cannot emulate hover or pointer, so stub the query a phone actually matches.
  // Importing that string from the app would let a wrong query keep passing.
  await page.addInitScript(() => {
    const query = '(hover: none), (pointer: coarse)'
    const real = window.matchMedia.bind(window)
    window.matchMedia = (requested: string) => {
      if (requested !== query) return real(requested)
      return {
        matches: true,
        media: requested,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() { return false },
      } as MediaQueryList
    }
  })
  // Wider than the narrow-layout breakpoint, so hiding depends on the pointer, not the width.
  await page.setViewportSize({ width: 820, height: 1180 })
  await page.goto('/')
  await expect(page.locator('.home-hint')).toHaveText('Các từ bạn tra sẽ hiện ở đây.')
  await expect(page.locator('.keyboard-hint')).toBeHidden()
})

test('a fine pointer keeps the shortcut explanation at both window widths', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.home-hint')).toContainText('ở bất kỳ đâu để tìm nhanh')
  await expect(page.locator('.keyboard-hint')).toBeVisible()
  await page.setViewportSize({ width: 390, height: 800 })
  await expect(page.locator('.home-hint')).toContainText('ở bất kỳ đâu để tìm nhanh')
  await expect(page.locator('.keyboard-hint')).toBeHidden()
})

test('unknown words offer close spellings', async ({ page }) => {
  await page.goto('/?q=exampel')
  await expect(page.getByText('Có phải bạn muốn tìm:')).toBeVisible()
  await page.getByRole('button', { name: 'example', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'example', exact: true })).toBeVisible()
})

test('Tab leaves the search box instead of walking the suggestions', async ({ page }) => {
  await page.goto('/')
  const input = page.getByRole('combobox')
  await input.fill('ex')
  await expect(page.getByRole('option')).toHaveCount(2)
  await input.press('Tab')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(page.getByRole('option')).toHaveCount(0)
})

test('long sense lists start collapsed', async ({ page }) => {
  const senses = Array.from({ length: 9 }, (_, i) => ({ definition: `Nghĩa ${i + 1}`, partOfSpeech: 'noun' }))
  await page.route('**/dictionary/data/test/e.json', route => route.fulfill({
    json: { example: { headword: 'example', vi: senses, en: [] } },
  }))
  await page.goto('/?q=example')
  await expect(page.getByText('Nghĩa 4', { exact: true })).toBeVisible()
  await expect(page.getByText('Nghĩa 5', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Xem thêm 5 nghĩa' }).click()
  await expect(page.getByText('Nghĩa 9', { exact: true })).toBeVisible()
})

test('deep links still load words and unknown words still show not found', async ({ page }) => {
  await page.goto('/?q=example')
  await expect(page.getByRole('combobox')).toHaveValue('example')
  await expect(page.getByRole('heading', { name: 'example', exact: true })).toBeVisible()
  await page.goto('/?q=unknown')
  await expect(page.getByRole('heading', { name: 'Không tìm thấy từ', exact: true })).toBeVisible()
})
