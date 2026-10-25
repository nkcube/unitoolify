(function () {
  "use strict";

  var inputText = document.getElementById("inputText");
  var outputText = document.getElementById("outputText");
  var inputFile = document.getElementById("inputFile");
  var fileNameDisplay = document.getElementById("fileNameDisplay");
  var urlSafe = document.getElementById("urlSafe");
  var splitLines = document.getElementById("splitLines");
  var liveMode = document.getElementById("liveMode");
  var encodeBtn = document.getElementById("encodeBtn");
  var copyBtn = document.getElementById("copyBtn");
  var downloadBtn = document.getElementById("downloadBtn");
  var meta = document.getElementById("meta");

  var CHUNK = 0x8000;
  var fileBytes = null;
  // Textareas normalise CRLF to LF, so keep the real payload for downloads.
  var lastResult = "";

  // Chunked on purpose: String.fromCharCode.apply(null, hugeArray) throws
  // RangeError once the input passes ~100 KB, which used to break big pastes.
  function bytesToBase64(bytes) {
    var binary = "";
    for (var i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  }

  function chunkString(str, length) {
    var out = [];
    for (var i = 0; i < str.length; i += length)
      out.push(str.slice(i, i + length));
    return out.join("\r\n");
  }

  function toUrlSafe(value) {
    return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function performEncode() {
    var bytes;
    try {
      bytes = fileBytes || new TextEncoder().encode(inputText.value);
    } catch (err) {
      outputText.value = "";
      meta.textContent = "Could not read that input: " + err.message;
      return;
    }

    if (!bytes.length) {
      outputText.value = "";
      meta.textContent = "";
      return;
    }

    var result = bytesToBase64(bytes);
    if (urlSafe.checked) result = toUrlSafe(result);
    if (splitLines.checked) result = chunkString(result, 76);
    lastResult = result;
    outputText.value = result;

    var kb = (bytes.length / 1024).toFixed(bytes.length > 10240 ? 0 : 1);
    meta.textContent =
      bytes.length.toLocaleString("en-US") +
      " bytes in (" +
      kb +
      " KB) → " +
      result.length.toLocaleString("en-US") +
      " Base64 characters";
  }

  inputText.addEventListener("input", function () {
    fileBytes = null;
    fileNameDisplay.textContent = "";
    inputFile.value = "";
    downloadBtn.hidden = true;
    if (liveMode.checked) performEncode();
  });

  inputFile.addEventListener("change", function (event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;

    fileNameDisplay.textContent =
      "Selected file: " +
      file.name +
      " (" +
      (file.size / 1024).toFixed(2) +
      " KB)";
    inputText.value = "";

    var reader = new FileReader();
    reader.onload = function () {
      fileBytes = new Uint8Array(reader.result);
      downloadBtn.hidden = false;
      performEncode();
    };
    reader.onerror = function () {
      meta.textContent = "Could not read that file.";
    };
    reader.readAsArrayBuffer(file);
  });

  [urlSafe, splitLines].forEach(function (el) {
    el.addEventListener("change", function () {
      if (liveMode.checked) performEncode();
    });
  });

  encodeBtn.addEventListener("click", function () {
    performEncode();
    UT.track("encode");
  });

  copyBtn.addEventListener("click", function () {
    UT.copy(outputText.value, copyBtn).then(function (ok) {
      if (ok) UT.track("copy");
    });
  });

  downloadBtn.addEventListener("click", function () {
    UT.download(
      lastResult || outputText.value,
      "encoded.b64.txt",
      "text/plain;charset=utf-8",
    );
    UT.track("download");
  });
})();
