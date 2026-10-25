(function () {
  "use strict";

  var inputText = document.getElementById("inputText");
  var outputText = document.getElementById("outputText");
  var mode = document.getElementById("mode");
  var plusAsSpace = document.getElementById("plusAsSpace");
  var liveMode = document.getElementById("liveMode");
  var actionBtn = document.getElementById("actionBtn");
  var copyBtn = document.getElementById("copyBtn");
  var meta = document.getElementById("meta");

  function decoder() {
    return mode.value === "uri" ? decodeURI : decodeURIComponent;
  }

  /**
   * Decode what can be decoded. A single malformed escape used to nuke the
   * whole result; now we decode valid runs and leave the rest untouched.
   */
  function tolerantDecode(value) {
    var decode = decoder();
    try {
      return decode(value);
    } catch (err) {
      return value.replace(/(?:%[0-9A-Fa-f]{2})+/g, function (run) {
        try {
          return decode(run);
        } catch (inner) {
          return run;
        }
      });
    }
  }

  function performAction() {
    var text = inputText.value;
    if (!text) {
      outputText.value = "";
      if (meta) meta.textContent = "";
      return;
    }

    var value = text;
    if (plusAsSpace.checked) value = value.replace(/\+/g, " ");

    var result = tolerantDecode(value);
    outputText.value = result;
    if (meta) {
      var broken = (text.match(/%(?![0-9A-Fa-f]{2})/g) || []).length;
      meta.textContent = broken
        ? broken + " malformed escape(s) left as-is"
        : result.length.toLocaleString("en-US") + " characters decoded";
    }
  }

  inputText.addEventListener("input", function () {
    if (liveMode.checked) performAction();
  });

  [mode, plusAsSpace].forEach(function (el) {
    el.addEventListener("change", function () {
      if (inputText.value) performAction();
    });
  });

  actionBtn.addEventListener("click", function () {
    performAction();
    UT.track("decode");
  });

  copyBtn.addEventListener("click", function () {
    UT.copy(outputText.value, copyBtn).then(function (ok) {
      if (ok) UT.track("copy");
    });
  });
})();
