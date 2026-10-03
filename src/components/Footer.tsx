import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useHowItWorks } from '../lib/howitworks'
import { openShortcuts } from '../lib/shortcuts'

const LINK =
  'rounded-sm text-ink-2 underline decoration-line underline-offset-4 transition-colors hover:text-maroon hover:decoration-maroon'
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
  const { show } = useHowItWorks()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Re-opens the "How it works" strip at the top of the home page.
  const help = () => {
    show()
    void navigate('/', { replace: pathname === '/' })
    window.scrollTo({ top: 0 })
  }

  return (
    <footer className="mt-16 border-t border-line bg-surface text-sm">
      <div className="grid gap-10 px-(--gutter) py-12 md:grid-cols-3 md:gap-8">
        <section aria-labelledby="footer-about">
          <h2 id="footer-about" className="eyebrow">
            Proof of concept
          </h2>
          <p className="mt-3 leading-relaxed text-ink-2">{DISCLAIMER}</p>
          <p className="mt-3 leading-relaxed text-ink-3">
            It is not affiliated with, endorsed by, or intended to imitate the design of any
            commercial streaming service.
          </p>
        </section>
        <section aria-labelledby="footer-source">
          <h2 id="footer-source" className="eyebrow">
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
            <li className="leading-relaxed text-ink-3">
              Videos © UP Open University, shared under{' '}
              <External href="https://creativecommons.org/licenses/by/4.0/" className={LINK}>
                CC BY 4.0
              </External>{' '}
              unless stated otherwise.
            </li>
          </ul>
        </section>
        <section aria-labelledby="footer-project">
          <h2 id="footer-project" className="eyebrow">
            Project
          </h2>
          <ul className="mt-3 space-y-2.5">
            <li className="text-ink-3">Code: MIT License</li>
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
          </ul>
        </section>
      </div>
      <div className="flex flex-col gap-2 border-t border-line px-(--gutter) py-5 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-display text-lg leading-none text-ink">
          UPOU <span className="text-maroon">OER</span>
        </p>
        <p>
          Open Educational Resources from UP Open University · a proof of concept, not a product.
        </p>
      </div>
    </footer>
  )
}
