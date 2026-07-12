(function () {
  "use strict";

  var CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRfeg4mWGWZgOc5ZC-84iBQP3XM4TBopECjBg8moFHmKj0pfOCID05iSC2Xfmf3Y4X8W5PP5r_GCY7a/pub?gid=1604307123&single=true&output=csv";

  var JUMP_LETTERS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  var els = {
    status: document.getElementById("status"),
    results: document.getElementById("results"),
    search: document.getElementById("search"),
    tabs: Array.prototype.slice.call(document.querySelectorAll(".tab")),
    jumpTop: document.getElementById("jumpNavTop"),
    jumpBottom: document.getElementById("jumpNavBottom")
  };

  var state = {
    rows: [],
    view: "director",
    query: "",
    jumpMap: {}
  };

  var CATEGORY_CLASS = {
    "Music Video": "tag-music-video",
    "Dance Sequence": "tag-dance-sequence",
    "Musical Montage": "tag-musical-montage",
    "DVD": "tag-dvd"
  };

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fetchData() {
    els.status.textContent = "Loading database…";
    Papa.parse(CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: function (result) {
        state.rows = cleanRows(result.data);
        els.status.textContent = state.rows.length ? "" : "No entries found.";
        render();
      },
      error: function (err) {
        els.status.textContent = "Couldn't load the database. Please try again later.";
        els.status.classList.add("error");
        console.error("CSV load error:", err);
      }
    });
  }

  function get(row, key) {
    return (row[key] || "").trim();
  }

  function cleanRows(rawRows) {
    return rawRows
      .map(function (row) {
        return {
          rowNum: get(row, "Row #"),
          artist: get(row, "Artist"),
          song: get(row, "Song Title"),
          director: get(row, "Director"),
          category: get(row, "Category"),
          youtube: get(row, "YouTube Link"),
          mvg: get(row, "MVG Link"),
          description: get(row, "Description")
        };
      })
      .filter(function (row) {
        return row.artist !== "" || row.song !== "";
      });
  }

  function matchesQuery(row, q) {
    if (!q) return true;
    q = q.toLowerCase();
    return (
      row.artist.toLowerCase().indexOf(q) !== -1 ||
      row.song.toLowerCase().indexOf(q) !== -1 ||
      row.director.toLowerCase().indexOf(q) !== -1
    );
  }

  function categoryTagClass(cat) {
    return CATEGORY_CLASS[cat] || "tag-default";
  }

  function letterBucket(str) {
    var ch = (str || "").trim().charAt(0).toUpperCase();
    if (/[0-9]/.test(ch)) return ch;
    if (/[A-Z]/.test(ch)) return ch;
    return "#";
  }

  var ICON_YOUTUBE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.5v-7l6.3 3.5-6.3 3.5Z"/></svg>';
  var ICON_INSTAGRAM = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.2c3.2 0 3.6 0 4.9.07 1.3.06 2.2.27 2.9.56.8.3 1.4.7 2 1.4.6.6 1 1.2 1.4 2 .3.7.5 1.6.6 2.9.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.06 1.3-.27 2.2-.56 2.9a5.8 5.8 0 0 1-1.4 2 5.8 5.8 0 0 1-2 1.4c-.7.3-1.6.5-2.9.56-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.3-.06-2.2-.27-2.9-.56a5.8 5.8 0 0 1-2-1.4 5.8 5.8 0 0 1-1.4-2c-.3-.7-.5-1.6-.56-2.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.06-1.3.27-2.2.56-2.9.3-.8.7-1.4 1.4-2 .6-.6 1.2-1 2-1.4.7-.3 1.6-.5 2.9-.56C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.15 0-3.52 0-4.76.07-1.03.05-1.6.22-1.97.36-.5.2-.85.42-1.22.79-.37.37-.6.72-.79 1.22-.14.37-.3.94-.36 1.97C2.8 8.48 2.8 8.85 2.8 12s0 3.52.1 4.76c.06 1.03.22 1.6.36 1.97.2.5.42.85.79 1.22.37.37.72.6 1.22.79.37.14.94.3 1.97.36 1.24.06 1.6.07 4.76.07s3.52 0 4.76-.07c1.03-.06 1.6-.22 1.97-.36.5-.2.85-.42 1.22-.79.37-.37.6-.72.79-1.22.14-.37.3-.94.36-1.97.06-1.24.07-1.6.07-4.76s0-3.52-.07-4.76c-.06-1.03-.22-1.6-.36-1.97a3.3 3.3 0 0 0-.79-1.22 3.3 3.3 0 0 0-1.22-.79c-.37-.14-.94-.3-1.97-.36C15.52 4 15.15 4 12 4Zm0 3.4a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2Zm0 1.8a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Zm5.86-2a1.08 1.08 0 1 1-2.16 0 1.08 1.08 0 0 1 2.16 0Z"/></svg>';

  function renderEntry(row) {
    var sub = [];
    if (state.view !== "artist" && row.artist) sub.push(escapeHtml(row.artist));
    if (state.view !== "director" && row.director) sub.push("Dir. " + escapeHtml(row.director));

    var links = "";
    if (row.youtube) {
      links += '<a class="icon-btn" href="' + escapeHtml(row.youtube) + '" target="_blank" rel="noopener noreferrer" title="Watch on YouTube" aria-label="Watch on YouTube">' + ICON_YOUTUBE + "</a>";
    }
    if (row.mvg) {
      links += '<a class="icon-btn" href="' + escapeHtml(row.mvg) + '" target="_blank" rel="noopener noreferrer" title="View on Instagram" aria-label="View on Instagram">' + ICON_INSTAGRAM + "</a>";
    }

    var descHtml = row.description
      ? '<p class="entry-desc">' + escapeHtml(row.description) + "</p>"
      : '<p class="entry-desc placeholder">No writeup yet.</p>';

    return (
      '<li class="entry">' +
      '<div class="entry-row" role="button" tabindex="0" aria-expanded="false">' +
      '<span class="entry-chevron" aria-hidden="true">&#9656;</span>' +
      '<span class="entry-main">' +
      '<span class="entry-title">' + escapeHtml(row.song || "(untitled)") + "</span>" +
      (sub.length ? '<span class="entry-sub">' + sub.join(" &middot; ") + "</span>" : "") +
      "</span>" +
      (row.category ? '<span class="tag ' + categoryTagClass(row.category) + '">' + escapeHtml(row.category) + "</span>" : "") +
      (links ? '<span class="entry-links">' + links + "</span>" : "") +
      "</div>" +
      '<div class="entry-body" hidden>' + descHtml + "</div>" +
      "</li>"
    );
  }

  function groupBy(rows, keyFn) {
    var groups = {};
    rows.forEach(function (row) {
      var key = keyFn(row) || "Unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });
    return groups;
  }

  function sortedKeys(groups) {
    return Object.keys(groups).sort(function (a, b) {
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
  }

  function sortByJumpLetter(keys) {
    return keys.slice().sort(function (a, b) {
      var ia = JUMP_LETTERS.indexOf(a);
      var ib = JUMP_LETTERS.indexOf(b);
      if (ia === -1) ia = 999;
      if (ib === -1) ib = 999;
      return ia - ib;
    });
  }

  function sortByField(rows, field) {
    return rows.slice().sort(function (a, b) {
      return (a[field] || "").localeCompare(b[field] || "", undefined, { sensitivity: "base" });
    });
  }

  function renderGroupSection(id, heading, rows) {
    return (
      '<section class="group" id="' + id + '">' +
      '<h2 class="group-heading">' + escapeHtml(heading) +
      '<span class="group-count">' + rows.length + (rows.length === 1 ? " entry" : " entries") + "</span></h2>" +
      '<ul class="entry-list">' + rows.map(renderEntry).join("") + "</ul>" +
      "</section>"
    );
  }

  function render() {
    var filtered = state.rows.filter(function (row) {
      return matchesQuery(row, state.query);
    });

    var jumpMap = {};
    var groupIdCounter = 0;

    if (!filtered.length) {
      els.results.innerHTML = '<div class="empty-state">No entries match your search.</div>';
      state.jumpMap = jumpMap;
      renderJumpNav();
      return;
    }

    var html = "";

    if (state.view === "song") {
      var byLetter = groupBy(filtered, function (r) { return letterBucket(r.song); });
      var keys = sortByJumpLetter(Object.keys(byLetter));
      keys.forEach(function (key) {
        var id = "grp-" + groupIdCounter++;
        if (!(key in jumpMap)) jumpMap[key] = id;
        html += renderGroupSection(id, key, sortByField(byLetter[key], "song"));
      });
    } else {
      var keyFn = state.view === "director" ? function (r) { return r.director; } : function (r) { return r.artist; };
      var groups = groupBy(filtered, keyFn);
      var names = sortedKeys(groups);
      names.forEach(function (name) {
        var id = "grp-" + groupIdCounter++;
        var letter = letterBucket(name);
        if (!(letter in jumpMap)) jumpMap[letter] = id;
        html += renderGroupSection(id, name, sortByField(groups[name], "song"));
      });
    }

    els.results.innerHTML = html;
    state.jumpMap = jumpMap;
    renderJumpNav();
  }

  function renderJumpNav() {
    var html = JUMP_LETTERS.map(function (letter) {
      var enabled = state.jumpMap.hasOwnProperty(letter);
      return '<button class="jump-btn" data-letter="' + letter + '"' + (enabled ? "" : " disabled") + ">" + letter + "</button>";
    }).join("");
    els.jumpTop.innerHTML = html;
    els.jumpBottom.innerHTML = html;
  }

  function onJumpClick(e) {
    var btn = e.target.closest(".jump-btn");
    if (!btn || btn.disabled) return;
    var id = state.jumpMap[btn.getAttribute("data-letter")];
    var target = id && document.getElementById(id);
    if (target) target.scrollIntoView({ block: "start" });
  }

  els.jumpTop.addEventListener("click", onJumpClick);
  els.jumpBottom.addEventListener("click", onJumpClick);

  function toggleEntry(entryRow) {
    var body = entryRow.nextElementSibling;
    var expanded = entryRow.getAttribute("aria-expanded") === "true";
    entryRow.setAttribute("aria-expanded", expanded ? "false" : "true");
    entryRow.parentElement.classList.toggle("expanded", !expanded);
    if (body) body.hidden = expanded;
  }

  els.results.addEventListener("click", function (e) {
    if (e.target.closest("a")) return;
    var row = e.target.closest(".entry-row");
    if (row) toggleEntry(row);
  });

  els.results.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var row = e.target.closest(".entry-row");
    if (row) {
      e.preventDefault();
      toggleEntry(row);
    }
  });

  els.tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      els.tabs.forEach(function (t) {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      state.view = tab.getAttribute("data-view");
      render();
    });
  });

  var searchTimer = null;
  els.search.addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.query = els.search.value.trim();
      render();
    }, 120);
  });

  fetchData();
})();
