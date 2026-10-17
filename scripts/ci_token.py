#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CI helper: يضمن وجود access token صالح ف scripts/pinterest_token.json.

- إيلا كان التوكن المحفوظ (من الكاش) صالح => كيخليه.
- إيلا كان منتهي => كيجدده بـ refresh_token.
- إيلا ماكانش => كيكتبو من secret ACCESS.

المتغيرات: ACCESS, REFRESH, APP_ID, APP_SECRET
"""

import base64
import json
import os
import time
from pathlib import Path

import requests

API = "https://api.pinterest.com/v5"
TOKEN_FILE = Path(__file__).resolve().parent / "pinterest_token.json"

ACCESS = os.environ.get("ACCESS")
REFRESH = os.environ.get("REFRESH")
APP_ID = os.environ.get("APP_ID")
APP_SECRET = os.environ.get("APP_SECRET")


def write_token(data, fallback_refresh=None):
    TOKEN_FILE.write_text(
        json.dumps(
            {
                "access_token": data["access_token"],
                "refresh_token": data.get("refresh_token") or fallback_refresh,
                "scope": data.get("scope"),
                "obtained_at": int(time.time()),
                "expires_in": data.get("expires_in"),
            }
        ),
        encoding="utf-8",
    )


def token_valid(tok):
    r = requests.get(
        f"{API}/user_account",
        headers={"Authorization": f"Bearer {tok}"},
        timeout=30,
    )
    return r.status_code == 200


def refresh():
    raw = base64.b64encode(f"{APP_ID}:{APP_SECRET}".encode()).decode()
    r = requests.post(
        f"{API}/oauth/token",
        headers={
            "Authorization": f"Basic {raw}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data={"grant_type": "refresh_token", "refresh_token": REFRESH},
        timeout=30,
    )
    return r


def main():
    tok = None
    if TOKEN_FILE.exists():
        tok = json.loads(TOKEN_FILE.read_text(encoding="utf-8")).get("access_token")
    if not tok:
        tok = ACCESS

    if tok and token_valid(tok):
        write_token({"access_token": tok}, fallback_refresh=REFRESH)
        print("التوكن صالح.")
        return 0

    print("التوكن منتهي ولا ماكاينش، كنتحاول نجدده ...")
    if REFRESH and APP_ID and APP_SECRET:
        r = refresh()
        if r.status_code == 200:
            write_token(r.json(), fallback_refresh=REFRESH)
            print("تجدد التوكن بنجاح.")
            return 0
        print(f"فشل التجديد: {r.status_code} {r.text}")

    if ACCESS:
        write_token({"access_token": ACCESS}, fallback_refresh=REFRESH)
        print("استعملنا ACCESS secret.")
        return 0

    print("ماكاينش توكن صالح ولا refresh. خاصك تحدث الـ secrets.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
