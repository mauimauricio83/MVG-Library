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
    previewBody: document.getElementById("mePreviewBody")
  };

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
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
    { key: "description", label: "Description", type: "text", sort: "string", cls: "admin-grid-wide" },
    { key: "flavorTextOverride", label: "Flavor Text", type: "text", sort: "string", cls: "admin-grid-wide" },
    { key: "vimeo", label: "Vimeo Link", type: "text", sort: "string", cls: "admin-grid-wide" },
    { key: "mvg", label: "MVG Link", type: "text", sort: "string", cls: "admin-grid-wide" },
    { key: "youtube", label: "YouTube Link", type: "youtube", sort: "string", cls: "admin-grid-wide" }
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
  }

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
    var input = e.target.closest('input[type="text"][data-field]');
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

  function openPreview(rowNum) {
    var row = findRowByNum(rowNum);
    if (!row) return;
    els.previewBody.innerHTML =
      embedHtml(row) +
      '<h2 class="admin-form-title">' + escapeHtml(row.artist) + " — " + escapeHtml(row.song) + "</h2>" +
      '<p class="admin-row-sub">#' + escapeHtml(row.rowNum) + (row.director ? " · " + escapeHtml(row.director) : "") + "</p>" +
      (row.description ? "<p>" + escapeHtml(row.description) + "</p>" : "");
    els.previewModal.hidden = false;
    document.body.style.overflow = "hidden";
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
      renderEntries();
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
      renderEntries();
    }).catch(function (err) {
      console.error("Admin load failed:", err);
      setStatus("Couldn't load entries: " + err.message, true);
    });
  }

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
