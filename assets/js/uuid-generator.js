(function () {
  "use strict";

  var outputText = document.getElementById("outputText");
  var generateBtn = document.getElementById("generateBtn");
  var copyBtn = document.getElementById("copyBtn");
  var downloadBtn = document.getElementById("downloadBtn");
  var uuidCount = document.getElementById("uuidCount");
  var uppercase = document.getElementById("uppercase");
  var noHyphens = document.getElementById("noHyphens");

  // v1 normally embeds the machine's MAC address. We use a random multicast
  // node instead, so generated IDs cannot be traced back to a device.
  var nodeId = new Uint8Array(6);
  var clockSeq = 0;
  (function init() {
    var random = new Uint8Array(8);
    crypto.getRandomValues(random);
    for (var i = 0; i < 6; i++) nodeId[i] = random[i];
    nodeId[0] |= 0x01;
    clockSeq = ((random[6] << 8) | random[7]) & 0x3fff;
  })();

  function toHex(bytes) {
    var out = "";
    for (var i = 0; i < bytes.length; i++) {
      out += bytes[i].toString(16).padStart(2, "0");
    }
    return out;
  }

  function uuidv4() {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
    var bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    var hex = toHex(bytes);
    return (
      hex.slice(0, 8) +
      "-" +
      hex.slice(8, 12) +
      "-" +
      hex.slice(12, 16) +
      "-" +
      hex.slice(16, 20) +
      "-" +
      hex.slice(20)
    );
  }

  function uuidv1() {
    // 100-nanosecond intervals since 1582-10-15, needs BigInt for precision.
    var unixMs = BigInt(Date.now()) + 12219292800000n;
    var subMs = BigInt(Math.floor((performance.now() % 1) * 10000));
    var timestamp = unixMs * 10000n + subMs;

    var timeLow = (timestamp & 0xffffffffn).toString(16).padStart(8, "0");
    var timeMid = ((timestamp >> 32n) & 0xffffn).toString(16).padStart(4, "0");
    // 12 bits of the high timestamp; the version nibble is prepended to it.
    var timeHigh = ((timestamp >> 48n) & 0x0fffn).toString(16).padStart(3, "0");

    clockSeq = (clockSeq + 1) & 0x3fff;
    var seq = ((clockSeq & 0x3fff) | 0x8000).toString(16).padStart(4, "0");

    return (
      timeLow +
      "-" +
      timeMid +
      "-1" +
      timeHigh +
      "-" +
      seq +
      "-" +
      toHex(nodeId)
    );
  }

  function generate() {
    var count = parseInt(uuidCount.value, 10);
    if (isNaN(count) || count < 1) count = 1;
    if (count > 10000) {
      count = 10000;
      uuidCount.value = "10000";
    }

    var version = document.querySelector(
      'input[name="uuidVersion"]:checked',
    ).value;
    var upper = uppercase.checked;
    var stripDashes = noHyphens.checked;

    var ids = new Array(count);
    for (var i = 0; i < count; i++) {
      var id = version === "1" ? uuidv1() : uuidv4();
      if (upper) id = id.toUpperCase();
      if (stripDashes) id = id.replace(/-/g, "");
      ids[i] = id;
    }

    outputText.value = ids.join("\n");
    UT.track("generate", { count: count, version: version });
  }

  generate();

  generateBtn.addEventListener("click", generate);

  copyBtn.addEventListener("click", function () {
    UT.copy(outputText.value, copyBtn).then(function (ok) {
      if (ok) UT.track("copy");
    });
  });

  downloadBtn.addEventListener("click", function () {
    if (!outputText.value) return;
    UT.download(outputText.value, "uuids.txt", "text/plain;charset=utf-8");
    UT.track("download");
  });
})();
