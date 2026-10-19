import assert from 'node:assert/strict'
import { test } from 'node:test'
import { groupSensesByPartOfSpeech, identifyPartOfSpeech } from '../src/utils/partOfSpeech.ts'

function sense(partOfSpeech, definition) {
  return { partOfSpeech, definition, source: 'fixture' }
}

test('normalizes POS aliases from multiple dictionaries', () => {
  for (const [raw, expected] of [
    ['N', 'noun'], ['n.', 'noun'], ['noun', 'noun'], ['N · countable', 'noun'],
    ['danh từ', 'noun'], ['V', 'verb'], ['v.t.', 'verb'],
    ['vi', 'verb'], ['verb', 'verb'], ['A', 'adjective'],
    ['adj.', 'adjective'], ['adjective', 'adjective'],
    ['D', 'adverb'], ['adv.', 'adverb'], ['adverb', 'adverb'],
    ['proper noun', 'properNoun'], ['phrasal verb', 'phrasalVerb'],
    ['idiom', 'idiom'], ['thành ngữ', 'idiom'], ['pron', 'pronoun'],
    ['prep', 'preposition'], ['conj', 'conjunction'],
    ['interj', 'interjection'], ['det', 'determiner'],
    ['prefix', 'prefix'], ['suffix', 'suffix'], ['abbreviation', 'abbreviation'],
    ['unexpected', 'other'], ['other', 'other'],
  ]) assert.equal(identifyPartOfSpeech(raw), expected, raw)
})

test('groups senses by POS while preserving meaning order inside each group', () => {
  const input = [
    sense('V', 'to operate'), sense('N', 'a journey'),
    sense('verb', 'to go'), sense('noun', 'a test'),
    sense('adj', 'fast'),
  ]
  const snapshot = JSON.stringify(input)
  const groups = groupSensesByPartOfSpeech(input, 'vi')
  assert.deepEqual(groups.map((g) => [g.key, g.label, g.senses.length]), [
    ['noun', 'Danh từ', 2],
    ['verb', 'Động từ', 2],
    ['adjective', 'Tính từ', 1],
  ])
  assert.deepEqual(groups[0].senses.map((s) => s.definition), ['a journey', 'a test'])
  assert.deepEqual(groups[1].senses.map((s) => s.definition), ['to operate', 'to go'])
  assert.equal(JSON.stringify(input), snapshot, 'Must not mutate original senses')
})

test('shows English POS headings and does not drop unknown sense types', () => {
  const groups = groupSensesByPartOfSpeech([
    sense('phrasal verb', 'to bring up'),
    sense('N', 'top of something'),
    sense('V', 'to move'),
    sense('other', 'unclassified'),
    sense('unknown-code', 'uncommon type'),
  ], 'en')
  assert.deepEqual(groups.map((g) => g.label), ['Noun', 'Verb', 'Phrasal verb', 'Other'])
  assert.equal(groups.at(-1).senses.length, 2)
})

test('empty dictionary returns no groups', () => {
  assert.deepEqual(groupSensesByPartOfSpeech([], 'vi'), [])
})
