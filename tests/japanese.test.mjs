import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import {
  japaneseLookupKeys, japanesePartOfSpeech, japaneseSearchKeys, japaneseShard, normalizeJapanese, romajiToHiragana,
} from '../src/utils/japanese.ts'

const samples = ['食べる', 'タベル', 'ｺﾝﾋﾟｭｰﾀｰ', 'ＣＤプレイヤー', '𠮟る', '  あ・うんの呼吸 ', 'ヴァイオリン']

test('normalisation and sharding match the Python importer', () => {
  const script = [
    'import json, sys',
    "sys.path.insert(0, 'scripts')",
    'from build_japanese import normalize, shard_of',
    'words = json.loads(sys.argv[1])',
    'print(json.dumps([[normalize(w), shard_of(normalize(w))] for w in words], ensure_ascii=False))',
  ].join('\n')
  const python = JSON.parse(execFileSync('python3', ['-c', script, JSON.stringify(samples)], { encoding: 'utf8' }))
  assert.deepEqual(samples.map((word) => {
    const key = normalizeJapanese(word)
    return [key, japaneseShard(key, 256)]
  }), python)
})

test('katakana and half-width forms share hiragana keys', () => {
  assert.equal(normalizeJapanese('タベル'), 'たべる')
  assert.equal(normalizeJapanese('ｺﾝﾋﾟｭｰﾀｰ'), 'こんぴゅーたー')
  assert.equal(normalizeJapanese('ＣＤプレイヤー'), 'cdぷれいやー')
})

test('converts common romaji spellings to hiragana', () => {
  for (const [input, expected] of [
    ['taberu', 'たべる'], ['sensei', 'せんせい'], ['konnichiha', 'こんにちは'], ['konna', 'こんな'],
    ['kitte', 'きって'], ['matcha', 'まっちゃ'], ['shashinka', 'しゃしんか'], ['tsukue', 'つくえ'],
    ['kyou', 'きょう'], ['jinja', 'じんじゃ'], ["kon'ya", 'こんや'], ['ra-menka', 'らーめんか'], ['konnyaku', 'こんにゃく'],
    ['fujiyama', 'ふじやま'], ['hon', 'ほn'],
  ]) assert.equal(romajiToHiragana(input), expected, input)
})

test('search keys try kana before the raw romaji prefix', () => {
  assert.deepEqual(japaneseSearchKeys('hon'), ['ほん', 'ほ', 'hon'])
  assert.deepEqual(japaneseSearchKeys('tabe'), ['たべ', 'tabe'])
  assert.deepEqual(japaneseSearchKeys('食べ'), ['食べ'])
  assert.deepEqual(japaneseSearchKeys('  '), [])
})

test('lookup keys are exact conversions only', () => {
  assert.deepEqual(japaneseLookupKeys('hon'), ['ほん', 'hon'])
  assert.deepEqual(japaneseLookupKeys('タベル'), ['たべる'])
  assert.deepEqual(japaneseLookupKeys('cd'), ['cd'])
})

test('labels JMdict parts of speech in Vietnamese', () => {
  assert.equal(japanesePartOfSpeech('n'), 'Danh từ')
  assert.equal(japanesePartOfSpeech('num'), 'Số từ')
  assert.equal(japanesePartOfSpeech('v5k'), 'Động từ nhóm 1')
  assert.equal(japanesePartOfSpeech('v1'), 'Động từ nhóm 2')
  assert.equal(japanesePartOfSpeech('adj-i'), 'Tính từ -i')
  assert.equal(japanesePartOfSpeech('vs-i'), 'Danh động từ (する)')
  assert.equal(japanesePartOfSpeech('unknown-code'), 'unknown-code')
})
