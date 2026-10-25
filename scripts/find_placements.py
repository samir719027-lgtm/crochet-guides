#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
سكريبت البحث على مواقع النشر (Placements) عبر Bing Search API.

كيقلب على كلمة مفتاحية (مثلاً "best iptv") وكيلقط المواقع اللي كتنشر
مقالات IPTV - خاصة المواقع الجامعية وعالية السلطة (.edu / .ac.uk / gov),
كيقدّر يفهم واش كتقبل guest post (write for us ...) وكينتج CSV.

الاستعمال:
  python scripts/find_placements.py --key <BING_API_KEY> --query "best iptv"
  python scripts/find_placements.py --key XXX --query "best iptv" --check-guest
  python scripts/find_placements.py --key XXX --query "best iptv" --count 50 --output placements.csv

الـ key من Azure: https://portal.azure.com -> Bing Search v7
(عندك طبقة مجانية F1: 1000 طلب/شهر)
"""

import argparse
import csv
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BING_ENDPOINT = "https://api.bing.microsoft.com/v7.0/search"

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = ROOT / "scripts" / "placements.csv"

DEFAULT_QUERIES = [
    "best iptv",
    "best iptv service",
    "best iptv 2026",
    "iptv subscription review",
    "iptv provider guide",
]

GUEST_POST_PATHS = [
    "/write-for-us",
    "/write-for-us/",
    "/guest-post",
    "/guest-post/",
    "/submit-guest-post",
    "/advertise",
    "/advertise/",
    "/contribute",
]

ACADEMIC_SUFFIXES = (".edu", ".ac.uk", ".ac.ma", ".edu.uk", ".gov", ".gov.uk")

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; PlacementFinder/1.0)"}


def log(msg):
    print(msg, flush=True)


def bing_search(key, query, count=50, mkt="en-US"):
    log(f"[bing] query: {query} (count={count})")
    resp = requests.get(
        BING_ENDPOINT,
        headers={"Ocp-Apim-Subscription-Key": key},
        params={"q": query, "count": min(count, 50), "mkt": mkt, "responseFilter": "Webpages"},
        timeout=30,
    )
    if resp.status_code == 401:
        log("[bing] المفتاح ماشي صحيح (401)")
        return []
    if resp.status_code == 429:
        log("[bing] تجاوزت الحد (429) - تسنى شوية")
        return []
    resp.raise_for_status()
    data = resp.json()
    return data.get("webPages", {}).get("value", [])


def is_academic(domain):
    return any(domain.endswith(s) for s in ACADEMIC_SUFFIXES)


def http_ok(url, timeout=12):
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout, allow_redirects=True)
        return r.status_code, r.url, r.text[:200000] if r.status_code == 200 else ""
    except requests.RequestException:
        return None, url, ""


def check_guest_post(domain):
    base = f"https://{domain}"
    found = []
    for path in GUEST_POST_PATHS:
        status, final, body = http_ok(base + path)
        if status is not None and status < 400:
            found.append(final)
        if len(found) >= 2:
            break
    return found


def collect(queries, count, key, check_guest=False):
    seen = {}
    for q in queries:
        results = bing_search(key, q, count=count)
        for item in results:
            url = item.get("url", "")
            if not url:
                continue
            domain = urlparse(url).netloc.lower().lstrip("www.")
            if not domain:
                continue
            row = seen.setdefault(
                domain,
                {
                    "domain": domain,
                    "sample_url": url,
                    "title": item.get("name", ""),
                    "queries": set(),
                    "academic": is_academic(domain),
                    "guest_pages": [],
                },
            )
            row["queries"].add(q)
        time.sleep(0.3)

    rows = list(seen.values())
    if check_guest:
        log(f"[guest] فحص {len(rows)} دومين على صفحات guest post ...")
        for row in rows:
            row["guest_pages"] = check_guest_post(row["domain"])
            if row["guest_pages"]:
                log(f"  + {row['domain']} -> {len(row['guest_pages'])} صفحة")
    for row in rows:
        row["queries"] = "; ".join(sorted(row["queries"]))
        row["guest_pages"] = "; ".join(row["guest_pages"])
    rows.sort(key=lambda r: (not r["academic"], not r["guest_pages"], r["domain"]))
    return rows


def write_csv(rows, output):
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8-sig") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=["domain", "academic", "guest_pages", "queries", "title", "sample_url"],
        )
        writer.writeheader()
        writer.writerows(rows)
    log(f"[csv] تّكتب: {output}")


def main():
    parser = argparse.ArgumentParser(description="لقاء مواقع النشر عبر Bing Search API")
    parser.add_argument("--key", default=os.environ.get("BING_API_KEY"), help="مفتاح Bing (أو BING_API_KEY)")
    parser.add_argument("--query", action="append", help="كلمة بحث (تقدر تعاودها عدة مرات)")
    parser.add_argument("--count", type=int, default=50, help="عدد النتائج لكل كلمة (حد أقصى 50)")
    parser.add_argument("--check-guest", action="store_true", help="فحص صفحات write-for-us / guest-post")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="ملف CSV للإخراج")
    args = parser.parse_args()

    if not args.key:
        log("خطأ: خاصك مفتاح Bing. دير --key ولا حط BING_API_KEY فالمتغيرات.")
        sys.exit(1)

    queries = args.query or DEFAULT_QUERIES
    t0 = time.time()
    rows = collect(queries, args.count, args.key, check_guest=args.check_guest)
    if not rows:
        log("ما لقيت حتى نتيجة")
        sys.exit(1)

    write_csv(rows, Path(args.output))
    academic = [r for r in rows if r["academic"]]
    with_guest = [r for r in rows if r["guest_pages"]]
    log("")
    log("=== النتيجة ===")
    log(f"دومينات: {len(rows)}")
    log(f"جامعية/gov: {len(academic)}")
    if args.check_guest:
        log(f"فيها guest post: {len(with_guest)}")
    log(f"المجموع: {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
