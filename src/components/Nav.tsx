import Image from "next/image";
import { DOWNLOAD_URL, REPO_URL } from "@/lib/site";
import { MetalButton } from "./MetalButton";

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-canvas/70 backdrop-blur-xl">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6"
      >
        <a
          href="#main"
          className="flex items-center gap-2.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-spark-teal-soft"
        >
          <Image
            src="/agentspend-icon.png"
            alt=""
            width={1024}
            height={1024}
            sizes="28px"
            className="size-7"
          />
          AgentSpend
        </a>

        <div className="flex items-center gap-1 sm:gap-2">
          <a
            href="#install"
            className="hidden rounded-full px-3.5 py-2 text-sm text-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-teal-soft sm:block"
          >
            Install
          </a>
          <a
            href="#faq"
            className="hidden rounded-full px-3.5 py-2 text-sm text-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-teal-soft sm:block"
          >
            FAQ
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-full px-3.5 py-2 text-sm text-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-teal-soft sm:block"
          >
            GitHub
          </a>
          <MetalButton>
            <a
              href={DOWNLOAD_URL}
              className="rounded-full px-4 py-2 text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-teal-soft"
            >
              Download
            </a>
          </MetalButton>
        </div>
      </nav>
    </header>
  );
}
