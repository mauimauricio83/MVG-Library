// Manage Entries — standalone admin page (manage-entries.html), not part
// of the app.js SPA. Same architecture as admin-intake.js: own Firebase
// init, own admins/{uid} auth gate, no app.js load. Ports the List/Grid
// browsing+editing experience that used to live inside index.html's admin
// modal (#adminListView) -- see CHANGELOG.md for the migration. The
// Add/Edit form and Bulk Import deliberately stayed in app.js (they're
// shared with the public lightbox's admin Edit button and TV Mode) --
// this page's "+ Add Entry"/"Bulk Import" links jump back there via
// index.html?admin=add / ?admin=bulk (see applyAdminDeepLink() in app.js).
(function () {
  "use strict";

  // Same config as app.js:13-21 -- safe to duplicate, it's public/client-side
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

  var els = {
    signedOut: document.getElementById("meSignedOut"),
    signInBtn: document.getElementById("meSignInBtn"),
    unauthorized: document.getElementById("meUnauthorized"),
    app: document.getElementById("meApp"),
    publishBtn: document.getElementById("mePublishBtn"),
    gridToggleBtn: document.getElementById("meGridToggleBtn"),
    searchInput: document.getElementById("meSearchInput"),
    status: document.getElementById("meStatus"),
    gridHint: document.getElementById("meGridHint"),
    entriesList: document.getElementById("meEntriesList"),
    gridWrap: document.getElementById("meGridWrap"),
    gridTable: document.getElementById("meGridTable"),
    gridPagerLabel: document.getElementById("meGridPagerLabel"),
    gridPageNumbers: document.getElementById("meGridPageNumbers"),
    gridFirstBtn: document.getElementById("meGridFirstBtn"),
    gridPrevBtn: document.getElementById("meGridPrevBtn"),
    gridNextBtn: document.getElementById("meGridNextBtn"),
    gridLastBtn: document.getElementById("meGridLastBtn"),
    previewModal: document.getElementById("mePreviewModal"),
    previewClose: document.getElementById("mePreviewClose"),
    previewBody: document.getElementById("mePreviewBody"),
    bottomScrollbar: document.getElementById("meBottomScrollbar"),
    bottomScrollbarInner: document.getElementById("meBottomScrollbarInner"),
    filterStatus: document.getElementById("meFilterStatus"),
    dupeCount: document.getElementById("meDupeCount"),
    noVideoCount: document.getElementById("meNoVideoCount"),
    brokenCount: document.getElementById("meBrokenCount"),
    healthDupesBtn: document.getElementById("meHealthDupesBtn"),
    healthNoVideoBtn: document.getElementById("meHealthNoVideoBtn"),
    healthBrokenBtn: document.getElementById("meHealthBrokenBtn"),
    goFillLinksBtn: document.getElementById("meGoFillLinksBtn"),
    scanBrokenBtn: document.getElementById("meScanBrokenBtn"),
    scanStopBtn: document.getElementById("meScanStopBtn"),
    scanProgress: document.getElementById("meScanProgress"),
    fillLinksModal: document.getElementById("meFillLinksModal"),
    fillLinksClose: document.getElementById("meFillLinksClose"),
    fillLinksRemaining: document.getElementById("meFillLinksRemaining"),
    fillLinksStatus: document.getElementById("meFillLinksStatus"),
    fillLinksCard: document.getElementById("meFillLinksCard"),
    fillLinksTitle: document.getElementById("meFillLinksTitle"),
    fillLinksSub: document.getElementById("meFillLinksSub"),
    fillLinksSearchBtn: document.getElementById("meFillLinksSearchBtn"),
    fillLinksAutoFillBtn: document.getElementById("meFillLinksAutoFillBtn"),
    fillLinksAutoFillNote: document.getElementById("meFillLinksAutoFillNote"),
    fillLinksInput: document.getElementById("meFillLinksInput"),
    fillLinksError: document.getElementById("meFillLinksError"),
    fillLinksPreview: document.getElementById("meFillLinksPreview"),
    fillLinksSaveBtn: document.getElementById("meFillLinksSaveBtn"),
    fillLinksSkipBtn: document.getElementById("meFillLinksSkipBtn"),
    fillLinksDeleteBtn: document.getElementById("meFillLinksDeleteBtn"),
    fillLinksDone: document.getElementById("meFillLinksDone"),
    fillLinksPublishBtn: document.getElementById("meFillLinksPublishBtn")
  };

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // The YouTube Data API returns snippet.title/channelTitle HTML-entity-
  // encoded (a video literally titled '...& ...' comes back as the text
  // "...&amp; ..."), which would otherwise show up literally (assigning
  // it to .textContent doesn't decode entities either) -- decode once at
  // ingestion. <textarea> is used rather than a <div> because its content
  // model is plain text, not HTML -- entities decode but nothing (e.g. a
  // stray "<script>") can execute.
  function decodeHtmlEntities(str) {
    var el = document.createElement("textarea");
    el.innerHTML = str;
    return el.value;
  }

  // Same regexes as app.js's extractYouTubeId()/extractVimeoId() -- duplicated
  // for the same reason as firebaseConfig above (no shared module system).
  function extractYouTubeId(url) {
    var m = String(url || "").match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : null;
  }

  function extractVimeoId(url) {
    var m = String(url || "").match(/vimeo\.com\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/|)(\d+)/);
    return m ? m[1] : null;
  }

  // Same as app.js's getRowVideoRef()/hasVideo() -- youtube wins if a row
  // somehow has both.
  function getRowVideoRef(row) {
    var ytId = extractYouTubeId(row && row.youtube);
    if (ytId) return { provider: "youtube", id: ytId };
    var vimeoId = extractVimeoId(row && row.vimeo);
    if (vimeoId) return { provider: "vimeo", id: vimeoId };
    return null;
  }

  function hasVideo(row) {
    return !!getRowVideoRef(row);
  }

  // Same as app.js's fetchVimeoThumbnail() -- Vimeo has no predictable
  // thumbnail URL the way YouTube does, so it's resolved once via oEmbed.
  function fetchVimeoThumbnail(vimeoId) {
    return fetch("https://vimeo.com/api/oembed.json?url=" + encodeURIComponent("https://vimeo.com/" + vimeoId))
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) { return (data && data.thumbnail_url) || null; })
      .catch(function () { return null; });
  }

  function setStatus(text, isError) {
    els.status.textContent = text || "";
    els.status.className = "admin-status" + (isError ? " is-error" : "");
    els.status.hidden = !text;
  }

  var adminRows = [];

  function findRowByNum(rowNum) {
    return adminRows.filter(function (r) { return r.rowNum === rowNum; })[0] || null;
  }

  // ---- List view row markup ----------------------------------------------
  function rowHtml(r) {
    var badges = "";
    if (r.feature) badges += '<span class="admin-badge">Feature</span>';
    if (r.spotlight) badges += '<span class="admin-badge">Maui\'s Picks</span>';
    if (r.sponsored) badges += '<span class="admin-badge admin-badge-sponsored">Sponsored</span>';
    if (r.backdoor) badges += '<span class="admin-badge admin-badge-backdoor">Backdoor</span>';
    return (
      '<div class="admin-row" data-rownum="' + escapeHtml(r.rowNum) + '">' +
        '<div class="admin-row-main">' +
          '<div class="admin-row-title">' + escapeHtml(r.artist) + " — " + escapeHtml(r.song) + "</div>" +
          '<div class="admin-row-sub"><button type="button" class="admin-grid-rownum-btn" data-preview-rownum="' + escapeHtml(r.rowNum) + '">#' + escapeHtml(r.rowNum) + "</button>" + (r.director ? " · " + escapeHtml(r.director) : "") + " " + badges + "</div>" +
        "</div>" +
        '<div class="admin-row-actions">' +
          '<a class="admin-row-btn" href="index.html?admin=edit&row=' + encodeURIComponent(r.rowNum) + '">Edit</a>' +
          '<button type="button" class="admin-row-btn admin-row-btn-danger" data-delete-rownum="' + escapeHtml(r.rowNum) + '">Delete</button>' +
        "</div>" +
      "</div>"
    );
  }

  // Simpler than app.js's adminSearchHaystack() -- skips country
  // code/name normalization (that dataset is large and only lived in
  // app.js) so a raw "SE" won't match typing "Sweden" here. Everything
  // else searches the same fields.
  function searchHaystack(r) {
    return [
      r.rowNum, r.artist, r.song, r.director, r.category, r.editor,
      r.country, (r.genres || []).join(" "),
      r.studio, r.producer, r.dp, r.choreographer,
      r.youtube, r.vimeo, r.mvg, r.description, r.flavorTextOverride
    ].join(" ").toLowerCase();
  }

  var gridMode = false;

  // ---- Data Health -- click a stat to filter List/Grid down to just those
  // rows, instead of Data Health rendering its own separate read-only
  // lists the way it used to inside the admin popup. Combines with the
  // free-text search rather than replacing it.
  var healthFilter = null; // null | "duplicates" | "noVideo" | "broken"
  var healthFilterRowNums = null; // Set, or null when no filter is active
  var brokenRows = []; // populated by a Broken Links scan, see scanForBrokenLinks() below

  // Two rows pointing at the same YouTube/Vimeo video ID -- almost always
  // an accidental double-submission/double-import. Same grouping as
  // app.js's findDuplicateVideoGroups().
  function findDuplicateVideoGroups(rows) {
    var byKey = {};
    rows.forEach(function (r) {
      var ref = getRowVideoRef(r);
      if (!ref) return;
      var key = ref.provider + ":" + ref.id;
      (byKey[key] = byKey[key] || []).push(r);
    });
    return Object.keys(byKey).map(function (k) { return byKey[k]; }).filter(function (g) { return g.length > 1; });
  }

  function renderHealthCounts() {
    var dupeRowNums = [];
    findDuplicateVideoGroups(adminRows).forEach(function (group) {
      group.forEach(function (r) { dupeRowNums.push(r.rowNum); });
    });
    var noVideoRows = adminRows.filter(function (r) { return !hasVideo(r); });
    els.dupeCount.textContent = dupeRowNums.length;
    els.noVideoCount.textContent = noVideoRows.length;
    els.brokenCount.textContent = brokenRows.length;
    els.goFillLinksBtn.hidden = !noVideoRows.length;
  }

  function clearHealthFilter() {
    healthFilter = null;
    healthFilterRowNums = null;
    els.filterStatus.hidden = true;
    renderEntries();
  }

  // Always applies `kind` (as opposed to toggling) -- used both by the
  // stat-button click handler and to refresh an already-active filter's
  // row set after a scan finishes or an edit changes membership.
  function applyHealthFilter(kind) {
    healthFilter = kind;
    var rowNums;
    var label;
    if (kind === "duplicates") {
      rowNums = [];
      findDuplicateVideoGroups(adminRows).forEach(function (group) { group.forEach(function (r) { rowNums.push(r.rowNum); }); });
      label = "duplicate video";
    } else if (kind === "noVideo") {
      rowNums = adminRows.filter(function (r) { return !hasVideo(r); }).map(function (r) { return r.rowNum; });
      label = "missing-link";
    } else {
      rowNums = brokenRows.map(function (r) { return r.rowNum; });
      label = "broken-link";
    }
    healthFilterRowNums = new Set(rowNums);
    els.filterStatus.innerHTML = "Showing " + rowNums.length + " " + label + " entr" + (rowNums.length === 1 ? "y" : "ies") +
      ' -- <button type="button" class="admin-grid-rownum-btn" id="meClearFilterBtn">Clear filter</button>';
    els.filterStatus.hidden = false;
    renderEntries();
  }

  function toggleHealthFilter(kind) {
    if (healthFilter === kind) clearHealthFilter();
    else applyHealthFilter(kind);
  }

  els.healthDupesBtn.addEventListener("click", function () { toggleHealthFilter("duplicates"); });
  els.healthNoVideoBtn.addEventListener("click", function () { toggleHealthFilter("noVideo"); });
  els.healthBrokenBtn.addEventListener("click", function () { toggleHealthFilter("broken"); });
  els.filterStatus.addEventListener("click", function (e) {
    if (e.target.closest("#meClearFilterBtn")) clearHealthFilter();
  });

  // ---- Broken Links scan --------------------------------------------------
  // Same approach as app.js's checkRowLinkOk()/scanForBrokenLinks(): a
  // lightweight oEmbed existence check per video (cheaper than spinning up
  // a real player for thousands of rows), 8-way concurrent worker pool,
  // stoppable via a flag. Network hiccups resolve as "ok" rather than
  // "broken" so a flaky connection can't get an entry misreported.
  function checkRowLinkOk(row) {
    var ref = getRowVideoRef(row);
    if (!ref) return Promise.resolve(true);
    var oembedUrl = ref.provider === "youtube"
      ? "https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + ref.id)
      : "https://vimeo.com/api/oembed.json?url=" + encodeURIComponent("https://vimeo.com/" + ref.id);
    return fetch(oembedUrl).then(function (res) { return res.ok; }).catch(function () { return true; });
  }

  var SCAN_CONCURRENCY = 8;
  var scanStopped = false;

  function scanForBrokenLinks() {
    var candidates = adminRows.filter(hasVideo);
    if (!candidates.length) return;
    scanStopped = false;
    brokenRows = [];
    var total = candidates.length;
    var checked = 0;
    var nextIndex = 0;

    els.scanBrokenBtn.hidden = true;
    els.scanStopBtn.hidden = false;
    els.scanProgress.hidden = false;

    function reportProgress() {
      els.scanProgress.textContent = "Checked " + checked + " / " + total + " -- " + brokenRows.length + " broken so far…";
    }

    function worker() {
      if (scanStopped || nextIndex >= candidates.length) return Promise.resolve();
      var row = candidates[nextIndex++];
      return checkRowLinkOk(row).then(function (ok) {
        checked++;
        if (!ok) { brokenRows.push(row); els.brokenCount.textContent = brokenRows.length; }
        reportProgress();
        return worker();
      });
    }

    reportProgress();
    var pool = [];
    for (var i = 0; i < SCAN_CONCURRENCY; i++) pool.push(worker());
    Promise.all(pool).then(function () {
      els.scanStopBtn.hidden = true;
      els.scanBrokenBtn.hidden = false;
      els.scanProgress.textContent = (scanStopped ? "Stopped after " : "Finished -- ") +
        "checking " + checked + " / " + total + ". " + brokenRows.length + " broken link" + (brokenRows.length === 1 ? "" : "s") + " found.";
      // Refresh in case the Broken Links filter was already active from a
      // previous scan -- otherwise it'd keep showing the stale result set.
      if (healthFilter === "broken") applyHealthFilter("broken");
    });
  }

  els.scanBrokenBtn.addEventListener("click", scanForBrokenLinks);
  els.scanStopBtn.addEventListener("click", function () {
    scanStopped = true;
    els.scanStopBtn.hidden = true;
    els.scanBrokenBtn.hidden = false;
  });

  // Shared by List and Grid -- clicking a Grid column header (see
  // GRID_COLUMNS/gridHeaderHtml below) changes this and re-sorts both,
  // even though List has no per-column headers of its own to click.
  var sortField = "rowNum";
  var sortDir = "desc";

  function sortValue(r, field) {
    return field === "genres" ? (r.genres || []).join(", ") : r[field];
  }

  function compareRows(a, b) {
    var col = GRID_COLUMNS.filter(function (c) { return c.key === sortField; })[0];
    var sortType = col ? col.sort : "string";
    var av = sortValue(a, sortField), bv = sortValue(b, sortField);
    var cmp;
    if (sortType === "number") cmp = (parseFloat(av) || 0) - (parseFloat(bv) || 0);
    else if (sortType === "bool") cmp = (av ? 1 : 0) - (bv ? 1 : 0);
    else cmp = String(av || "").toLowerCase().localeCompare(String(bv || "").toLowerCase());
    return sortDir === "desc" ? -cmp : cmp;
  }

  function filteredRows() {
    var query = els.searchInput.value.trim().toLowerCase();
    var rows = adminRows.filter(function (r) {
      if (healthFilterRowNums && !healthFilterRowNums.has(r.rowNum)) return false;
      return !query || searchHaystack(r).indexOf(query) !== -1;
    });
    return rows.slice().sort(compareRows);
  }

  function renderEntries() {
    var rows = filteredRows();
    if (gridMode) {
      renderGrid(rows);
      return;
    }
    els.entriesList.innerHTML = rows.length
      ? rows.map(rowHtml).join("")
      : '<p class="admin-empty">No matching entries.</p>';
  }

  // ---- Grid view -----------------------------------------------------
  var GRID_CATEGORIES = ["Music Video", "Dance", "Montage", "DVD", "Live", "Installation", "Short", "Docu"];
  var GRID_PAGE_SIZE = 75; // same DOM-size rationale as the original: 13k live inputs at once is what made this slow

  // Drives header, cell rendering, and sorting all from one place instead
  // of three separate hardcoded lists that'd inevitably drift out of sync.
  // sort: "string" | "number" | "bool" -- see compareRows() above.
  var GRID_COLUMNS = [
    { key: "rowNum", label: "Row", type: "rownum", sort: "number" },
    { key: "youtube", label: "YouTube Link", type: "youtube", sort: "string", cls: "admin-grid-wide" },
    { key: "artist", label: "Artist", type: "text", sort: "string" },
    { key: "song", label: "Song", type: "text", sort: "string" },
    { key: "director", label: "Director", type: "text", sort: "string" },
    { key: "category", label: "Category", type: "select", sort: "string" },
    { key: "year", label: "Year", type: "text", sort: "number", cls: "admin-grid-year" },
    { key: "feature", label: "Feature", type: "checkbox", sort: "bool" },
    { key: "spotlight", label: "Spotlight", type: "checkbox", sort: "bool" },
    { key: "sponsored", label: "Sponsored", type: "checkbox", sort: "bool" },
    { key: "backdoor", label: "Backdoor", type: "checkbox", sort: "bool" },
    { key: "studio", label: "Studio", type: "text", sort: "string" },
    { key: "producer", label: "Producer", type: "text", sort: "string" },
    { key: "dp", label: "DP", type: "text", sort: "string" },
    { key: "editor", label: "Editor", type: "text", sort: "string" },
    { key: "choreographer", label: "Choreographer", type: "text", sort: "string" },
    { key: "country", label: "Country", type: "text", sort: "string" },
    { key: "genres", label: "Genres", type: "genres", sort: "string" },
    { key: "releaseDate", label: "Release Date", type: "text", sort: "string" },
    { key: "submitterEmail", label: "Submitter Email", type: "text", sort: "string" },
    { key: "description", label: "Description", type: "textarea", sort: "string", cls: "admin-grid-wide" },
    { key: "flavorTextOverride", label: "Flavor Text", type: "textarea", sort: "string", cls: "admin-grid-wide" },
    { key: "vimeo", label: "Vimeo Link", type: "text", sort: "string", cls: "admin-grid-wide" },
    { key: "mvg", label: "MVG Link", type: "text", sort: "string", cls: "admin-grid-wide" }
  ];

  var gridAllRows = [];
  var gridPage = 0;

  function gridCategoryOptionsHtml(current) {
    return '<option value=""' + (current ? "" : " selected") + "></option>" +
      GRID_CATEGORIES.map(function (c) {
        return "<option" + (c === current ? " selected" : "") + ">" + escapeHtml(c) + "</option>";
      }).join("");
  }

  function gridHeaderHtml() {
    return "<tr>" + GRID_COLUMNS.map(function (col) {
      var arrow = sortField === col.key ? (sortDir === "asc" ? " ▲" : " ▼") : "";
      return '<th class="admin-grid-sortable" data-sort-key="' + col.key + '">' + escapeHtml(col.label) + arrow + "</th>";
    }).join("") + "</tr>";
  }

  // Row number opens the lightweight in-page video preview (see
  // openPreview()) rather than being plain text -- everything else keeps
  // the same live <input>/<select> editing as before.
  function gridCellHtml(r, col) {
    switch (col.type) {
      case "rownum":
        return '<td class="admin-grid-rownum"><button type="button" class="admin-grid-rownum-btn" data-preview-rownum="' + escapeHtml(r.rowNum) + '">#' + escapeHtml(r.rowNum) + "</button></td>";
      case "select":
        return '<td><select data-field="category">' + gridCategoryOptionsHtml(r.category) + "</select></td>";
      case "checkbox":
        return '<td class="admin-grid-check"><input type="checkbox" data-field="' + col.key + '"' + (r[col.key] ? " checked" : "") + "></td>";
      case "genres":
        return '<td><input type="text" data-field="genres" value="' + escapeHtml((r.genres || []).join(", ")) + '" placeholder="Pop, Synthpop"></td>';
      case "textarea":
        // Collapsed to a single truncated line by default, expands to a
        // proper multi-line box on focus/click (see the :focus rule in
        // styles.css) -- for Description/Flavor Text, which regularly run
        // well past what a single-line input can show.
        return '<td' + (col.cls ? ' class="' + col.cls + '"' : "") + '><textarea data-field="' + col.key + '" class="admin-grid-expand">' + escapeHtml(r[col.key] || "") + "</textarea></td>";
      case "youtube":
        return '<td class="admin-grid-wide admin-grid-link-cell">' +
          '<input type="text" data-field="youtube" value="' + escapeHtml(r.youtube || "") + '">' +
          (r.youtube ? '<a class="admin-grid-open-link" href="' + escapeHtml(r.youtube) + '" target="_blank" rel="noopener noreferrer" title="Open">&#8599;</a>' : "") +
          "</td>";
      default:
        return '<td' + (col.cls ? ' class="' + col.cls + '"' : "") + '><input type="text" data-field="' + col.key + '" value="' + escapeHtml(r[col.key] || "") + '"></td>';
    }
  }

  function gridRowHtml(r) {
    return '<tr data-rownum="' + escapeHtml(r.rowNum) + '">' + GRID_COLUMNS.map(function (col) { return gridCellHtml(r, col); }).join("") + "</tr>";
  }

  function renderGrid(rows) {
    gridAllRows = rows;
    gridPage = 0;
    renderGridPage();
  }

  function gridTotalPages() {
    return Math.max(1, Math.ceil(gridAllRows.length / GRID_PAGE_SIZE));
  }

  // Windowed page-number list (current ±2, plus first/last with an
  // ellipsis gap) -- at ~180 pages for the full catalog, listing every
  // page number would be its own scroll problem.
  function pageNumbersHtml(totalPages) {
    var current = gridPage + 1; // 1-indexed for display
    var windowStart = Math.max(1, current - 2);
    var windowEnd = Math.min(totalPages, current + 2);
    var parts = [];
    function pageBtn(p) {
      return '<button type="button" class="admin-grid-page-btn' + (p === current ? " is-active" : "") + '" data-page="' + (p - 1) + '">' + p + "</button>";
    }
    if (windowStart > 1) {
      parts.push(pageBtn(1));
      if (windowStart > 2) parts.push('<span class="admin-grid-page-ellipsis">…</span>');
    }
    for (var p = windowStart; p <= windowEnd; p++) parts.push(pageBtn(p));
    if (windowEnd < totalPages) {
      if (windowEnd < totalPages - 1) parts.push('<span class="admin-grid-page-ellipsis">…</span>');
      parts.push(pageBtn(totalPages));
    }
    return parts.join("");
  }

  function renderGridPage() {
    els.entriesList.hidden = true;
    els.gridWrap.hidden = false;
    var rows = gridAllRows;
    if (!rows.length) {
      els.gridTable.innerHTML = '<caption class="admin-empty">No matching entries.</caption>';
      els.gridPagerLabel.textContent = "";
      els.gridPageNumbers.innerHTML = "";
      els.gridFirstBtn.disabled = els.gridPrevBtn.disabled = els.gridNextBtn.disabled = els.gridLastBtn.disabled = true;
      els.bottomScrollbar.hidden = true;
      return;
    }
    var totalPages = gridTotalPages();
    gridPage = Math.max(0, Math.min(gridPage, totalPages - 1));
    var start = gridPage * GRID_PAGE_SIZE;
    var pageRows = rows.slice(start, start + GRID_PAGE_SIZE);
    els.gridTable.innerHTML = "<thead>" + gridHeaderHtml() + "</thead><tbody>" + pageRows.map(gridRowHtml).join("") + "</tbody>";
    els.gridPagerLabel.textContent = (start + 1) + "–" + (start + pageRows.length) + " of " + rows.length;
    els.gridPageNumbers.innerHTML = pageNumbersHtml(totalPages);
    els.gridFirstBtn.disabled = els.gridPrevBtn.disabled = gridPage === 0;
    els.gridLastBtn.disabled = els.gridNextBtn.disabled = gridPage >= totalPages - 1;
    syncBottomScrollbar();
  }

  // A native horizontal scrollbar on .admin-grid-wrap only shows up at
  // the bottom edge of the TABLE, which is often off-screen below the
  // fold -- this mirrors it as a bar fixed to the bottom of the viewport
  // instead, kept the same width/position as the actual scrollable area
  // (.hub-page) so it lines up whether the sidebar is collapsed or
  // expanded, and scroll-synced both ways with the real grid.
  var syncingGridScroll = false;

  function syncBottomScrollbar() {
    if (!gridMode) return;
    els.bottomScrollbar.hidden = gridAllRows.length === 0;
    els.bottomScrollbarInner.style.width = els.gridTable.scrollWidth + "px";
    var rect = document.querySelector(".hub-page").getBoundingClientRect();
    els.bottomScrollbar.style.left = rect.left + "px";
    els.bottomScrollbar.style.width = rect.width + "px";
  }

  els.gridWrap.addEventListener("scroll", function () {
    if (syncingGridScroll) return;
    syncingGridScroll = true;
    els.bottomScrollbar.scrollLeft = els.gridWrap.scrollLeft;
    syncingGridScroll = false;
  });

  els.bottomScrollbar.addEventListener("scroll", function () {
    if (syncingGridScroll) return;
    syncingGridScroll = true;
    els.gridWrap.scrollLeft = els.bottomScrollbar.scrollLeft;
    syncingGridScroll = false;
  });

  window.addEventListener("resize", syncBottomScrollbar);
  // Sidebar collapse/expand (site-nav.js toggling .header-links.is-open)
  // changes .hub-page's left edge without firing any event we can listen
  // for directly -- a class-attribute observer catches it instead.
  var sidebarEl = document.querySelector(".header-links");
  if (sidebarEl) new MutationObserver(syncBottomScrollbar).observe(sidebarEl, { attributes: true, attributeFilter: ["class"] });

  function flashGridCell(el, ok) {
    el.classList.remove("save-ok", "save-error");
    void el.offsetWidth; // reflow so re-adding the class restarts the animation
    el.classList.add(ok ? "save-ok" : "save-error");
  }

  // Keeps the YouTube column's "open in new tab" link in sync after an
  // edit, without a full grid re-render (which would also toss focus).
  function updateYoutubeLinkCell(inputEl, url) {
    var cell = inputEl.closest("td");
    var link = cell.querySelector(".admin-grid-open-link");
    if (url) {
      if (!link) {
        link = document.createElement("a");
        link.className = "admin-grid-open-link";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.title = "Open";
        link.innerHTML = "&#8599;";
        cell.appendChild(link);
      }
      link.href = url;
    } else if (link) {
      link.remove();
    }
  }

  function saveGridField(cellEl, rowNum, field, value) {
    var storedValue = field === "genres"
      ? String(value || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean)
      : value;
    var patch = {};
    patch[field] = storedValue;
    patch.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    db.collection("videos").doc(rowNum).set(patch, { merge: true }).then(function () {
      var row = findRowByNum(rowNum);
      if (row) row[field] = storedValue;
      flashGridCell(cellEl, true);
      if (field === "youtube") updateYoutubeLinkCell(cellEl, storedValue);
      // A youtube/vimeo edit can change this row's Duplicate/Missing-Link/
      // Broken membership -- refresh the counts, and the active filter's
      // row set if one of those three is currently applied.
      if (field === "youtube" || field === "vimeo") {
        renderHealthCounts();
        if (healthFilter) applyHealthFilter(healthFilter);
      }
    }).catch(function (err) {
      console.error("Grid save failed:", err);
      flashGridCell(cellEl, false);
    });
  }

  function gridFieldValue(inputEl) {
    return inputEl.type === "checkbox" ? inputEl.checked : inputEl.value.trim();
  }

  els.gridTable.addEventListener("change", function (e) {
    var input = e.target.closest("input[data-field], select[data-field]");
    if (!input || input.type === "text") return; // text inputs save on focusout below, not every change
    var rowNum = input.closest("tr").getAttribute("data-rownum");
    saveGridField(input, rowNum, input.getAttribute("data-field"), gridFieldValue(input));
  });

  els.gridTable.addEventListener("focusout", function (e) {
    var input = e.target.closest('input[type="text"][data-field], textarea[data-field]');
    if (!input) return;
    var rowNum = input.closest("tr").getAttribute("data-rownum");
    var field = input.getAttribute("data-field");
    var value = gridFieldValue(input);
    var row = findRowByNum(rowNum);
    var currentValue = row ? (field === "genres" ? (row.genres || []).join(", ") : (row[field] || "")) : null;
    if (row && currentValue === value) return; // unchanged -- don't spend a write confirming nothing happened
    saveGridField(input, rowNum, field, value);
  });

  els.gridTable.addEventListener("click", function (e) {
    var th = e.target.closest("th[data-sort-key]");
    if (th) {
      var key = th.getAttribute("data-sort-key");
      if (sortField === key) sortDir = sortDir === "asc" ? "desc" : "asc";
      else { sortField = key; sortDir = "asc"; }
      renderEntries();
      return;
    }
    var previewBtn = e.target.closest("[data-preview-rownum]");
    if (previewBtn) openPreview(previewBtn.getAttribute("data-preview-rownum"));
  });

  els.gridPageNumbers.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-page]");
    if (!btn) return;
    gridPage = parseInt(btn.getAttribute("data-page"), 10);
    renderGridPage();
    els.gridWrap.scrollTop = 0;
  });

  els.gridFirstBtn.addEventListener("click", function () {
    gridPage = 0;
    renderGridPage();
    els.gridWrap.scrollTop = 0;
  });

  els.gridPrevBtn.addEventListener("click", function () {
    if (gridPage <= 0) return;
    gridPage--;
    renderGridPage();
    els.gridWrap.scrollTop = 0;
  });

  els.gridNextBtn.addEventListener("click", function () {
    gridPage++;
    renderGridPage();
    els.gridWrap.scrollTop = 0;
  });

  els.gridLastBtn.addEventListener("click", function () {
    gridPage = gridTotalPages() - 1;
    renderGridPage();
    els.gridWrap.scrollTop = 0;
  });

  els.gridToggleBtn.addEventListener("click", function () {
    gridMode = !gridMode;
    els.gridToggleBtn.setAttribute("aria-pressed", gridMode ? "true" : "false");
    els.gridToggleBtn.classList.toggle("is-active", gridMode);
    els.gridToggleBtn.textContent = gridMode ? "List view" : "Grid view";
    els.gridHint.hidden = !gridMode;
    els.gridWrap.hidden = !gridMode;
    els.entriesList.hidden = gridMode;
    if (!gridMode) els.bottomScrollbar.hidden = true;
    renderEntries();
  });

  // ---- Row-number video preview -----------------------------------------
  // Deliberately lightweight (embed + title/credits/description, not the
  // full public lightbox with comments/related videos/etc.) -- this is a
  // quick "what am I looking at" check while editing, not a replacement
  // for the real video page. Stays on this page rather than navigating
  // away, unlike Edit/Add/Bulk Import which jump back to index.html.
  function embedHtml(row) {
    var ytId = extractYouTubeId(row.youtube);
    if (ytId) {
      return '<iframe src="https://www.youtube.com/embed/' + ytId + '?autoplay=1" title="Video preview" allow="autoplay; encrypted-media" allowfullscreen class="admin-preview-embed"></iframe>';
    }
    var vimeoId = extractVimeoId(row.vimeo);
    if (vimeoId) {
      return '<iframe src="https://player.vimeo.com/video/' + vimeoId + '?autoplay=1" title="Video preview" allow="autoplay; fullscreen" allowfullscreen class="admin-preview-embed"></iframe>';
    }
    return '<p class="admin-empty">No recognized YouTube or Vimeo link.</p>';
  }

  // Same approach as app.js's downloadCoverArt() -- maxresdefault with a
  // fallback chain (YouTube's CDN returns a small gray placeholder rather
  // than a 404 for sizes that don't exist), fetched as a blob since the
  // cross-origin image can't be forced to save via a plain <a download>.
  var COVER_ART_SIZES = ["maxresdefault", "sddefault", "hqdefault"];

  function downloadCoverArt(row, btn) {
    var originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "…";
    var filenameBase = ((row.artist ? row.artist + "-" : "") + (row.song || "cover")).replace(/[^a-z0-9]+/gi, "-").slice(0, 60) || "cover";

    function finish() {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
    function saveBlob(blob) {
      var objectUrl = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = objectUrl;
      a.download = filenameBase + ".jpg";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 1000);
    }

    var videoRef = getRowVideoRef(row);
    if (videoRef && videoRef.provider === "youtube") {
      (function tryNext(i) {
        if (i >= COVER_ART_SIZES.length) { finish(); return; }
        fetch("https://i.ytimg.com/vi/" + videoRef.id + "/" + COVER_ART_SIZES[i] + ".jpg")
          .then(function (res) { if (!res.ok) throw new Error("not found"); return res.blob(); })
          .then(function (blob) {
            if (blob.size < 2000) throw new Error("placeholder image");
            saveBlob(blob);
            finish();
          })
          .catch(function () { tryNext(i + 1); });
      })(0);
    } else if (videoRef && videoRef.provider === "vimeo") {
      (row.vimeoThumb ? Promise.resolve(row.vimeoThumb) : fetchVimeoThumbnail(videoRef.id)).then(function (url) {
        if (!url) { finish(); return; }
        return fetch(url).then(function (res) { return res.blob(); }).then(function (blob) { saveBlob(blob); finish(); });
      }).catch(finish);
    } else {
      finish();
    }
  }

  function openPreview(rowNum) {
    var row = findRowByNum(rowNum);
    if (!row) return;
    els.previewBody.innerHTML =
      embedHtml(row) +
      '<h2 class="admin-form-title">' + escapeHtml(row.artist) + " — " + escapeHtml(row.song) + "</h2>" +
      '<p class="admin-row-sub">#' + escapeHtml(row.rowNum) + (row.director ? " · " + escapeHtml(row.director) : "") + "</p>" +
      (row.description ? "<p>" + escapeHtml(row.description) + "</p>" : "") +
      '<button type="button" class="admin-row-btn" id="mePreviewCoverBtn">Download cover art</button>';
    els.previewModal.hidden = false;
    document.body.style.overflow = "hidden";
    document.getElementById("mePreviewCoverBtn").addEventListener("click", function () {
      downloadCoverArt(row, this);
    });
  }

  function closePreview() {
    els.previewModal.hidden = true;
    els.previewBody.innerHTML = ""; // clears the iframe so playback actually stops
    document.body.style.overflow = "";
  }

  els.previewModal.addEventListener("click", function (e) {
    if (e.target.closest(".lightbox-close") || e.target.closest(".lightbox-backdrop")) closePreview();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !els.previewModal.hidden) closePreview();
  });

  // ---- Delete ----------------------------------------------------------
  els.entriesList.addEventListener("click", function (e) {
    var previewBtn = e.target.closest("[data-preview-rownum]");
    if (previewBtn) {
      openPreview(previewBtn.getAttribute("data-preview-rownum"));
      return;
    }
    var btn = e.target.closest("[data-delete-rownum]");
    if (!btn) return;
    var rowNum = btn.getAttribute("data-delete-rownum");
    var row = findRowByNum(rowNum);
    var label = row ? row.artist + " — " + row.song : "entry #" + rowNum;
    if (!window.confirm('Delete "' + label + '"? This can\'t be undone.')) return;
    db.collection("videos").doc(rowNum).delete().then(function () {
      adminRows = adminRows.filter(function (r) { return r.rowNum !== rowNum; });
      brokenRows = brokenRows.filter(function (r) { return r.rowNum !== rowNum; });
      renderHealthCounts();
      if (healthFilter) applyHealthFilter(healthFilter); else renderEntries();
      setStatus('Deleted "' + label + '". Publishing…');
      return publishSnapshot().then(function (result) {
        setStatus('Deleted "' + label + '". Published ' + result.count + " entries to the live site.");
      });
    }).catch(function (err) {
      console.error("Delete failed:", err);
      setStatus("Delete failed: " + err.message, true);
    });
  });

  // ---- Publish -----------------------------------------------------------
  // Same logic as app.js's publishSnapshot() -- own fresh `videos` read,
  // gzip, upload to catalog/snapshot.json. Duplicated rather than shared
  // since this page doesn't load app.js; kept in sync by hand if the
  // snapshot shape ever changes there.
  function publishSnapshot() {
    return db.collection("videos").get().then(function (snap) {
      var rows = snap.docs.map(function (doc) {
        var d = doc.data();
        return {
          rowNum: d.rowNum || "", artist: d.artist || "", song: d.song || "",
          director: d.director || "", category: d.category || "", youtube: d.youtube || "",
          vimeo: d.vimeo || "", vimeoThumb: d.vimeoThumb || "", mvg: d.mvg || "",
          year: d.year || "", releaseDate: d.releaseDate || "", studio: d.studio || "",
          producer: d.producer || "", dp: d.dp || "", editor: d.editor || "",
          choreographer: d.choreographer || "", country: d.country || "", genres: d.genres || [],
          description: d.description || "", flavorTextOverride: d.flavorTextOverride || "",
          feature: !!d.feature, spotlight: !!d.spotlight, sponsored: !!d.sponsored, backdoor: !!d.backdoor,
          createdAt: d.createdAt ? d.createdAt.toMillis() : null,
          youtubeSearchText: d.youtubeSearchText || "",
          searchHaystack: [d.artist, d.song, d.director, d.producer, d.dp, d.editor, d.choreographer, d.studio, d.description, d.youtubeSearchText].join(" ").toLowerCase()
        };
      });
      rows.sort(function (a, b) { return parseInt(a.rowNum, 10) - parseInt(b.rowNum, 10); });
      var jsonBlob = new Blob([JSON.stringify(rows)], { type: "application/json" });
      var ref = firebase.storage().ref("catalog/snapshot.json");
      var uploadPromise = window.CompressionStream
        ? new Response(jsonBlob.stream().pipeThrough(new CompressionStream("gzip"))).blob().then(function (gzBlob) {
            return ref.put(gzBlob, { cacheControl: "public, max-age=300", contentType: "application/json", contentEncoding: "gzip" });
          })
        : ref.put(jsonBlob, { cacheControl: "public, max-age=300", contentType: "application/json" });
      return uploadPromise.then(function () { return { count: rows.length }; });
    });
  }

  els.publishBtn.addEventListener("click", function () {
    els.publishBtn.disabled = true;
    setStatus("Publishing snapshot…");
    publishSnapshot().then(function (result) {
      setStatus("Published " + result.count + " entries to the live site.");
    }).catch(function (err) {
      console.error("Publish failed:", err);
      setStatus("Publish failed: " + err.message, true);
    }).then(function () {
      els.publishBtn.disabled = false;
    });
  });

  els.searchInput.addEventListener("input", renderEntries);
  els.signInBtn.addEventListener("click", function () {
    auth.signInWithPopup(googleProvider).catch(function (err) {
      setStatus(err.message || "Sign-in failed.", true);
    });
  });

  function loadEntries() {
    setStatus("Loading entries…");
    els.entriesList.innerHTML = "";
    return db.collection("videos").get().then(function (snap) {
      adminRows = snap.docs.map(function (doc) { return doc.data(); });
      setStatus(adminRows.length + " entries loaded.");
      renderHealthCounts();
      renderEntries();
    }).catch(function (err) {
      console.error("Admin load failed:", err);
      setStatus("Couldn't load entries: " + err.message, true);
    });
  }

  // ---- Fill Missing Links ------------------------------------------------
  // Same design as app.js's version: a one-at-a-time queue (always
  // operates on index [0]), Skip rotates to the back instead of dropping
  // it, Save & Next writes a partial merge doc directly (no batching, no
  // auto-publish -- same manual "Publish Now" Grid edits already use) then
  // auto-triggers the next auto-fill search. The live preview while
  // pasting a link reuses embedHtml() (a plain iframe) rather than
  // app.js's createVideoPlayer() -- that's shared IFrame-API
  // infrastructure built for the lightbox/TV Mode/Channel Mode and is too
  // heavy to duplicate here just to look at a pasted link.
  var YOUTUBE_SEARCH_API_KEY = "AIzaSyBCjFAxZEVXdDWC_HLQnZCV0ihXW-B2eBk";
  var fillLinksQueue = [];
  var fillLinksFilledCount = 0;

  function renderFillLinksCard() {
    els.fillLinksRemaining.textContent = fillLinksQueue.length;
    els.fillLinksInput.value = "";
    els.fillLinksError.hidden = true;
    els.fillLinksAutoFillNote.hidden = true;
    els.fillLinksPreview.hidden = true;
    els.fillLinksPreview.innerHTML = "";

    if (!fillLinksQueue.length) {
      els.fillLinksCard.hidden = true;
      els.fillLinksDone.hidden = false;
      return;
    }
    els.fillLinksCard.hidden = false;
    els.fillLinksDone.hidden = true;

    var row = fillLinksQueue[0];
    els.fillLinksTitle.textContent = row.artist + " — " + row.song;
    els.fillLinksSub.textContent = "#" + row.rowNum +
      (row.director ? " · " + row.director : "") +
      (row.year ? " · " + row.year : "") +
      (row.category ? " · " + row.category : "");
    els.fillLinksInput.focus();
  }

  var fillLinksPreviewDebounce = null;

  function updateFillLinksPreview() {
    var url = els.fillLinksInput.value.trim();
    var ytId = extractYouTubeId(url);
    var vimeoId = !ytId ? extractVimeoId(url) : null;
    if (!ytId && !vimeoId) {
      els.fillLinksPreview.hidden = true;
      els.fillLinksPreview.innerHTML = "";
      return;
    }
    els.fillLinksPreview.hidden = false;
    els.fillLinksPreview.innerHTML = embedHtml({ youtube: ytId ? url : "", vimeo: vimeoId ? url : "" });
  }

  els.fillLinksInput.addEventListener("input", function () {
    if (fillLinksPreviewDebounce) clearTimeout(fillLinksPreviewDebounce);
    fillLinksPreviewDebounce = setTimeout(updateFillLinksPreview, 600);
  });

  // Same YouTube Data API v3 search.list call as admin-intake.js/app.js's
  // original Fill Links auto-fill -- referrer-restricted key, ~100 free
  // calls/day.
  function fetchYouTubeTopResult(query) {
    var url = "https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&type=video&q=" +
      encodeURIComponent(query) + "&key=" + encodeURIComponent(YOUTUBE_SEARCH_API_KEY);
    return fetch(url).then(function (res) {
      if (!res.ok) return res.json().then(function (body) {
        var reason = body && body.error && body.error.errors && body.error.errors[0] && body.error.errors[0].reason;
        throw new Error(reason === "quotaExceeded" ? "Daily search quota used up -- try again tomorrow, or keep using Search + paste." : "YouTube search failed (" + res.status + ").");
      });
      return res.json();
    }).then(function (data) {
      var item = data.items && data.items[0];
      if (!item) return null;
      return { videoId: item.id.videoId, title: decodeHtmlEntities(item.snippet.title), channel: decodeHtmlEntities(item.snippet.channelTitle) };
    });
  }

  function triggerFillLinksAutoFill() {
    var row = fillLinksQueue[0];
    if (!row) return;
    var query = (row.artist + " " + row.song).trim() + " music video";
    els.fillLinksAutoFillBtn.disabled = true;
    els.fillLinksAutoFillNote.hidden = true;
    els.fillLinksError.hidden = true;
    fetchYouTubeTopResult(query).then(function (result) {
      if (fillLinksQueue[0] !== row) return; // queue moved on while this was in flight
      if (!result) {
        els.fillLinksError.textContent = "No YouTube results for that search.";
        els.fillLinksError.hidden = false;
        return;
      }
      els.fillLinksInput.value = "https://www.youtube.com/watch?v=" + result.videoId;
      els.fillLinksAutoFillNote.textContent = 'Top result: "' + result.title + '" -- ' + result.channel + ". Check the preview below before saving.";
      els.fillLinksAutoFillNote.hidden = false;
      updateFillLinksPreview();
    }).catch(function (err) {
      if (fillLinksQueue[0] !== row) return;
      console.error("YouTube auto-fill search failed:", err);
      els.fillLinksError.textContent = err.message;
      els.fillLinksError.hidden = false;
    }).finally(function () {
      els.fillLinksAutoFillBtn.disabled = false;
    });
  }

  els.fillLinksAutoFillBtn.addEventListener("click", triggerFillLinksAutoFill);

  function openFillLinksModal() {
    fillLinksQueue = adminRows.filter(function (r) { return !hasVideo(r); });
    fillLinksFilledCount = 0;
    els.fillLinksModal.hidden = false;
    document.body.style.overflow = "hidden";
    renderFillLinksCard();
  }

  function closeFillLinksModal() {
    els.fillLinksModal.hidden = true;
    els.fillLinksPreview.innerHTML = "";
    document.body.style.overflow = "";
    renderHealthCounts();
    if (healthFilter) applyHealthFilter(healthFilter); else renderEntries();
  }

  els.goFillLinksBtn.addEventListener("click", openFillLinksModal);
  els.fillLinksClose.addEventListener("click", closeFillLinksModal);
  els.fillLinksModal.addEventListener("click", function (e) {
    if (e.target.closest(".lightbox-close") || e.target.closest(".lightbox-backdrop")) closeFillLinksModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !els.fillLinksModal.hidden) closeFillLinksModal();
  });

  els.fillLinksSearchBtn.addEventListener("click", function () {
    var row = fillLinksQueue[0];
    if (!row) return;
    var query = (row.artist + " " + row.song).trim() + " music video";
    window.open("https://www.youtube.com/results?search_query=" + encodeURIComponent(query), "_blank", "noopener");
  });

  els.fillLinksSkipBtn.addEventListener("click", function () {
    if (!fillLinksQueue.length) return;
    fillLinksQueue.push(fillLinksQueue.shift());
    renderFillLinksCard();
  });

  els.fillLinksDeleteBtn.addEventListener("click", function () {
    var row = fillLinksQueue[0];
    if (!row) return;
    var label = row.artist + " — " + row.song;
    if (!window.confirm('Delete "' + label + '"? This can\'t be undone.')) return;
    db.collection("videos").doc(row.rowNum).delete().then(function () {
      adminRows = adminRows.filter(function (r) { return r.rowNum !== row.rowNum; });
      brokenRows = brokenRows.filter(function (r) { return r.rowNum !== row.rowNum; });
      fillLinksQueue.shift();
      renderHealthCounts();
      renderFillLinksCard();
      els.fillLinksStatus.textContent = 'Deleted "' + label + '". Not yet published -- use Publish Now when you\'re done.';
      els.fillLinksStatus.className = "admin-status";
      els.fillLinksStatus.hidden = false;
    }).catch(function (err) {
      console.error("Delete failed:", err);
      els.fillLinksStatus.textContent = "Delete failed: " + err.message;
      els.fillLinksStatus.className = "admin-status is-error";
      els.fillLinksStatus.hidden = false;
    });
  });

  function saveFillLinksEntry() {
    var row = fillLinksQueue[0];
    if (!row) return;
    var url = els.fillLinksInput.value.trim();
    var ytId = extractYouTubeId(url);
    var vimeoId = !ytId ? extractVimeoId(url) : null;
    if (!ytId && !vimeoId) {
      els.fillLinksError.textContent = "That doesn't look like a YouTube or Vimeo link.";
      els.fillLinksError.hidden = false;
      return;
    }

    els.fillLinksSaveBtn.disabled = true;
    var doc = { updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    var thumbPromise = Promise.resolve();
    if (ytId) {
      doc.youtube = url;
    } else {
      doc.vimeo = url;
      thumbPromise = fetchVimeoThumbnail(vimeoId).then(function (thumb) { if (thumb) doc.vimeoThumb = thumb; });
    }

    thumbPromise.then(function () {
      return db.collection("videos").doc(row.rowNum).set(doc, { merge: true });
    }).then(function () {
      var cached = findRowByNum(row.rowNum);
      if (cached) { cached.youtube = doc.youtube || cached.youtube; cached.vimeo = doc.vimeo || cached.vimeo; if (doc.vimeoThumb) cached.vimeoThumb = doc.vimeoThumb; }
      fillLinksQueue.shift();
      fillLinksFilledCount++;
      renderHealthCounts();
      els.fillLinksStatus.textContent = "Filled " + fillLinksFilledCount + " so far this session. Not yet published -- use Publish Now when you're done.";
      els.fillLinksStatus.className = "admin-status";
      els.fillLinksStatus.hidden = false;
      renderFillLinksCard();
      triggerFillLinksAutoFill();
    }).catch(function (err) {
      console.error("Fill Links save failed:", err);
      els.fillLinksError.textContent = "Save failed: " + err.message;
      els.fillLinksError.hidden = false;
    }).finally(function () {
      els.fillLinksSaveBtn.disabled = false;
    });
  }

  els.fillLinksSaveBtn.addEventListener("click", saveFillLinksEntry);
  els.fillLinksInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); saveFillLinksEntry(); }
  });

  els.fillLinksPublishBtn.addEventListener("click", function () {
    els.fillLinksPublishBtn.disabled = true;
    setStatus("Publishing snapshot…");
    publishSnapshot().then(function (result) {
      els.fillLinksStatus.textContent = "Published " + result.count + " entries to the live site.";
      els.fillLinksStatus.className = "admin-status";
      els.fillLinksStatus.hidden = false;
    }).catch(function (err) {
      console.error("Publish failed:", err);
      els.fillLinksStatus.textContent = "Publish failed: " + err.message;
      els.fillLinksStatus.className = "admin-status is-error";
      els.fillLinksStatus.hidden = false;
    }).finally(function () {
      els.fillLinksPublishBtn.disabled = false;
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
      loadEntries();
    });
  });
})();
