import type { ReactNode } from "react";

/**
 * A full-width page of the vault app (settings, generator, security check,
 * sharing, developer tools, …): an optional eyebrow, a large title, a short
 * description and the page's actions, above cards on the app canvas. The
 * same anatomy as the admin consoles (views/admin/console.tsx).
 */
export function Page({
  title,
  eyebrow,
  description,
  actions,
  width = "default",
  children,
}: {
  title: string;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** `wide` for dashboards (the security check). */
  width?: "default" | "wide";
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div
        className={`mx-auto w-full px-4 pt-8 pb-16 sm:px-6 lg:px-10 lg:pt-10 ${width === "wide" ? "max-w-5xl" : "max-w-4xl"}`}
      >
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && <p className="mb-2 text-overline text-accent uppercase">{eyebrow}</p>}
            <h1 className="text-title text-text">{title}</h1>
            {description && <p className="mt-2 max-w-2xl text-body text-text-muted">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
        {children}
      </div>
    </section>
  );
}

/** A titled card on a page; rows inside are separated by hairlines. */
export function Panel({
  id,
  title,
  description,
  icon,
  actions,
  children,
}: {
  id?: string;
  title: string;
  description?: ReactNode;
  /** A Lucide icon, shown in an accent tile next to the title. */
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className="scroll-mt-6 overflow-hidden rounded-card border border-hairline bg-surface shadow-card"
    >
      <header className="flex items-start gap-3 border-b border-hairline px-5 py-4">
        {icon && (
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-accent [&_svg]:size-[18px]"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 id={id ? `${id}-title` : undefined} className="text-[0.9375rem] font-semibold text-text">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-body-sm text-text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className="divide-y divide-hairline">{children}</div>
    </section>
  );
}
