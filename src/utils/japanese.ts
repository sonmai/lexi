/**
 * Japanese lookup helpers. `normalizeJapanese` and `japaneseShard` must stay in
 * sync with `normalize` and `shard_of` in scripts/build_japanese.py.
 */

export function normalizeJapanese(input: string): string {
  return input.normalize('NFKC').toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .trim()
    .replace(/\s+/g, ' ')
}

export function japaneseShard(key: string, shardCount: number): string {
  let hash = 0x811c9dc5
  for (const ch of key) {
    hash ^= ch.codePointAt(0)!
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return (hash % shardCount).toString(16).padStart(2, '0')
}

export function containsJapanese(text: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uff66-\uff9f]/.test(text)
}

export function isKanji(ch: string): boolean {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(ch) || (ch.codePointAt(0) ?? 0) >= 0x20000
}

const romaji = new Map<string, string>()
const rows: Record<string, string> = {
  '': 'あいうえお', k: 'かきくけこ', s: 'さしすせそ', t: 'たちつてと', n: 'なにぬねの',
  h: 'はひふへほ', m: 'まみむめも', r: 'らりるれろ', g: 'がぎぐげご', z: 'ざじずぜぞ',
  d: 'だぢづでど', b: 'ばびぶべぼ', p: 'ぱぴぷぺぽ',
}
for (const [consonant, kana] of Object.entries(rows)) {
  ;[...'aiueo'].forEach((vowel, index) => romaji.set(consonant + vowel, kana[index]))
}
const contracted: Record<string, string> = {
  ky: 'き', sh: 'し', sy: 'し', ch: 'ち', ty: 'ち', cy: 'ち', ny: 'に', hy: 'ひ', my: 'み',
  ry: 'り', gy: 'ぎ', j: 'じ', jy: 'じ', zy: 'じ', dy: 'ぢ', by: 'び', py: 'ぴ',
}
for (const [prefix, kana] of Object.entries(contracted)) {
  romaji.set(prefix + 'a', kana + 'ゃ')
  romaji.set(prefix + 'u', kana + 'ゅ')
  romaji.set(prefix + 'o', kana + 'ょ')
}
for (const [key, kana] of Object.entries({
  shi: 'し', chi: 'ち', tsu: 'つ', fu: 'ふ', ji: 'じ', she: 'しぇ', che: 'ちぇ', je: 'じぇ',
  ya: 'や', yu: 'ゆ', yo: 'よ', wa: 'わ', wo: 'を', fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ',
  vu: 'ゔ', va: 'ゔぁ', vi: 'ゔぃ', ve: 'ゔぇ', vo: 'ゔぉ', thi: 'てぃ', dhi: 'でぃ',
  xa: 'ぁ', xi: 'ぃ', xu: 'ぅ', xe: 'ぇ', xo: 'ぉ', la: 'ぁ', li: 'ぃ', lu: 'ぅ', le: 'ぇ', lo: 'ぉ',
  xya: 'ゃ', xyu: 'ゅ', xyo: 'ょ', lya: 'ゃ', lyu: 'ゅ', lyo: 'ょ', xtu: 'っ', ltu: 'っ', '-': 'ー',
})) romaji.set(key, kana)

/** Wāpuro-style romaji to hiragana; unconvertible letters (a trailing "n", "k"...) are kept. */
export function romajiToHiragana(input: string): string {
  const text = input.toLowerCase()
  let output = ''
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    const next = text[i + 1]
    if (ch === 'n' && next !== undefined && !'aiueoy'.includes(next)) {
      const afterDouble = text[i + 2]
      const consumeBoth = next === "'" || (next === 'n' && (afterDouble === undefined || !'aiueoy'.includes(afterDouble)))
      output += 'ん'
      i += consumeBoth ? 2 : 1
      continue
    }
    if (ch === next && /[bcdfghjkmpqrstvwxyz]/.test(ch)) {
      output += 'っ'
      i += 1
      continue
    }
    if (ch === 't' && text.startsWith('ch', i + 1)) {
      output += 'っ'
      i += 1
      continue
    }
    const length = [3, 2, 1].find((size) => romaji.has(text.slice(i, i + size)))
    if (length) {
      output += romaji.get(text.slice(i, i + length))
      i += length
    } else {
      output += ch
      i += 1
    }
  }
  return output
}

/** Normalised prefixes to search, kana conversions of romaji first. */
export function japaneseSearchKeys(input: string): string[] {
  const key = normalizeJapanese(input)
  if (!key) return []
  const keys: string[] = []
  if (/[a-z]/.test(key)) {
    const kana = romajiToHiragana(key)
    for (const candidate of [kana.replace(/n$/, 'ん'), kana, kana.replace(/[a-z']+$/, '')]) {
      if (candidate && candidate !== key && !/[a-z]/.test(candidate) && !keys.includes(candidate)) keys.push(candidate)
    }
  }
  keys.push(key)
  return keys
}

/** Exact keys for a lookup: "hon" means ほん, never the ほ prefix. */
export function japaneseLookupKeys(input: string): string[] {
  const key = normalizeJapanese(input)
  if (!key) return []
  const kana = romajiToHiragana(key).replace(/n$/, 'ん')
  return kana !== key && !/[a-z]/.test(kana) ? [kana, key] : [key]
}

const posLabels: [RegExp, string][] = [
  [/^n-suf$|^suf$/, 'Hậu tố'],
  [/^n-pref$|^pref$/, 'Tiền tố'],
  [/^n-pr$/, 'Danh từ riêng'],
  [/^num$/, 'Số từ'],
  [/^n/, 'Danh từ'],
  [/^vs/, 'Danh động từ (する)'],
  [/^v1/, 'Động từ nhóm 2'],
  [/^v5/, 'Động từ nhóm 1'],
  [/^vk$/, 'Động từ 来る'],
  [/^vz$/, 'Động từ -ずる'],
  [/^vt$/, 'Ngoại động từ'],
  [/^vi$/, 'Nội động từ'],
  [/^aux-v$/, 'Trợ động từ'],
  [/^v/, 'Động từ'],
  [/^adj-i/, 'Tính từ -i'],
  [/^adj-na$/, 'Tính từ -na'],
  [/^adj-no$/, 'Danh từ đi với の'],
  [/^adj-pn$/, 'Liên thể từ'],
  [/^adj/, 'Tính từ'],
  [/^adv/, 'Trạng từ'],
  [/^exp$/, 'Cụm từ'],
  [/^int$/, 'Thán từ'],
  [/^pn$/, 'Đại từ'],
  [/^prt$/, 'Trợ từ'],
  [/^conj$/, 'Liên từ'],
  [/^ctr$/, 'Trợ số từ'],
  [/^cop$/, 'Hệ từ'],
]

export function japanesePartOfSpeech(code: string): string {
  return posLabels.find(([pattern]) => pattern.test(code))?.[1] ?? code
}

const tagLabels: Record<string, string> = {
  uk: 'thường viết bằng kana', abbr: 'viết tắt', arch: 'cổ', rare: 'hiếm', obs: 'lỗi thời',
  col: 'khẩu ngữ', sl: 'tiếng lóng', 'net-sl': 'tiếng lóng mạng', hon: 'tôn kính ngữ',
  hum: 'khiêm nhường ngữ', pol: 'lịch sự', form: 'trang trọng', 'on-mim': 'từ tượng thanh/tượng hình',
  yoji: 'thành ngữ 4 chữ', id: 'thành ngữ', proverb: 'tục ngữ', derog: 'miệt thị', vulg: 'thô tục',
  joc: 'đùa', dated: 'cũ', hist: 'lịch sử',
}

export function japaneseTagLabel(tag: string): string | null {
  return tagLabels[tag] ?? null
}
