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

  function convertJSONtoYAML() {
    var raw = inputText.value;
    if (!raw.trim()) {
      outputText.value = "";
      errorMsg.textContent = "";
      inputText.classList.remove("textarea-error");
      if (meta) meta.textContent = "";
      return;
    }

    try {
      var parsed = JSON.parse(raw);
      var yaml = jsyaml.dump(parsed, {
        indent: Number(indentSpace.value),
        lineWidth: -1,
        noRefs: false,
      });
      outputText.value = yaml;
      errorMsg.textContent = "";
      inputText.classList.remove("textarea-error");
      if (meta) meta.textContent = UT.lines(yaml);
    } catch (err) {
      var m = /position (\d+)/.exec(err.message);
      var where = "";
      if (m) {
        var before = raw.slice(0, Number(m[1]));
        where =
          " (line " +
          before.split("\n").length +
          ", column " +
          (Number(m[1]) - before.lastIndexOf("\n")) +
          ")";
      }
      errorMsg.textContent = "Invalid JSON" + where + ".";
      inputText.classList.add("textarea-error");
    }
  }

  inputText.addEventListener(
    "input",
    UT.debounce(function () {
      if (liveMode.checked) convertJSONtoYAML();
    }, 220),
  );

  indentSpace.addEventListener("change", function () {
    if (inputText.value.trim()) convertJSONtoYAML();
  });

  formatBtn.addEventListener("click", function () {
    convertJSONtoYAML();
    UT.track("convert");
  });

  copyBtn.addEventListener("click", function () {
    UT.copy(outputText.value, copyBtn).then(function (ok) {
      if (ok) UT.track("copy");
    });
  });

  downloadBtn.addEventListener("click", function () {
    if (!outputText.value) return;
    UT.download(outputText.value, "converted.yaml", "text/yaml;charset=utf-8");
    UT.track("download");
  });
})();
