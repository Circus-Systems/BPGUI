import type { ReactNode } from "react";

export function SlideShell({
  number,
  title,
  subtitle,
  children,
}: {
  number: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="brief-slide break-after-page bg-white rounded-lg border border-border p-8 mb-6 shadow-sm print:shadow-none print:border-0 print:rounded-none print:mb-0 print:p-12 print:min-h-[210mm]">
      <header className="mb-6 border-b border-border pb-3">
        <div className="text-xs uppercase tracking-wider text-muted">
          Slide {number}
        </div>
        <h2 className="text-xl font-semibold text-foreground mt-1">{title}</h2>
        {subtitle && (
          <p className="text-sm text-muted mt-1">{subtitle}</p>
        )}
      </header>
      {children}
    </section>
  );
}
