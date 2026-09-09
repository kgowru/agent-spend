/**
 * Every external URL and every factual claim the landing page makes.
 *
 * Claims are cited to the repo file they came from so they stay auditable.
 * Where the repo contradicts itself, the winning value is noted inline.
 */

export const REPO_URL = "https://github.com/kgowru/agent-spend";
export const DOWNLOAD_URL = `${REPO_URL}/releases/latest`;
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
export const BLOG_URL = "https://kapilgowru.xyz/blog/agent-spend";

/** Set this to a Buy Me a Coffee or Ko-fi URL to reveal the support section. */
export const DONATE_URL = "";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const VERSION = "v0.1.1";

/** Feeds the meta and OG description, so it has to stay under ~155 characters. */
export const TAGLINE =
  "See what your Claude Code usage costs in dollars, plus an estimate of the energy behind it, and learn habits that reduce your spend.";

export const TRUST = [
  {
    title: "No network calls",
    body: "It never phones home. It reads your local logs and nothing leaves your machine.",
  },
  {
    title: "No API key, no account",
    body: "Nothing to configure. It finds your usage in ~/.claude/projects and picks it up automatically.",
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
    a: "No. It reads Claude Code's own logs on your Mac. No keys, no account, no network calls.",
  },
  {
    q: "I'm on a Pro or Max subscription. Will the dollars match my bill?",
    a: "No, and the app says so. The figure is what your usage would cost at Anthropic's published API rates. On a subscription it is a comparison number, not your invoice.",
  },
  {
    q: "Does it work on Intel Macs?",
    a: "Yes. The release is a universal binary of about 3 MB covering Apple Silicon and Intel. It needs macOS 14 or later.",
  },
  {
    q: "Where does my data go?",
    a: "Nowhere. It makes no network calls. It reads your local Claude Code logs and writes a small database in your Application Support folder.",
  },
  {
    q: "Why is the energy a range instead of a number?",
    a: "Because a truthful energy figure is a range. Nobody publishes per-token energy for these models, so every figure out there is a model rather than a measurement. AgentSpend shows you every coefficient, its range and its source, and lets you drag the assumption that moves the total most.",
  },
  {
    q: "Does it track Cursor or Codex?",
    a: "Not today. It reads the logs Claude Code writes locally. If you don't use Claude Code, it will be empty.",
  },
  {
    q: "How do I uninstall it?",
    a: "Drag the app to the Trash. To remove it completely, delete its folder in Application Support too.",
  },
  {
    q: "Is this an Anthropic product?",
    a: "No. It reads logs Claude Code writes locally, but it is an independent project with no affiliation to Anthropic.",
  },
] as const;
