import { BLOG_URL, DOWNLOAD_URL, LICENSE_URL, REPO_URL } from "@/lib/site";

const LINKS = [
  { label: "GitHub", href: REPO_URL },
  { label: "Releases", href: DOWNLOAD_URL },
  { label: "Write-up", href: BLOG_URL },
  { label: "License", href: LICENSE_URL },
];

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
      </div>
    </footer>
  );
}
