#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
سكريبت الفهرسة السريعة: IndexNow + Google sitemap ping.

كيرفع كل روابط الـ sitemap لـ IndexNow فطلب واحد (دقيقة وحدة تقريباً)
وكيصيفط ping لـ Google بالـ sitemap.

الاستعمال لأي موقع:
  python scripts/index_submit.py --site https://example.com
  python scripts/index_submit.py --site https://example.com --dry-run
  python scripts/index_submit.py --site https://example.com --sitemap https://example.com/sitemap2.xml
  python scripts/index_submit.py --site https://example.com --limit 20

ملاحظات:
  - IndexNow ما خاصوش حساب - غير مفتاح (key) ملف نصي فـ root الموقع.
    السكريبت كينشئ المفتاح أوتوماتيكياً فـ scripts/indexnow_key.txt
    وخاصة يكون الملف (وسمو هو المفتاح) منشور فـ root الموقع باش يخدم.
  - Google ping خدمة قديمة، رجعها Google ولكن كتبقى مفيدة كإشارة.
  - IndexNow كيخدم لـ Bing و Yandex و Naver و Seznam و غيرو.
"""

import argparse
import secrets
import sys
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse

import requests

INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"
GOOGLE_PING_URL = "https://www.google.com/ping?sitemap={sitemap}"

ROOT = Path(__file__).resolve().parent.parent
STATE_DIR = Path(__file__).resolve().parent
KEY_STATE_FILE = STATE_DIR / "indexnow_key.txt"


def log(msg):
    print(msg, flush=True)


def load_or_create_key():
    if KEY_STATE_FILE.exists():
        key = KEY_STATE_FILE.read_text().strip()
        if len(key) == 32 and all(c in "0123456789abcdefABCDEF" for c in key):
            return key.lower()
    key = secrets.token_hex(16)
    KEY_STATE_FILE.write_text(key + "\n", encoding="utf-8")
    log(f"[key] تم إنشاء مفتاح IndexNow جديد: {key}")
    log(f"[key] الملف محفوظ فـ {KEY_STATE_FILE}")
    log("[key] خاصك تنشر المفتاح فـ root الموقع باسم الملف <key>.txt")
    log(f"[key] مثال: https://example.com/{key}.txt يحتوي غير المفتاح وحدو")
    return key


def _read_sitemap(source):
    if source.startswith("http://") or source.startswith("https://"):
        resp = requests.get(source, timeout=30, headers={"User-Agent": "Mozilla/5.0 (compatible; IndexSubmit/1.0)"})
        resp.raise_for_status()
        return resp.content
    return Path(source).read_bytes()


def _parse_locs(content):
    root = ET.fromstring(content)
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls, child_sitemaps = [], []
    for loc in root.findall(".//sm:url/sm:loc", ns):
        if loc.text:
            urls.append(loc.text.strip())
    for loc in root.findall(".//sm:sitemap/sm:loc", ns):
        if loc.text:
            child_sitemaps.append(loc.text.strip())
    if not urls and not child_sitemaps:
        for loc in root.iter():
            if loc.tag.endswith("loc") and loc.text:
                urls.append(loc.text.strip())
    return urls, child_sitemaps


def fetch_urls(sitemap_source, depth=0):
    if depth == 0:
        log(f"[sitemap] جاري تحميل: {sitemap_source}")
    content = _read_sitemap(sitemap_source)
    urls, children = _parse_locs(content)
    if children:
        log(f"[sitemap] sitemap index - {len(children)} ملف فرعي")
        for child in children:
            urls.extend(fetch_urls(child, depth + 1))
    seen = set()
    unique = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            unique.append(u)
    return unique


def submit_indexnow(site, urls, key, dry_run=False):
    host = urlparse(site).netloc
    payload = {
        "host": host,
        "key": key,
        "keyLocation": f"{site.rstrip('/')}/{key}.txt",
        "urlList": urls,
    }

    if dry_run:
        log(f"[indexnow] Dry run - غادي نرسل {len(urls)} رابط لـ {host}")
        for u in urls[:10]:
            log(f"  - {u}")
        if len(urls) > 10:
            log(f"  ... و {len(urls) - 10} رابط آخر")
        return True

    log(f"[indexnow] جاري إرسال {len(urls)} رابط لـ {host} ...")
    t0 = time.time()
    try:
        resp = requests.post(
            INDEXNOW_ENDPOINT,
            json=payload,
            timeout=60,
            headers={"Content-Type": "application/json; charset=utf-8"},
        )
    except requests.RequestException as exc:
        log(f"[indexnow] خطأ فالشبكة: {exc}")
        return False

    elapsed = time.time() - t0
    if resp.status_code in (200, 202):
        log(f"[indexnow] تم! الحالة {resp.status_code} فـ {elapsed:.1f}s")
        return True
    log(f"[indexnow] فشل - الحالة {resp.status_code}")
    log(f"[indexnow] الرد: {resp.text[:500]}")
    if resp.status_code == 403:
        log("[indexnow] غالباً المفتاح ما منشورش فـ root الموقع - تأكد أن ملف <key>.txt موجود ومرفوع")
    return False


def ping_google(sitemap_url, dry_run=False):
    url = GOOGLE_PING_URL.format(sitemap=sitemap_url)
    if dry_run:
        log(f"[google] Dry run - غادي نصيفط: {url}")
        return True
    log(f"[google] جاري ping: {sitemap_url}")
    t0 = time.time()
    try:
        resp = requests.get(url, timeout=30)
    except requests.RequestException as exc:
        log(f"[google] خطأ: {exc}")
        return False
    elapsed = time.time() - t0
    log(f"[google] الحالة {resp.status_code} فـ {elapsed:.1f}s")
    if resp.status_code == 404:
        log("[google] ملاحظة: Google حيد الخدمة - استعمل Google Search Console Submit Sitemap عوضها")
    return resp.status_code < 400


def main():
    parser = argparse.ArgumentParser(description="رفع روابط sitemap لـ IndexNow + Google ping")
    parser.add_argument("--site", required=True, help="رابط الموقع الأساسي مثال: https://example.com")
    parser.add_argument("--sitemap", help="رابط أو مسار sitemap (افتراضي: <site>/sitemap.xml)")
    parser.add_argument("--limit", type=int, help="عدد الروابط القصوى باش ترسل (اختياري)")
    parser.add_argument("--dry-run", action="store_true", help="عرض فقط بلا إرسال")
    args = parser.parse_args()

    site = args.site.rstrip("/")
    sitemap_source = args.sitemap or f"{site}/sitemap.xml"

    t_start = time.time()
    key = load_or_create_key()

    try:
        urls = fetch_urls(sitemap_source)
    except Exception as exc:
        log(f"[sitemap] خطأ: {exc}")
        sys.exit(1)

    if not urls:
        log("[sitemap] ما لقيت حتى رابط")
        sys.exit(1)

    if args.limit:
        urls = urls[: args.limit]

    log(f"[sitemap] العدد: {len(urls)} رابط")

    ok_indexnow = submit_indexnow(site, urls, key, dry_run=args.dry_run)
    ok_google = ping_google(sitemap_source if sitemap_source.startswith("http") else f"{site}/sitemap.xml", dry_run=args.dry_run)

    total = time.time() - t_start
    log("")
    log("=== النتيجة ===")
    log(f"IndexNow: {'نجح' if ok_indexnow else 'فشل'}")
    log(f"Google ping: {'نجح' if ok_google else 'فشل/غير مدعوم'}")
    log(f"المجموع: {total:.1f}s")
    sys.exit(0 if ok_indexnow else 1)


if __name__ == "__main__":
    main()
