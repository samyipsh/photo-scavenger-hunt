import { describe, expect, it } from 'vitest'
import { likelyFix, likelyMisspelling, nameCloseness, rankNames, spotAnimals, spotItFor } from '../app/utils/animalNames'

const spots = spotAnimals([
  { id: 'hornbill', title: 'Hornbill', type: 'spot', points: 50, animal: 'hornbill' },
  { id: 'pigeon', title: 'Pigeon or dove', type: 'spot', points: 20, animal: 'pigeon' },
  { id: 'swan', title: 'Swan', type: 'spot', points: 50, animal: 'swan' },
  { id: 'monitor-lizard', title: 'Monitor lizard', type: 'spot', points: 30, animal: 'monitor lizard' },
  { id: 'orchid', title: 'Orchid', type: 'spot', points: 30 },
  { id: 'animals', title: 'Animals spotted', type: 'award', points: 0 },
])

describe('nameCloseness', () => {
  it('ranks the same name, then a start, then one letter off, then a longer name holding it', () => {
    expect(nameCloseness('Hornbill', 'hornbill')).toBe(0)
    expect(nameCloseness('horn', 'hornbill')).toBe(1)
    expect(nameCloseness('liz', 'monitor lizard')).toBe(1)
    expect(nameCloseness('squirel', 'squirrel')).toBe(2)
    expect(nameCloseness('kingfisj', 'kingfisher')).toBe(2)
    expect(nameCloseness('black swan', 'swan')).toBe(3)
    expect(nameCloseness('otter', 'heron')).toBeNull()
  })
})

describe('rankNames', () => {
  const names = ['swan', 'hornbill', 'heron', 'squirrel']
  it('puts the nearest first and leaves out the rest', () => {
    expect(rankNames('hornbil', names, n => [n])).toEqual(['hornbill'])
    expect(rankNames('h', names, n => [n])).toEqual(names)
    expect(rankNames('he', names, n => [n])).toEqual(['heron'])
  })
})

describe('spotItFor', () => {
  it('finds the Spot it challenge a name means', () => {
    expect(spotItFor('Hornbill', spots)?.id).toBe('hornbill')
    expect(spotItFor('hornbil', spots)?.id).toBe('hornbill')
    expect(spotItFor('Dove', spots)?.id).toBe('pigeon')
    expect(spotItFor('Black swan', spots)?.id).toBe('swan')
    expect(spotItFor('Monitor lizards', spots)?.id).toBe('monitor-lizard')
    expect(spotItFor('Kingfisher', spots)).toBeNull()
  })
  it('only knows Spot it animals', () => {
    expect(spots.map(s => s.id)).toEqual(['hornbill', 'pigeon', 'swan', 'monitor-lizard'])
  })
})

describe('misspellings', () => {
  const known = ['hornbill', 'squirrel', 'swan']
  it('spots a name one letter off a known one', () => {
    expect(likelyMisspelling('Hornbil', known)).toBe(true)
    expect(likelyMisspelling('hornbill', known)).toBe(false)
    expect(likelyMisspelling('heron', known)).toBe(false)
  })
  it('suggests the known name it was meant to be', () => {
    expect(likelyFix('hornbil', known)).toBe('hornbill')
    expect(likelyFix('Squirel', known)).toBe('squirrel')
    expect(likelyFix('squirrel', known)).toBeNull()
    expect(likelyFix('black swan', known)).toBeNull()
  })
})
