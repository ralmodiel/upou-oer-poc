import type { ReactNode } from 'react'
import { useHelp } from '../lib/howitworks'
import { openPrivacy } from '../lib/privacy'
import { openShortcuts } from '../lib/shortcuts'

// The footer is a deep maroon band: paper text, gold headings. Links turn to a glass pill on hover
// and focus (white at 8% with a light rim, a ::before 8px wider each side, so nothing moves) and
// their underline goes gold; paper text keeps 7.8:1 on the pill where gold would fall near 4:1 under
// the band's light corner in dark. The pill carries the gold focus ring and glow (band-focus).
const LINK =
  'relative isolate text-on-band underline decoration-on-band/40 underline-offset-4 outline-none transition-[text-decoration-color] before:absolute before:-inset-x-2 before:inset-y-1.5 before:-z-10 before:rounded-pill before:bg-white/8 before:opacity-0 before:shadow-[inset_0_1px_0_rgb(255_255_255/0.16),0_0_0_1px_rgb(255_255_255/0.1),0_8px_20px_-10px_rgb(0_0_0/0.5)] before:transition-opacity hover:decoration-band-gold hover:before:opacity-100 focus-visible:decoration-band-gold focus-visible:before:opacity-100 focus-visible:before:shadow-[inset_0_1px_0_rgb(255_255_255/0.16),0_0_0_1px_rgb(255_255_255/0.1),0_0_14px_2px_var(--color-glow),0_0_40px_8px_var(--color-glow-soft)] focus-visible:before:outline-2 focus-visible:before:outline-offset-2 focus-visible:before:outline-band-gold focus-visible:before:transition-none'
const HEADING = 'text-xs font-semibold tracking-[0.08em] text-band-gold uppercase'
// List items: the same look with a 40px tall hit area.
const ITEM = `${LINK} -my-2.5 inline-block py-2.5`
const ACTION = `${ITEM} cursor-pointer text-left`

// Only a real https URL becomes a link.
const REPO_RAW = import.meta.env.VITE_REPO_URL as string | undefined
const REPO_URL = /^https:\/\/\S+$/.test(REPO_RAW ?? '') ? REPO_RAW : undefined
const LICENSES_URL = `${import.meta.env.BASE_URL}THIRD_PARTY_LICENSES.txt`

// First paragraph of NOTICE.md, verbatim.
const DISCLAIMER =
  "This project is a temporary, non-commercial proof of concept built to explore UPOU's open educational videos. It is not a product or service, it is not monetized, and it is expected to be taken down shortly after publication."

function External({
  href,
  children,
  className = ITEM,
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  )
}

export default function Footer() {
  // Re-opens the "How it works" strip at the top of the home page, focus on its heading.
  const help = useHelp()

  return (
    <footer className="mt-16 bg-band-maroon bg-(image:--gradient-band) text-sm text-on-band shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] band-focus">
      <div className="grid gap-10 px-(--gutter) py-12 md:grid-cols-3 md:gap-8">
        <section aria-labelledby="footer-about">
          <h2 id="footer-about" className={HEADING}>
            Proof of concept
          </h2>
          <p className="mt-3 leading-relaxed text-on-band/90">{DISCLAIMER}</p>
          <p className="mt-3 leading-relaxed text-on-band/75">
            It is an independent project, not affiliated with or endorsed by UP Open University, and
            not intended to imitate the design of any commercial streaming service.
          </p>
        </section>
        <section aria-labelledby="footer-source">
          <h2 id="footer-source" className={HEADING}>
            Source
          </h2>
          <ul className="mt-3 space-y-2.5">
            <li>
              <External href="https://oer.upou.edu.ph/videos/">
                oer.upou.edu.ph (UP Open University)
              </External>
            </li>
            <li>
              <External href="https://www.youtube.com/@UPOpenUniversityNetworks">
                YouTube channel
              </External>
            </li>
            <li className="leading-relaxed text-on-band/75">
              Videos © UP Open University, shared under{' '}
              <External href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</External>{' '}
              unless stated otherwise.
            </li>
          </ul>
        </section>
        <section aria-labelledby="footer-project">
          <h2 id="footer-project" className={HEADING}>
            Project
          </h2>
          <ul className="mt-3 space-y-2.5">
            <li className="text-on-band/75">Code: MIT License</li>
            <li>
              <a href={LICENSES_URL} className={ITEM}>
                Third-party licenses
              </a>
            </li>
            {REPO_URL && (
              <li>
                <External href={REPO_URL}>View source</External>
              </li>
            )}
            <li>
              <button type="button" onClick={help} className={ACTION}>
                Help: how it works
              </button>
            </li>
            <li>
              <button type="button" onClick={openShortcuts} className={ACTION}>
                Keyboard shortcuts
              </button>
            </li>
            <li>
              <button type="button" onClick={openPrivacy} className={ACTION}>
                Privacy and history
              </button>
            </li>
          </ul>
        </section>
      </div>
      <div className="flex flex-col gap-2 border-t border-on-band/15 bg-black/10 px-(--gutter) py-5 text-xs text-on-band/75 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-display text-lg leading-none text-on-band">
          UPOU <span className="text-band-gold">OER</span>
        </p>
        <p>
          Open Educational Resources from UP Open University · an independent proof of concept, not
          a product.
        </p>
      </div>
    </footer>
  )
}
