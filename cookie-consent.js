(function () {
  var KEY = "cg-consent";
  var GA_ID = "G-ZLKW21MDJZ";
  var ADS_CLIENT = "ca-pub-2407314174904220";
  var EEA = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH"];

  function read() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function write(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    wait_for_update: 500
  });
  window.gtag("js", new Date());

  /* Google Analytics runs with consent signals; cookies only after a grant. */
  (function loadGA() {
    if (window.__cgGaLoaded) return;
    window.__cgGaLoaded = true;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(s);
    window.gtag("config", GA_ID, { anonymize_ip: true });
  })();

  /* AdSense must load unconditionally so Google's certified consent message can run. */
  (function loadAds() {
    if (window.__cgAdsLoaded) return;
    window.__cgAdsLoaded = true;
    var s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + ADS_CLIENT;
    document.head.appendChild(s);
  })();

  var isEea = null;

  function detect(cb) {
    if (isEea !== null) return cb(isEea);
    fetch("/cdn-cgi/trace", { cache: "no-store" })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var m = /(?:^|\n)loc=([A-Z]{2})(?:\n|$)/.exec(t);
        isEea = !!(m && EEA.indexOf(m[1]) > -1);
        cb(isEea);
      })
      .catch(function () {
        isEea = false;
        cb(false);
      });
  }

  function allowAds() {
    window.gtag("consent", "update", {
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted"
    });
  }

  function hide() {
    var box = document.getElementById("cgConsent");
    if (box) box.remove();
  }

  function choose(value) {
    write(value);
    window.gtag("consent", "update", {
      analytics_storage: value === "granted" ? "granted" : "denied"
    });
    hide();
  }

  function build() {
    hide();
    var box = document.createElement("div");
    box.id = "cgConsent";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Cookie consent");
    box.style.cssText = "position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:720px;margin:0 auto;background:#FBF8F2;color:#2A241E;border:1px solid rgba(42,36,30,.22);border-radius:6px;padding:16px 18px;box-shadow:0 10px 30px rgba(0,0,0,.18);font-family:'Work Sans',sans-serif;font-size:14px;line-height:1.55;";
    box.innerHTML =
      '<p style="margin:0 0 12px;">We use cookies to measure how the guides are used. You can accept or reject analytics cookies; if you reject, analytics stays off. Advertising is served by Google, which asks for your consent where the law requires it. Read our <a href="/privacy-policy" style="color:#22404F;text-decoration:underline;">privacy policy</a>.</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:10px;">' +
      '<button type="button" data-consent="granted" style="background:#22404F;color:#fff;border:1px solid #22404F;border-radius:4px;padding:9px 16px;font:inherit;font-weight:600;cursor:pointer;">Accept analytics</button>' +
      '<button type="button" data-consent="denied" style="background:#22404F;color:#fff;border:1px solid #22404F;border-radius:4px;padding:9px 16px;font:inherit;font-weight:600;cursor:pointer;">Reject analytics</button>' +
      "</div>";
    document.body.appendChild(box);
    var buttons = box.querySelectorAll("button[data-consent]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function () {
        choose(this.getAttribute("data-consent"));
      });
    }
  }

  window.cgOpenConsent = function () {
    if (window.googlefc && typeof window.googlefc.showRevocationMessage === "function") {
      try { window.googlefc.showRevocationMessage(); return; } catch (e) {}
    }
    if (isEea === true) return;
    build();
  };

  function init() {
    detect(function (eea) {
      if (eea) return;
      allowAds();
      if (read() === "granted") {
        window.gtag("consent", "update", { analytics_storage: "granted" });
      } else if (!read()) {
        build();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a") : null;
    if (!a || !a.href || a.href.indexOf("amazon.com") < 0) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "affiliate_click", link_url: a.href, page_path: window.location.pathname });
  });
})();
