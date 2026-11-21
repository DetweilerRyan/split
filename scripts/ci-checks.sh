#!/usr/bin/env bash
# Runs AGENTS.md's definition-of-done checks at the same time, for .github/workflows/ci.yml.
# Each check's output goes to its own log, printed afterwards in a group named for the check,
# with an error annotation for each check that failed. Types runs before Production build, not
# beside it. Reasons for both are in docs/engineering/ci.meta.md.
set -u

if [ ! -f package.json ]; then
  echo "ERROR: Run this script from the SplitSmart repository root." >&2
  exit 1
fi

# Outside the checkout, so lint and formatting never read a log while it is being written.
logs=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/ci-checks.XXXXXX")

names=('Lint' 'Formatting' 'Types' 'Tests' 'Production build')
scripts=('lint' 'format:check' 'typecheck' 'test' 'build')

# Runs check $1 and records its exit code and duration in tenths of a second.
check() {
  local start end code
  start=$(date +%s%N)
  npm run "${scripts[$1]}" >"$logs/$1.log" 2>&1
  code=$?
  end=$(date +%s%N)
  echo "$code $(((end - start) / 100000000))" >"$logs/$1.status"
}

check 0 &
check 1 &
check 3 &
{
  check 2
  check 4
} &
wait

failed=0
for i in "${!names[@]}"; do
  name=${names[$i]}
  code=1 tenths=0
  [ -f "$logs/$i.status" ] && read -r code tenths <"$logs/$i.status"
  echo "::group::$name (npm run ${scripts[$i]}): exit $code, $((tenths / 10)).$((tenths % 10)) s"
  cat "$logs/$i.log" 2>/dev/null
  echo "::endgroup::"
  if [ "$code" != 0 ]; then
    echo "::error title=$name failed::npm run ${scripts[$i]} exited with code $code. Its output is in the '$name' group above."
    failed=1
  fi
done
exit $failed
