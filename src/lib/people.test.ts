import { beforeAll, describe, expect, it } from 'vitest'
import { isGenericTag, isNameToken, isPersonTag, registerNameTokens, topicTags } from './tags'

describe('person tags', () => {
  beforeAll(() =>
    registerNameTokens(['Dr. Myra Oruga', 'aProf. Benjamin Gonzales', 'Ms. Nally Rapada']),
  )

  it('recognises titled, suffixed and initialled names', () => {
    for (const tag of [
      'Dr. Myra Oruga',
      'aProf. Benjamin Gonzales',
      'Ms. Nally Rapada',
      'Atty. Jose Rizal',
      'Juan dela Cruz Jr.',
      'Maricel A. Tapia-Villamayor',
      'Sir Lex Librero',
    ])
      expect(isPersonTag(tag), tag).toBe(true)
  })

  it('recognises learned names without a title', () => {
    expect(isPersonTag('Myra Oruga')).toBe(true)
    expect(isPersonTag('Benjamin Gonzales')).toBe(true)
  })

  it('keeps topics and places', () => {
    for (const tag of [
      'Climate Change',
      'Cagayan Valley',
      'Public Health',
      'Sikolohiyang Pilipino',
      'Open Education',
      'FASTLearn',
      'Region II',
      'Module III',
    ])
      expect(isPersonTag(tag), tag).toBe(false)
  })

  it('drops people from topic chips everywhere', () => {
    expect(isGenericTag('Dr. Myra Oruga')).toBe(true)
    expect(topicTags(['Climate Change', 'Dr. Myra Oruga', 'Myra Oruga', 'Research'])).toEqual([
      'Climate Change',
      'Research',
    ])
  })
})

describe('learned name tokens', () => {
  beforeAll(() =>
    registerNameTokens([
      'Dr. Ma. Cristina D. Padolina',
      'Mr. Noel Rosal,',
      'Director Multi Media Center and Information Service UP Open University',
    ]),
  )

  it('knows first and last names, whatever their case or punctuation', () => {
    for (const word of ['Padolina', 'cristina', 'Rosal', 'noel'])
      expect(isNameToken(word), word).toBe(true)
    expect(isPersonTag('Ma. Cristina Padolina')).toBe(true)
  })

  it('learns nothing from a titled office', () => {
    for (const word of ['media', 'information', 'open', 'university']) {
      expect(isNameToken(word), word).toBe(false)
    }
    expect(isPersonTag('Open University')).toBe(false)
  })
})

describe('names from the catalog', () => {
  beforeAll(() =>
    registerNameTokens(() => [
      { tags: ['Dr. Grace Javier Alfonso', 'Mayor Noel E. Rosal', 'Climate Change'] },
      { tags: ['Elvira N. Baura', 'Jose Butch Dalisay Jr.', 'MS Excel'], title: 'Panel' },
      { tags: ['Rice Terraces'], title: 'Rice Terraces Today | Dr. Agnes Rola' },
      { tags: ['felix librero', 'devcom'], title: 'FICS Chat with Sir Lex Librero | Episode 6' },
      { tags: [], title: 'Assessment | Ms. Ana Katrina T. Marcial' },
    ]),
  )

  it('knows more titles, credited speakers and unmistakable names', () => {
    for (const tag of [
      'Mayor Noel E. Rosal',
      'Ambassador Noel Servigon',
      'Assistant Professor Jonathan Cagas',
      'Kat. Prop. Crizel Sicat-De Laza',
      'Gen. Antonio Luna',
      'Agnes Rola',
      'Grace Barretto-Tesoro',
      'Elvira Baura',
      'Butch Dalisay',
      'felix librero',
      'ana katrina marcial',
    ])
      expect(isPersonTag(tag), tag).toBe(true)
  })

  it('keeps acronyms, shouting and topics that are not names', () => {
    for (const tag of [
      'PRAYERS N FAITH',
      'Landing A Job',
      'MS Excel',
      'AR Technology',
      'Gen Z',
      'Sec 3',
      'Climate Change',
      'Rice Terraces',
      'Juvenile Justice',
      'La Nina',
      'devcom',
      'Agnes',
    ])
      expect(isPersonTag(tag), tag).toBe(false)
  })

  it('keeps titles, instalment labels and tags naming a person out of the topics', () => {
    for (const tag of [
      'An Interview with Dr. Judy Taguiwalo',
      'Ethics in Social Science Research | Dr. Meita Dhamayanti',
      'Vice Chancellor for Academic Affairs',
      'Flexible Learning: An Overview',
      'How to Organize and Autofill Messy Data in Excel',
      'FASTLearn Episode 62',
      'Tech Tips 33',
      'Conference E-Proceedings',
    ])
      expect(isGenericTag(tag), tag).toBe(true)
    for (const tag of ['Doctor of Communication', 'RA 10650', 'COVID-19', 'ISEAC 2023'])
      expect(isGenericTag(tag), tag).toBe(false)
  })

  it('reads the catalog only when first asked, and again after it changes', () => {
    let reads = 0
    registerNameTokens(() => {
      reads++
      return [{ tags: ['Dr. Myra Oruga'] }]
    })
    expect(reads).toBe(0)
    expect(isPersonTag('Myra Oruga')).toBe(true)
    expect(isNameToken('oruga')).toBe(true)
    expect(reads).toBe(1)
    registerNameTokens(['Dr. Nally Rapada'])
    expect(isPersonTag('Myra Oruga')).toBe(false)
    expect(isPersonTag('Nally Rapada')).toBe(true)
  })
})

describe('names without a title anywhere', () => {
  beforeAll(() =>
    registerNameTokens(() => [
      {
        tags: ['claudio', 'gender', 'concepts'],
        title: 'Gender and Multimedia | An Interview with Dr Sylvia Estrada-Claudio',
      },
      { tags: ['estrada', 'claudio'], title: 'UPOU Orientation' },
    ]),
  )

  it('knows the curated people, whatever their case', () => {
    for (const tag of ['jelaine bagos', 'Apolonio Chua', 'Christian Monsod'])
      expect(isPersonTag(tag), tag).toBe(true)
    expect(isPersonTag('Christian Ethics')).toBe(false)
  })

  it('treats a lone surname as a person when its video credits it', () => {
    expect(isPersonTag('claudio')).toBe(true)
    expect(isPersonTag('Claudio')).toBe(true)
    expect(isNameToken('claudio')).toBe(true)
    // Half of the compound surname, but no video credits it as a tag of its own.
    expect(isPersonTag('estrada')).toBe(false)
    expect(topicTags(['claudio', 'gender', 'concepts', 'interview'])).toEqual(['Gender'])
  })
})
