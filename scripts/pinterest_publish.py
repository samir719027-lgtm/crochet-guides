#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pinterest auto-publisher for CrochetGuides.

ÙŠÙ‚Ø±Ø§ guides Ù…Ù† search-index.json ÙˆÙŠÙ†Ø´Ø± pins Ø¹Ù„Ù‰ Pinterest Ø¹Ø¨Ø± API v5.

Ø§Ù„Ø®Ø·ÙˆØ§Øª:
  # 1) Ø¬ÙŠØ¨ ØªÙˆÙƒÙ† ÙÙŠÙ‡ ØµÙ„Ø§Ø­ÙŠØ§Øª Ø§Ù„ÙƒØªØ§Ø¨Ø© (OAuth). Ø®Ø§ØµÙƒ ØªÙƒÙˆÙ† Ø²Ø¯Øª Ø§Ù„Ù€ Redirect URI
  #    http://localhost:8085/ Ù ØªØ·Ø¨ÙŠÙ‚Ùƒ Ù…Ù† developers.pinterest.com
  python scripts/pinterest_publish.py --auth --app-id 1607174 --app-secret XXXXX

  # 2) Ø¹Ø±Ø¶ Ø§Ù„Ù„ÙˆØ­Ø§Øª (Boards) Ø¨Ø§Ø´ ØªØ§Ø®Ø° Ø§Ù„Ù€ board_id
  python scripts/pinterest_publish.py --fetch-boards

  # 3) ØªØ¬Ø±Ø¨Ø© Ø¨Ù„Ø§ Ù…Ø§ ØªÙ†Ø´Ø± (Dry run, Ø§Ù„Ø§ÙØªØ±Ø§Ø¶ÙŠ)
  python scripts/pinterest_publish.py --limit 5

  # 4) Ø§Ù„Ù†Ø´Ø± Ø§Ù„Ø­Ù‚ÙŠÙ‚ÙŠ
  python scripts/pinterest_publish.py --publish --limit 5

  # 5) ØªØ¬Ø¯ÙŠØ¯ Ø§Ù„ØªÙˆÙƒÙ† Ù‚Ø¨Ù„ Ù…Ø§ ÙŠØ³Ø§Ù„ÙŠ
  python scripts/pinterest_publish.py --refresh
"""

import argparse
import base64
import json
import os
import sys
import time
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import requests

API = "https://api.pinterest.com/v5"
OAUTH_AUTHORIZE = "https://www.pinterest.com/oauth/"

SITE = "https://crochetguide.uk"
IMAGE_URL_TEMPLATE = SITE + "/guides/images/{slug}.jpg"

SCOPES = "boards:read,boards:write,pins:read,pins:write,user_accounts:read"

ROOT = Path(__file__).resolve().parent.parent
INDEX_FILE = ROOT / "search-index.json"
IMAGES_DIR = ROOT / "guides" / "images"
STATE_FILE = ROOT / "scripts" / "pinterest_state.json"
TOKEN_FILE = ROOT / "scripts" / "pinterest_token.json"

DEFAULT_PORT = 8085
REDIRECT_URI = f"http://localhost:{DEFAULT_PORT}/"

# ---------------------------------------------------------------------------
# BOARD_MAP: Ø±Ø¨Ø· ÙƒÙ„ ØªØµÙ†ÙŠÙ (category) Ø¨Ù„ÙˆØ­Ø© (board_id) Ø¯ÙŠØ§Ù„ Pinterest
# Ø¨Ø¯Ù„ Ø§Ù„Ø£Ø±Ù‚Ø§Ù… Ù‡Ù†Ø§ Ø¨Ø§Ù„Ù€ board_id Ø§Ù„Ø­Ù‚ÙŠÙ‚ÙŠ Ø¯ÙŠØ§Ù„Ùƒ (Ø´ÙˆÙ: --fetch-boards)
# ---------------------------------------------------------------------------
BOARD_MAP = {
    "Amigurumi & Toys":       "1082552897870784267",  # Gifts for Kids & Family
    "Baby & Kids":            "1082552897870784267",  # Gifts for Kids & Family
    "Seasonal & Holiday":     "1082552897870784269",  # Holiday & Seasonal Gifts
    "Home & Decor":           "1082552897870784270",  # Home & Decor Gifts
    "Wearables":              "1082552897870784266",  # Gifts for Her
    "Bags & Accessories":     "1082552897870784266",  # Gifts for Her
    "Techniques & Tutorials": "1082552897870784266",  # Gifts for Her (Ø¨Ø¯Ù„Ù‡Ø§)
    "Guides & Comparisons":   "1082552897870784266",  # Gifts for Her (Ø¨Ø¯Ù„Ù‡Ø§)
}

DEFAULT_BOARD_ID = "1082552897870784266"

TITLE_MAX = 100
DESC_MAX = 800
ALT_MAX = 500


# ---------------------------------------------------------------------------
# Ù‚Ø±Ø§Ø¡Ø© Ø§Ù„Ù€ index ÙˆØ§Ù„Ù…Ù„ÙØ§Øª
# ---------------------------------------------------------------------------
def load_index():
    with open(INDEX_FILE, "r", encoding="utf-8-sig") as f:
        return json.load(f)


def slug_of(guide):
    return guide["url"].replace("/guides/", "").strip("/")


def normalize_category(cat):
    cat = (cat or "").replace("\ufffd", "").strip()
    if cat.startswith("Home &"):
        return "Home & Decor"
    return cat


def image_url_for(slug):
    if not (IMAGES_DIR / f"{slug}.jpg").exists():
        return None
    return IMAGE_URL_TEMPLATE.format(slug=slug)


def board_for(category, override):
    if override:
        return override
    return BOARD_MAP.get(category, DEFAULT_BOARD_ID)


GIFT_EXTRA_SLUGS = {"gift-guide"}

KID_CATEGORIES = {"Baby & Kids", "Amigurumi & Toys"}


def is_gift(guide):
    slug = slug_of(guide)
    category = normalize_category(guide["category"])
    if category == "Seasonal & Holiday":
        return True
    if "roundup" in slug:
        return True
    if slug in GIFT_EXTRA_SLUGS:
        return True
    return False


def is_kid(guide):
    return normalize_category(guide["category"]) in KID_CATEGORIES


def load_json(path, default):
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return default


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_state():
    return load_json(STATE_FILE, {})


def save_state(state):
    save_json(STATE_FILE, state)


# ---------------------------------------------------------------------------
# Ø§Ù„ØªÙˆÙƒÙ†
# ---------------------------------------------------------------------------
def get_token(args):
    if args.token:
        return args.token
    if os.environ.get("PINTEREST_ACCESS_TOKEN"):
        return os.environ["PINTEREST_ACCESS_TOKEN"]
    tok = load_json(TOKEN_FILE, {})
    if tok.get("access_token"):
        return tok["access_token"]
    return None


def save_token(data):
    save_json(
        TOKEN_FILE,
        {
            "access_token": data.get("access_token"),
            "refresh_token": data.get("refresh_token"),
            "scope": data.get("scope"),
            "obtained_at": int(time.time()),
            "expires_in": data.get("expires_in"),
        },
    )


def basic_auth(app_id, app_secret):
    raw = f"{app_id}:{app_secret}".encode()
    return "Basic " + base64.b64encode(raw).decode()


# ---------------------------------------------------------------------------
# OAuth: Ø§Ù„ØªØµØ±ÙŠØ­ + ØªØ¨Ø¯ÙŠÙ„ Ø§Ù„ÙƒÙˆØ¯ Ø¨ØªÙˆÙƒÙ†
# ---------------------------------------------------------------------------
class _CallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        self.server.auth_code = params.get("code", [None])[0]
        self.server.auth_error = params.get("error", [None])[0]
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        msg = "ØªÙ… Ø§Ù„ØªØµØ±ÙŠØ­ Ø¨Ù†Ø¬Ø§Ø­. ØªÙ‚Ø¯Ø± ØªØ³Ø¯ Ù‡Ø§Ø¯ Ø§Ù„Ù†Ø§ÙØ°Ø© ÙˆØ±Ø¬Ø¹ Ù„Ù„Ù€ terminal."
        if self.server.auth_error:
            msg = f"Ø®Ø·Ø£: {self.server.auth_error}"
        self.wfile.write(f"<html><body><h2>{msg}</h2></body></html>".encode("utf-8"))

    def log_message(self, *a):
        pass


def exchange_code(app_id, app_secret, code, redirect_uri):
    resp = requests.post(
        f"{API}/oauth/token",
        headers={
            "Authorization": basic_auth(app_id, app_secret),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
        },
        timeout=30,
    )
    return resp


def do_auth(args):
    app_id = args.app_id or os.environ.get("PINTEREST_APP_ID")
    app_secret = args.app_secret or os.environ.get("PINTEREST_APP_SECRET")
    if not app_id or not app_secret:
        print("Ø®Ø§ØµÙƒ --app-id Ùˆ --app-secret (ÙˆÙ„Ø§ PINTEREST_APP_ID / PINTEREST_APP_SECRET).")
        sys.exit(1)

    redirect_uri = f"http://localhost:{args.port}/"
    auth_url = (
        f"{OAUTH_AUTHORIZE}?client_id={app_id}"
        f"&redirect_uri={urllib.parse.quote(redirect_uri)}"
        f"&response_type=code&scope={urllib.parse.quote(SCOPES)}&state=crochetguides"
    )

    print("Ø§ÙØªØ­ÙŠ Ù‡Ø§Ø¯ Ø§Ù„Ø±Ø§Ø¨Ø· ÙØ§Ù„Ù…ØªØµÙØ­ ÙˆØ¯ÙˆØ² Ø¹Ù„Ù‰ 'Give access':\n")
    print(auth_url)
    print(f"\n(ÙƒÙ†ØªØ³Ù†Ø§Ùˆ Ø§Ù„Ù€ callback Ø¹Ù„Ù‰ {redirect_uri} ...)")
    try:
        webbrowser.open(auth_url)
    except Exception:
        pass

    server = HTTPServer(("localhost", args.port), _CallbackHandler)
    server.timeout = 300
    server.auth_code = None
    server.auth_error = None
    server.handle_request()

    if server.auth_error:
        print(f"Ø®Ø·Ø£ ÙØ§Ù„ØªØ­Ù‚ÙŠÙ‚: {server.auth_error}")
        sys.exit(1)
    if not server.auth_code:
        print("Ù…Ø§Ù„Ù‚ÙŠÙ†Ø§Ø´ Ø§Ù„Ù€ code. Ø¹Ø§ÙˆØ¯ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø©.")
        sys.exit(1)

    print("ØªÙˆØµÙ„Ù†Ø§ Ø¨Ø§Ù„Ù€ codeØŒ ÙƒÙ†ØªØ­ÙˆÙ„Ùˆ Ù„ØªÙˆÙƒÙ† ...")
    resp = exchange_code(app_id, app_secret, server.auth_code, redirect_uri)
    if resp.status_code != 200:
        print(f"ÙØ´Ù„ ØªØ¨Ø¯ÙŠÙ„ Ø§Ù„ØªÙˆÙƒÙ†: {resp.status_code}\n{resp.text}")
        sys.exit(1)

    data = resp.json()
    save_token(data)
    print("\nâœ… ØªÙˆØµÙ„Ù†Ø§ Ø¨Ø§Ù„ØªÙˆÙƒÙ†!")
    print(f"scope: {data.get('scope')}")
    print(f"expires_in: {data.get('expires_in')} Ø«Ø§Ù†ÙŠØ© (~{int(data.get('expires_in', 0)) // 86400} ÙŠÙˆÙ…)")
    print(f"ØªÙˆÙƒÙ† Ù…Ø­ÙÙˆØ¸ Ù: {TOKEN_FILE}")


def do_refresh(args):
    app_id = args.app_id or os.environ.get("PINTEREST_APP_ID")
    app_secret = args.app_secret or os.environ.get("PINTEREST_APP_SECRET")
    tok = load_json(TOKEN_FILE, {})
    refresh_token = tok.get("refresh_token")
    if not (app_id and app_secret and refresh_token):
        print("Ø®Ø§ØµÙƒ app-id + app-secret + refresh_token Ù…Ø­ÙÙˆØ¸ (Ù…Ù† --auth).")
        sys.exit(1)

    resp = requests.post(
        f"{API}/oauth/token",
        headers={
            "Authorization": basic_auth(app_id, app_secret),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data={"grant_type": "refresh_token", "refresh_token": refresh_token},
        timeout=30,
    )
    if resp.status_code != 200:
        print(f"ÙØ´Ù„ Ø§Ù„ØªØ¬Ø¯ÙŠØ¯: {resp.status_code}\n{resp.text}")
        sys.exit(1)
    data = resp.json()
    save_token(data)
    print("âœ… ØªØ¬Ø¯Ø¯ Ø§Ù„ØªÙˆÙƒÙ†.")


# ---------------------------------------------------------------------------
# Ø·Ù„Ø¨Ø§Øª API
# ---------------------------------------------------------------------------
def request_with_retry(method, url, token, payload=None, max_retries=5):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    delay = 3
    resp = None
    for _ in range(max_retries):
        resp = requests.request(method, url, headers=headers, json=payload, timeout=30)
        if resp.status_code == 429:
            wait = int(resp.headers.get("Retry-After", delay))
            print(f"  ... 429 rate limit, Ù†Ø³ØªÙ†Ù‰ {wait}s")
            time.sleep(wait)
            delay = min(delay * 2, 60)
            continue
        return resp
    return resp


def fetch_boards(token):
    resp = request_with_retry("GET", f"{API}/boards", token)
    if resp.status_code != 200:
        print(f"Ø®Ø·Ø£ ÙØ¬Ù„Ø¨ Ø§Ù„Ù„ÙˆØ­Ø§Øª: {resp.status_code}\n{resp.text}")
        return
    for b in resp.json().get("items", []):
        print(f'{b["id"]}  |  {b["name"]}')


def build_pin(guide, board_id):
    slug = slug_of(guide)
    img = image_url_for(slug)
    if not img:
        return None, slug
    body = {
        "board_id": board_id,
        "title": guide["title"][:TITLE_MAX],
        "description": guide["desc"][:DESC_MAX],
        "alt_text": guide["desc"][:ALT_MAX],
        "link": SITE + guide["url"],
        "media_source": {"source_type": "image_url", "url": img},
    }
    return body, slug


def do_publish(args, token):
    guides = load_index()
    state = load_state()

    # Daily rate limit: skip if already published N pins today (UTC)
    daily_limit = getattr(args, "daily_limit", 0) or 0
    if daily_limit > 0 and args.publish:
        today = time.strftime("%Y-%m-%d", time.gmtime())
        published_today = sum(
            1 for v in state.values()
            if isinstance(v, dict) and str(v.get("at", "")).startswith(today)
        )
        if published_today >= daily_limit:
            print(f"Daily limit reached: {published_today}/{daily_limit} pins today ({today} UTC). Skipping.")
            return
        remaining = daily_limit - published_today
        if args.limit and args.limit > remaining:
            args.limit = remaining
            print(f"Daily quota: {published_today}/{daily_limit} used, {remaining} remaining today.")

    if args.category:
        guides = [g for g in guides if normalize_category(g["category"]) == normalize_category(args.category)]
    if args.gift:
        guides = [g for g in guides if is_gift(g)]
    if args.kids:
        guides = [g for g in guides if is_kid(g)]
    if args.only:
        guides = [g for g in guides if slug_of(g) == args.only]

    # pym: skip image-less guides before applying limit, otherwise an
    # image-less guide (e.g. pdf-library) is picked and skipped every run,
    # never marked in state, so zero pins get published.
    todo = [g for g in guides if slug_of(g) not in state and image_url_for(slug_of(g))]
    if args.limit:
        todo = todo[: args.limit]

    mode = "PUBLISH" if args.publish else "DRY-RUN"
    print(f"Ø§Ù„ÙˆØ¶Ø¹: {mode} | Ø¹Ø¯Ø¯ Ø§Ù„Ù€ pins: {len(todo)}\n")

    ok = skipped = failed = 0
    for i, g in enumerate(todo, 1):
        category = normalize_category(g["category"])
        board_id = board_for(category, args.board_id)
        body, slug = build_pin(g, board_id)
        if not body:
            print(f"[{i}] â­  {slug}: Ù…Ø§ÙƒØ§ÙŠÙ†Ø´ ØµÙˆØ±Ø©")
            skipped += 1
            continue

        print(f'[{i}] {"ðŸš€" if args.publish else "ðŸ‘€"} {body["title"]}')
        print(f'      board={board_id}  img={body["media_source"]["url"]}')

        if not args.publish:
            ok += 1
            continue

        resp = request_with_retry("POST", f"{API}/pins", token, body)
        if resp.status_code in (200, 201):
            pin_id = resp.json().get("id")
            print(f"      âœ… ØªØ¯Ø§Ø± pin: {pin_id}")
            state[slug] = {"pin_id": pin_id, "board_id": board_id}
            save_state(state)
            ok += 1
        else:
            print(f"      âŒ ÙØ´Ù„ {resp.status_code}: {resp.text}")
            failed += 1

        time.sleep(args.delay)

    print(f"\nØ§Ù„Ù†ØªÙŠØ¬Ø©: Ù†Ø¬Ø­={ok}  ØªÙÙˆØª={skipped}  ÙØ´Ù„={failed}")
    if not args.publish:
        print("Ù‡Ø§Ø¯ÙŠ ØºÙŠØ± ØªØ¬Ø±Ø¨Ø©. Ø²ÙŠØ¯ --publish Ø¨Ø§Ø´ ØªÙ†Ø´Ø± ÙØ¹Ù„Ø§Ù‹.")


def main():
    p = argparse.ArgumentParser(description="Pinterest publisher")
    p.add_argument("--token")
    p.add_argument("--app-id")
    p.add_argument("--app-secret")
    p.add_argument("--port", type=int, default=DEFAULT_PORT)
    p.add_argument("--auth", action="store_true", help="OAuth: Ø¬ÙŠØ¨ ØªÙˆÙƒÙ† ÙÙŠÙ‡ write")
    p.add_argument("--refresh", action="store_true", help="Ø¬Ø¯Ù‘Ø¯ Ø§Ù„ØªÙˆÙƒÙ†")
    p.add_argument("--fetch-boards", action="store_true", help="Ø¹Ø±Ø¶ Ø§Ù„Ù„ÙˆØ­Ø§Øª ÙˆØ§Ù„Ù€ IDs")
    p.add_argument("--publish", action="store_true", help="Ø§Ù„Ù†Ø´Ø± Ø§Ù„Ø­Ù‚ÙŠÙ‚ÙŠ")
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--daily-limit", type=int, default=6, help="Max pins per day (UTC). 0 = no limit.")
    p.add_argument("--category")
    p.add_argument("--gift", action="store_true", help="ØºÙŠØ± Ù†ÙŠØªØ´ Ø§Ù„Ù‡Ø¯Ø§ÙŠØ§ (seasonal/holiday + roundups + gift guides)")
    p.add_argument("--kids", action="store_true", help="ØºÙŠØ± Ù‡Ø¯Ø§ÙŠØ§ Ø§Ù„Ø¯Ø±Ø§Ø±ÙŠ (Baby & Kids + Amigurumi & Toys)")
    p.add_argument("--only")
    p.add_argument("--board-id")
    p.add_argument("--delay", type=float, default=3.0)
    args = p.parse_args()

    if args.auth:
        do_auth(args)
        return
    if args.refresh:
        do_refresh(args)
        return

    token = get_token(args)
    if not token:
        print("Ù…Ø§ÙƒØ§ÙŠÙ†Ø´ ØªÙˆÙƒÙ†. Ø¯ÙŠØ± --auth Ø£ÙˆÙ„Ø§ØŒ ÙˆÙ„Ø§ Ù…Ø±Ø± --token / PINTEREST_ACCESS_TOKEN.")
        sys.exit(1)

    if args.fetch_boards:
        fetch_boards(token)
    else:
        do_publish(args, token)


if __name__ == "__main__":
    main()
