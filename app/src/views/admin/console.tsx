import { cn } from "@passbox/ui";
import type { ReactNode } from "react";

/**
 * Building blocks of the two admin consoles (the server's administration and
 * an organization's admin console): a page header with an eyebrow and a
 * large title, panels with an icon tile, and the frame that holds the
 * section navigation next to the content. Dense but calm: hairline borders,
 * 20 px cards, tabular numbers.
 */

export function ConsoleHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 text-overline text-text-subtle uppercase">{eyebrow}</p>}
        <h1 className="text-title text-text">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A titled surface for one area of a console. Children are separated by hairlines. */
export function ConsolePanel({
  id,
  icon,
  title,
  description,
  actions,
  children,
  className,
}: {
  id?: string;
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const titleId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={cn(
        "scroll-mt-6 overflow-hidden rounded-card border border-hairline bg-surface shadow-card",
        className,
      )}
    >
      <header className="flex flex-wrap items-start gap-3 border-b border-hairline px-5 py-4">
        {icon && (
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-accent [&_svg]:size-[18px]"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-[0.9375rem] font-semibold text-text">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-[0.8125rem] text-text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className="divide-y divide-hairline">{children}</div>
    </section>
  );
}

/** The console frame: a section navigation (wide screens) next to the scrolling content. */
export function ConsoleFrame({
  label,
  nav,
  top,
  children,
}: {
  /** Accessible name of the whole console. */
  label: string;
  /** The `<nav>` for wide screens. */
  nav: ReactNode;
  /** Shown above the content on narrow screens (a section picker). */
  top?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={label} className="flex min-w-0 flex-1 overflow-hidden bg-canvas">
      {nav}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {top}
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10">{children}</div>
      </div>
    </section>
  );
}

/** The sidebar of a console: a heading block and the section items. */
export function ConsoleNav({
  label,
  heading,
  children,
  footer,
}: {
  label: string;
  heading: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <nav
      aria-label={label}
      className="hidden w-60 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-hairline bg-surface px-3 py-5 md:flex"
    >
      <div className="mb-4">{heading}</div>
      {children}
      {footer && <div className="mt-auto border-t border-hairline px-1 pt-3">{footer}</div>}
    </nav>
  );
}

/** Identity block at the top of a console sidebar: a tile, a name, a caption. */
export function ConsoleIdentity({ tile, name, caption }: { tile: ReactNode; name: string; caption: string }) {
  return (
    <div className="flex items-center gap-3 rounded-control border border-hairline bg-surface-raised px-3 py-2.5">
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-signature text-solar shadow-highlight [&_svg]:size-4"
      >
        {tile}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[0.8125rem] font-semibold text-text" title={name}>
          {name}
        </p>
        <p className="truncate text-xs text-text-muted">{caption}</p>
      </div>
    </div>
  );
}

/** A grid of `StatTile`s. */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>{children}</div>;
}
