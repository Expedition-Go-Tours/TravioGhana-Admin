import type { ReactNode } from "react";
import { LifeBuoy, Lock, ShieldCheck } from "lucide-react";
import travioWordmark from "@/assets/travio-ghana-wordmark.png";
import travioWordmarkDark from "@/assets/travio-ghana-wordmark-on-dark.png";

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Small text under the form column, e.g. a link back to the public site. */
  footer?: ReactNode;
  /** Headline on the brand panel. Defaults to the product name, not the form title. */
  panelTitle?: string;
}

const FACTS = [
  { icon: ShieldCheck, text: "Restricted to Travio Ghana staff" },
  { icon: Lock, text: "Sign-in activity is logged and reviewed" },
  { icon: LifeBuoy, text: "Locked out? Contact your administrator" },
];

/**
 * Two-column auth surface: a branded, security-aware panel on the left and the
 * form on the right. Below `lg` the panel collapses to the wordmark above the
 * form, so the page stays a single column on phones and tablets.
 */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
  panelTitle = "Travio Ghana admin console",
}: AuthShellProps) {
  return (
    <div className="min-h-[100dvh] bg-surface-muted lg:grid lg:grid-cols-[minmax(0,46%)_minmax(0,1fr)]">
      {/* Brand + security panel (desktop) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[hsl(var(--brand-dark))] px-10 py-10 lg:flex xl:px-16">
        {/* `self-start`: a stretched flex item would force the wordmark to the
            panel width and break its aspect ratio. */}
        <img
          src={travioWordmarkDark}
          alt="Travio Ghana"
          className="h-11 w-auto self-start"
        />

        <div className="max-w-[26rem]">
          <h2 className="text-[clamp(1.75rem,2.2vw,2.25rem)] font-semibold leading-tight text-white">
            {panelTitle}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-white/70">
            Manage tours, bookings, payouts and supplier partners for Travio Ghana.
          </p>

          <ul className="mt-8 space-y-3">
            {FACTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-white/80">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/80" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/50">
          Travio Ghana Admin. An Expedition-Go Tours company.
        </p>
      </aside>

      {/* Form column */}
      <main className="flex min-h-[100dvh] items-center justify-center px-6 py-10 lg:min-h-0 lg:py-0">
        <div className="w-full max-w-[400px]">
          <img
            src={travioWordmark}
            alt="Travio Ghana"
            className="mx-auto mb-8 h-11 w-auto lg:hidden"
          />

          <h1 className="text-[26px] font-medium leading-8 tracking-[-0.26px] text-text-primary">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-sm text-text-secondary">{subtitle}</p>
          )}

          <div className="mt-7">{children}</div>

          {footer && (
            <div className="mt-8 text-center text-xs text-text-tertiary">{footer}</div>
          )}
        </div>
      </main>
    </div>
  );
}
