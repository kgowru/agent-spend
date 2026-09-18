#!/bin/bash
# Fetch the pinned ccusage binary and lipo it into a universal Mach-O.
#
# AgentSpend parses Claude Code and Codex itself. This binary covers the other
# fourteen agent CLIs, which is breadth we are not going to hand-maintain: every
# one of them changes its log format on its own schedule, and ccusage already
# tracks all of them with a per-agent adapter and a test suite.
#
# Four things this has to get right:
#
#  1. **Verify before signing.** We re-sign this with a Developer ID and ship it
#     inside a notarized app, so a compromised or swapped npm artifact would be
#     laundered through our own certificate. The sha256 in ccusage-lock.json is
#     checked against the extracted Mach-O before lipo ever runs.
#  2. **lipo, don't pick.** npm publishes two thin slices and never a fat binary
#     (the Nix pipeline builds each target independently). Shipping only arm64
#     would silently break every Intel Mac, and the failure mode is a menu bar
#     that reads $0.00 rather than a crash.
#  3. **Strip the ad-hoc signature by re-signing.** The published slices are
#     `adhoc, linker-signed` with `TeamIdentifier=not set`. lipo does not carry a
#     usable signature across, and notarization rejects it regardless, so the
#     bundle step re-signs. This script deliberately leaves it unsigned.
#  4. **Ship the license.** MIT requires the copyright notice to travel with the
#     binary, so it is written next to it and build-app.sh copies both.
#
# Output: vendor/ccusage (universal, unsigned) and vendor/LICENSE-ccusage.
set -euo pipefail
cd "$(dirname "$0")"

LOCK="ccusage-lock.json"
OUT="vendor/ccusage"

read -r VERSION REGISTRY ARM_PKG ARM_SHA X64_PKG X64_SHA <<<"$(
  python3 -c '
import json
d = json.load(open("ccusage-lock.json"))
s = d["slices"]
print(d["version"], d["registry"],
      s["arm64"]["package"],  s["arm64"]["sha256"],
      s["x86_64"]["package"], s["x86_64"]["sha256"])
'
)"

# Already correct? Re-downloading on every `swift build` would be rude, and this
# runs from build-app.sh.
if [ "${1:-}" != "--force" ] && [ -f "$OUT" ]; then
  if have="$(shasum -a 256 "$OUT" | cut -d' ' -f1)" && \
     [ "$have" = "$(cat vendor/.ccusage-universal-sha256 2>/dev/null || echo none)" ]; then
    echo "ccusage $VERSION already vendored"
    exit 0
  fi
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p vendor

fetch_slice() {
  local pkg="$1" want="$2" arch="$3"
  # @scope/name -> the tarball basename npm uses drops the scope.
  local base="${pkg#@*/}"
  local url="$REGISTRY/$pkg/-/$base-$VERSION.tgz"
  # Progress goes to stderr: stdout is this function's return value (the path to
  # the extracted binary), and a stray status line there ends up as a filename.
  echo "  fetching $pkg@$VERSION" >&2
  curl -fsSL "$url" -o "$TMP/$arch.tgz"
  mkdir -p "$TMP/$arch"
  tar -xzf "$TMP/$arch.tgz" -C "$TMP/$arch"
  local bin="$TMP/$arch/package/bin/ccusage"
  [ -f "$bin" ] || { echo "error: no bin/ccusage inside $pkg@$VERSION" >&2; exit 1; }

  local got
  got="$(shasum -a 256 "$bin" | cut -d' ' -f1)"
  if [ "$got" != "$want" ]; then
    echo "error: sha256 mismatch for $pkg@$VERSION" >&2
    echo "  expected $want" >&2
    echo "  actual   $got" >&2
    echo "  Refusing to sign an artifact that is not the one that was reviewed." >&2
    exit 1
  fi
  # Sanity-check the slice really is the architecture it claims, so a registry
  # mix-up surfaces here and not as a lipo error with a confusing message.
  if ! lipo -archs "$bin" | tr ' ' '\n' | grep -qx "$arch"; then
    echo "error: $pkg does not contain a $arch slice (has: $(lipo -archs "$bin"))" >&2
    exit 1
  fi
  echo "$bin"
}

echo "vendoring ccusage $VERSION"
ARM_BIN="$(fetch_slice "$ARM_PKG" "$ARM_SHA" arm64)"
X64_BIN="$(fetch_slice "$X64_PKG" "$X64_SHA" x86_64)"

lipo -create "$ARM_BIN" "$X64_BIN" -output "$OUT"
chmod +x "$OUT"
shasum -a 256 "$OUT" | cut -d' ' -f1 > vendor/.ccusage-universal-sha256

# MIT: the notice travels with the binary.
cat > vendor/LICENSE-ccusage <<'LICENSE'
ccusage is bundled with AgentSpend under the MIT License.

MIT License

Copyright (c) 2025 ryoppippi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Upstream: https://github.com/ccusage/ccusage
LICENSE

echo "  $OUT ($(lipo -archs "$OUT"), $(wc -c < "$OUT" | tr -d ' ') bytes, unsigned)"
