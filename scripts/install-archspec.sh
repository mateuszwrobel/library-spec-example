#!/usr/bin/env bash
# install-archspec.sh — system-adaptive installer for the archspec CLI.
#
# Usage:
#   install-archspec.sh [--dry-run]
#
# Flags:
#   --dry-run            print the resolved asset URL for this host, exit 0 (no network)
#   -h | --help          usage
#
# Env:
#   ARCHSPEC_VERSION     release version to install (default 0.5.2)
#   INSTALL_DIR          install target directory (default $HOME/.local/bin)
#
# Behavior:
#   Detects OS/arch via uname, resolves the GitHub release asset for the pinned
#   version, downloads asset + .sha256 sidecar, verifies the checksum BEFORE
#   extracting, extracts (tar.gz or zip), installs the binary into INSTALL_DIR,
#   prints the installed path and version. Never uses sudo. Unsupported host or
#   arch combos fail with the supported-target list — the wrong asset is never
#   silently picked. deb/pkg variants are not used by this script.
#
# Supported targets (uname -s / uname -m -> asset):
#   Linux/x86_64    -> archspec-<V>-x86_64-unknown-linux-musl.tar.gz
#   Linux/aarch64   -> archspec-<V>-aarch64-unknown-linux-gnu.tar.gz
#   Darwin/x86_64   -> archspec-<V>-x86_64-apple-darwin.tar.gz
#   Darwin/arm64    -> archspec-<V>-aarch64-apple-darwin.tar.gz
#   (deliberate upstream gaps: no x86_64 GNU-linux asset — musl covers it;
#    no aarch64 musl — gnu covers it; Windows assets exist upstream but this
#    script does not handle them)
#
# Exit: 0 installed or --dry-run; 1 download/checksum/extract/run failure;
#       2 usage error or unsupported platform.
#
# Deps: curl, mktemp, tar (unzip only for .zip assets), sha256sum or shasum.

set -u

VERSION="${ARCHSPEC_VERSION:-0.5.2}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
REPO="mateuszwrobel/archspec"
BASE_URL="https://github.com/${REPO}/releases/download/v${VERSION}"

usage() {
  cat <<'EOF'
install-archspec.sh [--dry-run]

  --dry-run   print resolved asset URL for this host and exit 0 (no network)
  -h|--help   usage

Env: ARCHSPEC_VERSION (default 0.5.2), INSTALL_DIR (default $HOME/.local/bin)
EOF
}

die()  { printf 'error: %s\n'  "$*" >&2; exit 1; }
die2() { printf 'error: %s\n'  "$*" >&2; exit 2; }

DRY_RUN=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) usage; exit 0 ;;
    *)         usage >&2; die2 "unknown argument: $1" ;;
  esac
  shift
done

# uname -> release-asset target triple (+ archive extension)
OS="$(uname -s)"
ARCH="$(uname -m)"
EXT="tar.gz"

case "$OS:$ARCH" in
  Linux:x86_64)  TARGET="x86_64-unknown-linux-musl" ;;
  Linux:aarch64) TARGET="aarch64-unknown-linux-gnu" ;;
  Darwin:x86_64) TARGET="x86_64-apple-darwin" ;;
  Darwin:arm64)  TARGET="aarch64-apple-darwin" ;;
  MINGW*:*|MSYS*:*|CYGWIN*:*)
    die2 "unsupported platform: $OS/$ARCH — Windows assets exist upstream but this script does not handle them. Supported: Linux/x86_64, Linux/aarch64, Darwin/x86_64, Darwin/arm64"
    ;;
  *)
    die2 "unsupported platform: $OS/$ARCH. Supported: Linux/x86_64, Linux/aarch64, Darwin/x86_64, Darwin/arm64"
    ;;
esac

ASSET="archspec-${VERSION}-${TARGET}.${EXT}"
URL="${BASE_URL}/${ASSET}"

if [ "$DRY_RUN" -eq 1 ]; then
  printf 'asset:  %s\n' "$URL"
  printf 'sha256: %s.sha256\n' "$URL"
  exit 0
fi

command -v curl   >/dev/null 2>&1 || die2 "curl not found"
command -v mktemp >/dev/null 2>&1 || die2 "mktemp not found"

TMP="$(mktemp -d)" || die "mktemp -d failed"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL --output "$TMP/$ASSET" "$URL"          || die "download failed: $URL"
curl -fsSL --output "$TMP/$ASSET.sha256" "$URL.sha256" \
  || die "checksum download failed: $URL.sha256"

# checksum tool: sha256sum, shasum -a 256 fallback
if command -v sha256sum >/dev/null 2>&1; then
  sha256_of() { sha256sum "$1" | awk '{print $1}'; }
elif command -v shasum >/dev/null 2>&1; then
  sha256_of() { shasum -a 256 "$1" | awk '{print $1}'; }
else
  die2 "need sha256sum or shasum for checksum verification"
fi

EXPECTED="$(awk 'NR==1 {print $1}' "$TMP/$ASSET.sha256")"
[ -n "$EXPECTED" ] || die "empty .sha256 sidecar: $URL.sha256"
ACTUAL="$(sha256_of "$TMP/$ASSET")" || die "checksum computation failed"
[ "$ACTUAL" = "$EXPECTED" ] \
  || die "checksum mismatch for $ASSET: expected $EXPECTED, got $ACTUAL"

EXTRACT="$TMP/extract"
mkdir -p "$EXTRACT" || die "mkdir failed"

case "$EXT" in
  tar.gz|tgz)
    tar -xzf "$TMP/$ASSET" -C "$EXTRACT" || die "extract failed: $ASSET"
    ;;
  zip)
    command -v unzip >/dev/null 2>&1 || die2 "unzip not found"
    unzip -q "$TMP/$ASSET" -d "$EXTRACT" || die "extract failed: $ASSET"
    ;;
  *)
    die "unhandled archive type: $EXT"
    ;;
esac

SRC="$(find "$EXTRACT" -type f -name archspec | head -n 1)"
[ -n "$SRC" ] || die "archspec binary not found in $ASSET"

mkdir -p "$INSTALL_DIR" || die "cannot create $INSTALL_DIR"
cp "$SRC" "$INSTALL_DIR/archspec" || die "install into $INSTALL_DIR failed"
chmod 755 "$INSTALL_DIR/archspec" || die "chmod failed"

printf 'installed: %s\n' "$INSTALL_DIR/archspec"
"$INSTALL_DIR/archspec" --version || die "installed binary failed to run"
