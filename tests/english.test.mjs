import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import { englishChunk, normaliseEnglish } from '../src/utils/english.ts'
import { similarEnglish, similarJapanese, suggestEnglish, suggestJapanese } from '../src/utils/prefixSearch.ts'

const samples = ['Example', '  New   York ', 'ﬁnance', 'Ǆungla', 'İstanbul', 'ＡＢＣ', 'x-ray', 'a', "'twas", '3d', 'Ω', 'ᴮoat']

test('normalisation and chunking match the Python importer', () => {
  const script = [
    'import json, sys',
    "sys.path.insert(0, 'scripts')",
    'from build_dictionary import normalize, shard_key',
    'words = json.loads(sys.argv[1])',
    'print(json.dumps([[normalize(w), shard_key(normalize(w))] for w in words], ensure_ascii=False))',
  ].join('\n')
  const python = JSON.parse(execFileSync('python3', ['-c', script, JSON.stringify(samples)], { encoding: 'utf8' }))
  assert.deepEqual(samples.map((word) => {
    const key = normaliseEnglish(word)
    return [key, englishChunk(key, 'prefix2')]
  }), python)
})

test('English suggestions are prefix matches in index order', () => {
  const words = ['ex', 'example', 'excellent', 'except', 'exit', 'fox']
  assert.deepEqual(suggestEnglish(words, 'EXC'), ['excellent', 'except'])
  assert.deepEqual(suggestEnglish(words, 'ex', 3), ['ex', 'example', 'excellent'])
  assert.deepEqual(suggestEnglish(words, 'zz'), [])
  assert.deepEqual(suggestEnglish(words, '   '), [])
})

test('misspellings suggest the closest words sharing the first letter', () => {
  const words = ['receipt', 'receive', 'received', 'recipe', 'relieve', 'sieve']
  // One edit (a swap counts as one) ranks before two; ties keep index order.
  assert.deepEqual(similarEnglish(words, 'recieve'), ['receive', 'relieve', 'received', 'recipe'])
  assert.deepEqual(similarEnglish(words, 'recieve', 1), ['receive'])
  assert.deepEqual(similarEnglish(words, 'zzzz'), [])
  assert.deepEqual(similarEnglish(words, 'r'), [])
})

test('Japanese close matches share the longest known prefix', () => {
  const words = ['たべもの', 'たべる', 'のむ']
  assert.deepEqual(similarJapanese(words, 'たべた'), ['たべもの', 'たべる'])
  assert.deepEqual(similarJapanese(words, 'ねる'), [])
})

test('Japanese suggestions search kana conversions of romaji first', () => {
  const words = ['たべもの', 'タベル', '食べる']
  assert.deepEqual(suggestJapanese(words, 'tabe'), ['たべもの', 'タベル'])
  assert.deepEqual(suggestJapanese(words, '食'), ['食べる'])
})
