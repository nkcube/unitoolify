(function () {
  "use strict";

  var inputText = document.getElementById("inputText");
  var outputText = document.getElementById("outputText");
  var liveMode = document.getElementById("liveMode");
  var indentSpace = document.getElementById("indentSpace");
  var formatBtn = document.getElementById("formatBtn");
  var copyBtn = document.getElementById("copyBtn");
  var downloadBtn = document.getElementById("downloadBtn");
  var errorMsg = document.getElementById("errorMsg");
  var meta = document.getElementById("meta");

  function indent() {
    var value = indentSpace.value;
    return value === "tab" ? "\t" : Number(value);
  }

  function positionOf(raw, message) {
    var m = /position (\d+)/.exec(message);
    if (!m) return "";
    var index = Number(m[1]);
    var before = raw.slice(0, index);
    var line = before.split("\n").length;
    var column = index - before.lastIndexOf("\n");
    return " (line " + line + ", column " + column + ")";
  }

  function showError(raw, err) {
    errorMsg.textContent = "Invalid JSON" + positionOf(raw, err.message) + ".";
    inputText.classList.add("textarea-error");
  }

  function clearError() {
    errorMsg.textContent = "";
    inputText.classList.remove("textarea-error");
  }

  function formatJSON() {
    var raw = inputText.value;
    if (!raw.trim()) {
      outputText.value = "";
      if (meta) meta.textContent = "";
      clearError();
      return;
    }

    try {
      var parsed = JSON.parse(raw);
      var formatted = JSON.stringify(parsed, null, indent());
      outputText.value = formatted;
      clearError();
      if (meta) {
        meta.textContent =
          formatted.length.toLocaleString("en-US") +
          " characters · " +
          UT.lines(formatted);
      }
    } catch (err) {
      showError(raw, err);
    }
  }

  var onInput = UT.debounce(function () {
    if (liveMode.checked) formatJSON();
  }, 200);

  inputText.addEventListener("input", onInput);

  indentSpace.addEventListener("change", function () {
    if (inputText.value.trim()) formatJSON();
  });

  formatBtn.addEventListener("click", function () {
    formatJSON();
    UT.track("format");
  });

  copyBtn.addEventListener("click", function () {
    UT.copy(outputText.value, copyBtn).then(function (ok) {
      if (ok) UT.track("copy");
    });
  });

  downloadBtn.addEventListener("click", function () {
    if (!outputText.value) return;
    UT.download(
      outputText.value,
      "formatted.json",
      "application/json;charset=utf-8",
    );
    UT.track("download");
  });
})();
