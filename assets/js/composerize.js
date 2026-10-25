(function () {
  "use strict";

  var inputText = document.getElementById("inputText");
  var outputText = document.getElementById("outputText");
  var copyBtn = document.getElementById("copyBtn");
  var downloadBtn = document.getElementById("downloadBtn");
  var convertBtn = document.getElementById("convertBtn");
  var liveMode = document.getElementById("liveMode");
  var meta = document.getElementById("meta");

  var libPromise = null;

  function library() {
    if (!libPromise) {
      // Bundled locally: the tool must not depend on esm.sh being reachable,
      // and a pinned bundle cannot change under us between visits.
      libPromise = import("/assets/vendor/composerize.js").then(function (mod) {
        return mod.default || mod;
      });
    }
    return libPromise;
  }

  function setMeta(text) {
    if (meta) meta.textContent = UT.lines(text);
  }

  function convert() {
    var command = inputText.value.trim();
    if (!command) {
      outputText.value = "";
      setMeta("");
      return;
    }

    library().then(
      function (composerize) {
        try {
          outputText.value = composerize(command);
          setMeta(outputText.value);
        } catch (err) {
          outputText.value = "# Could not parse that command:\n" + err.message;
          setMeta("");
        }
      },
      function () {
        outputText.value =
          "# The converter failed to load.\n# Check your connection and reload the page.";
        setMeta("");
      },
    );
  }

  inputText.addEventListener(
    "input",
    UT.debounce(function () {
      if (!liveMode || liveMode.checked) convert();
    }, 250),
  );

  convertBtn.addEventListener("click", function () {
    convert();
    UT.track("convert");
  });

  copyBtn.addEventListener("click", function () {
    UT.copy(outputText.value, copyBtn).then(function (ok) {
      if (ok) UT.track("copy");
    });
  });

  downloadBtn.addEventListener("click", function () {
    if (!outputText.value) return;
    UT.download(outputText.value, "docker-compose.yml", "text/yaml");
  });

  if (inputText.value.trim()) convert();
})();
