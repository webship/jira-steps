#!/usr/bin/env bash
#
# Build the local site the @webship-js/jira-steps suite runs against: Jira
# Software Data Center from the official container image, with its own
# PostgreSQL container, set up without a person at the keyboard.
#
#   ./build-jira-site.sh            build (or finish building) the site and seed it
#   ./build-jira-site.sh renew      restart the application so the test licence starts a new 3-hour window
#   ./build-jira-site.sh status     print the application state and the licence expiry
#   ./build-jira-site.sh down       stop and remove the containers and volumes
#
# Licence. There is no free self-hosted edition. The script uses the "10 user
# Jira Software Data Center license, expires in 3 hours" timebomb licence that
# Atlassian publishes for testing Data Center products:
#   https://developer.atlassian.com/platform/marketplace/timebomb-licenses-for-testing-server-apps/
# It reads the key from the JIRA_LICENSE environment variable, and when that is
# empty it downloads the key from that page at build time. No key is stored in
# this script or in the repository. The licence counts its three hours from the
# start of the application: `renew` restarts it and starts a new window.
#
# What the build leaves on the site (the suite relies on it and never changes it):
#   accounts   admin (administrator), alex and sam (ordinary users)
#   projects   SCRUM "Scrum Sample" (Scrum software development, with a board,
#              a backlog and an active sprint) and KAN "Kanban Sample" (Kanban)
#   issues     a few named issues in each project, a shared filter and a dashboard

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

JIRA_PORT="${JIRA_PORT:-2990}"
export JIRA_PORT
BASE="${JIRA_BASE_URL:-http://localhost:${JIRA_PORT}}"
LICENSE_PAGE='https://developer.atlassian.com/platform/marketplace/timebomb-licenses-for-testing-server-apps/'
LICENSE_HEADING='10 user Jira Software Data Center license, expires in 3 hours'

ADMIN_USER="${JIRA_ADMIN_USER:-admin}"
ADMIN_PASSWORD="${JIRA_ADMIN_PASSWORD:-Admin123456789!}"
ALEX_USER="${JIRA_ALEX_USER:-alex}"
ALEX_PASSWORD="${JIRA_ALEX_PASSWORD:-Alex123456789!}"
SAM_USER="${JIRA_SAM_USER:-sam}"
SAM_PASSWORD="${JIRA_SAM_PASSWORD:-Sam123456789!}"

COOKIES="$(mktemp)"
trap 'rm -f "$COOKIES"' EXIT

say() { printf '\n== %s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

state() { curl -s --max-time 10 "$BASE/status" | sed -n 's/.*"state":"\([A-Z_]*\)".*/\1/p'; }

wait_for_state() {
  # wait_for_state <seconds> <state> [<state> ...]
  local limit="$1"; shift
  local waited=0 now=''
  while [ "$waited" -lt "$limit" ]; do
    now="$(state || true)"
    for wanted in "$@"; do
      [ "$now" = "$wanted" ] && { echo "state: $now (after ${waited}s)"; return 0; }
    done
    [ "$now" = "ERROR" ] && fail "the application reports state ERROR; see: docker compose logs jira"
    sleep 5; waited=$((waited + 5))
  done
  fail "the application did not reach $* within ${limit}s (last state: ${now:-none}); see: docker compose logs jira"
}

license_key() {
  # The key, on one line, from JIRA_LICENSE or from Atlassian's public page.
  if [ -n "${JIRA_LICENSE:-}" ]; then
    printf '%s' "$JIRA_LICENSE" | tr -d ' \n\r'
    return
  fi
  curl -sL --max-time 60 -A 'Mozilla/5.0' "$LICENSE_PAGE" | python3 -c '
import re, sys
page = sys.stdin.read()
heading = sys.argv[1]
at = page.find(heading)
if at < 0:
    sys.exit("the licence heading was not found on the page")
m = re.search(r"(AAAB[A-Za-z0-9+/=\\\s]+?)(?:```|<|\")", page[at:at + 4000])
if not m:
    sys.exit("no licence key follows the heading")
key = re.sub(r"\\n|\\r|\s", "", m.group(1))
sys.stdout.write(key)
' "$LICENSE_HEADING" || fail "could not read the test licence from $LICENSE_PAGE; set JIRA_LICENSE to the key published there"
}

token() {
  awk '$6 == "atlassian.xsrf.token" { print $7 }' "$COOKIES" | tail -1
}

wizard_post() {
  # wizard_post <action> <curl --data-urlencode arguments ...>: one step of the setup wizard.
  local action="$1"; shift
  curl -s -o /dev/null -c "$COOKIES" -b "$COOKIES" "$BASE/secure/${action}!default.jspa"
  local args=()
  for pair in "$@"; do args+=(--data-urlencode "$pair"); done
  curl -s -c "$COOKIES" -b "$COOKIES" --max-time 600 \
    -H 'X-Atlassian-Token: no-check' \
    --data-urlencode "atl_token=$(token)" "${args[@]}" \
    -o "$HERE/.last-response.html" -w '%{http_code} %{redirect_url}\n' \
    "$BASE/secure/${action}.jspa"
  # What the wizard answered with: the title of the page and the errors it shows, if any.
  python3 - "$HERE/.last-response.html" <<'PY' || true
import re, sys
try:
    page = open(sys.argv[1], encoding="utf-8", errors="replace").read()
except OSError:
    sys.exit(0)
title = re.search(r"<title>(.*?)</title>", page, re.S)
errors = [re.sub(r"<[^>]+>|\s+", " ", e).strip() for e in re.findall(r'class="[^"]*\berror\b[^"]*"[^>]*>(.*?)</(?:div|span|p)>', page, re.S)]
errors = [e for e in errors if e]
if title or errors:
    print("  page:", re.sub(r"\s+", " ", title.group(1)).strip() if title else "(no title)", "| errors:", "; ".join(errors[:5]) or "none")
PY
}

SESSION="$(mktemp)"
trap 'rm -f "$COOKIES" "$SESSION"' EXIT

sign_in() {
  # A session as the administrator, through the resource the sign-in form itself uses
  # (basic authentication is off by default on this release).
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' -c "$SESSION" \
    -H 'Content-Type: application/json' -H 'X-Atlassian-Token: no-check' \
    --data "$(python3 -c 'import json,sys; print(json.dumps({"username": sys.argv[1], "password": sys.argv[2], "rememberMe": False, "targetUrl": "", "captchaId": ""}))' "$ADMIN_USER" "$ADMIN_PASSWORD")" \
    "$BASE/rest/tsv/1.0/authenticate?os_authType=none")"
  [ "$code" = "200" ]
}

sign_in_when_ready() {
  # The sign-in resource comes up a little after the application reports RUNNING.
  local waited=0
  until sign_in; do
    [ "$waited" -ge 300 ] && fail "the administrator could not sign in within 300s (check JIRA_ADMIN_USER and JIRA_ADMIN_PASSWORD)"
    sleep 5; waited=$((waited + 5))
  done
}

api() {
  # api <METHOD> <path> [<json>]: a REST call as the administrator; prints the body, fails on an error status.
  local method="$1" path="$2" body="${3:-}"
  local args=(-s -b "$SESSION" -X "$method" -H 'Accept: */*' -H 'X-Atlassian-Token: no-check' -w '\n%{http_code}')
  [ -n "$body" ] && args+=(-H 'Content-Type: application/json' --data "$body")
  local out code
  out="$(curl "${args[@]}" "$BASE$path")"
  code="${out##*$'\n'}"
  out="${out%$'\n'*}"
  if [ "$code" -ge 400 ]; then
    printf 'REST %s %s answered %s: %s\n' "$method" "$path" "$code" "$out" >&2
    return 1
  fi
  printf '%s' "$out"
}

wait_for_apps() {
  # The application answers RUNNING a little before its apps (boards, licences) do: wait for them.
  local waited=0
  until curl -s -o /dev/null -b "$SESSION" -w '%{http_code}' "$BASE/rest/agile/1.0/board" | grep -q '^200$' \
     && curl -s -o /dev/null -b "$SESSION" -H 'Accept: */*' -w '%{http_code}' "$BASE/rest/plugins/applications/1.0/installed/jira-software/license" | grep -q '^200$'; do
    [ "$waited" -ge 600 ] && fail "the boards and licence resources did not answer within 600s; see: docker compose logs jira"
    sleep 5; waited=$((waited + 5))
    # A restart ends the session: sign in again once the sign-in resource is back.
    sign_in 2>/dev/null || true
  done
  echo "apps ready (after ${waited}s)"
}

json() { python3 -c "import json,sys; d=json.load(sys.stdin); print($1)"; }

case "${1:-build}" in
  down)
    docker compose down -v
    exit 0
    ;;
  renew)
    say "Restarting the application: the test licence starts a new 3-hour window"
    docker compose restart jira
    wait_for_state 600 RUNNING
    sign_in_when_ready
    wait_for_apps
    api GET '/rest/plugins/applications/1.0/installed/jira-software/license' | json "'licence valid:', d.get('valid'), '| expires:', __import__('datetime').datetime.fromtimestamp(d['expiryDate'] / 1000).strftime('%Y-%m-%d %H:%M')"
    exit 0
    ;;
  status)
    sign_in_when_ready
    wait_for_apps >/dev/null
    echo "state: $(state)"
    api GET '/rest/plugins/applications/1.0/installed/jira-software/license' | json "'licence valid:', d.get('valid'), '| users:', d.get('maximumNumberOfUsers'), '| expires:', __import__('datetime').datetime.fromtimestamp(d['expiryDate'] / 1000).strftime('%Y-%m-%d %H:%M')" || true
    exit 0
    ;;
  build) ;;
  *) fail "unknown action: $1 (build, renew, status, down)" ;;
esac

say "Starting the containers (Jira Software ${JIRA_VERSION:-11.3.13} and PostgreSQL)"
docker compose up -d
wait_for_state 900 FIRST_RUN RUNNING

if [ "$(state)" = "FIRST_RUN" ]; then
  say "Setup wizard: opening the site (this loads the starting data: the user directory, the default schemes)"
  # The first visit goes through startup.jsp, which fills the empty database, and ends
  # on the first page of the wizard. Without it the wizard later answers
  # "Cannot add user, all the user directories are read-only."
  waited=0
  until landed="$(curl -s -L -o /dev/null -c "$COOKIES" -b "$COOKIES" --max-time 600 -w '%{url_effective}' "$BASE/")" && case "$landed" in *SetupApplicationProperties*) true ;; *) false ;; esac; do
    [ "$waited" -ge 600 ] && fail "the first page of the setup wizard did not show within 600s (last address: ${landed:-none})"
    sleep 5; waited=$((waited + 5))
  done
  echo "wizard ready at $landed"

  say "Setup wizard: application properties"
  wizard_post SetupApplicationProperties "title=Webship Test Site" "mode=private" "baseURL=$BASE" "nextStep=true"

  say "Setup wizard: licence (Atlassian's public 3-hour test licence, or JIRA_LICENSE)"
  KEY="$(license_key)"
  [ "${#KEY}" -gt 200 ] || fail "the licence key looks too short (${#KEY} characters)"
  wizard_post SetupLicense "setupLicenseKey=$KEY"
  unset KEY

  say "Setup wizard: administrator account"
  # The user directory comes up a little after the licence is accepted: until then the
  # wizard answers "Cannot add user, all the user directories are read-only." Try again.
  waited=0
  while :; do
    answer="$(wizard_post SetupAdminAccount "fullname=Site Administrator" "email=admin@example.com" "username=$ADMIN_USER" "password=$ADMIN_PASSWORD" "confirm=$ADMIN_PASSWORD")"
    printf '%s\n' "$answer"
    case "$answer" in *"errors: none"*|302*) [ "${answer#*errors: }" = "$answer" ] || [ "${answer##*errors: }" = "none" ] && break ;; esac
    [ "$waited" -ge 300 ] && fail "the wizard did not accept the administrator account within 300s"
    sleep 10; waited=$((waited + 10))
  done

  say "Setup wizard: no outgoing mail"
  answer="$(wizard_post SetupMailNotifications "noemail=true")"
  printf '%s\n' "$answer"
  # A redirect to the welcome page or a "Loading..." page both mean the wizard is done;
  # the sign-in below is the proof.
  case "$answer" in 302*|200*"errors: none"*) ;; *) fail "the last step of the wizard failed; see: docker compose logs jira" ;; esac

  wait_for_state 600 RUNNING
fi
rm -f "$HERE/.last-response.html"

say "Checking the administrator can sign in"
sign_in_when_ready
wait_for_apps
api GET '/rest/api/2/myself' | json "'signed in as', d['name']"

exists() { api GET "$1" >/dev/null 2>&1; }

add_user() {
  # add_user <username> <password> <display name>
  if exists "/rest/api/2/user?username=$1"; then echo "account $1: already there"; return; fi
  api POST /rest/api/2/user "$(python3 -c 'import json,sys; print(json.dumps({"name": sys.argv[1], "password": sys.argv[2], "emailAddress": sys.argv[1] + "@example.com", "displayName": sys.argv[3], "notification": False}))' "$1" "$2" "$3")" >/dev/null
  echo "account $1: created"
}

add_project() {
  # add_project <KEY> <name> <template key>
  if exists "/rest/api/2/project/$1"; then echo "project $1: already there"; return; fi
  api POST /rest/api/2/project "$(python3 -c 'import json,sys; print(json.dumps({"key": sys.argv[1], "name": sys.argv[2], "projectTypeKey": "software", "projectTemplateKey": sys.argv[3], "lead": sys.argv[4], "description": sys.argv[2] + " project of the test site"}))' "$1" "$2" "$3" "$ADMIN_USER")" >/dev/null
  echo "project $1: created"
}

add_issue() {
  # add_issue <PROJECT> <type> <summary> [<assignee>]
  local found
  found="$(api POST /rest/api/2/search "$(python3 -c 'import json,sys; print(json.dumps({"jql": "project = %s AND summary ~ \"\\\"%s\\\"\"" % (sys.argv[1], sys.argv[2]), "fields": ["summary"], "maxResults": 1}))' "$1" "$3")" | json "d['total']")"
  if [ "$found" != "0" ]; then echo "issue \"$3\": already there"; return; fi
  api POST /rest/api/2/issue "$(python3 -c '
import json, sys
fields = {"project": {"key": sys.argv[1]}, "issuetype": {"name": sys.argv[2]}, "summary": sys.argv[3], "description": "Seeded by the site build script. The suite reads it and never changes it."}
if len(sys.argv) > 4 and sys.argv[4]:
    fields["assignee"] = {"name": sys.argv[4]}
print(json.dumps({"fields": fields}))' "$1" "$2" "$3" "${4:-}")" | json "'issue', d['key'], 'created'"
}

say "Accounts (created here, never by a suite)"
add_user "$ALEX_USER" "$ALEX_PASSWORD" "Alex Tester"
add_user "$SAM_USER" "$SAM_PASSWORD" "Sam Reporter"

say "Sample projects"
add_project SCRUM "Scrum Sample" "com.pyxis.greenhopper.jira:gh-scrum-template"
add_project KAN "Kanban Sample" "com.pyxis.greenhopper.jira:gh-kanban-template"

say "Sample issues"
add_issue SCRUM Story "Set up the build pipeline"
add_issue SCRUM Bug "Fix the login redirect" "$ALEX_USER"
add_issue SCRUM Task "Write the release notes"
add_issue SCRUM Story "Add the search page" "$SAM_USER"
add_issue KAN Task "Review the style guide"
add_issue KAN Task "Update the contact page" "$ALEX_USER"
add_issue KAN Bug "Broken link in the footer"

say "A shared filter"
if [ "$(api GET /rest/api/2/filter/favourite | json "len([f for f in d if f['name'] == 'Sample open issues'])")" = "0" ]; then
  FILTER_ID="$(api POST /rest/api/2/filter '{"name":"Sample open issues","description":"Open issues of the two sample projects","jql":"project in (SCRUM, KAN) AND resolution = Unresolved ORDER BY key ASC","favourite":true}' | json "d['id']")"
  api POST "/rest/api/2/filter/$FILTER_ID/permission" '{"type":"authenticated"}' >/dev/null
  echo "filter Sample open issues: created and shared with every signed-in user"
else
  echo "filter Sample open issues: already there"
fi

say "Done"
api GET /rest/api/2/serverInfo | json "'Jira Software', d['version'], 'at', d['baseUrl']"
api GET '/rest/plugins/applications/1.0/installed/jira-software/license' | json "'licence:', d.get('organizationName'), '| users:', d.get('maximumNumberOfUsers'), '| expires:', __import__('datetime').datetime.fromtimestamp(d['expiryDate'] / 1000).strftime('%Y-%m-%d %H:%M')"
echo "Accounts: $ADMIN_USER, $ALEX_USER, $SAM_USER. Renew the licence window with: $0 renew"
