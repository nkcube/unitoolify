(function () {
  "use strict";

  var tabs = [
    {
      tab: document.getElementById("tab-vert"),
      panel: document.getElementById("panel-vert"),
    },
    {
      tab: document.getElementById("tab-horz"),
      panel: document.getElementById("panel-horz"),
    },
  ];

  var links = {
    vert: document.getElementById("dragLinkVert"),
    horz: document.getElementById("dragLinkHorz"),
  };

  function freshId(prefix) {
    var random =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    return "bookmark-separator-" + prefix + "-" + random;
  }

  function refresh(kind) {
    var link = links[kind];
    if (!link) return;
    var id = freshId(kind);
    link.setAttribute("href", "#" + id);
    // replaceState instead of location.replace: no history entry, no scroll jump.
    if (window.history && history.replaceState) {
      history.replaceState(null, "", "#" + id);
    }
  }

  Object.keys(links).forEach(function (kind) {
    var link = links[kind];
    if (!link) return;
    refresh(kind);
    link.addEventListener("mousedown", function (event) {
      if (event.button === 0) refresh(kind);
    });
    link.addEventListener(
      "touchstart",
      function () {
        refresh(kind);
      },
      { passive: true },
    );
  });

  function select(index) {
    tabs.forEach(function (pair, i) {
      var active = i === index;
      pair.tab.setAttribute("aria-selected", String(active));
      pair.tab.classList.toggle("btn-primary", active);
      pair.tab.classList.toggle("btn-ghost", !active);
      pair.panel.hidden = !active;
    });
    UT.track("separator_orientation", {
      orientation: index === 0 ? "vertical" : "horizontal",
    });
  }

  tabs.forEach(function (pair, index) {
    pair.tab.addEventListener("click", function () {
      select(index);
    });
    pair.tab.addEventListener("keydown", function (event) {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        var next =
          (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) %
          tabs.length;
        select(next);
        tabs[next].tab.focus();
      }
    });
  });
})();
