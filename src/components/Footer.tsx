import {
  BLOG_URL,
  DONATE_URL,
  DOWNLOAD_URL,
  LICENSE_URL,
  REPO_URL,
} from "@/lib/site";

const LINKS = [
  { label: "GitHub", href: REPO_URL },
  { label: "Releases", href: DOWNLOAD_URL },
  { label: "Write-up", href: BLOG_URL },
  { label: "License", href: LICENSE_URL },
];

/* A quiet nod, not a call to action: an icon-only coffee link tucked in beside
 * the footer links. Only renders once a donate URL is set. */
function CoffeeLink() {
  if (!DONATE_URL) return null;

  return (
    <a
      href={DONATE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Buy me a coffee"
      title="Buy me a coffee"
      className="text-muted/70 transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-teal-soft"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
      >
        <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
        <line x1="6" y1="2" x2="6" y2="4" />
        <line x1="10" y1="2" x2="10" y2="4" />
        <line x1="14" y1="2" x2="14" y2="4" />
      </svg>
    </a>
  );
}

export function Footer() {
  return (
    <footer className="mt-8 border-t border-white/8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-md">
          <p className="text-sm text-muted">MIT, 2026 Kapil Gowru.</p>
          <p className="mt-3 text-sm/6 text-muted">
            Not affiliated with Anthropic.
          </p>
        </div>

        <div className="flex items-center gap-x-6 gap-y-2">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {LINKS.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-teal-soft"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <CoffeeLink />
        </div>
      </div>
    </footer>
  );
}
