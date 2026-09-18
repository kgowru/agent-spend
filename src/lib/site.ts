/**
 * Every external URL and every factual claim the landing page makes.
 *
 * Claims are cited to the repo file they came from so they stay auditable.
 * Where the repo contradicts itself, the winning value is noted inline.
 */

export const REPO_URL = "https://github.com/kgowru/agent-spend";

/** The release page itself, for people who want the notes and the checksums. */
export const RELEASES_URL = `${REPO_URL}/releases/latest`;

/*
 * The download buttons hand over the disk image directly, no stop at the
 * release page. GitHub redirects `/releases/latest/download/<asset>` to
 * whichever release is newest, so this never needs bumping on a new version.
 * The one thing it depends on is the asset staying named AgentSpend.dmg.
 */
export const DOWNLOAD_URL = `${REPO_URL}/releases/latest/download/AgentSpend.dmg`;
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
export const BLOG_URL = "https://kapilgowru.xyz/blog/agent-spend";

/** Buy Me a Coffee link, surfaced as a discreet icon in the footer. */
export const DONATE_URL = "https://buymeacoffee.com/kapskaps";

/*
 * Feeds `metadataBase`, so every og:image and canonical URL hangs off it. If it
 * fell through to localhost in production every link preview would break, so
 * Vercel's own production hostname sits in the middle as a safety net.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const VERSION = "v0.1.3";

/** Feeds the meta and OG description, so it has to stay under ~155 characters. */
export const TAGLINE =
  "See what your coding agents cost, split by agent, plus an estimate of the energy behind it, and learn habits that reduce your spend.";

export const TRUST = [
  {
    title: "No network calls",
    body: "It never phones home. It reads your local logs and nothing leaves your machine.",
  },
  {
    title: "No API key, no account",
    body: "Nothing to configure. It finds the logs your agents already write and picks them up automatically.",
  },
  {
    title: "Stays on your Mac",
    body: "The only thing it writes is a small database in your Application Support folder.",
  },
  {
    title: "0% CPU when idle",
    body: "Native Swift with no external dependencies. A tool that burned power to report power would defeat itself.",
  },
  {
    title: "Open source, MIT",
    body: "Every source, coefficient and caveat ships as one JSON file inside the app, meant to be read and argued with.",
  },
  {
    title: "Checked against a second implementation",
    body: "A separate Python version of the same parser and model is the reference the Swift one is tested against. On a frozen snapshot they agree to the token and the cent.",
  },
] as const;

export const FAQ = [
  {
    q: "Do I need an API key or an account?",
    a: "No. It reads the logs your agents already write on your Mac. No keys, no account, no network calls.",
  },
  {
    q: "I'm on a Pro or Max subscription. Will the dollars match my bill?",
    a: "No, and the app says so. On a flat rate plan it reads your tier from Claude Code's own config and labels the figure list price, not your bill. It is the right number for comparing one model against another, and the wrong one to call an invoice.",
  },
  {
    q: "Does it work on Intel Macs?",
    a: "Yes. The release is a universal binary covering Apple Silicon and Intel, about 7 MB. It needs macOS 14 or later.",
  },
  {
    q: "Where does my data go?",
    a: "Nowhere. It makes no network calls beyond a daily version check you can switch off. It reads your local agent logs and writes a small database in your Application Support folder.",
  },
  {
    q: "Why is the energy a range instead of a number?",
    a: "Because a truthful energy figure is a range. Nobody publishes per-token energy for these models, so every figure out there is a model rather than a measurement. AgentSpend shows you every coefficient, its range and its source, and lets you drag the assumption that moves the total most.",
  },
  {
    q: "Which agents does it track?",
    a: "Claude Code and Codex are read directly. Sixteen more agent CLIs are read through a bundled copy of ccusage, including Gemini, GitHub Copilot, OpenCode, Amp, Droid, Goose and Qwen. Each appears as soon as you use it. Cursor is not supported: it bills per request on the server and its local token data is too incomplete to trust.",
  },
  {
    q: "How do I uninstall it?",
    a: "Drag the app to the Trash. To remove it completely, delete its folder in Application Support too.",
  },
  {
    q: "Is this an Anthropic product?",
    a: "No. It reads logs these tools write locally, but it is an independent project with no affiliation to Anthropic, OpenAI, Google, GitHub or any other vendor it reads.",
  },
] as const;
