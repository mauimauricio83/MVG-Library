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
    showShortsCheckbox: document.getElementById("intakeShowShortsCheckbox"),
    status: document.getElementById("intakeStatus"),
    results: document.getElementById("intakeResults"),
    loadMoreRow: document.getElementById("intakeLoadMoreRow"),
    loadMoreBtn: document.getElementById("intakeLoadMoreBtn"),
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
  var results = []; // accumulated across pages, each: {videoId, title, channel, publishedAt, thumb, seconds, isDuplicate, isShort}
  var nextPageToken = null;
  var currentPublishedAfter = null;

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

  // order=relevance, not date -- "music video" is generic enough that new
  // matching uploads (a lot of them spam/hashtag noise) land every few
  // minutes, so sorting strictly by date buried real candidates from a
  // few days back under the last several hours of noise. Relevance still
  // respects publishedAfter as a hard cutoff, just ranks within it instead
  // of by recency -- closer to how youtube.com's own search behaves when
  // filtered by upload date (it defaults to relevance sort too). Even so,
  // this can't fully match youtube.com's own search results: the public
  // API's relevance ranking is a cruder text/tag index than the signals
  // (personalization, channel authority, etc.) the website's search uses,
  // so some real videos that the site surfaces just won't show up here.
  function ytSearchList(publishedAfter, pageToken) {
    var url = "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=relevance&maxResults=50" +
      "&q=" + encodeURIComponent("music video") +
      "&publishedAfter=" + encodeURIComponent(publishedAfter) +
      "&key=" + encodeURIComponent(YOUTUBE_API_KEY) +
      (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");
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

  function summarizeStatus() {
    var visibleCount = countVisible();
    var dupeCount = results.filter(function (r) { return r.isDuplicate; }).length;
    var shortCount = results.filter(function (r) { return r.isShort && !r.isDuplicate; }).length;
    var hiddenBits = [];
    if (dupeCount) hiddenBits.push(dupeCount + " already in catalog");
    if (shortCount) hiddenBits.push(shortCount + " Shorts");
    var hiddenNote = (!els.showDupesCheckbox.checked || !els.showShortsCheckbox.checked) && hiddenBits.length
      ? " (" + hiddenBits.join(", ") + " hidden -- toggle above to reveal)"
      : "";
    setStatus(results.length + " result" + (results.length === 1 ? "" : "s") + " fetched, " + visibleCount + " shown" + hiddenNote + ".");
  }

  function countVisible() {
    var showDupes = els.showDupesCheckbox.checked;
    var showShorts = els.showShortsCheckbox.checked;
    return results.filter(function (r) {
      return (showDupes || !r.isDuplicate) && (showShorts || !r.isShort);
    }).length;
  }

  function fetchPage(pageToken) {
    return ytSearchList(currentPublishedAfter, pageToken).then(function (searchJson) {
      var items = searchJson.items || [];
      var ids = items.map(function (item) { return item.id.videoId; }).filter(Boolean);
      nextPageToken = searchJson.nextPageToken || null;
      return ytVideoDurations(ids).then(function (durations) {
        var existingIds = new Set(results.map(function (r) { return r.videoId; }));
        items.forEach(function (item) {
          var videoId = item.id.videoId;
          if (!videoId || existingIds.has(videoId)) return;
          var seconds = durations[videoId] || 0;
          results.push({
            videoId: videoId,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
            thumb: item.snippet.thumbnails && (item.snippet.thumbnails.medium || item.snippet.thumbnails.default).url,
            seconds: seconds,
            isShort: seconds > 0 && seconds < 90,
            isDuplicate: knownYouTubeIds.has(videoId)
          });
        });
        renderResults();
        summarizeStatus();
        els.loadMoreRow.hidden = !nextPageToken;
      });
    });
  }

  function runSearch() {
    var days = Math.max(1, Math.min(30, parseInt(els.daysInput.value, 10) || 7));
    currentPublishedAfter = new Date(Date.now() - days * 86400000).toISOString();
    results = [];
    nextPageToken = null;

    els.searchBtn.disabled = true;
    setStatus("Searching the last " + days + " day" + (days === 1 ? "" : "s") + "…");
    els.results.innerHTML = "";
    els.copyRow.hidden = true;
    els.loadMoreRow.hidden = true;

    fetchPage(null).catch(function (err) {
      setStatus(err.message || "Search failed.", true);
    }).then(function () {
      els.searchBtn.disabled = false;
    });
  }

  function loadMore() {
    if (!nextPageToken) return;
    els.loadMoreBtn.disabled = true;
    setStatus("Loading more…");
    fetchPage(nextPageToken).catch(function (err) {
      setStatus(err.message || "Load more failed.", true);
    }).then(function () {
      els.loadMoreBtn.disabled = false;
    });
  }

  // YouTube's CDN serves maxresdefault.jpg for every video, but it isn't
  // part of the search API's snippet.thumbnails (which tops out around
  // 480x360) -- fetched directly here instead. Unavailable videos don't
  // 404 on this endpoint, they return a small gray placeholder, so a size
  // check picks the fallback (sddefault, then hqdefault) instead of just
  // trusting a 200. Cross-origin, so a plain <a download> wouldn't force
  // a save -- fetched as a blob and downloaded via an object URL instead.
  var COVER_ART_SIZES = ["maxresdefault", "sddefault", "hqdefault"];
  function downloadCoverArt(videoId, filenameBase, btn) {
    var originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "…";

    function tryNext(i) {
      if (i >= COVER_ART_SIZES.length) {
        btn.disabled = false;
        btn.textContent = originalLabel;
        setStatus("Couldn't fetch cover art for that video.", true);
        return;
      }
      var url = "https://i.ytimg.com/vi/" + videoId + "/" + COVER_ART_SIZES[i] + ".jpg";
      fetch(url).then(function (res) {
        if (!res.ok) throw new Error("not found");
        return res.blob();
      }).then(function (blob) {
        if (blob.size < 2000) throw new Error("placeholder image"); // unavailable-size stand-in, not a real thumbnail
        var objectUrl = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = objectUrl;
        a.download = filenameBase + ".jpg";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 1000);
        btn.disabled = false;
        btn.textContent = originalLabel;
      }).catch(function () { tryNext(i + 1); });
    }
    tryNext(0);
  }

  function renderResults() {
    var showDupes = els.showDupesCheckbox.checked;
    var showShorts = els.showShortsCheckbox.checked;
    var visible = results.filter(function (r) {
      return (showDupes || !r.isDuplicate) && (showShorts || !r.isShort);
    });

    if (!visible.length) {
      els.results.innerHTML = '<p class="admin-empty">' + (results.length ? "Nothing to show -- try Show already-added / Show Shorts, or Load more." : "No results yet -- run a search.") + "</p>";
      updateCopyBar();
      return;
    }

    // Checkbox (selection) and the thumbnail/title (watch on YouTube, new
    // tab) are deliberately separate click targets, not one wrapping
    // <label> -- otherwise clicking through to watch a video would also
    // toggle its selection, and vice versa.
    els.results.innerHTML = visible.map(function (r) {
      var badges = "";
      if (r.isDuplicate) badges += '<span class="admin-badge">Already in catalog</span>';
      if (r.isShort) badges += '<span class="admin-badge admin-badge-sponsored">Short</span>';
      var disabled = r.isDuplicate ? "disabled" : "";
      var publishedDate = r.publishedAt ? new Date(r.publishedAt).toLocaleDateString() : "";
      var watchUrl = "https://www.youtube.com/watch?v=" + encodeURIComponent(r.videoId);
      return (
        '<div class="intake-result-card' + (r.isDuplicate ? " is-duplicate" : "") + '">' +
          '<input type="checkbox" class="intake-result-check" data-video-id="' + escapeHtml(r.videoId) + '" ' + disabled + '>' +
          '<a class="intake-result-thumb-link" href="' + escapeHtml(watchUrl) + '" target="_blank" rel="noopener noreferrer" aria-label="Watch on YouTube">' +
            '<img class="intake-result-thumb" src="' + escapeHtml(r.thumb || "") + '" alt="" loading="lazy">' +
            '<span class="intake-result-play">&#9654;</span>' +
          "</a>" +
          '<div class="intake-result-info">' +
            '<a class="intake-result-title" href="' + escapeHtml(watchUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(r.title) + "</a>" + badges +
            '<div class="intake-result-meta">' + escapeHtml(r.channel) + " &middot; " + escapeHtml(publishedDate) +
              (r.seconds ? " &middot; " + formatDuration(r.seconds) : "") + "</div>" +
          "</div>" +
          '<button type="button" class="admin-row-btn intake-result-cover-btn" data-video-id="' + escapeHtml(r.videoId) + '" title="Download hi-res cover art">Cover art</button>' +
        "</div>"
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
  els.loadMoreBtn.addEventListener("click", loadMore);
  els.showDupesCheckbox.addEventListener("change", function () { renderResults(); summarizeStatus(); });
  els.showShortsCheckbox.addEventListener("change", function () { renderResults(); summarizeStatus(); });
  els.results.addEventListener("change", function (e) {
    if (e.target.classList.contains("intake-result-check")) updateCopyBar();
  });
  els.results.addEventListener("click", function (e) {
    var btn = e.target.closest(".intake-result-cover-btn");
    if (!btn) return;
    var videoId = btn.getAttribute("data-video-id");
    var r = results.filter(function (x) { return x.videoId === videoId; })[0];
    var filenameBase = r ? splitArtistSong(r.title).song.replace(/[^a-z0-9]+/gi, "-").slice(0, 60) || videoId : videoId;
    downloadCoverArt(videoId, filenameBase, btn);
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
