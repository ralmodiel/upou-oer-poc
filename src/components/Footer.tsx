import type { ReactNode } from 'react'
import { useHelp } from '../lib/howitworks'
import { openPrivacy } from '../lib/privacy'
import { openShortcuts } from '../lib/shortcuts'

// The footer is a deep maroon band: paper text, gold on hover and for headings (band-focus turns
// the focus ring gold too).
const LINK =
  'rounded-sm text-on-band underline decoration-on-band/40 underline-offset-4 transition-colors hover:text-band-gold hover:decoration-band-gold'
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
    <footer className="mt-16 bg-band-maroon text-sm text-on-band band-focus">
      <div className="grid gap-10 px-(--gutter) py-12 md:grid-cols-3 md:gap-8">
        <section aria-labelledby="footer-about">
          <h2 id="footer-about" className={HEADING}>
            Proof of concept
          </h2>
          <p className="mt-3 leading-relaxed text-on-band/90">{DISCLAIMER}</p>
          <p className="mt-3 leading-relaxed text-on-band/75">
            It is not affiliated with, endorsed by, or intended to imitate the design of any
            commercial streaming service.
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
      <div className="flex flex-col gap-2 border-t border-on-band/15 px-(--gutter) py-5 text-xs text-on-band/75 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-display text-lg leading-none text-on-band">
          UPOU <span className="text-band-gold">OER</span>
        </p>
        <p>
          Open Educational Resources from UP Open University · a proof of concept, not a product.
        </p>
      </div>
    </footer>
  )
}
