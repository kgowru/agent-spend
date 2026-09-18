#!/usr/bin/env python3
"""Seed a store with synthetic usage across several agents, for screenshots.

Like seed-demo-store.py, but multi-agent: Claude Code and Codex land in
`requests` (they have native per-request ingestors, so they carry a provider),
while Gemini, Copilot, Amp and Droid land in `agent_daily`, which is the
day-level table the bundled ccusage sidecar writes. That split is the real
shape of the data, not a shortcut for the mock: the sidecar cannot report
per-request rows, so a demo that faked them would make the chart look more
precise than it can actually be.

    python3 tools/seed-multiagent-demo.py /tmp/demo-home
    HOME=/tmp/demo-home mac/.build/release/AgentSpend --render /tmp/demo-shots

Every figure is invented. Nothing here maps to a real repo or a real bill.
"""

import os
import random
import sqlite3
import sys
from datetime import datetime, timedelta, timezone

DAYS = 95

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
  is_subagent  INTEGER NOT NULL,
  provider     TEXT
);
CREATE INDEX IF NOT EXISTS idx_ts ON requests(ts);
CREATE INDEX IF NOT EXISTS idx_provider ON requests(provider);
CREATE TABLE IF NOT EXISTS agent_daily (
  agent        TEXT NOT NULL,
  day          TEXT NOT NULL,
  model        TEXT NOT NULL,
  input        INTEGER NOT NULL,
  output       INTEGER NOT NULL,
  cache_write  INTEGER NOT NULL,
  cache_read   INTEGER NOT NULL,
  reasoning    INTEGER NOT NULL,
  day_cost_usd REAL NOT NULL,
  PRIMARY KEY (agent, day, model)
);
PRAGMA user_version = 2;
"""

PROJECTS = [
    ("/Users/dev/code/storefront", "main", 0.30),
    ("/Users/dev/code/api-gateway", "feat/rate-limits", 0.24),
    ("/Users/dev/code/design-system", "main", 0.18),
    ("/Users/dev/code/data-pipeline", "fix/retries", 0.16),
    ("/Users/dev/code/personal-site", "main", 0.12),
]

# (model, provider, weight, token scale)
MODELS = [
    ("claude-opus-5", "claude", 0.42, 1.55),
    ("claude-sonnet-5", "claude", 0.24, 1.00),
    ("claude-haiku-4-5", "claude", 0.06, 0.50),
    ("gpt-5.6-sol", "codex", 0.19, 1.30),
    ("gpt-5.5", "codex", 0.09, 1.10),
]

# Sidecar agents: (agent, model, mean $/active day, share of days active).
# Deliberately smaller than the two native ones. A mock where every agent is
# the same size would hide the thing the chart is for, which is seeing at a
# glance that one tool dominates.
SIDECAR = [
    ("gemini", "gemini-3-pro", 3.30, 0.52),
    ("copilot", "gpt-5.3-codex", 1.90, 0.42),
    ("amp", "claude-sonnet-5", 2.20, 0.30),
    ("droid", "gpt-5.4", 0.95, 0.22),
]


def pick(weighted, rng):
    total = sum(w for _, w in weighted)
    r = rng.uniform(0, total)
    for value, w in weighted:
        r -= w
        if r <= 0:
            return value
    return weighted[-1][0]


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: seed-multiagent-demo.py <sandbox-home>")

    home = os.path.abspath(os.path.expanduser(sys.argv[1]))
    support = os.path.join(home, "Library", "Application Support", "AgentSpend")
    os.makedirs(support, exist_ok=True)
    db_path = os.path.join(support, "usage.sqlite")
    for suffix in ("", "-wal", "-shm"):
        if os.path.exists(db_path + suffix):
            os.remove(db_path + suffix)

    rng = random.Random(20260917)   # fixed: reruns reproduce the screenshots
    db = sqlite3.connect(db_path)
    db.executescript(SCHEMA)

    now = datetime.now(timezone.utc)
    rows, daily = [], []
    rid = 0

    for day_offset in range(DAYS):
        day = now - timedelta(days=day_offset)
        weekday = day.weekday()
        # Lighter at weekends, gently rising toward today so each larger window
        # strictly exceeds the shorter one, which --render asserts.
        volume = 0.45 if weekday >= 5 else 1.0
        volume *= 1.0 + (DAYS - day_offset) / (DAYS * 2.2)
        sessions = max(1, int(rng.gauss(3.2, 1.1) * volume))

        for session in range(sessions):
            cwd, branch = pick([((p, b), w) for p, b, w in PROJECTS], rng)
            session_id = f"sess-{day.strftime('%Y%m%d')}-{session:02d}"
            start = day.replace(hour=rng.randint(9, 20),
                                minute=rng.randint(0, 59), second=0, microsecond=0)

            for _ in range(max(3, int(rng.gauss(20, 8) * volume))):
                rid += 1
                model, provider, _, scale = pick(
                    [(m, m[2]) for m in MODELS], rng)
                cache_read = int(max(0, rng.gauss(185000, 62000)) * scale)
                cache_write = int(max(0, rng.gauss(9500, 4200)) * scale)
                w5m = int(cache_write * rng.uniform(0.6, 0.95))
                inp = int(max(80, rng.gauss(1300, 520)) * scale)
                out = int(max(40, rng.gauss(950, 400)) * scale)
                ts = start + timedelta(seconds=rng.randint(0, 5400))
                rows.append((
                    f"msg_demo_{rid:07d}", session_id, int(ts.timestamp()),
                    model, inp, cache_write, w5m, cache_write - w5m,
                    cache_read, out, cwd, branch,
                    1 if rng.random() < 0.08 else 0,
                    1 if rng.random() < 0.05 else 0,
                    provider,
                ))

        # Sidecar agents report a day at a time, with a cost and no request rows.
        key = day.astimezone().strftime("%Y-%m-%d")
        for agent, model, mean, active in SIDECAR:
            if rng.random() > active * volume:
                continue
            usd = max(0.05, rng.gauss(mean, mean * 0.45)) * volume
            # Token counts are illustrative; the sidecar's own cost figure is
            # what the chart stacks, so these only populate the detail rows.
            daily.append((agent, key, model,
                          int(usd * 90_000), int(usd * 4_000),
                          0, int(usd * 300_000), int(usd * 1_200), round(usd, 4)))

    db.executemany(
        "INSERT INTO requests (request_id, session_id, ts, model, input,"
        " cache_write, cache_w5m, cache_w1h, cache_read, output, cwd,"
        " git_branch, is_sidechain, is_subagent, provider)"
        " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
    db.executemany(
        "INSERT OR REPLACE INTO agent_daily (agent, day, model, input, output,"
        " cache_write, cache_read, reasoning, day_cost_usd)"
        " VALUES (?,?,?,?,?,?,?,?,?)", daily)
    db.commit()

    by_provider = dict(db.execute(
        "SELECT provider, COUNT(*) FROM requests GROUP BY provider").fetchall())
    by_agent = dict(db.execute(
        "SELECT agent, ROUND(SUM(day_cost_usd), 2) FROM ("
        "  SELECT agent, day, MAX(day_cost_usd) AS day_cost_usd"
        "  FROM agent_daily GROUP BY agent, day) GROUP BY agent").fetchall())
    print(f"seeded {len(rows)} requests over {DAYS} days -> {db_path}")
    print(f"  native (requests): {by_provider}")
    print(f"  sidecar ($ total): {by_agent}")
    db.close()


if __name__ == "__main__":
    main()
