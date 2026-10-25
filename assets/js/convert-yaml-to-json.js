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
    if (value === "tab") return "\t";
    return Number(value);
  }

  function convertYAMLtoJSON() {
    var raw = inputText.value;
    if (!raw.trim()) {
      outputText.value = "";
      errorMsg.textContent = "";
      inputText.classList.remove("textarea-error");
      if (meta) meta.textContent = "";
      return;
    }

    try {
      // JSON_SCHEMA keeps `2024-01-01` a string instead of turning it into a
      // Date and re-serialising it as an ISO timestamp. loadAll handles
      // multi-document files (`---` separators) that used to throw.
      var docs = jsyaml
        .loadAll(raw, { schema: jsyaml.JSON_SCHEMA })
        .map(function (doc) {
          return doc === undefined ? null : doc;
        });
      var value = docs.length > 1 ? docs : docs[0];
      var json = JSON.stringify(value, null, indent());
      outputText.value = json;
      errorMsg.textContent = "";
      inputText.classList.remove("textarea-error");
      if (meta) {
        var documents =
          docs.length > 1 ? " · " + docs.length + " documents" : "";
        meta.textContent =
          json.length.toLocaleString("en-US") + " characters" + documents;
      }
    } catch (err) {
      var where =
        err.mark && typeof err.mark.line === "number"
          ? " (line " +
            (err.mark.line + 1) +
            ", column " +
            (err.mark.column + 1) +
            ")"
          : "";
      errorMsg.textContent = "Invalid YAML" + where + ": " + err.reason;
      inputText.classList.add("textarea-error");
    }
  }

  inputText.addEventListener(
    "input",
    UT.debounce(function () {
      if (liveMode.checked) convertYAMLtoJSON();
    }, 220),
  );

  indentSpace.addEventListener("change", function () {
    if (inputText.value.trim()) convertYAMLtoJSON();
  });

  formatBtn.addEventListener("click", function () {
    convertYAMLtoJSON();
    UT.track("convert");
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
      "converted.json",
      "application/json;charset=utf-8",
    );
    UT.track("download");
  });
})();
