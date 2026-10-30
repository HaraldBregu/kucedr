#!/usr/bin/env bash
# Creates the private bucket for passphrase-encrypted cloud API keys on a hosted Supabase project.
# Usage: SUPABASE_PROJECT_REF=<ref> scripts/supabase-credentials.sh
# Requires `npx supabase login` (or SUPABASE_ACCESS_TOKEN). Safe to re-run.
set -euo pipefail

cd "$(dirname "$0")/.."
REF="${SUPABASE_PROJECT_REF:-}"
MIGRATION="supabase/migrations/20261030140000_credentials_bucket.sql"
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

echo "→ Checking whether the credentials bucket policies exist"
installed="$(query "select exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'credentials_owner_select') as installed")" || {
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

echo "→ Verifying bucket is private and has four owner policies"
verified="$(query "select
  (select not public from storage.buckets where id = 'credentials')
  and (select count(*) = 4 from pg_policies where schemaname = 'storage' and policyname like 'credentials_owner_%')
  as verified")" || { echo "$verified" >&2; exit 1; }
echo "$verified"
grep -q true <<<"$verified" || { echo "Verification failed." >&2; exit 1; }

echo "Done. If you later use 'supabase db push', first run:"
echo "  npx supabase migration repair 20261030140000 --status applied --project-ref $REF"
