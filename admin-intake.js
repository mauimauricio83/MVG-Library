// Weekly Intake — standalone admin page (admin-intake.html), not part of
// the app.js SPA. Kept as its own small script rather than folding into
// app.js since it doesn't need the 13k-video fetch, TV Mode, or any of the
// public-site machinery -- just Firebase Auth + a `videos` collection read
// for dedup + the YouTube Data API. See BULK_FIELD_ALIASES / buildBulkDoc /
// parseBulkImportText in app.js for the existing, proven Bulk Import
// pipeline this hands off to -- deliberately NOT reimplemented here.
(function () {
  "use strict";

  // Same config as app.js:35-43 -- safe to duplicate, it's public/client-side
  // by design; Firestore security rules are what actually gate access.
  var firebaseConfig = {
    apiKey: "AIzaSyAStHfrJ9NwLfaIclL9ODHFchxMm5MBlMw",
    authDomain: "mvg-library.firebaseapp.com",
    projectId: "mvg-library",
    storageBucket: "mvg-library.firebasestorage.app",
    messagingSenderId: "231351803618",
    appId: "1:231351803618:web:abc5015bccc8361296c8bb",
    measurementId: "G-GS1TQ1CXRZ"
  };
  firebase.initializeApp(firebaseConfig);
  var auth = firebase.auth();
  var db = firebase.firestore();
  var googleProvider = new firebase.auth.GoogleAuthProvider();

  // Same key as app.js:64 (YOUTUBE_SEARCH_API_KEY) -- referrer-restricted,
  // ~100 search.list calls/day free. Duplicated rather than shared since
  // this page doesn't load app.js.
  var YOUTUBE_API_KEY = "AIzaSyBCjFAxZEVXdDWC_HLQnZCV0ihXW-B2eBk";

  var els = {
    signedOut: document.getElementById("intakeSignedOut"),
    signInBtn: document.getElementById("intakeSignInBtn"),
    unauthorized: document.getElementById("intakeUnauthorized"),
    app: document.getElementById("intakeApp"),
    daysInput: document.getElementById("intakeDaysInput"),
    searchBtn: document.getElementById("intakeSearchBtn"),
    showDupesCheckbox: document.getElementById("intakeShowDupesCheckbox"),
    status: document.getElementById("intakeStatus"),
    results: document.getElementById("intakeResults"),
    copyRow: document.getElementById("intakeCopyRow"),
    copyBtn: document.getElementById("intakeCopyBtn")
  };

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Same regex as app.js:4118 (extractYouTubeId) -- duplicated for the
  // same reason as firebaseConfig above.
  function extractYouTubeId(url) {
    var m = String(url || "").match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : null;
  }

  function parseIso8601Duration(iso) {
    var m = String(iso || "").match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    if (!m) return 0;
    var h = parseInt(m[1] || "0", 10), min = parseInt(m[2] || "0", 10), s = parseInt(m[3] || "0", 10);
    return h * 3600 + min * 60 + s;
  }

  function formatDuration(seconds) {
    if (!seconds) return "";
    var m = Math.floor(seconds / 60), s = seconds % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  // Best-effort "Artist - Song" split off common title separators. Falls
  // back to Song = full title, Artist blank -- the admin reviews/edits
  // every row in Bulk Import's Preview before committing anyway, so an
  // imperfect split just means a bit more manual cleanup, not bad data.
  function splitArtistSong(title) {
    var m = String(title || "").match(/^(.+?)\s*[-–—|]\s*(.+)$/);
    if (m) return { artist: m[1].trim(), song: m[2].trim() };
    return { artist: "", song: String(title || "").trim() };
  }

  var knownYouTubeIds = null; // Set, built once after admin auth confirms
  var results = []; // last search results, each: {videoId, title, channel, publishedAt, thumb, seconds, isDuplicate, isShort}

  function setStatus(text, isError) {
    els.status.textContent = text || "";
    els.status.className = "admin-status" + (isError ? " is-error" : "");
  }

  function loadKnownYouTubeIds() {
    return db.collection("videos").get().then(function (snap) {
      var ids = new Set();
      snap.forEach(function (doc) {
        var id = extractYouTubeId(doc.data().youtube);
        if (id) ids.add(id);
      });
      knownYouTubeIds = ids;
    });
  }

  function ytSearchList(publishedAfter) {
    var url = "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=date&maxResults=50" +
      "&q=" + encodeURIComponent("music video") +
      "&publishedAfter=" + encodeURIComponent(publishedAfter) +
      "&key=" + encodeURIComponent(YOUTUBE_API_KEY);
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("YouTube search failed (" + res.status + ")");
      return res.json();
    });
  }

  function ytVideoDurations(ids) {
    if (!ids.length) return Promise.resolve({});
    var url = "https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=" +
      ids.join(",") + "&key=" + encodeURIComponent(YOUTUBE_API_KEY);
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("YouTube durations lookup failed (" + res.status + ")");
      return res.json();
    }).then(function (json) {
      var byId = {};
      (json.items || []).forEach(function (item) {
        byId[item.id] = parseIso8601Duration(item.contentDetails && item.contentDetails.duration);
      });
      return byId;
    });
  }

  function runSearch() {
    var days = Math.max(1, Math.min(30, parseInt(els.daysInput.value, 10) || 7));
    var publishedAfter = new Date(Date.now() - days * 86400000).toISOString();

    els.searchBtn.disabled = true;
    setStatus("Searching the last " + days + " day" + (days === 1 ? "" : "s") + "…");
    els.results.innerHTML = "";
    els.copyRow.hidden = true;

    ytSearchList(publishedAfter).then(function (searchJson) {
      var items = searchJson.items || [];
      var ids = items.map(function (item) { return item.id.videoId; }).filter(Boolean);
      return ytVideoDurations(ids).then(function (durations) {
        results = items.map(function (item) {
          var videoId = item.id.videoId;
          var seconds = durations[videoId] || 0;
          return {
            videoId: videoId,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
            thumb: item.snippet.thumbnails && (item.snippet.thumbnails.medium || item.snippet.thumbnails.default).url,
            seconds: seconds,
            isShort: seconds > 0 && seconds < 90,
            isDuplicate: knownYouTubeIds.has(videoId)
          };
        });
        renderResults();
        setStatus(results.length + " result" + (results.length === 1 ? "" : "s") + " found.");
      });
    }).catch(function (err) {
      setStatus(err.message || "Search failed.", true);
    }).then(function () {
      els.searchBtn.disabled = false;
    });
  }

  function renderResults() {
    var showDupes = els.showDupesCheckbox.checked;
    var visible = results.filter(function (r) { return showDupes || !r.isDuplicate; });

    if (!visible.length) {
      els.results.innerHTML = '<p class="admin-empty">' + (results.length ? "Nothing new -- everything found is already in the catalog." : "No results yet -- run a search.") + "</p>";
      updateCopyBar();
      return;
    }

    els.results.innerHTML = visible.map(function (r) {
      var badges = "";
      if (r.isDuplicate) badges += '<span class="admin-badge">Already in catalog</span>';
      if (r.isShort) badges += '<span class="admin-badge admin-badge-sponsored">Short</span>';
      var disabled = r.isDuplicate ? "disabled" : "";
      var publishedDate = r.publishedAt ? new Date(r.publishedAt).toLocaleDateString() : "";
      return (
        '<label class="intake-result-card' + (r.isDuplicate ? " is-duplicate" : "") + '">' +
          '<input type="checkbox" class="intake-result-check" data-video-id="' + escapeHtml(r.videoId) + '" ' + disabled + '>' +
          '<img class="intake-result-thumb" src="' + escapeHtml(r.thumb || "") + '" alt="" loading="lazy">' +
          '<div class="intake-result-info">' +
            '<div class="intake-result-title">' + escapeHtml(r.title) + badges + "</div>" +
            '<div class="intake-result-meta">' + escapeHtml(r.channel) + " &middot; " + escapeHtml(publishedDate) +
              (r.seconds ? " &middot; " + formatDuration(r.seconds) : "") + "</div>" +
          "</div>" +
        "</label>"
      );
    }).join("");

    updateCopyBar();
  }

  function selectedVideoIds() {
    return Array.prototype.slice.call(els.results.querySelectorAll(".intake-result-check:checked"))
      .map(function (el) { return el.getAttribute("data-video-id"); });
  }

  function updateCopyBar() {
    var count = selectedVideoIds().length;
    els.copyRow.hidden = count === 0;
    els.copyBtn.textContent = "Copy " + count + " selected row" + (count === 1 ? "" : "s");
  }

  function buildBulkImportText(videoIds) {
    var rows = videoIds.map(function (id) {
      var r = results.filter(function (x) { return x.videoId === id; })[0];
      if (!r) return null;
      var split = splitArtistSong(r.title);
      var year = r.publishedAt ? new Date(r.publishedAt).getFullYear() : "";
      var youtubeUrl = "https://www.youtube.com/watch?v=" + r.videoId;
      return [split.artist, split.song, youtubeUrl, "Music Video", year].join("\t");
    }).filter(Boolean);
    return ["Artist\tSong Title\tYouTube Link\tCategory\tYear"].concat(rows).join("\n");
  }

  els.signInBtn.addEventListener("click", function () {
    auth.signInWithPopup(googleProvider).catch(function (err) {
      setStatus(err.message || "Sign-in failed.", true);
    });
  });

  els.searchBtn.addEventListener("click", runSearch);
  els.showDupesCheckbox.addEventListener("change", renderResults);
  els.results.addEventListener("change", function (e) {
    if (e.target.classList.contains("intake-result-check")) updateCopyBar();
  });

  els.copyBtn.addEventListener("click", function () {
    var ids = selectedVideoIds();
    if (!ids.length) return;
    var text = buildBulkImportText(ids);
    navigator.clipboard.writeText(text).then(function () {
      setStatus("Copied " + ids.length + " row" + (ids.length === 1 ? "" : "s") + " -- paste into Admin → Bulk Import.");
    }).catch(function () {
      setStatus("Couldn't copy automatically -- select and copy the rows manually.", true);
    });
  });

  auth.onAuthStateChanged(function (user) {
    els.signedOut.hidden = !!user;
    els.unauthorized.hidden = true;
    els.app.hidden = true;
    if (!user) return;

    db.collection("admins").doc(user.uid).get().then(function (doc) {
      if (!doc.exists) {
        els.unauthorized.hidden = false;
        return;
      }
      els.app.hidden = false;
      setStatus("Loading catalog for dedup…");
      loadKnownYouTubeIds().then(function () {
        setStatus("Ready -- pick a date range and search.");
      }).catch(function (err) {
        setStatus("Couldn't load the catalog for dedup: " + (err.message || err), true);
      });
    });
  });
})();
