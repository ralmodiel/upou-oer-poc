const LINK =
  'text-neutral-300 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white hover:decoration-brand-400'

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-white/5 px-(--gutter) py-10 text-sm text-neutral-400">
      <p className="mb-6 max-w-3xl leading-relaxed text-neutral-300">
        Proof of concept — a temporary, non-commercial demo built to explore UPOU&apos;s open
        educational videos. It is not a product or service and will be taken down shortly. It is not
        affiliated with, endorsed by, or intended to imitate the design of any commercial streaming
        service.
      </p>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="shrink-0 leading-none font-black tracking-tighter uppercase">
          <span className="text-brand-500">UPOU</span>{' '}
          <span className="text-neutral-300">Networks</span>
        </p>
        <p className="leading-relaxed">
          Videos © UP Open University · Content from{' '}
          <a
            href="https://oer.upou.edu.ph/videos/"
            target="_blank"
            rel="noopener noreferrer"
            className={LINK}
          >
            UPOU Networks (oer.upou.edu.ph)
          </a>{' '}
          · Streamed via{' '}
          <a
            href="https://www.youtube.com/@UPOpenUniversityNetworks"
            target="_blank"
            rel="noopener noreferrer"
            className={LINK}
          >
            YouTube
          </a>
        </p>
      </div>
    </footer>
  )
}
