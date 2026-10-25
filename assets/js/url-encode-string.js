(function () {
  "use strict";

  var inputText = document.getElementById("inputText");
  var outputText = document.getElementById("outputText");
  var mode = document.getElementById("mode");
  var liveMode = document.getElementById("liveMode");
  var actionBtn = document.getElementById("actionBtn");
  var copyBtn = document.getElementById("copyBtn");

  function performAction() {
    var text = inputText.value;
    if (!text) {
      outputText.value = "";
      return;
    }

    // encodeURI throws on lone surrogates (paste half an emoji, for example).
    if (typeof text.toWellFormed === "function") text = text.toWellFormed();

    var result;
    try {
      if (mode.value === "uri") {
        result = encodeURI(text);
      } else {
        result = encodeURIComponent(text);
        if (mode.value === "strict") {
          result = result.replace(/[!'()*]/g, function (char) {
            return "%" + char.charCodeAt(0).toString(16).toUpperCase();
          });
        } else if (mode.value === "form") {
          result = result.replace(/%20/g, "+");
        }
      }
    } catch (err) {
      result = "Could not encode: " + err.message;
    }
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
