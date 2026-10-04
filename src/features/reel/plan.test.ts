import { afterEach, describe, expect, it } from 'vitest'
import { setFrameCrops, setFrameFlags } from '../../data/frameFlags'
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

  it('gives one still a single long move, and shows a title card whole in any template', () => {
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
    expect(cards.every((p) => p.single && p.slides && p.shots[0].slide)).toBe(true)
    // Type never sits on the picture, so title cards and slides take every template.
    expect(new Set(cards.map((p) => p.template)).size).toBeGreaterThan(1)
  })

  it('shows slides whole, without zoom or pan (a sliver on 640px stills)', () => {
    const plan = buildReelPlan({
      ...testVideo,
      frames: ['maxres1', 'maxres2', 'maxres3'].map(still),
      slides: [true, false, true],
    })
    expect(plan.slides).toBe(true)
    expect(plan.shots.map((s) => s.slide)).toEqual([true, false, true])
    const [slide, photo] = plan.shots.map((s) => vars(s.style))
    expect(slide).toMatchObject({ '--ko': '50% 50%', '--ks0': 1, '--ks1': 1 })
    for (const k of ['--kx0', '--ky0', '--kx1', '--ky1']) expect(slide[k]).toBe('0%')
    // The photo between them keeps its Ken Burns move.
    expect(+photo['--ks0']).not.toBe(+photo['--ks1'])

    const sd = buildReelPlan({
      ...testVideo,
      frames: ['sd1', 'sd2', 'sd3'].map(still),
      slides: [true, true, true],
    })
    expect(sd.lowRes).toBe(true)
    for (const shot of sd.shots)
      expect(vars(shot.style)).toMatchObject({ '--ks0': 1.02, '--ks1': 1.02 })
  })

  it('gives one still a seeded slow push-in about the upper middle', () => {
    const plans = 'abcdefghijkl'.split('').map((c) =>
      buildReelPlan({
        ...testVideo,
        youtubeId: c.repeat(11),
        frames: Array(3).fill(still('maxres2')),
      }),
    )
    for (const plan of plans) {
      expect(plan.single).toBe(true)
      expect(plan.shots[0].slide).toBe(false)
      const v = vars(plan.shots[0].style)
      // Opens on the full frame, so the card image or loading cover it follows hands over cleanly.
      expect(v).toMatchObject({ '--ks0': 1, '--kx0': '0%', '--ky0': '0%' })
      const s1 = +v['--ks1']
      expect(s1).toBeGreaterThanOrEqual(1.1)
      expect(s1).toBeLessThanOrEqual(1.2)
      const [ox, oy] = v['--ko'].split(' ').map(parseFloat)
      expect(ox).toBeGreaterThanOrEqual(32)
      expect(ox).toBeLessThanOrEqual(68)
      expect(oy).toBeGreaterThanOrEqual(28)
      expect(oy).toBeLessThanOrEqual(46)
      // The drift stays within what the final scale leaves on either side: no edge shows.
      const kx = parseFloat(v['--kx1'])
      const ky = parseFloat(v['--ky1'])
      expect(kx).toBeLessThanOrEqual(ox * (s1 - 1) + 0.01)
      expect(-kx).toBeLessThanOrEqual((100 - ox) * (s1 - 1) + 0.01)
      expect(ky).toBeLessThanOrEqual(oy * (s1 - 1) + 0.01)
      expect(-ky).toBeLessThanOrEqual((100 - oy) * (s1 - 1) + 0.01)
    }
    // Seeded: the same video always moves the same way, different videos differently.
    const again = buildReelPlan({
      ...testVideo,
      youtubeId: 'a'.repeat(11),
      frames: Array(3).fill(still('maxres2')),
    })
    expect(again.shots[0].style).toEqual(plans[0].shots[0].style)
    expect(new Set(plans.map((p) => vars(p.shots[0].style)['--ko'])).size).toBe(plans.length)

    const sd = buildReelPlan({ ...testVideo, frames: Array(3).fill(still('sd2')) })
    const v = vars(sd.shots[0].style)
    expect(v['--ks0']).toBe(1.02)
    expect(+v['--ks1']).toBeGreaterThanOrEqual(1.12)
    expect(+v['--ks1']).toBeLessThanOrEqual(1.22)
  })

  describe('card previews of one still', () => {
    afterEach(() => (setFrameFlags({}), setFrameCrops({})))
    // A keep box in 16ths of the frame (frame-flags bits 25-41: x0, y0, x1 - 1, y1 - 1).
    const keep = ([x0, y0, x1, y1]: number[]) =>
      (1 + 2 * (x0 | (y0 << 4) | ((x1 - 1) << 8) | ((y1 - 1) << 12))) * 2 ** 25
    const planOf = (id: string, frame: string, box?: number[]) => {
      if (box) setFrameFlags({ [id]: keep(box) })
      return buildReelPlan({ ...testVideo, youtubeId: id, frames: Array(3).fill(still(frame)) })
    }
    // Where [a, b] lands at scale s about origin o, shifted by t (fractions of the frame).
    const land = (a: number, b: number, o: number, s: number, t: number) => [
      o + (a - o) * s + t,
      o + (b - o) * s + t,
    ]

    it('pushes in further about the faces, keeping them and the edges in view', () => {
      const box = [9, 2, 13, 7]
      const ids = 'abcdefghijkl'.split('').map((c) => c.repeat(11))
      for (const id of ids) {
        const v = vars(planOf(id, 'maxres2', box).shots[0].style)
        const s = +v['--pks1']
        expect(s).toBeGreaterThanOrEqual(1.18)
        expect(s).toBeLessThanOrEqual(1.26)
        expect(v['--pky1']).toBe('0%')
        const [ox, oy] = v['--pko'].split(' ').map((p) => parseFloat(p) / 100)
        const t = parseFloat(v['--pkx1']) / 100
        const [a, b] = [box[0] / 16, box[2] / 16]
        // The zoom alone, and the final state with the drift (the drift trails the zoom).
        for (const shift of [0, t]) {
          const [l, r] = land(a, b, ox, s, shift)
          expect(l).toBeGreaterThanOrEqual(-1e-3)
          expect(r).toBeLessThanOrEqual(1 + 1e-3)
          const [e0, e1] = land(0, 1, ox, s, shift)
          expect(e0).toBeLessThanOrEqual(1e-3)
          expect(e1).toBeGreaterThanOrEqual(1 - 1e-3)
        }
        const [top, bottom] = land(box[1] / 16, box[3] / 16, oy, s, 0)
        expect(top).toBeGreaterThanOrEqual(-1e-3)
        expect(bottom).toBeLessThanOrEqual(1 + 1e-3)
      }
      // Seeded drift, both ways across videos.
      const drifts = ids.map((id) =>
        parseFloat(vars(planOf(id, 'maxres2', box).shots[0].style)['--pkx1']),
      )
      expect(drifts.some((x) => x > 0) && drifts.some((x) => x < 0)).toBe(true)
    })

    it('moves a title card gently and without drift; a full-frame box or none keeps its move', () => {
      const card = vars(planOf('cardcardcar', 'maxresdefault', [2, 3, 14, 12]).shots[0].style)
      expect(card).toMatchObject({
        '--ks1': 1,
        '--pks1': '1.100',
        '--pkx1': '0.00%',
        '--pky1': '0%',
      })

      const wide = vars(planOf('widewidewid', 'maxres2', [0, 4, 16, 12]).shots[0].style)
      const none = vars(planOf('nonenonenon', 'maxres2').shots[0].style)
      for (const v of [wide, none])
        expect([v['--pko'], v['--pks1'], v['--pkx1'], v['--pky1']]).toEqual([
          v['--ko'],
          v['--ks1'],
          v['--kx1'],
          v['--ky1'],
        ])
      // Several stills: no card move at all.
      const three = buildReelPlan(testVideo)
      expect(three.shots.every((shot) => !('--pks1' in vars(shot.style)))).toBe(true)
    })

    it('reads the box through the crop zoom of the 320px still', () => {
      setFrameCrops({ zoomzoomzoo: [1, 1, 1.25] })
      const v = vars(planOf('zoomzoomzoo', 'maxres2', [6, 6, 10, 10]).shots[0].style)
      // Box [0.375, 0.625] → [0.34375, 0.65625] on screen: the push-in stays about the centre.
      expect(v['--pko']).toBe('50.00% 50.00%')
    })
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
