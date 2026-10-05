# Coefficient resources

Shared source of truth for both the Swift app and `tools/prototype.py`. Keep
them in sync. The Python oracle is the golden-file fixture the Swift ingestor
is tested against, and both read *these* files, so a coefficient change lands in
both at once.

- **`energy-model.json`**: per-tier Wh/1k-token coefficients with `lo`/`v`/`hi`
  bands, plus the cache read/write factors, caveats, equivalences, and grid
  defaults. Every number carries a basis, a confidence, and source URLs.
- **`pricing.json`**: published Anthropic and OpenAI per-MTok rates, cache
  multipliers, and optional per-model long-context thresholds. Unlike the
  energy figures, these are exact. `cacheMultipliers` holds the per-vendor
  default and a model's own `cache` block overrides it, because neither vendor
  is internally uniform — Fable 5.1 and Mythos 5.1 read at 0.025x and Opus 5.5
  at 0.05x against Anthropic's 0.1x house rate, and OpenAI began charging for
  cache writes at GPT-5.6 having charged nothing at 5.5. A `longContext` block
  carries the surcharge OpenAI applies to a whole request once it crosses that
  model's prompt threshold; only gpt-6-astra has one so far.

Three rules when editing:

1. **Never add a bare number.** If you can't state where a coefficient came from
   and how confident it is, it doesn't belong here.
2. **Never silently drop an unrecognized model.** A model without coefficients
   must surface as a loud error, not as zero energy. Silent zeroing is the
   failure mode that makes a tool like this quietly wrong.
3. **Add every new model to BOTH files, with the same tier.** Pricing and energy
   are keyed independently, and a model present in only one is half-broken in a
   way nothing in the UI announces: missing from `pricing.json` it costs $0,
   and missing from `energy-model.json` it drops out of the tier filter the
   recommender uses. `SelfTest.rateCard` and `tools/verify.py` assert both the
   parity and the tier agreement.
