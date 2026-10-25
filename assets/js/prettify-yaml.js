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

  function locationOf(err) {
    if (!err.mark || typeof err.mark.line !== "number") return "";
    return (
      " (line " +
      (err.mark.line + 1) +
      ", column " +
      (err.mark.column + 1) +
      ")"
    );
  }

  function formatYAML() {
    var raw = inputText.value;
    if (!raw.trim()) {
      outputText.value = "";
      errorMsg.textContent = "";
      inputText.classList.remove("textarea-error");
      if (meta) meta.textContent = "";
      return;
    }

    try {
      // JSON_SCHEMA keeps scalars as written: dates stay strings instead of
      // silently turning into ISO timestamps on the way out.
      var parsed = jsyaml.load(raw, { schema: jsyaml.JSON_SCHEMA });
      if (parsed === undefined) {
        outputText.value = raw;
        return;
      }
      var dumped = jsyaml.dump(parsed, {
        schema: jsyaml.JSON_SCHEMA,
        indent: Number(indentSpace.value),
        lineWidth: -1,
        noRefs: false,
      });
      outputText.value = dumped;
      errorMsg.textContent = "";
      inputText.classList.remove("textarea-error");
      if (meta) {
        meta.textContent = UT.lines(dumped);
      }
    } catch (err) {
      errorMsg.textContent =
        "Invalid YAML" + locationOf(err) + ": " + err.reason;
      inputText.classList.add("textarea-error");
    }
  }

  inputText.addEventListener(
    "input",
    UT.debounce(function () {
      if (liveMode.checked) formatYAML();
    }, 220),
  );

  indentSpace.addEventListener("change", function () {
    if (inputText.value.trim()) formatYAML();
  });

  formatBtn.addEventListener("click", function () {
    formatYAML();
    UT.track("format");
  });

  copyBtn.addEventListener("click", function () {
    UT.copy(outputText.value, copyBtn).then(function (ok) {
      if (ok) UT.track("copy");
    });
  });

  downloadBtn.addEventListener("click", function () {
    if (!outputText.value) return;
    UT.download(outputText.value, "formatted.yaml", "text/yaml;charset=utf-8");
    UT.track("download");
  });
})();
