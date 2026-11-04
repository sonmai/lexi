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
    await expect(page.getByRole('banner').getByRole('group', { name: 'Chọn từ điển' })).toBeVisible()
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
  // The shortcut listener attaches after the first render, so an early press can be missed.
  await expect(async () => {
    await page.keyboard.press('Control+k')
    await expect(input).toBeFocused({ timeout: 500 })
  }).toPass()
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
  const recent = page.getByRole('region', { name: 'Tra gần đây' })
  await expect(page.getByRole('combobox')).toBeVisible()
  await expect(recent).toHaveCount(0)
  await page.goto('/?q=excellent')
  await expect(page).toHaveTitle('excellent · Lexi')
  await page.goto('/?q=example')
  await expect(page.getByRole('heading', { name: 'example', exact: true })).toBeVisible()
  await expect(page.getByRole('banner').getByRole('group', { name: 'Chọn từ điển' })).toHaveCount(0)
  await expect(page.getByRole('main').getByRole('group', { name: 'Chọn từ điển' })).toBeVisible()
  await page.goto('/')
  await expect(page).toHaveTitle('Lexi · Từ điển Anh–Việt, Nhật–Việt')
  await expect(recent.getByRole('button').filter({ hasNotText: 'Xoá' })).toHaveText(['example', 'excellent'])
  await recent.getByRole('button', { name: 'excellent' }).click()
  await expect(page.getByRole('heading', { name: 'excellent', exact: true })).toBeVisible()
  await page.goBack()
  await page.getByRole('button', { name: 'Xoá lịch sử' }).click()
  await expect(recent).toHaveCount(0)
})

test('touch devices hide the keyboard shortcut', async ({ page }) => {
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
  await expect(page.getByRole('combobox')).toBeVisible()
  await expect(page.locator('.keyboard-hint')).toBeHidden()
})

test('a fine pointer shows the shortcut only on wide windows', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.keyboard-hint')).toBeVisible()
  await page.setViewportSize({ width: 390, height: 800 })
  await expect(page.locator('.keyboard-hint')).toBeHidden()
})

test('the border light runs on focus and loops only through a slow lookup', async ({ page }) => {
  await page.goto('/')
  const input = page.getByRole('combobox')
  await expect(page.locator('.search-led')).toHaveCount(0)
  await input.focus()
  await expect(page.locator('.search-led-lap')).toHaveCount(1)
  await input.fill('ex')
  await expect(page.locator('.wordmark-dot-hop')).toHaveCount(1)
  await page.route('**/dictionary/data/test/e.json', async route => {
    await new Promise(resolve => setTimeout(resolve, 800))
    await route.fallback()
  })
  await input.fill('example')
  await input.press('Enter')
  await expect(page.locator('.search-led-busy')).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'example', exact: true })).toBeVisible()
  await expect(page.locator('.search-led-busy')).toHaveCount(0)
})

test('the home placeholder types examples until the field is used', async ({ page }) => {
  await page.goto('/')
  const input = page.getByRole('combobox')
  await expect(input).toHaveAttribute('placeholder', 'Thử tra: serendipity')
  await input.focus()
  await expect(input).toHaveAttribute('placeholder', 'Nhập từ tiếng Anh để tra cứu...')
  await page.goto('/?q=example')
  await page.waitForTimeout(800)
  await expect(input).toHaveAttribute('placeholder', 'Nhập từ tiếng Anh để tra cứu...')
})

test('hovering the wordmark bounces its dot', async ({ page }) => {
  await page.goto('/')
  const dot = page.locator('.wordmark span')
  await expect(dot).toHaveCSS('animation-name', 'none')
  await page.locator('.wordmark').hover()
  await expect(dot).toHaveCSS('animation-name', 'dot-bounce')
})

test('reduced motion keeps the plain placeholder', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForTimeout(800)
  await expect(page.getByRole('combobox')).toHaveAttribute('placeholder', 'Nhập từ tiếng Anh để tra cứu...')
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
