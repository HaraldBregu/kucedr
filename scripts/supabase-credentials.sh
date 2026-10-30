#!/usr/bin/env bash
# Applies the cloud API key migration and deploys its Edge Functions to a hosted Supabase project.
# Usage: SUPABASE_PROJECT_REF=<ref> scripts/supabase-credentials.sh [--test]
# Requires `npx supabase login` (or SUPABASE_ACCESS_TOKEN). Safe to re-run.
set -euo pipefail

cd "$(dirname "$0")/.."
REF="${SUPABASE_PROJECT_REF:-}"
MIGRATION="supabase/migrations/20261030120000_credentials.sql"
TEST="supabase/tests/database/credentials.test.sql"
supabase() {
	local out status=0
	out="$(npx --no-install supabase "$@" 2>&1)" || status=$?
	grep -v -e 'new version of Supabase CLI' -e 'recommend updating' <<<"$out" || true
	return "$status"
}
query() { supabase db query --linked --project-ref "$REF" "$@"; }

if [[ ! "$REF" =~ ^[a-z]{20}$ ]]; then
	echo "Set SUPABASE_PROJECT_REF to your 20-letter project ref (Dashboard → Project Settings → General)." >&2
	exit 1
fi

echo "→ Checking whether the credentials schema is installed"
installed="$(query "select to_regnamespace('credentials') is not null as installed")" || {
	echo "$installed" >&2
	echo "Could not reach the project. Run 'npx supabase login' and check the project ref." >&2
	exit 1
}
if grep -q true <<<"$installed"; then
	echo "  already installed, skipping migration"
else
	echo "→ Applying $MIGRATION in one transaction"
	sql="$(mktemp)"
	trap 'rm -f "$sql"' EXIT
	{ echo 'begin;'; cat "$MIGRATION"; echo 'commit;'; } > "$sql"
	query -f "$sql"
fi

echo "→ Verifying table and privileges"
verified="$(query "select
  to_regclass('credentials.credentials') is not null
  and not has_schema_privilege('authenticated', 'credentials', 'usage')
  and not has_function_privilege('anon', 'public.credential_secret(uuid, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.credential_secret(uuid, uuid)', 'execute')
  and has_function_privilege('service_role', 'public.credential_secret(uuid, uuid)', 'execute')
  as verified")"
echo "$verified"
grep -q true <<<"$verified" || { echo "Verification failed." >&2; exit 1; }

echo "→ Deploying Edge Functions (JWT verification on)"
supabase functions deploy credentials --project-ref "$REF" --use-api
supabase functions deploy model-gateway --project-ref "$REF" --use-api

if [[ "${1:-}" == "--test" ]]; then
	echo "→ Running $TEST (wrapped in a transaction that rolls back)"
	query -f "$TEST"
fi

echo "Done. If you later use 'supabase db push', first run:"
echo "  npx supabase migration repair 20261030120000 --status applied --project-ref $REF"
