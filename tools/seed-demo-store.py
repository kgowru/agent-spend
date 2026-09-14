#!/usr/bin/env python3
"""Seed an AgentSpend store with synthetic usage, for screenshots.

Every capture of a real store contains real project names and real dollar
figures, which is why none is committed (see the note in README.md). This
writes a store full of invented-but-plausible usage into a throwaway HOME so
`AgentSpend --render` can produce marketing imagery that leaks nothing.

    python3 tools/seed-demo-store.py <sandbox-home>
    HOME=<sandbox-home> mac/.build/release/AgentSpend --render <out-dir>

The numbers are shaped to look like real Claude Code usage: cache reads
dominate the token mix, output is the smallest slice, and activity is heavier
on weekdays. Totals must strictly increase across the 1/14/30/90-day windows,
which is a precondition `--render` checks.
"""

import os
import random
import sqlite3
import sys
from datetime import datetime, timedelta, timezone

SCHEMA = """
CREATE TABLE IF NOT EXISTS requests (
  request_id   TEXT PRIMARY KEY,
  session_id   TEXT,
  ts           INTEGER,
  model        TEXT NOT NULL,
  input        INTEGER NOT NULL,
  cache_write  INTEGER NOT NULL,
  cache_w5m    INTEGER NOT NULL,
  cache_w1h    INTEGER NOT NULL,
  cache_read   INTEGER NOT NULL,
  output       INTEGER NOT NULL,
  cwd          TEXT,
  git_branch   TEXT,
  is_sidechain INTEGER NOT NULL,
  is_subagent  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ts ON requests(ts);
CREATE INDEX IF NOT EXISTS idx_model ON requests(model);
CREATE INDEX IF NOT EXISTS idx_cwd ON requests(cwd);
"""

# Invented projects. Generic on purpose — nothing here maps to a real repo.
PROJECTS = [
    ("/Users/dev/code/storefront", "main", 0.30),
    ("/Users/dev/code/api-gateway", "feat/rate-limits", 0.24),
    ("/Users/dev/code/design-system", "main", 0.18),
    ("/Users/dev/code/data-pipeline", "fix/retries", 0.16),
    ("/Users/dev/code/personal-site", "main", 0.12),
]

# Deliberately top-heavy: leaning on the frontier model for everything is the
# habit the app exists to surface, so the demo store should actually trigger
# the savings recommendations rather than show an empty "$0.00 identified".
MODELS = [
    ("claude-opus-4-8", 0.58),
    ("claude-sonnet-5", 0.31),
    ("claude-haiku-4-5", 0.11),
]

DAYS = 120


def pick(weighted, rng):
    r = rng.random() * sum(w for _, w in weighted)
    for value, weight in weighted:
        r -= weight
        if r <= 0:
            return value
    return weighted[-1][0]


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: seed-demo-store.py <sandbox-home>")

    home = os.path.abspath(os.path.expanduser(sys.argv[1]))
    support = os.path.join(home, "Library", "Application Support", "AgentSpend")
    os.makedirs(support, exist_ok=True)
    db_path = os.path.join(support, "usage.sqlite")
    if os.path.exists(db_path):
        os.remove(db_path)

    # Fixed seed: reruns reproduce the same screenshots.
    rng = random.Random(20260911)
    db = sqlite3.connect(db_path)
    db.executescript(SCHEMA)

    now = datetime.now(timezone.utc)
    rows = []
    rid = 0

    for day_offset in range(DAYS):
        day = now - timedelta(days=day_offset)
        # Lighter on weekends, and a gentle upward trend toward today so each
        # larger window strictly exceeds the shorter one.
        weekday = day.weekday()
        volume = 0.45 if weekday >= 5 else 1.0
        volume *= 1.0 + (DAYS - day_offset) / (DAYS * 2.2)
        sessions = max(1, int(rng.gauss(3.2, 1.1) * volume))

        for session in range(sessions):
            cwd, branch = pick([((p, b), w) for p, b, w in PROJECTS], rng)
            session_id = f"sess-{day.strftime('%Y%m%d')}-{session:02d}"
            start = day.replace(
                hour=rng.randint(9, 20), minute=rng.randint(0, 59), second=0,
                microsecond=0)

            for _ in range(max(3, int(rng.gauss(22, 9) * volume))):
                rid += 1
                model = pick(MODELS, rng)
                scale = {"claude-opus-4-8": 1.55,
                         "claude-sonnet-5": 1.0,
                         "claude-haiku-4-5": 0.5}[model]

                # Cache reads dominate; output is the smallest slice.
                cache_read = int(max(0, rng.gauss(24000, 9000)) * scale)
                cache_write = int(max(0, rng.gauss(2600, 1400)) * scale)
                w5m = int(cache_write * rng.uniform(0.6, 0.95))
                inp = int(max(80, rng.gauss(900, 420)) * scale)
                out = int(max(40, rng.gauss(720, 380)) * scale)

                ts = start + timedelta(seconds=rng.randint(0, 5400))
                rows.append((
                    f"msg_demo_{rid:07d}", session_id, int(ts.timestamp()),
                    model, inp, cache_write, w5m, cache_write - w5m,
                    cache_read, out, cwd, branch,
                    1 if rng.random() < 0.08 else 0,
                    1 if rng.random() < 0.05 else 0,
                ))

    db.executemany(
        "INSERT INTO requests (request_id, session_id, ts, model, input,"
        " cache_write, cache_w5m, cache_w1h, cache_read, output, cwd,"
        " git_branch, is_sidechain, is_subagent)"
        " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
    db.commit()

    total_tokens = db.execute(
        "SELECT SUM(input + cache_write + cache_read + output) FROM requests"
    ).fetchone()[0]
    print(f"seeded {len(rows)} requests over {DAYS} days "
          f"({total_tokens/1e6:.1f}M tokens) -> {db_path}")
    db.close()


if __name__ == "__main__":
    main()
