import type { ReactNode } from 'react'

interface Props {
  icon?: ReactNode
  title: string
  children?: ReactNode
  action?: ReactNode
}

export default function EmptyState({ icon, title, children, action }: Props) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center sm:py-24">
      {icon && (
        <div className="mb-5 grid size-16 place-items-center rounded-full bg-ink-800 text-brand-400 ring-1 ring-white/10">
          {icon}
        </div>
      )}
      <h2 className="text-xl font-bold text-white sm:text-2xl">{title}</h2>
      {children && (
        <div className="mt-2 text-sm leading-relaxed text-neutral-400 sm:text-base">{children}</div>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
