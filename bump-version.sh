#!/usr/bin/env bash
# ============================================================================
# bump-version.sh  —  Automatiza: bump version → commit → tag → push
#
# Uso:
#   ./bump-version.sh <major|minor|patch|prerelease> [--preid <id>] [--dry-run]
#   ./bump-version.sh <semver-exacto>                 [--dry-run]
#
# Ejemplos:
#   ./bump-version.sh patch              # 1.0.0 → 1.0.1
#   ./bump-version.sh minor              # 1.0.0 → 1.1.0
#   ./bump-version.sh major              # 1.0.0 → 2.0.0
#   ./bump-version.sh prerelease         # 1.0.0 → 1.0.1-0
#   ./bump-version.sh prerelease --preid beta  # 1.0.0 → 1.0.1-beta.0
#   ./bump-version.sh 1.5.0              # fuerza 1.5.0 exacto
#   ./bump-version.sh patch --dry-run    # solo muestra, no ejecuta
#
# Requisitos: Node.js >= 18, git, y estar en la rama 'main' con working tree
#             limpio.  No requiere paquetes npm externos.
# ============================================================================

set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
DRY_RUN=false
PREID=""

# ── Colores ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${CYAN}ℹ️${NC}  $*"; }
ok()    { echo -e "${GREEN}✅${NC}  $*"; }
warn()  { echo -e "${YELLOW}⚠️${NC}  $*"; }
err()   { echo -e "${RED}❌${NC}  $*" >&2; }
step()  { echo; echo -e "${BOLD}─── $* ───${NC}"; }

# ── Parsear argumentos ──────────────────────────────────────────────────────
BUMP_SPEC=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --preid)   PREID="$2"; shift 2 ;;
    --help|-h) sed -n '/^# Uso:/,/^$/p' "$0" | sed 's/^# //'; exit 0 ;;
    *)
      [[ -z "$BUMP_SPEC" ]] && BUMP_SPEC="$1" && shift \
        || { err "Argumento inesperado: $1"; exit 1; }
      ;;
  esac
done

if [[ -z "$BUMP_SPEC" ]]; then
  err "Falta el tipo de bump o versión."
  echo "Uso: $SCRIPT_NAME <major|minor|patch|prerelease|<semver>> [--preid <id>] [--dry-run]"
  exit 1
fi

# ── Validar entorno ─────────────────────────────────────────────────────────
step "Validando entorno"

# 1. Node.js >= 18
command -v node &>/dev/null || { err "Node.js no está instalado."; exit 1; }
NODE_MAJOR="$(node -e "console.log(process.versions.node.split('.')[0])")"
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  err "Se requiere Node.js >= 18 (tienes $(node -v))."
  exit 1
fi
ok "Node.js $(node -v)"

# 2. npm >= 9 (soporta bien 'npm version --preid')
command -v npm &>/dev/null || { err "npm no está instalado."; exit 1; }
ok "npm $(npm -v)"

# 3. Git
command -v git &>/dev/null || { err "Git no está instalado."; exit 1; }
ok "Git $(git --version 2>&1 | awk '{print $3}')"

# 4. Dentro de un repositorio git
if ! git rev-parse --is-inside-work-tree &>/dev/null; then
  err "No estás dentro de un repositorio git."
  exit 1
fi
ok "Repositorio git detectado"

# 5. Rama main (warn si no)
CURRENT_BRANCH="$(git branch --show-current)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  warn "Estás en la rama '$CURRENT_BRANCH', no en 'main'."
  read -rp "  ¿Continuar de todas formas? [y/N] " CONFIRM
  [[ "$CONFIRM" =~ ^[Yy]$ ]] || { info "Abortado."; exit 1; }
fi

# 6. Working tree limpio
if ! git diff-index --quiet HEAD --; then
  err "El working tree tiene cambios sin commit."
  err "Haz commit o stash antes de versionar."
  exit 1
fi
ok "Working tree limpio"

# 7. Aviso de commits sin push
UPSTREAM="$(git rev-parse "@{upstream}" 2>/dev/null || true)"
if [[ -n "$UPSTREAM" ]]; then
  AHEAD="$(git rev-list --count "@{upstream}..HEAD" 2>/dev/null || echo 0)"
  if [[ "$AHEAD" -gt 0 ]]; then
    warn "Tienes $AHEAD commit(s) sin pushear (se pushean junto con el tag)."
  fi
fi

# ── Leer versión actual ─────────────────────────────────────────────────────
CURRENT_VERSION="$(node -p "require('./package.json').version")"
ok "Versión actual: ${BOLD}${CURRENT_VERSION}${NC}"

# ── Calcular nueva versión usando npm version (sin commit ni tag) ──────────
step "Calculando nueva versión"

PREID_FLAG=""
[[ -n "$PREID" ]] && PREID_FLAG="--preid $PREID"

if $DRY_RUN; then
  # Simular el bump sin tocar archivos
  NEW_VERSION="$(node -e "
    const v = '${CURRENT_VERSION}';
    const parts = v.split('.').map(Number);
    let result;
    switch ('${BUMP_SPEC}') {
      case 'major': result = [parts[0]+1, 0, 0]; break;
      case 'minor': result = [parts[0], parts[1]+1, 0]; break;
      case 'patch': result = [parts[0], parts[1], parts[2]+1]; break;
      case 'prerelease':
        const pre = '${PREID}' ? '${PREID}.' : '';
        result = [parts[0], parts[1], parts[2]+1, '-'+pre+'0']; break;
      default: result = '${BUMP_SPEC}'.split('.'); break;
    }
    console.log(Array.isArray(result) ? result.join('.') : result);
  " 2>/dev/null || echo "${BUMP_SPEC}")"
else
  # npm version actualiza package.json + package-lock.json en un solo comando
  NEW_VERSION="$(npm version "$BUMP_SPEC" --no-git-tag-version --no-commit-hooks $PREID_FLAG 2>&1)"
  # npm version devuelve "vX.Y.Z", quitar la v
  NEW_VERSION="${NEW_VERSION#v}"
fi

# Validar que la nueva versión sea razonable
if [[ -z "$NEW_VERSION" || "$NEW_VERSION" == *"npm ERR"* ]]; then
  err "No se pudo calcular la nueva versión."
  err "Bump spec: '$BUMP_SPEC', preid: '${PREID:-}'"
  err "Usa 'npm version' para depurar: npm version $BUMP_SPEC --no-git-tag-version --no-commit-hooks $PREID_FLAG"
  exit 1
fi

TAG="v${NEW_VERSION}"

# Detectar pre-release
IS_PRERELEASE=false
if [[ "$NEW_VERSION" == *-* ]]; then
  IS_PRERELEASE=true
fi

ok "Nueva versión: ${BOLD}${NEW_VERSION}${NC}"
info "Tag         : ${BOLD}${TAG}${NC}"
info "Pre-release : ${IS_PRERELEASE}"

# ── Confirmar ───────────────────────────────────────────────────────────────
echo
if $DRY_RUN; then
  warn "⚠️  MODO DRY-RUN — no se ejecutó ningún cambio real ⚠️"
  exit 0
fi

if [[ -t 1 ]]; then
  read -rp "¿Proceder con el release v${NEW_VERSION}? [y/N] " CONFIRM
  [[ "$CONFIRM" =~ ^[Yy]$ ]] || { info "Abortado."; exit 1; }
fi

# ── Ejecutar ────────────────────────────────────────────────────────────────
step "1. ✅ package.json actualizado"
info "Versión: ${CURRENT_VERSION} → ${NEW_VERSION}"
info "Reflejado en package.json + package-lock.json (por npm version)"

step "2. Haciendo commit"

COMMIT_MSG="chore(release): bump version to ${NEW_VERSION}"

git add package.json package-lock.json 2>/dev/null || git add package.json
git commit -m "$COMMIT_MSG" -m "Tag: ${TAG}"
ok "Commit creado: ${COMMIT_MSG}"

step "3. Creando tag"

git tag -a "$TAG" -m "Release ${TAG}"
ok "Tag creado: ${TAG}"

step "4. Pusheando a GitHub"

REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"
if [[ -z "$REMOTE_URL" ]]; then
  warn "No se encontró remote 'origin'. Debes pushear manualmente:"
  info "  git push origin $CURRENT_BRANCH"
  info "  git push origin $TAG"
else
  info "Remote: $REMOTE_URL"
  info "Push a origin..."
  git push origin "$CURRENT_BRANCH"
  git push origin "$TAG"
fi

# ── Resumen final ───────────────────────────────────────────────────────────
REPO_SLUG="$(git config --get remote.origin.url 2>/dev/null \
  | sed -n 's/.*[:/]\([^/]*\/[^/]*\)\.git/\1/p' \
  || echo "<usuario>/AML_AudioTool_YouTubeMP3_Downloader")"

echo
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  🚀  Release ${BOLD}${TAG}${NC}${GREEN} completado!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo
echo -e "  Tag   : ${BOLD}${TAG}${NC}"
echo -e "  Commit: ${BOLD}${COMMIT_MSG}${NC}"
echo
echo -e "  GitHub Actions hará el resto automáticamente:"
echo -e "    🔨  Build: Windows EXE portable"
echo -e "    🚀  GitHub Release con release notes automáticas"
echo
echo -e "  🔗  https://github.com/${REPO_SLUG}/releases/tag/${TAG}"
echo
