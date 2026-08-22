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
    gridPrevBtn: document.getElementById("meGridPrevBtn"),
    gridNextBtn: document.getElementById("meGridNextBtn")
  };

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
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
          '<div class="admin-row-sub">#' + escapeHtml(r.rowNum) + (r.director ? " · " + escapeHtml(r.director) : "") + " " + badges + "</div>" +
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

  function filteredRows() {
    var query = els.searchInput.value.trim().toLowerCase();
    var rows = adminRows.filter(function (r) {
      return !query || searchHaystack(r).indexOf(query) !== -1;
    });
    return rows.slice().sort(function (a, b) { return parseInt(b.rowNum, 10) - parseInt(a.rowNum, 10); });
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
  var GRID_CHECKBOX_FIELDS = ["feature", "spotlight", "sponsored", "backdoor"];
  var GRID_PAGE_SIZE = 75; // same DOM-size rationale as the original: 13k live inputs at once is what made this slow
  var gridAllRows = [];
  var gridPage = 0;

  function gridCategoryOptionsHtml(current) {
    return '<option value=""' + (current ? "" : " selected") + "></option>" +
      GRID_CATEGORIES.map(function (c) {
        return "<option" + (c === current ? " selected" : "") + ">" + escapeHtml(c) + "</option>";
      }).join("");
  }

  function gridRowHtml(r) {
    return (
      '<tr data-rownum="' + escapeHtml(r.rowNum) + '">' +
        '<td class="admin-grid-rownum">#' + escapeHtml(r.rowNum) + "</td>" +
        '<td><input type="text" data-field="artist" value="' + escapeHtml(r.artist || "") + '"></td>' +
        '<td><input type="text" data-field="song" value="' + escapeHtml(r.song || "") + '"></td>' +
        '<td><input type="text" data-field="director" value="' + escapeHtml(r.director || "") + '"></td>' +
        '<td><select data-field="category">' + gridCategoryOptionsHtml(r.category) + "</select></td>" +
        '<td><input type="text" class="admin-grid-year" data-field="year" value="' + escapeHtml(r.year || "") + '"></td>' +
        GRID_CHECKBOX_FIELDS.map(function (f) {
          return '<td class="admin-grid-check"><input type="checkbox" data-field="' + f + '"' + (r[f] ? " checked" : "") + "></td>";
        }).join("") +
        '<td><input type="text" data-field="editor" value="' + escapeHtml(r.editor || "") + '"></td>' +
        '<td><input type="text" data-field="country" value="' + escapeHtml(r.country || "") + '"></td>' +
        '<td><input type="text" data-field="genres" value="' + escapeHtml((r.genres || []).join(", ")) + '" placeholder="Pop, Synthpop"></td>' +
        '<td class="admin-grid-wide"><input type="text" data-field="youtube" value="' + escapeHtml(r.youtube || "") + '"></td>' +
      "</tr>"
    );
  }

  function renderGrid(rows) {
    gridAllRows = rows;
    gridPage = 0;
    renderGridPage();
  }

  function renderGridPage() {
    els.entriesList.hidden = true;
    els.gridWrap.hidden = false;
    var rows = gridAllRows;
    if (!rows.length) {
      els.gridTable.innerHTML = '<caption class="admin-empty">No matching entries.</caption>';
      els.gridPagerLabel.textContent = "";
      els.gridPrevBtn.disabled = true;
      els.gridNextBtn.disabled = true;
      return;
    }
    var totalPages = Math.max(1, Math.ceil(rows.length / GRID_PAGE_SIZE));
    gridPage = Math.max(0, Math.min(gridPage, totalPages - 1));
    var start = gridPage * GRID_PAGE_SIZE;
    var pageRows = rows.slice(start, start + GRID_PAGE_SIZE);
    els.gridTable.innerHTML =
      "<thead><tr>" +
        "<th>Row</th><th>Artist</th><th>Song</th><th>Director</th><th>Category</th><th>Year</th>" +
        "<th>Feature</th><th>Spotlight</th><th>Sponsored</th><th>Backdoor</th><th>Editor</th>" +
        "<th>Country</th><th>Genres</th><th>YouTube Link</th>" +
      "</tr></thead><tbody>" +
      pageRows.map(gridRowHtml).join("") +
      "</tbody>";
    els.gridPagerLabel.textContent = (start + 1) + "–" + (start + pageRows.length) + " of " + rows.length;
    els.gridPrevBtn.disabled = gridPage === 0;
    els.gridNextBtn.disabled = gridPage >= totalPages - 1;
  }

  function flashGridCell(el, ok) {
    el.classList.remove("save-ok", "save-error");
    void el.offsetWidth; // reflow so re-adding the class restarts the animation
    el.classList.add(ok ? "save-ok" : "save-error");
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

  // ---- Delete ----------------------------------------------------------
  els.entriesList.addEventListener("click", function (e) {
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
