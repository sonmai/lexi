import { expect, test } from '@playwright/test'
import { japaneseShard, normalizeJapanese } from '../../src/utils/japanese'

const shardCount = 4
const pages: Record<string, unknown[]> = {
  食べる: [{
    id: '1358280', forms: ['食べる'], readings: ['たべる'], common: true, vi: ['Ăn'], pos: ['v1', 'vt'],
    ja: ['何かを、口から嚙んで飲み込む。'],
    examples: [{ ja: '朝食は何を食べたの？', vi: 'Bữa sáng bạn ăn gì?' }],
  }],
  はし: [
    { id: '1', forms: ['橋'], readings: ['はし'], common: true, vi: ['Cây cầu'], pos: ['n'] },
    { id: '2', forms: ['箸'], readings: ['はし'], common: true, vi: ['Đôi đũa'], pos: ['n'] },
  ],
}
pages.たべる = pages.食べる
const index = ['たべる', 'はし', '食べる']
const shards: Record<string, Record<string, unknown[]>> = {}
for (const [key, entries] of Object.entries(pages)) {
  const shard = japaneseShard(normalizeJapanese(key), shardCount)
  shards[shard] = { ...shards[shard], [normalizeJapanese(key)]: entries }
}
const chunkUrl = (shard: string) => `/dictionary/data/ja-test/${shard}.json`

test.beforeEach(async ({ page }) => {
  await page.route('**/dictionary/manifest.json', route => route.fulfill({
    json: {
      version: 'test', count: 1, index: '/dictionary/words.json', chunks: ['/dictionary/data/test/ex.json'],
      chunkStrategy: 'prefix2',
      japanese: {
        version: 'test', count: 3, index: '/dictionary/ja-words.json', kanji: '/dictionary/ja-kanji.json',
        chunks: Object.keys(shards).map(chunkUrl), chunkStrategy: 'fnv1a', shardCount,
      },
    },
  }))
  await page.route('**/dictionary/words.json', route => route.fulfill({ json: ['example'] }))
  await page.route('**/dictionary/data/test/ex.json', route => route.fulfill({
    json: { example: { headword: 'example', vi: [{ definition: 'Ví dụ', partOfSpeech: 'noun' }], en: [] } },
  }))
  await page.route('**/dictionary/ja-words.json', route => route.fulfill({ json: index }))
  await page.route('**/dictionary/ja-kanji.json', route => route.fulfill({ json: { 食: ['Thực'], 橋: ['Kiều', 'Khiêu'] } }))
  for (const [shard, json] of Object.entries(shards)) {
    await page.route('**' + chunkUrl(shard), route => route.fulfill({ json }))
  }
})

test('romaji input finds Japanese words with Vietnamese meanings and Hán Việt', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Nhật–Việt', exact: true }).click()
  await expect(page.getByText('3 mục từ', { exact: true })).toBeVisible()
  const input = page.getByRole('combobox')
  await input.fill('tabe')
  await expect(page.getByRole('option')).toHaveText(['たべる↗'])
  await input.fill('taberu')
  await input.press('Enter')
  await expect(page.getByRole('heading', { name: '食べる', exact: true })).toBeVisible()
  const params = new URL(page.url()).searchParams
  expect([params.get('q'), params.get('lang')]).toEqual(['たべる', 'ja'])
  await expect(page.getByText('THỰC', { exact: true })).toBeVisible()
  await expect(page.getByText('Ăn', { exact: true })).toBeVisible()
  await expect(page.getByText('Động từ nhóm 2 · Ngoại động từ')).toBeVisible()
  await expect(page.getByText('Bữa sáng bạn ăn gì?')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Nhật – Anh' })).toHaveCount(0)
  const monolingual = page.getByRole('region', { name: 'Nhật – Nhật' })
  await expect(monolingual.getByText('何かを、口から嚙んで飲み込む。')).toBeVisible()
})

test('entries without Japanese definitions hide the Nhật – Nhật section', async ({ page }) => {
  await page.goto('/?q=%E3%81%AF%E3%81%97&lang=ja')
  await expect(page.getByRole('heading', { name: '橋', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Nhật – Nhật' })).toHaveCount(0)
})

test('typing kana switches to Japanese and shows every homograph', async ({ page }) => {
  await page.goto('/')
  const input = page.getByRole('combobox')
  await input.fill('はし')
  await expect(page.getByRole('button', { name: 'Nhật–Việt', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await input.press('Enter')
  await expect(page.getByText('2 mục cho “はし”')).toBeVisible()
  await expect(page.getByRole('heading', { name: '橋', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '箸', exact: true })).toBeVisible()
  await expect(page.getByText('橋 Kiều/Khiêu', { exact: true })).toBeVisible()
  await expect(page.getByText('Đôi đũa', { exact: true })).toBeVisible()
})

test('Japanese deep links and the English dictionary stay independent', async ({ page }) => {
  await page.goto('/?q=食べる&lang=ja')
  await expect(page.getByRole('heading', { name: '食べる', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Anh–Việt', exact: true }).click()
  await expect(page).toHaveURL(/\?q=%E9%A3%9F%E3%81%B9%E3%82%8B$/)
  await expect(page.getByRole('heading', { name: 'Không tìm thấy từ', exact: true })).toBeVisible()
  await page.getByRole('combobox').fill('example')
  await page.getByRole('combobox').press('Enter')
  await expect(page.getByRole('heading', { name: 'example', exact: true })).toBeVisible()
  await page.goto('/?q=unknown&lang=ja')
  await expect(page.getByRole('heading', { name: 'Không tìm thấy từ', exact: true })).toBeVisible()
})
