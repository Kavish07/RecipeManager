#!/usr/bin/env bash
# Substitutes .env into app.js placeholders, same as .github/workflows/deploy.yml.
# Modifies app.js in place for local testing - do not commit the result.
set -euo pipefail
cd "$(dirname "$0")/.."

set -a
source .env
set +a

sed -i "s|__SUPABASE_URL__|${SUPABASE_URL}|" app.js
sed -i "s|__SUPABASE_ANON_KEY__|${SUPABASE_ANON_KEY}|" app.js

echo "app.js updated with local Supabase config - do not commit this change."
