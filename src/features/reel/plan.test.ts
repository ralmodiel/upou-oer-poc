import { describe, expect, it } from 'vitest'
import { buildReelPlan, clampTitle, hookFrom, toLines, topicsOf } from './plan'
import { testVideo } from './testing'

describe('clampTitle', () => {
  it('keeps short titles and cuts long ones at a word boundary with an ellipsis', () => {
    expect(clampTitle('  Types  of Models ')).toBe('Types of Models')
    const long = clampTitle('alpha beta gamma delta '.repeat(20), 50)
    expect(long.length).toBeLessThanOrEqual(50)
    expect(long).toMatch(/^alpha beta gamma delta .* [a-z]+…$/)
  })
})

describe('hookFrom', () => {
  it('drops links and "In this video," and keeps abbreviations inside the hook', () => {
    expect(hookFrom('In this video, we explore https://example.com open data. More here.')).toBe(
      'We explore open data. More here.',
    )
    expect(hookFrom('Dr. Cruz explains it. Then more.')).toBe('Dr. Cruz explains it. Then more.')
    expect(hookFrom('   ')).toBe('')
  })

  it('ellipsizes long text at a word boundary', () => {
    const hook = hookFrom('word '.repeat(60))
    expect(hook.length).toBeLessThanOrEqual(110)
    expect(hook).toMatch(/ word…$/)
  })
})

describe('topicsOf', () => {
  it('skips generic tags, the category and series variants, shortest first', () => {
    const tags = [...testVideo.tags, 'Lecture', 'technology and teaching']
    expect(topicsOf({ ...testVideo, tags })).toEqual(['TechTips', 'Open Data', 'Statistics'])
  })
})

describe('toLines', () => {
  it('balances words across lines and respects the line cap', () => {
    expect(toLines(['Introduction', 'to', 'Data', 'Science'])).toEqual([
      ['Introduction', 'to'],
      ['Data', 'Science'],
    ])
    expect(toLines(['Solo'])).toEqual([['Solo']])
    const words = 'one two three four five six seven eight nine ten eleven twelve'.split(' ')
    expect(toLines(words, 4)).toHaveLength(4)
    expect(toLines(words, 7).flat()).toEqual(words)
  })
})

describe('buildReelPlan', () => {
  const still = (name: string) => `https://i.ytimg.com/vi/abcDEF12345/${name}.jpg`
  const vars = (style: object) => style as Record<string, string>

  it('reframes a repeated still: mirrored crop, reversed zoom, tighter', () => {
    const plan = buildReelPlan({
      ...testVideo,
      frames: ['maxres2', 'maxres3', 'maxres2'].map(still),
    })
    expect(plan.single).toBe(false)
    expect(plan.shots).toHaveLength(3)
    const [a, , b] = plan.shots.map((s) => vars(s.style))
    const x = (v: Record<string, string>) => parseFloat(v['--ko'])
    expect(x(a) + x(b)).toBeCloseTo(100, 1)
    expect(Math.sign(+a['--ks1'] - +a['--ks0'])).toBe(-Math.sign(+b['--ks1'] - +b['--ks0']))
    expect(Math.min(+b['--ks0'], +b['--ks1'])).toBeGreaterThan(Math.min(+a['--ks0'], +a['--ks1']))
  })

  it('gives one still a single long move, and a title card the split frame', () => {
    const one = buildReelPlan({ ...testVideo, frames: Array(3).fill(still('maxres3')) })
    expect(one.single).toBe(true)
    expect(one.shots).toHaveLength(1)
    expect(vars(one.shots[0].style)['--kb-ms']).toBe('7200ms')

    const cards = ['a', 'b', 'c', 'd', 'e', 'f'].map((c) =>
      buildReelPlan({
        ...testVideo,
        youtubeId: c.repeat(11),
        frames: Array(3).fill(still('maxresdefault')),
      }),
    )
    expect(cards.every((p) => p.single && p.template === 'split')).toBe(true)
  })

  it('times kinetic words so none passes or grows over another', () => {
    const kinetic = (title: string, motion: 'slam' | 'slide') => {
      for (const c of 'abcdefghijklmnopqrstuvwxyz') {
        const plan = buildReelPlan({ ...testVideo, title, youtubeId: c.repeat(11) })
        if (plan.template === 'kinetic' && plan.motion === motion) return plan
      }
      throw new Error('no kinetic plan')
    }
    const at = (style: object) => parseFloat(vars(style)['--w'])

    // Short titles go word by word; lines sliding in from the left lead with their last word.
    const slide = kinetic('Managing Sustainability Transitions Now', 'slide')
    expect(slide.unit).toBe('word')
    for (const line of slide.lines) {
      const times = line.words.map((w) => at(w.style))
      const fromLeft = +vars(line.style)['--from'] < 0
      expect(times).toEqual([...times].sort((p, q) => (fromLeft ? q - p : p - q)))
    }
    const slam = kinetic('Managing Sustainability Transitions Now', 'slam')
    const times = slam.lines.flatMap((l) => l.words.map((w) => at(w.style)))
    times.slice(1).forEach((t, i) => expect(t - times[i]).toBeGreaterThanOrEqual(240))

    // Long titles go a line at a time.
    const long = kinetic(
      'Special Session 7: Presidents’ Panel on the Future of Higher Education',
      'slam',
    )
    expect(long.unit).toBe('line')
    const starts = long.lines.map((l) => parseFloat(vars(l.style)['--lw']))
    starts.slice(1).forEach((t, i) => expect(t - starts[i]).toBeGreaterThanOrEqual(230))
  })
})
