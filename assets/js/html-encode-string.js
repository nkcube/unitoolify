(function () {
  "use strict";

  var inputText = document.getElementById("inputText");
  var outputText = document.getElementById("outputText");
  var mode = document.getElementById("mode");
  var liveMode = document.getElementById("liveMode");
  var actionBtn = document.getElementById("actionBtn");
  var copyBtn = document.getElementById("copyBtn");

  function escapeNonAscii(value) {
    var out = "";
    var chars = Array.from(value);
    for (var i = 0; i < chars.length; i++) {
      var code = chars[i].codePointAt(0);
      out += code > 126 ? "&#" + code + ";" : chars[i];
    }
    return out;
  }

  function performAction() {
    var input = inputText.value;
    if (!input) {
      outputText.value = "";
      return;
    }

    var result = input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    if (mode.value !== "text") {
      result = result.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    if (mode.value === "nonascii") result = escapeNonAscii(result);

    outputText.value = result;
  }

  inputText.addEventListener("input", function () {
    if (liveMode.checked) performAction();
  });

  mode.addEventListener("change", function () {
    if (inputText.value) performAction();
  });

  actionBtn.addEventListener("click", function () {
    performAction();
    UT.track("encode");
  });

  copyBtn.addEventListener("click", function () {
    UT.copy(outputText.value, copyBtn).then(function (ok) {
      if (ok) UT.track("copy");
    });
  });
})();
