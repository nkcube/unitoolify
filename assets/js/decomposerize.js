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
      libPromise = import("/assets/vendor/decomposerize.js").then(
        function (mod) {
          return mod.default || mod;
        },
      );
    }
    return libPromise;
  }

  function setMeta(text) {
    if (meta) meta.textContent = UT.lines(text);
  }

  function convert() {
    var yaml = inputText.value.trim();
    if (!yaml) {
      outputText.value = "";
      setMeta("");
      return;
    }

    library().then(
      function (decomposerize) {
        try {
          outputText.value = decomposerize(yaml);
          setMeta(outputText.value);
        } catch (err) {
          outputText.value =
            "# Could not parse that compose file:\n" + err.message;
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
    UT.download(outputText.value, "docker-run.txt");
  });

  if (inputText.value.trim()) convert();
})();
