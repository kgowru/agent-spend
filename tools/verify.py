#!/usr/bin/env python3
"""Verification suite for the Phase 0 oracle.

Independent code path from prototype.py — deliberately re-derives everything
rather than importing the aggregation logic, so a bug in one doesn't hide in
the other. Checks the assumptions dedup rests on:

  1. Dedup integrity  — does any message.id carry two DIFFERENT usage payloads?
                        If so, dedup is discarding real requests.
  2. Duplicate shape  — are duplicates within one file, or across files?
  3. Idempotence      — parsing twice yields identical totals.
  4. Spot-check cost  — recompute one session by hand against published rates.
"""

import glob
import json
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from prototype import (DEFAULT_ROOT, SYNTHETIC, cost_usd, load_resources,  # noqa: E402
                       normalize_model, parse)

FAIL = []


def check(label, ok, detail=""):
    print(f"  [{'PASS' if ok else 'FAIL'}] {label}" + (f"  {detail}" if detail else ""))
    if not ok:
        FAIL.append(label)


def main():
    energy, pricing, tiers, prices = load_resources()
    mult = pricing["cacheMultipliers"]

    # Raw scan, independent of prototype.parse
    payloads = defaultdict(set)      # message.id -> set of usage fingerprints
    stable = defaultdict(set)        # message.id -> non-output fields only
    files_for_id = defaultdict(set)  # message.id -> set of files
    max_out = defaultdict(int)       # message.id -> max output_tokens seen
    first_out = {}                   # message.id -> first output_tokens seen
    raw = 0
    for path in sorted(glob.glob(os.path.join(DEFAULT_ROOT, "**", "*.jsonl"),
                                 recursive=True)):
        with open(path, errors="ignore") as fh:
            for line in fh:
                if '"usage":{' not in line:
                    continue
                try:
                    d = json.loads(line)
                except ValueError:
                    continue
                m = d.get("message")
                if not isinstance(m, dict) or not isinstance(m.get("usage"), dict):
                    continue
                if m.get("model") == SYNTHETIC:
                    continue
                raw += 1
                mid = m.get("id") or d.get("requestId")
                u = m["usage"]
                fp = (u.get("input_tokens"), u.get("output_tokens"),
                      u.get("cache_creation_input_tokens"),
                      u.get("cache_read_input_tokens"), m.get("model"))
                payloads[mid].add(fp)
                stable[mid].add((u.get("input_tokens"),
                                 u.get("cache_creation_input_tokens"),
                                 u.get("cache_read_input_tokens"), m.get("model")))
                o = u.get("output_tokens") or 0
                max_out[mid] = max(max_out[mid], o)
                first_out.setdefault(mid, o)
                files_for_id[mid].add(path)

    print("1. Dedup integrity")
    # A streaming message is logged repeatedly with a growing output_tokens, so
    # payloads DO conflict by design. What must never conflict is everything
    # else -- that is what makes "keep the row with max output_tokens" sound.
    unstable = {k: v for k, v in stable.items() if len(v) > 1}
    check("non-output fields never conflict for a given message.id",
          not unstable, f"{len(unstable)} conflicts of {len(payloads):,} ids")
    for k, v in list(unstable.items())[:3]:
        print(f"       {k}: {v}")

    streaming = sum(1 for k, v in payloads.items() if len(v) > 1)
    under = sum(max_out.values()) - sum(first_out.values())
    check("max-output dedup recovers the streaming undercount", under > 0,
          f"{streaming:,} streamed ids; first-wins would lose {under:,} output "
          f"tokens ({100.0 * under / max(sum(max_out.values()), 1):.1f}%)")

    print("\n2. Duplicate shape")
    cross = sum(1 for v in files_for_id.values() if len(v) > 1)
    dupes = raw - len(payloads)
    check("duplicates exist and are accounted for", dupes > 0,
          f"{dupes:,} dupes over {raw:,} raw rows ({100.0 * dupes / raw:.1f}%)")
    print(f"       ids appearing in >1 file: {cross:,} "
          f"({100.0 * cross / max(len(payloads), 1):.1f}%) "
          f"-- cross-file dupes mean parent sessions re-log subagent turns")

    print("\n3. Idempotence")
    a, sa = parse(DEFAULT_ROOT)
    b, sb = parse(DEFAULT_ROOT)
    check("two parses agree on row count", len(a) == len(b), f"{len(a):,} vs {len(b):,}")
    ta = sum(r["input"] + r["output"] + r["cacheRead"] + r["cacheWrite"] for r in a)
    tb = sum(r["input"] + r["output"] + r["cacheRead"] + r["cacheWrite"] for r in b)
    check("two parses agree on total tokens", ta == tb, f"{ta:,}")
    check("parse output matches independent raw scan", len(a) == len(payloads),
          f"parse={len(a):,} rawscan={len(payloads):,}")
    pa = sum(r["output"] for r in a)
    check("parse keeps the completed (max) output count per message",
          pa == sum(max_out.values()),
          f"parse={pa:,} rawscan_max={sum(max_out.values()):,}")

    print("\n4. Every model resolves to coefficients")
    seen_models = {r["model"] for r in a}
    unpriced = {m for m in seen_models if m not in prices}
    unenergied = {m for m in seen_models if m not in tiers}
    check("all observed models have pricing", not unpriced, str(sorted(unpriced)))
    check("all observed models have energy coefficients", not unenergied,
          str(sorted(unenergied)))

    print("\n5. Cost spot-check (hand-computed vs cost_usd)")
    row = max(a, key=lambda r: r["output"])
    p = prices[row["model"]]
    # A model's own `cache` block wins over its vendor default, and
    # `cacheMultipliers` is keyed by provider — so neither the hand
    # computation nor cost_usd may index it directly.
    model_mult = p.get("cache") or mult[p["provider"]]
    w5, w1h = row["cacheWrite5m"], row["cacheWrite1h"]
    write = (w5 * model_mult["write5m"] + w1h * model_mult["write1h"]) \
        if (w5 + w1h) else row["cacheWrite"] * model_mult["write5m"]
    hand = (row["input"] * p["input"] + write * p["input"]
            + row["cacheRead"] * p["input"] * model_mult["read"]
            + row["output"] * p["output"]) / 1_000_000.0
    got = cost_usd(row, prices, mult)
    check("hand-computed cost matches cost_usd", abs(hand - got) < 1e-12,
          f"{row['model']}: ${got:.6f}")

    print("\n6. Model ID normalization")
    check("dated IDs normalize to alias",
          normalize_model("claude-haiku-4-5-20251001") == "claude-haiku-4-5")
    check("alias IDs are unchanged",
          normalize_model("claude-opus-4-8") == "claude-opus-4-8")
    check("no dated IDs survive into parsed rows",
          not any(m and m[-9] == "-" and m[-8:].isdigit() for m in seen_models),
          str(sorted(seen_models)))

    print("\n7. Rate card against the published pricing pages")
    # Effective dollars per MTok, transcribed from the two `sources` URLs in
    # pricing.json on 2026-09-25. The point is to pin the DERIVED cache rates,
    # not just the base ones: cache terms are stored as multipliers, so a wrong
    # multiplier is invisible in the table and wrong in the bill. Opus 5.5
    # (0.05x) and Fable/Mythos 5.1 (0.025x) are the rows that would break if
    # someone dropped the per-model override and fell back to the 0.1x default.
    rate_card = [
        # id,                  input,  output, cache read, 5m write, 1h write
        ("claude-opus-5-5",      4.0,    20.0,       0.20,     5.000,    8.000),
        ("claude-opus-5",        5.0,    25.0,       0.50,     6.250,   10.000),
        ("claude-sonnet-5",      2.0,    10.0,       0.20,     2.500,    4.000),
        ("claude-fable-5-1",    10.0,    50.0,       0.25,    12.500,   20.000),
        ("claude-mythos-5-1",   10.0,    50.0,       0.25,    12.500,   20.000),
        ("claude-haiku-4-5",     1.0,     5.0,       0.10,     1.250,    2.000),
        ("gpt-6-astra",         10.0,    50.0,       1.00,    12.500,   12.500),
        ("gpt-6-sol",            2.0,    10.0,       0.20,     2.500,    2.500),
        ("gpt-6-luna",           0.1,     0.5,       0.01,     0.125,    0.125),
        ("gpt-5.6-sol",          4.0,    20.0,       0.40,     5.000,    5.000),
        ("gpt-5.6-terra",        2.0,    12.0,       0.20,     2.500,    2.500),
        ("gpt-5.6-luna",         0.2,     1.2,       0.02,     0.250,    0.250),
    ]
    for mid, exp_in, exp_out, exp_read, exp_w5, exp_w1h in rate_card:
        p = prices.get(mid)
        if p is None:
            check(f"{mid} is in the catalog", False)
            continue
        m = p.get("cache") or mult[p["provider"]]
        got = (p["input"], p["output"], p["input"] * m["read"],
               p["input"] * m["write5m"], p["input"] * m["write1h"])
        exp = (exp_in, exp_out, exp_read, exp_w5, exp_w1h)
        check(f"{mid} matches the published rate card",
              all(abs(g - e) < 1e-9 for g, e in zip(got, exp)),
              f"in ${got[0]:g} out ${got[1]:g} read ${got[2]:g} "
              f"w5m ${got[3]:g} w1h ${got[4]:g}")

    # GPT-6 Sol and Luna undercut their GPT-5.6 namesakes at the same tier.
    # This is not cosmetic: the tier-downshift recommendation is sized against
    # the cheaper model, so a missing GPT-6 row quotes a floor ~2x too high.
    check("gpt-6-sol is half gpt-5.6-sol on input and output",
          prices["gpt-6-sol"]["input"] * 2 == prices["gpt-5.6-sol"]["input"]
          and prices["gpt-6-sol"]["output"] * 2 == prices["gpt-5.6-sol"]["output"])
    check("gpt-6-luna undercuts gpt-5.6-luna on input and output",
          prices["gpt-6-luna"]["input"] < prices["gpt-5.6-luna"]["input"]
          and prices["gpt-6-luna"]["output"] < prices["gpt-5.6-luna"]["output"])
    # Opus 5.5 sits BELOW Opus 5 on every axis, cache reads included.
    o55, o5 = prices["claude-opus-5-5"], prices["claude-opus-5"]
    m55 = o55.get("cache") or mult[o55["provider"]]
    m5 = o5.get("cache") or mult[o5["provider"]]
    check("claude-opus-5-5 is cheaper than claude-opus-5 on every axis",
          o55["input"] < o5["input"] and o55["output"] < o5["output"]
          and o55["input"] * m55["read"] < o5["input"] * m5["read"])

    print("\n8. Every catalog model prices and resolves cache terms")
    # A model that prices at None is coerced to $0 by every aggregating caller,
    # which is the silent-zeroing failure Resources/README.md forbids.
    probe = {"input": 1000, "output": 1000, "cacheWrite": 1000,
             "cacheWrite5m": 0, "cacheWrite1h": 0, "cacheRead": 1000}
    unpriceable = sorted(m for m in prices
                         if cost_usd({**probe, "model": m}, prices, mult) is None)
    check("every catalog model returns a cost", not unpriceable, str(unpriceable))
    no_tier = sorted(m for m in prices if m not in tiers)
    check("every catalog model has an energy-model entry", not no_tier, str(no_tier))
    # The reverse direction. An energy-only model is never iterated above, so
    # it would stay invisible here while pricing at $0 in the app and still
    # being eligible for the recommender's tier filter.
    no_price = sorted(m for m in tiers if m not in prices)
    check("every energy-model entry has a published price", not no_price, str(no_price))
    # Presence in both files is not enough: the two must agree on the TIER.
    # The recommender filters frontier-large off the ENERGY entry while the
    # Models table shows the priced one, so a disagreement splits the two with
    # nothing in the UI to announce it. SelfTest checks this; until now this
    # verifier did not, which is the half that is supposed to be independent.
    tier_drift = sorted(f"{m}: pricing={prices[m].get('tier')!r} energy={tiers[m]!r}"
                        for m in prices if m in tiers
                        and prices[m].get("tier") != tiers[m])
    check("pricing and energy agree on every shared model's tier",
          not tier_drift, str(tier_drift))

    print("\n" + ("ALL CHECKS PASSED" if not FAIL else f"FAILED: {FAIL}"))
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
