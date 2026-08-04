(function () {
  "use strict";

  var SNAPSHOT_URL = "https://firebasestorage.googleapis.com/v0/b/mvg-library.firebasestorage.app/o/catalog%2Fsnapshot.json?alt=media";
  var CACHE_DB_NAME = "mvg-cache";
  var CACHE_STORE = "kv";
  var CACHE_KEY = "mvg-wiki-cache-v5";

  var LATEST_POOL = 600; // how many of the newest submissions feed the cloud
  var MAX_WORDS = 140; // cap for render performance
  var MIN_FONT = 13;
  var MAX_FONT = 46;

  // Same fix as app.js's isEligibleLatestSubmission()/renderLatestStrip()
  // (kept duplicated here since cloud.js is a standalone script with no
  // shared module system) -- entries below rowNum 12462 are internal
  // research/backfill, not real submissions, and rowNum 13129-13178 is a
  // 50-entry Michel Gondry backfill block (consecutive rowNums, clearly one
  // bulk import) that's what made him dominate this exact word cloud.
  var LATEST_MIN_ROWNUM = 12462;
  var LATEST_EXCLUDED_RANGES = [[13129, 13178]];

  function isEligibleSubmission(rowNum) {
    var n = parseInt(rowNum, 10);
    if (isNaN(n) || n < LATEST_MIN_ROWNUM) return false;
    for (var i = 0; i < LATEST_EXCLUDED_RANGES.length; i++) {
      if (n >= LATEST_EXCLUDED_RANGES[i][0] && n <= LATEST_EXCLUDED_RANGES[i][1]) return false;
    }
    return true;
  }

  function openCacheDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error("IndexedDB unavailable")); return; }
      var req = indexedDB.open(CACHE_DB_NAME, 1);
      req.onupgradeneeded = function () {
        req.result.createObjectStore(CACHE_STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function loadCache() {
    return openCacheDb().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(CACHE_STORE, "readonly");
        var req = tx.objectStore(CACHE_STORE).get(CACHE_KEY);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { resolve(null); };
      });
    }).catch(function () {
      return null;
    });
  }

  function fetchSnapshot() {
    return fetch(SNAPSHOT_URL).then(function (res) {
      if (!res.ok) throw new Error("snapshot fetch failed: " + res.status);
      return res.json();
    });
  }

  function getRows() {
    return loadCache().then(function (cached) {
      if (cached && cached.rows && cached.rows.length) return cached.rows;
      return fetchSnapshot();
    }).catch(function () {
      return fetchSnapshot();
    });
  }

  // ---- Build the weighted word list from the latest submissions ----------

  function buildWords(rows) {
    var pool = rows
      .filter(function (r) { return isEligibleSubmission(r.rowNum); })
      .map(function (r) { return { row: r, n: parseInt(r.rowNum, 10) }; })
      .sort(function (a, b) { return b.n - a.n; })
      .slice(0, LATEST_POOL)
      .map(function (x) { return x.row; });

    var counts = {};
    var display = {};
    pool.forEach(function (row) {
      [row.artist, row.song, row.director].forEach(function (val) {
        var text = (val || "").trim();
        if (!text) return;
        var key = text.toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
        if (!display[key]) display[key] = text;
      });
    });

    var words = Object.keys(counts).map(function (key) {
      return { text: display[key], count: counts[key] };
    });
    words.sort(function (a, b) { return b.count - a.count; });
    words = words.slice(0, MAX_WORDS);

    var maxCount = words.reduce(function (m, w) { return Math.max(m, w.count); }, 1);
    var minCount = words.reduce(function (m, w) { return Math.min(m, w.count); }, maxCount);
    words.forEach(function (w) {
      var t = maxCount === minCount ? 1 : (w.count - minCount) / (maxCount - minCount);
      w.fontSize = MIN_FONT + t * (MAX_FONT - MIN_FONT);
      w.hue = hashHue(w.text);
    });
    return words;
  }

  function hashHue(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) >>> 0;
    }
    return h % 360;
  }

  // ---- Fibonacci sphere point distribution --------------------------------

  function sphereWords(words) {
    var n = words.length;
    var goldenAngle = Math.PI * (3 - Math.sqrt(5));
    words.forEach(function (w, i) {
      var y = n <= 1 ? 0 : 1 - (i / (n - 1)) * 2;
      var radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
      var theta = goldenAngle * i;
      w.x = Math.cos(theta) * radiusAtY;
      w.y = y;
      w.z = Math.sin(theta) * radiusAtY;
    });
  }

  // ---- Render / animate -----------------------------------------------

  function init(words) {
    var stage = document.getElementById("cloudStage");
    stage.innerHTML = "";
    var sphere = document.createElement("div");
    sphere.className = "cloud-sphere";
    stage.appendChild(sphere);

    var spans = words.map(function (w) {
      var el = document.createElement("span");
      el.className = "cloud-word";
      el.textContent = w.text;
      el.style.fontSize = w.fontSize.toFixed(1) + "px";
      el.style.color = "hsl(" + w.hue + ", 72%, 58%)";
      sphere.appendChild(el);
      return el;
    });

    var rotX = -0.15;
    var rotY = 0;
    var autoSpeed = 0.12; // radians/sec
    var zoom = 1;
    var dragging = false;
    var lastX = 0, lastY = 0;
    var velX = 0, velY = 0;
    var idleTimer = null;

    function stageRect() { return stage.getBoundingClientRect(); }
    function radius() {
      var r = stageRect();
      return Math.min(r.width, r.height) * 0.36 * zoom;
    }
    var perspectiveDist = 900;

    function render() {
      var R = radius();
      var cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      var cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      for (var i = 0; i < words.length; i++) {
        var w = words[i];
        var x1 = w.x * cosY + w.z * sinY;
        var z1 = -w.x * sinY + w.z * cosY;
        var y1 = w.y;
        var y2 = y1 * cosX - z1 * sinX;
        var z2 = y1 * sinX + z1 * cosX;
        var x2 = x1;

        var px = x2 * R, py = y2 * R, pz = z2 * R;
        var scale = perspectiveDist / (perspectiveDist + pz);
        var opacity = 0.32 + 0.68 * ((pz + R) / (2 * R));

        var el = spans[i];
        el.style.transform = "translate(-50%, -50%) translate3d(" + px.toFixed(1) + "px," + py.toFixed(1) + "px,0) scale(" + scale.toFixed(3) + ")";
        el.style.opacity = opacity.toFixed(2);
        el.style.zIndex = Math.round(pz * 10) + 10000;
      }
    }

    var lastT = null;
    function tick(t) {
      if (lastT == null) lastT = t;
      var dt = Math.min(0.05, (t - lastT) / 1000);
      lastT = t;
      if (!dragging) {
        rotY += autoSpeed * dt;
      } else {
        rotY += velX * dt;
        rotX += velY * dt;
        rotX = Math.max(-1.2, Math.min(1.2, rotX));
      }
      render();
      requestAnimationFrame(tick);
    }

    function onDown(clientX, clientY) {
      dragging = true;
      lastX = clientX;
      lastY = clientY;
      velX = 0; velY = 0;
    }
    function onMove(clientX, clientY) {
      if (!dragging) return;
      var dx = clientX - lastX;
      var dy = clientY - lastY;
      lastX = clientX;
      lastY = clientY;
      velX = dx * 0.02;
      velY = -dy * 0.02;
      rotY += velX * 0.6;
      rotX += velY * 0.6;
      rotX = Math.max(-1.2, Math.min(1.2, rotX));
    }
    function onUp() {
      dragging = false;
    }

    stage.style.cursor = "grab";
    stage.addEventListener("pointerdown", function (e) {
      stage.style.cursor = "grabbing";
      stage.setPointerCapture(e.pointerId);
      onDown(e.clientX, e.clientY);
    });
    stage.addEventListener("pointermove", function (e) { onMove(e.clientX, e.clientY); });
    stage.addEventListener("pointerup", function () { stage.style.cursor = "grab"; onUp(); });
    stage.addEventListener("pointercancel", function () { stage.style.cursor = "grab"; onUp(); });
    stage.addEventListener("wheel", function (e) {
      e.preventDefault();
      zoom = Math.max(0.55, Math.min(2, zoom - e.deltaY * 0.0012));
    }, { passive: false });

    window.addEventListener("resize", render);
    requestAnimationFrame(tick);
  }

  getRows().then(function (rows) {
    var words = buildWords(rows);
    sphereWords(words);
    init(words);
  }).catch(function (err) {
    var stage = document.getElementById("cloudStage");
    stage.innerHTML = '<p class="cloud-loading">Couldn\'t load the cloud right now.</p>';
    console.error("Word cloud failed:", err);
  });
})();
