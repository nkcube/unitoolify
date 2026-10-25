(function () {
  "use strict";

  var inputText = document.getElementById("inputText");
  var outputText = document.getElementById("outputText");
  var inputFile = document.getElementById("inputFile");
  var fileNameDisplay = document.getElementById("fileNameDisplay");
  var liveMode = document.getElementById("liveMode");
  var decodeBtn = document.getElementById("decodeBtn");
  var copyBtn = document.getElementById("copyBtn");
  var downloadBtn = document.getElementById("downloadBtn");
  var meta = document.getElementById("meta");

  var rawBytes = null;

  function normalise(value) {
    var clean = value.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    var remainder = clean.length % 4;
    if (remainder === 2) clean += "==";
    else if (remainder === 3) clean += "=";
    else if (remainder === 1) throw new Error("length is not valid Base64");
    return clean;
  }

  function performDecode() {
    var value = inputText.value;
    if (!value.trim()) {
      outputText.value = "";
      rawBytes = null;
      if (meta) meta.textContent = "";
      return;
    }

    var bytes;
    try {
      var binary = atob(normalise(value));
      bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    } catch (err) {
      rawBytes = null;
      outputText.value = "Not valid Base64: " + err.message;
      if (meta) meta.textContent = "";
      return;
    }

    rawBytes = bytes;

    var text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      outputText.value = text;
      if (meta) {
        meta.textContent =
          bytes.length.toLocaleString("en-US") + " bytes decoded as UTF-8 text";
      }
    } catch (err) {
      outputText.value =
        "[Binary data — " +
        bytes.length.toLocaleString("en-US") +
        " bytes. Use “Download decoded file” to save it.]";
      if (meta) meta.textContent = "Not valid UTF-8, so it is shown as binary.";
    }
  }

  inputText.addEventListener("input", function () {
    fileNameDisplay.textContent = "";
    inputFile.value = "";
    if (liveMode.checked) performDecode();
  });

  inputFile.addEventListener("change", function (event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    fileNameDisplay.textContent = "Loaded file: " + file.name;

    var reader = new FileReader();
    reader.onload = function () {
      inputText.value = String(reader.result);
      if (liveMode.checked) performDecode();
    };
    reader.onerror = function () {
      if (meta) meta.textContent = "Could not read that file.";
    };
    reader.readAsText(file);
  });

  decodeBtn.addEventListener("click", function () {
    performDecode();
    UT.track("decode");
  });

  copyBtn.addEventListener("click", function () {
    UT.copy(outputText.value, copyBtn).then(function (ok) {
      if (ok) UT.track("copy");
    });
  });

  downloadBtn.addEventListener("click", function () {
    if (!rawBytes) {
      UT.announce("Decode something first");
      return;
    }
    var blob = new Blob([rawBytes]);
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "decoded.bin";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
    UT.track("download");
  });
})();
