import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  // Buttons on the right (they wrap below the title on phones).
  actions?: ReactNode;
  // A small "back to" link above the title.
  back?: { href: string; label: string };
  // Anything that belongs under the title (badges, meta).
  children?: ReactNode;
};

// Every page starts the same way: a back link if it's a sub-page, the title,
// one line saying what the page is for, and the page's actions on the right.
export function PageHeader({ title, description, actions, back, children }: PageHeaderProps) {
  return (
    <div className="mb-6 sm:mb-8">
      {back && (
        <Link
          href={back.href}
          className="group mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-100"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-100">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-500">{description}</p>}
          {children}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

// The standard width and padding for a page's content.
export function PageContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main className={`mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10 ${className}`}>{children}</main>;
}