(function () {
  var KEY = "cg-consent";
  var GA_ID = "G-ZLKW21MDJZ";
  var ADS_CLIENT = "ca-pub-2407314174904220";

  function read() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function write(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }

  function loadGA() {
    if (window.__cgGaLoaded) return;
    window.__cgGaLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(s);
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, { anonymize_ip: true });
  }

  function loadAds() {
    if (window.__cgAdsLoaded) return;
    window.__cgAdsLoaded = true;
    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.requestNonPersonalizedAds = 0;
    var s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + ADS_CLIENT;
    document.head.appendChild(s);
  }

  function nonPersonalised() {
    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.requestNonPersonalizedAds = 1;
  }

  window.cgLoadGA = loadGA;
  if (read() === "granted") {
    loadGA();
    loadAds();
  } else {
    nonPersonalised();
  }

  function hide() {
    var box = document.getElementById("cgConsent");
    if (box) box.remove();
  }

  function choose(value) {
    write(value);
    if (value === "granted") {
      loadGA();
      loadAds();
    } else {
      nonPersonalised();
    }
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
      '<p style="margin:0 0 12px;">We use cookies for analytics and advertising. You can accept or reject non-essential cookies. If you reject, analytics stays off and ads are not personalised. Read our <a href="/privacy-policy" style="color:#22404F;text-decoration:underline;">privacy policy</a>.</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:10px;">' +
      '<button type="button" data-consent="granted" style="background:#22404F;color:#fff;border:1px solid #22404F;border-radius:4px;padding:9px 16px;font:inherit;font-weight:600;cursor:pointer;">Accept</button>' +
      '<button type="button" data-consent="denied" style="background:#22404F;color:#fff;border:1px solid #22404F;border-radius:4px;padding:9px 16px;font:inherit;font-weight:600;cursor:pointer;">Reject non-essential</button>' +
      "</div>";
    document.body.appendChild(box);
    var buttons = box.querySelectorAll("button[data-consent]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function () {
        choose(this.getAttribute("data-consent"));
      });
    }
  }

  window.cgOpenConsent = build;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      if (!read()) build();
    });
  } else if (!read()) {
    build();
  }

  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a") : null;
    if (!a || !a.href || a.href.indexOf("amazon.com") < 0) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "affiliate_click", link_url: a.href, page_path: window.location.pathname });
  });
})();
