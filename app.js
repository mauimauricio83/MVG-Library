(function () {
  "use strict";

  var CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRfeg4mWGWZgOc5ZC-84iBQP3XM4TBopECjBg8moFHmKj0pfOCID05iSC2Xfmf3Y4X8W5PP5r_GCY7a/pub?gid=1604307123&single=true&output=csv";

  var els = {
    status: document.getElementById("status"),
    results: document.getElementById("results"),
    search: document.getElementById("search"),
    tabs: Array.prototype.slice.call(document.querySelectorAll(".tab"))
  };

  var state = {
    rows: [],
    view: "director",
    query: ""
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
        els.status.textContent = state.rows.length
          ? ""
          : "No entries found.";
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

  function renderCard(row) {
    var descHtml = row.description
      ? '<p class="card-desc">' + escapeHtml(row.description) + "</p>"
      : '<p class="card-desc placeholder">No writeup yet.</p>';

    var links = "";
    if (row.youtube) {
      links +=
        '<a href="' + escapeHtml(row.youtube) + '" target="_blank" rel="noopener noreferrer">' +
        '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.5v-7l6.3 3.5-6.3 3.5Z"/></svg>' +
        "YouTube</a>";
    }
    if (row.mvg) {
      links +=
        '<a href="' + escapeHtml(row.mvg) + '" target="_blank" rel="noopener noreferrer">' +
        '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.2c3.2 0 3.6 0 4.9.07 1.3.06 2.2.27 2.9.56.8.3 1.4.7 2 1.4.6.6 1 1.2 1.4 2 .3.7.5 1.6.6 2.9.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.06 1.3-.27 2.2-.56 2.9a5.8 5.8 0 0 1-1.4 2 5.8 5.8 0 0 1-2 1.4c-.7.3-1.6.5-2.9.56-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.3-.06-2.2-.27-2.9-.56a5.8 5.8 0 0 1-2-1.4 5.8 5.8 0 0 1-1.4-2c-.3-.7-.5-1.6-.56-2.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.06-1.3.27-2.2.56-2.9.3-.8.7-1.4 1.4-2 .6-.6 1.2-1 2-1.4.7-.3 1.6-.5 2.9-.56C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.15 0-3.52 0-4.76.07-1.03.05-1.6.22-1.97.36-.5.2-.85.42-1.22.79-.37.37-.6.72-.79 1.22-.14.37-.3.94-.36 1.97C2.8 8.48 2.8 8.85 2.8 12s0 3.52.1 4.76c.06 1.03.22 1.6.36 1.97.2.5.42.85.79 1.22.37.37.72.6 1.22.79.37.14.94.3 1.97.36 1.24.06 1.6.07 4.76.07s3.52 0 4.76-.07c1.03-.06 1.6-.22 1.97-.36.5-.2.85-.42 1.22-.79.37-.37.6-.72.79-1.22.14-.37.3-.94.36-1.97.06-1.24.07-1.6.07-4.76s0-3.52-.07-4.76c-.06-1.03-.22-1.6-.36-1.97a3.3 3.3 0 0 0-.79-1.22 3.3 3.3 0 0 0-1.22-.79c-.37-.14-.94-.3-1.97-.36C15.52 4 15.15 4 12 4Zm0 3.4a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2Zm0 1.8a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Zm5.86-2a1.08 1.08 0 1 1-2.16 0 1.08 1.08 0 0 1 2.16 0Z"/></svg>' +
        "Instagram</a>";
    }

    return (
      '<div class="card">' +
      '<p class="card-title">' + escapeHtml(row.song || "(untitled)") + "</p>" +
      '<p class="card-artist">' + escapeHtml(row.artist || "Unknown artist") + "</p>" +
      (row.director ? '<p class="card-director">Dir. ' + escapeHtml(row.director) + "</p>" : "") +
      (row.category ? '<span class="tag ' + categoryTagClass(row.category) + '">' + escapeHtml(row.category) + "</span>" : "") +
      descHtml +
      (links ? '<div class="card-links">' + links + "</div>" : "") +
      "</div>"
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

  function sortByField(rows, field) {
    return rows.slice().sort(function (a, b) {
      return (a[field] || "").localeCompare(b[field] || "", undefined, { sensitivity: "base" });
    });
  }

  function render() {
    var filtered = state.rows.filter(function (row) {
      return matchesQuery(row, state.query);
    });

    if (!filtered.length) {
      els.results.innerHTML = '<div class="empty-state">No entries match your search.</div>';
      return;
    }

    var html = "";

    if (state.view === "song") {
      var sorted = sortByField(filtered, "song");
      html += '<div class="card-grid">' + sorted.map(renderCard).join("") + "</div>";
    } else {
      var keyFn = state.view === "director"
        ? function (r) { return r.director; }
        : function (r) { return r.artist; };
      var groups = groupBy(filtered, keyFn);
      var keys = sortedKeys(groups);

      keys.forEach(function (key) {
        var groupRows = sortByField(groups[key], "song");
        html +=
          '<section class="group">' +
          '<h2 class="group-heading">' + escapeHtml(key) +
          '<span class="group-count">' + groupRows.length + (groupRows.length === 1 ? " entry" : " entries") + "</span></h2>" +
          '<div class="card-grid">' + groupRows.map(renderCard).join("") + "</div>" +
          "</section>";
      });
    }

    els.results.innerHTML = html;
  }

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
