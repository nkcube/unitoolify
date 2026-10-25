/**
 * Shared runtime: clipboard, consent-gated analytics, small utilities.
 * Everything here degrades gracefully — no tool should break because
 * analytics or the clipboard API is unavailable.
 */
(function () {
  "use strict";

  var GA_ID = document.documentElement.dataset.ga || "";
  var CONSENT_KEY = "ut-consent";
  var status = document.createElement("p");
  status.className = "sr-only";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  document.addEventListener("DOMContentLoaded", function () {
    document.body.appendChild(status);
  });

  function announce(message) {
    if (status.isConnected) {
      status.textContent = "";
      // force a re-announcement for repeat copies
      window.setTimeout(function () {
        status.textContent = message;
      }, 30);
    }
  }

  /* ---------------------------------------------------------------- clipboard */

  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    var ok = false;
    try {
      ta.select();
      ta.setSelectionRange(0, text.length);
      ok = document.execCommand("copy");
    } catch (err) {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }

  function copy(text, btn, label) {
    var fallback = label || "Copy";
    var done = function (ok) {
      if (btn) {
        var previous = btn.dataset.label || btn.textContent;
        btn.dataset.label = previous;
        btn.textContent = ok ? "Copied!" : "Copy failed";
        window.setTimeout(function () {
          btn.textContent = btn.dataset.label || fallback;
        }, 1600);
      }
      announce(
        ok
          ? "Copied to clipboard"
          : "Copy failed — select the text and press Ctrl or Cmd + C",
      );
      return ok;
    };

    if (!text) {
      announce("Nothing to copy yet");
      return Promise.resolve(false);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        function () {
          return done(true);
        },
        function () {
          return done(legacyCopy(text));
        },
      );
    }
    return Promise.resolve(done(legacyCopy(text)));
  }

  /* ---------------------------------------------------------------- downloads */

  function download(text, filename, type) {
    var blob = new Blob([text], { type: type || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /* ------------------------------------------------------------------- status */

  // Shared "N lines" readout so no tool ever prints "1 lines".
  function lines(text) {
    if (!text) return "";
    var n = text.split("\n").length;
    return n.toLocaleString("en-US") + (n === 1 ? " line" : " lines");
  }

  /* ---------------------------------------------------------------- analytics */

  var analyticsLoaded = false;

  function consent() {
    try {
      return localStorage.getItem(CONSENT_KEY);
    } catch (err) {
      return null;
    }
  }

  function setConsent(value) {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch (err) {
      /* storage blocked — treat as session-only */
    }
  }

  function track(name, params) {
    if (!analyticsLoaded || typeof window.gtag !== "function") return;
    var payload = Object.assign(
      { page: (document.body && document.body.dataset.page) || "unknown" },
      params || {},
    );
    window.gtag("event", name, payload);
  }

  function loadAnalytics() {
    if (!GA_ID || analyticsLoaded) return;
    analyticsLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "granted",
    });
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, { anonymize_ip: true });
    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(script);
  }

  var banner = null;

  function buildBanner() {
    if (banner) return banner;
    banner = document.createElement("div");
    banner.className = "consent";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Analytics consent");
    banner.innerHTML =
      '<p class="m-0 leading-relaxed">We count page views with Google Analytics to see which tools are worth maintaining. It never sees what you paste. <a class="text-blue-400 underline" href="/privacy/">Details</a></p>' +
      '<div class="flex shrink-0 gap-2">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-consent="denied">Decline</button>' +
      '<button type="button" class="btn btn-primary btn-sm" data-consent="granted">Accept</button>' +
      "</div>";
    banner.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-consent]");
      if (!btn) return;
      var value = btn.getAttribute("data-consent");
      setConsent(value);
      banner.hidden = true;
      if (value === "granted") loadAnalytics();
    });
    document.body.appendChild(banner);
    return banner;
  }

  function openConsent() {
    var current = consent();
    var el = buildBanner();
    el.hidden = false;
    if (current === "granted") {
      el.querySelector('[data-consent="granted"]').textContent = "Keep enabled";
    }
  }

  function initConsent() {
    var current = consent();
    if (current === "granted") {
      loadAnalytics();
      return;
    }
    if (current === "denied") return;
    // Only interrupt once the page has settled.
    window.setTimeout(function () {
      if (!consent()) buildBanner().hidden = false;
    }, 1200);
  }

  /* ---------------------------------------------------------------- misc */

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      var self = this;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        fn.apply(self, args);
      }, wait);
    };
  }

  function on(selector, type, handler) {
    var el = document.querySelector(selector);
    if (el) el.addEventListener(type, handler);
    return el;
  }

  document.addEventListener("DOMContentLoaded", function () {
    initConsent();

    document.addEventListener("click", function (event) {
      var settings = event.target.closest("[data-consent-open]");
      if (settings) {
        event.preventDefault();
        openConsent();
        return;
      }
      var tracked = event.target.closest("[data-track]");
      if (tracked) track(tracked.getAttribute("data-track"));
    });

    var page = document.body.dataset.page;
    if (page) track("page_view", { page_title: page });
  });

  window.addEventListener("error", function (event) {
    track("exception", {
      description: String(event.message).slice(0, 120),
      fatal: false,
    });
  });

  window.addEventListener("unhandledrejection", function (event) {
    track("exception", {
      description: String(event.reason).slice(0, 120),
      fatal: false,
    });
  });

  window.UT = {
    copy: copy,
    download: download,
    lines: lines,
    track: track,
    debounce: debounce,
    on: on,
    announce: announce,
  };
})();
