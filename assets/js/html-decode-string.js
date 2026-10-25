(function () {
  "use strict";

  var inputText = document.getElementById("inputText");
  var outputText = document.getElementById("outputText");
  var liveMode = document.getElementById("liveMode");
  var actionBtn = document.getElementById("actionBtn");
  var copyBtn = document.getElementById("copyBtn");
  var meta = document.getElementById("meta");

  /**
   * Decoding through a detached <textarea> is the safest way to reuse the
   * browser's own entity table: its content model is RCDATA, so entities are
   * decoded but nothing is ever executed or fetched.
   */
  function performAction() {
    var input = inputText.value;
    if (!input) {
      outputText.value = "";
      if (meta) meta.textContent = "";
      return;
    }

    // A literal </textarea> would close our scratch element early.
    var guarded = input.replace(/<\/textarea/gi, "&lt;/textarea");
    var scratch = document.createElement("textarea");
    scratch.innerHTML = guarded;
    outputText.value = scratch.value;

    if (meta) {
      var entities = (
        input.match(/&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/gi) || []
      ).length;
      meta.textContent = entities
        ? entities + " entit" + (entities === 1 ? "y" : "ies") + " decoded"
        : "No entities found — output matches input";
    }
  }

  inputText.addEventListener("input", function () {
    if (liveMode.checked) performAction();
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
