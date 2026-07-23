(function () {
  "use strict";

  var APP_VERSION = "4.15.0"; // bump alongside CHANGELOG.md on each meaningful commit

  var DEFAULT_TITLE = document.title;

  var CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRfeg4mWGWZgOc5ZC-84iBQP3XM4TBopECjBg8moFHmKj0pfOCID05iSC2Xfmf3Y4X8W5PP5r_GCY7a/pub?gid=1998671230&single=true&output=csv";

  // Ad slideshows, each sourced from its own small published sheet —
  // columns: Seconds (how long that ad shows before advancing), Image, Link.
  var AD_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRfeg4mWGWZgOc5ZC-84iBQP3XM4TBopECjBg8moFHmKj0pfOCID05iSC2Xfmf3Y4X8W5PP5r_GCY7a/pub?gid=1370999706&single=true&output=csv";
  var AD_DEFAULT_SECONDS = 6;
  var TOP_AD_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRfeg4mWGWZgOc5ZC-84iBQP3XM4TBopECjBg8moFHmKj0pfOCID05iSC2Xfmf3Y4X8W5PP5r_GCY7a/pub?gid=1259061390&single=true&output=csv";
  var TOP_AD_DEFAULT_SECONDS = 6;

  // Google Apps Script Web App bound to the "Submissions" tab.
  var SUBMIT_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbw6gTzYbfWEKoceJofWrgTnmfnk0S0DHnPWN6owX0YlsqrvN4DqdyYCVC_WNzsDdnYb/exec";

  // Client-side Firebase config -- safe to be public; Firestore's security
  // rules (not this config) are what actually gate access.
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
  var currentUser = null;

  // "Report issue" opens this Google Form pre-filled with the entry's own data.
  // Entry IDs read directly from the form's own field definitions.
  var REPORT_FORM_BASE = "https://docs.google.com/forms/d/e/1FAIpQLSe_URC6V6a8G2jDNond69uklAdGHPpXn2oezJpoOTObjqGT8g/viewform";
  var REPORT_FORM_ENTRIES = {
    rowNum: "entry.1971155431",
    artist: "entry.1092668461",
    song: "entry.332338301",
    youtube: "entry.234972007"
  };

  function reportFormUrl(row) {
    var params = new URLSearchParams();
    params.set("usp", "pp_url");
    params.set(REPORT_FORM_ENTRIES.rowNum, row.rowNum || "");
    params.set(REPORT_FORM_ENTRIES.artist, row.artist || "");
    params.set(REPORT_FORM_ENTRIES.song, row.song || "");
    params.set(REPORT_FORM_ENTRIES.youtube, row.youtube || "");
    return REPORT_FORM_BASE + "?" + params.toString();
  }

  var JUMP_LETTERS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  var els = {
    status: document.getElementById("status"),
    results: document.getElementById("results"),
    search: document.getElementById("search"),
    tabs: Array.prototype.slice.call(document.querySelectorAll(".tab")),
    jumpTop: document.getElementById("jumpNavTop"),
    jumpBottom: document.getElementById("jumpNavBottom"),
    videoEmbed: document.getElementById("videoEmbed"),
    videoBox: document.getElementById("videoEmbedBox"),
    categoryFilters: document.getElementById("categoryFilters"),
    subtitleStats: document.getElementById("subtitleStats"),
    controls: document.querySelector(".controls"),
    adPlaceholder: document.querySelector(".ad-placeholder"),
    yearFilter: document.getElementById("yearFilter"),
    genreFilter: document.getElementById("genreFilter"),
    countryFilter: document.getElementById("countryFilter"),
    mvgOnlyToggle: document.getElementById("mvgOnlyToggle"),
    filtersToggle: document.getElementById("filtersToggle"),
    filtersPanel: document.getElementById("filtersPanel"),
    filtersToggleCount: document.getElementById("filtersToggleCount"),
    clearFiltersBtn: document.getElementById("clearFiltersBtn"),
    lightbox: document.getElementById("lightbox"),
    lightboxPanel: document.querySelector(".lightbox-panel"),
    lightboxContent: document.getElementById("lightboxContent"),
    latestStrip: document.getElementById("latestStrip"),
    featuredStrip: document.getElementById("featuredStrip"),
    favoritesStrip: document.getElementById("favoritesStrip"),
    featuredPlayAll: document.getElementById("featuredPlayAll"),
    latestPlayAll: document.getElementById("latestPlayAll"),
    recentPlayAll: document.getElementById("recentPlayAll"),
    favoritesPlayAll: document.getElementById("favoritesPlayAll"),
    favoritesCollapseBtn: document.getElementById("favoritesCollapseBtn"),
    openRecentBtn: document.getElementById("openRecentBtn"),
    recentModal: document.getElementById("recentModal"),
    recentModalClose: document.getElementById("recentModalClose"),
    recentList: document.getElementById("recentList"),
    latestCollapseBtn: document.getElementById("latestCollapseBtn"),
    featuredCollapseBtn: document.getElementById("featuredCollapseBtn"),
    spotlightSidebar: document.getElementById("spotlightSidebar"),
    spotlightCards: document.getElementById("spotlightCards"),
    spotlightVerticalAd: document.getElementById("spotlightVerticalAd"),
    appFooter: document.getElementById("appFooter"),
    signInBtn: document.getElementById("signInBtn"),
    signOutBtn: document.getElementById("signOutBtn"),
    headerAccount: document.getElementById("headerAccount"),
    headerAvatar: document.getElementById("headerAvatar"),
    headerUserName: document.getElementById("headerUserName"),
    openSubmitBtn: document.getElementById("openSubmitBtn"),
    submitModal: document.getElementById("submitModal"),
    submitClose: document.getElementById("submitClose"),
    submitForm: document.getElementById("submitForm"),
    submitCategory: document.getElementById("submitCategory"),
    submitGenre: document.getElementById("submitGenre"),
    submitCountry: document.getElementById("submitCountry"),
    submitFormBtn: document.getElementById("submitFormBtn"),
    submitFormStatus: document.getElementById("submitFormStatus"),
    headerMenuBtn: document.getElementById("headerMenuBtn"),
    headerLinks: document.getElementById("headerLinks"),
    headerMenuClose: document.getElementById("headerMenuClose"),
    bottomNavHome: document.getElementById("bottomNavHome"),
    bottomNavFavorites: document.getElementById("bottomNavFavorites"),
    bottomNavSearch: document.getElementById("bottomNavSearch"),
    bottomNavTV: document.getElementById("bottomNavTV"),
    bottomNavSettings: document.getElementById("bottomNavSettings"),
    favoritesModal: document.getElementById("favoritesModal"),
    favoritesModalClose: document.getElementById("favoritesModalClose"),
    favoritesModalList: document.getElementById("favoritesModalList"),
    favoritesModalPlayAll: document.getElementById("favoritesModalPlayAll"),
    openSettingsBtn: document.getElementById("openSettingsBtn"),
    settingsModal: document.getElementById("settingsModal"),
    settingsSyncNote: document.getElementById("settingsSyncNote"),
    clearRecentBtn: document.getElementById("clearRecentBtn"),
    themeToggle: document.getElementById("themeToggle"),
    settingsStatus: document.getElementById("settingsStatus")
  };

  els.appFooter.textContent = "v" + APP_VERSION + " · Created by MnC · 2026";

  var LATEST_STRIP_COUNT = 50;
  var SPOTLIGHT_COUNT = 3;

  var YEAR_NONE = "__no-year__";
  var GENRE_NONE = "__no-genre__";
  var COUNTRY_NONE = "__no-country__";

  // This app is often embedded in a Squarespace page via an auto-height
  // iframe (no independent scrolling inside the iframe -- the OUTER page
  // scrolls a tall iframe instead). `position: fixed` is relative to the
  // iframe's own viewport, which in that setup spans the iframe's full
  // (tall) document rather than just the visible slice, so fixed overlays
  // drift far off-screen once the outer page has scrolled. Freezing the
  // body at scroll position 0 via `position: fixed; top: -Ypx` while a
  // modal is open keeps our fixed overlays aligned with what's actually
  // visible, and is restored (with scroll position) on close.
  var scrollLockCount = 0;
  var scrollLockY = 0;
  function lockBodyScroll() {
    if (scrollLockCount === 0) {
      scrollLockY = window.scrollY || window.pageYOffset || 0;
      document.body.style.position = "fixed";
      document.body.style.top = "-" + scrollLockY + "px";
      document.body.style.left = "0";
      document.body.style.right = "0";
    }
    scrollLockCount++;
  }

  function unlockBodyScroll() {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      window.scrollTo(0, scrollLockY);
    }
  }

  // Popups (lightbox, submit/settings/recent modals, the mobile header menu)
  // don't otherwise touch browser history, so the Android/browser back
  // button skips right past them and exits the app/tab instead of just
  // closing whatever's open. Pushing one history entry per "layer" makes
  // back behave like a dismiss instead of a full exit: popstate closes
  // whatever's open rather than navigating away. Only one entry is ever
  // pushed at a time (modalHistoryActive) since only one popup is open at
  // once -- switching between popups (e.g. Recently Viewed -> lightbox)
  // reuses the same layer rather than stacking a new history entry per hop.
  var modalHistoryActive = false;

  function pushModalHistory() {
    if (modalHistoryActive) return;
    modalHistoryActive = true;
    history.pushState({ mvgModal: true }, "", location.href);
  }

  function closeAllModalsHard() {
    closeLightbox();
    closeSubmitModal();
    closeSettingsModal();
    closeRecentModal();
    closeFavoritesModal();
    closeHeaderMenu();
  }

  // Call this from user-facing dismiss actions (X buttons, backdrop clicks,
  // Escape, clicking outside). Internal transitions between popups (e.g. a
  // Recently Viewed item opening the lightbox) should keep calling the
  // specific close*() function directly instead, so they don't trigger an
  // actual back-navigation.
  function dismissTopModal() {
    if (modalHistoryActive) {
      history.back();
    } else {
      closeAllModalsHard();
    }
  }

  window.addEventListener("popstate", function () {
    if (!modalHistoryActive) return;
    modalHistoryActive = false;
    closeAllModalsHard();
  });

  function scrollBelowStickyHeader(el) {
    var headerHeight = els.controls ? els.controls.getBoundingClientRect().height : 0;
    var y = el.getBoundingClientRect().top + window.scrollY - headerHeight - 10;
    window.scrollTo({ top: Math.max(y, 0), behavior: "auto" });
  }

  function moveVideoPairHome() {
    // TV Mode's video player + the ad banner + Favorites live right below
    // Latest Submissions; Featured stays anchored after the jump nav.
    els.latestStrip.after(els.adPlaceholder, els.videoEmbed, els.favoritesStrip);
    els.jumpTop.after(els.featuredStrip);
  }

  function findRowByNum(rowNum) {
    return state.rows.filter(function (r) { return r.rowNum === rowNum; })[0] || null;
  }

  var state = {
    rows: [],
    view: "director",
    query: "",
    category: "",
    year: "",
    genre: "",
    country: "",
    mvgOnly: false,
    activeLetter: null,
    lightboxRowNum: null,
    lightboxPlayer: null,
    lightboxSize: loadLightboxSizePref(),
    recentSet: {},
    tv: { active: false, queue: [], index: 0, player: null, shellBuilt: false }
  };

  var CACHE_KEY = "mvg-wiki-cache-v5"; // bumped: v4 rows predate the release-date artifact fix
  var LIGHTBOX_SIZE_KEY = "mvg-lightbox-size";

  var CATEGORY_CLASS = {
    "Music Video": "tag-music-video",
    "Dance": "tag-dance-sequence",
    "Montage": "tag-musical-montage",
    "DVD": "tag-dvd",
    "Live": "tag-live",
    "Installation": "tag-installation",
    "Short": "tag-short",
    "Docu": "tag-docu"
  };

  // The sheet's Country column may hold an ISO code (from the automated lookup
  // pass) or a full name (from new form submissions) — normalize either to a
  // clean full name at display time rather than enforcing one format upstream.
  var COUNTRY_CODE_TO_NAME = {
    AF: "Afghanistan", AL: "Albania", DZ: "Algeria", AD: "Andorra", AO: "Angola",
    AG: "Antigua and Barbuda", AR: "Argentina", AM: "Armenia", AU: "Australia", AT: "Austria",
    AZ: "Azerbaijan", BS: "Bahamas", BH: "Bahrain", BD: "Bangladesh", BB: "Barbados",
    BY: "Belarus", BE: "Belgium", BZ: "Belize", BJ: "Benin", BT: "Bhutan",
    BO: "Bolivia", BA: "Bosnia and Herzegovina", BW: "Botswana", BR: "Brazil", BN: "Brunei",
    BG: "Bulgaria", BF: "Burkina Faso", BI: "Burundi", CV: "Cabo Verde", KH: "Cambodia",
    CM: "Cameroon", CA: "Canada", CF: "Central African Republic", TD: "Chad", CL: "Chile",
    CN: "China", CO: "Colombia", KM: "Comoros", CG: "Congo", CD: "Congo",
    CR: "Costa Rica", HR: "Croatia", CU: "Cuba", CY: "Cyprus", CZ: "Czechia",
    DK: "Denmark", DJ: "Djibouti", DM: "Dominica", DO: "Dominican Republic", EC: "Ecuador",
    EG: "Egypt", SV: "El Salvador", GQ: "Equatorial Guinea", ER: "Eritrea", EE: "Estonia",
    SZ: "Eswatini", ET: "Ethiopia", FJ: "Fiji", FI: "Finland", FR: "France",
    GA: "Gabon", GM: "Gambia", GE: "Georgia", DE: "Germany", GH: "Ghana",
    GR: "Greece", GD: "Grenada", GT: "Guatemala", GN: "Guinea", GW: "Guinea-Bissau",
    GY: "Guyana", HT: "Haiti", HN: "Honduras", HU: "Hungary", IS: "Iceland",
    IN: "India", ID: "Indonesia", IR: "Iran", IQ: "Iraq", IE: "Ireland",
    IL: "Israel", IT: "Italy", JM: "Jamaica", JP: "Japan", JO: "Jordan",
    KZ: "Kazakhstan", KE: "Kenya", KI: "Kiribati", XK: "Kosovo", KW: "Kuwait",
    KG: "Kyrgyzstan", LA: "Laos", LV: "Latvia", LB: "Lebanon", LS: "Lesotho",
    LR: "Liberia", LY: "Libya", LI: "Liechtenstein", LT: "Lithuania", LU: "Luxembourg",
    MG: "Madagascar", MW: "Malawi", MY: "Malaysia", MV: "Maldives", ML: "Mali",
    MT: "Malta", MH: "Marshall Islands", MR: "Mauritania", MU: "Mauritius", MX: "Mexico",
    FM: "Micronesia", MD: "Moldova", MC: "Monaco", MN: "Mongolia", ME: "Montenegro",
    MA: "Morocco", MZ: "Mozambique", MM: "Myanmar", NA: "Namibia", NR: "Nauru",
    NP: "Nepal", NL: "Netherlands", NZ: "New Zealand", NI: "Nicaragua", NE: "Niger",
    NG: "Nigeria", KP: "North Korea", MK: "North Macedonia", NO: "Norway", OM: "Oman",
    PK: "Pakistan", PW: "Palau", PS: "Palestine", PA: "Panama", PG: "Papua New Guinea",
    PY: "Paraguay", PE: "Peru", PH: "Philippines", PL: "Poland", PT: "Portugal",
    PR: "Puerto Rico", QA: "Qatar", RO: "Romania", RU: "Russia", RW: "Rwanda",
    KN: "Saint Kitts and Nevis", LC: "Saint Lucia", VC: "Saint Vincent and the Grenadines", WS: "Samoa", SM: "San Marino",
    ST: "Sao Tome and Principe", SA: "Saudi Arabia", SN: "Senegal", RS: "Serbia", SC: "Seychelles",
    SL: "Sierra Leone", SG: "Singapore", SK: "Slovakia", SI: "Slovenia", SB: "Solomon Islands",
    SO: "Somalia", ZA: "South Africa", KR: "South Korea", SS: "South Sudan", ES: "Spain",
    LK: "Sri Lanka", SD: "Sudan", SR: "Suriname", SE: "Sweden", CH: "Switzerland",
    SY: "Syria", TW: "Taiwan", TJ: "Tajikistan", TZ: "Tanzania", TH: "Thailand",
    TL: "Timor-Leste", TG: "Togo", TO: "Tonga", TT: "Trinidad and Tobago", TN: "Tunisia",
    TR: "Turkey", TM: "Turkmenistan", TV: "Tuvalu", UG: "Uganda", UA: "Ukraine",
    AE: "United Arab Emirates", GB: "United Kingdom", US: "United States", UY: "Uruguay", UZ: "Uzbekistan",
    VU: "Vanuatu", VA: "Vatican City", VE: "Venezuela", VN: "Vietnam", YE: "Yemen",
    ZM: "Zambia", ZW: "Zimbabwe"
  };

  var COUNTRY_ALIASES = {
    usa: "United States", "u.s.a.": "United States", "u.s.": "United States", america: "United States",
    uk: "United Kingdom", "u.k.": "United Kingdom", england: "United Kingdom",
    "south korea": "South Korea", korea: "South Korea", "republic of korea": "South Korea",
    "russian federation": "Russia", holland: "Netherlands", uae: "United Arab Emirates",
    "czech republic": "Czechia"
  };

  var COUNTRY_NAME_SET = (function () {
    var set = {};
    Object.keys(COUNTRY_CODE_TO_NAME).forEach(function (code) {
      set[COUNTRY_CODE_TO_NAME[code].toLowerCase()] = COUNTRY_CODE_TO_NAME[code];
    });
    return set;
  })();

  // The sheet's "Release date" column is date-formatted, so cells holding a
  // bare year (e.g. 1996) publish as that serial number's date -- 1996 days
  // from Sheets' 1899-12-30 epoch is "June 18, 1905". The mapping is
  // invertible (days-since-epoch IS the original year), so decode it here
  // rather than showing thousands of bogus 1905 dates in the lightbox.
  var SHEET_MONTHS = { January: 0, February: 1, March: 2, April: 3, May: 4, June: 5, July: 6, August: 7, September: 8, October: 9, November: 10, December: 11 };
  function fixReleaseDate(raw) {
    var m = String(raw || "").match(/^(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (19[0-1]\d)$/);
    if (!m) return raw;
    var serial = Math.round((Date.UTC(+m[3], SHEET_MONTHS[m[1]], +m[2]) - Date.UTC(1899, 11, 30)) / 86400000);
    return serial >= 1900 && serial <= 2100 ? String(serial) : raw;
  }

  function normalizeCountry(raw) {
    var v = String(raw || "").trim();
    if (!v) return "";
    if (v.length === 2 && COUNTRY_CODE_TO_NAME[v.toUpperCase()]) return COUNTRY_CODE_TO_NAME[v.toUpperCase()];
    var lower = v.toLowerCase();
    if (COUNTRY_NAME_SET[lower]) return COUNTRY_NAME_SET[lower];
    if (COUNTRY_ALIASES[lower]) return COUNTRY_ALIASES[lower];
    return v; // unrecognized — show whatever's there rather than hide it
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function loadLightboxSizePref() {
    try {
      return localStorage.getItem(LIGHTBOX_SIZE_KEY) === "small" ? "small" : "large";
    } catch (e) {
      return "large";
    }
  }

  function saveLightboxSizePref(size) {
    try {
      localStorage.setItem(LIGHTBOX_SIZE_KEY, size);
    } catch (e) {}
  }

  var FILTERS_EXPANDED_KEY = "mvg-filters-expanded";

  function loadFiltersExpandedPref() {
    try {
      return localStorage.getItem(FILTERS_EXPANDED_KEY) === "true";
    } catch (e) {
      return false;
    }
  }

  function saveFiltersExpandedPref(expanded) {
    try {
      localStorage.setItem(FILTERS_EXPANDED_KEY, expanded ? "true" : "false");
    } catch (e) {}
  }

  // All four media strips are collapsible; each picks its own default via
  // the defaultCollapsed param below -- Recently Viewed/Favorites start
  // collapsed (secondary, personalized content), Latest/Featured start
  // expanded (primary content most visitors want to see right away).
  function loadCollapsedPref(key, defaultCollapsed) {
    try {
      var raw = localStorage.getItem(key);
      return raw === null ? defaultCollapsed : raw === "true";
    } catch (e) {
      return defaultCollapsed;
    }
  }

  function saveCollapsedPref(key, collapsed) {
    try {
      localStorage.setItem(key, collapsed ? "true" : "false");
    } catch (e) {}
  }

  function setupCollapsibleStrip(sectionEl, toggleBtn, prefKey, defaultCollapsed) {
    var collapsed = loadCollapsedPref(prefKey, defaultCollapsed);
    sectionEl.classList.toggle("is-collapsed", collapsed);
    toggleBtn.addEventListener("click", function () {
      collapsed = !collapsed;
      sectionEl.classList.toggle("is-collapsed", collapsed);
      saveCollapsedPref(prefKey, collapsed);
    });
  }

  // Favorites/recently-viewed are localStorage-first (instant, works
  // signed-out) and pushed to Firestore too when signed in, so they sync
  // across devices. See syncFromFirestore()/pushToFirestore() below.
  var FAVORITES_KEY = "mvg-favorites";
  var RECENT_KEY = "mvg-recently-viewed";
  var RECENT_MAX = 12;

  function loadFavorites() {
    try {
      var raw = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  }

  function saveFavorites(list) {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function isFavorite(rowNum) {
    return loadFavorites().indexOf(rowNum) !== -1;
  }

  function toggleFavorite(rowNum) {
    var list = loadFavorites();
    var idx = list.indexOf(rowNum);
    var nowFavorite = idx === -1;
    if (nowFavorite) list.push(rowNum);
    else list.splice(idx, 1);
    saveFavorites(list);
    pushToFirestore();
    return nowFavorite;
  }

  function loadRecentlyViewed() {
    try {
      var raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  }

  function pushRecentlyViewed(rowNum) {
    var list = loadRecentlyViewed().filter(function (n) { return n !== rowNum; });
    list.unshift(rowNum);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
    } catch (e) {}
    pushToFirestore();
  }

  // Fire-and-forget: local writes should never wait on the network, and this
  // fires on every favorite/view so silent failure (offline, rules issue) is
  // the right behavior rather than surfacing an error to the user.
  function pushToFirestore() {
    if (!currentUser) return;
    db.collection("users").doc(currentUser.uid).set({
      favorites: loadFavorites(),
      recentlyViewed: loadRecentlyViewed()
    }, { merge: true }).catch(function (err) {
      console.error("Firestore sync (push) failed:", err);
    });
  }

  // Runs once per sign-in: reconciles this browser's local data with
  // whatever's already saved for this account, so signing in on a fresh
  // device doesn't wipe out favorites picked up elsewhere (or vice versa).
  function syncFromFirestore() {
    if (!currentUser) return;
    db.collection("users").doc(currentUser.uid).get().then(function (doc) {
      var remote = doc.exists ? doc.data() : {};
      var remoteFavorites = Array.isArray(remote.favorites) ? remote.favorites : [];
      var remoteRecent = Array.isArray(remote.recentlyViewed) ? remote.recentlyViewed : [];
      var localFavorites = loadFavorites();
      var localRecent = loadRecentlyViewed();

      var mergedFavorites = remoteFavorites.concat(
        localFavorites.filter(function (id) { return remoteFavorites.indexOf(id) === -1; })
      );
      var mergedRecent = remoteRecent.length ? remoteRecent : localRecent;

      saveFavorites(mergedFavorites);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(mergedRecent.slice(0, RECENT_MAX)));
      } catch (e) {}

      pushToFirestore();
      renderFavoritesStrip(state.rows);
      renderRecentList(state.rows);
    }).catch(function (err) {
      console.error("Firestore sync (pull) failed:", err);
    });
  }

  function saveCache(rows) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ rows: rows, savedAt: Date.now() }));
    } catch (e) {}
  }

  function loadCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setStatus(message, opts) {
    opts = opts || {};
    els.status.classList.toggle("error", !!opts.error);
    els.status.innerHTML = opts.spinner
      ? '<span class="spinner-small"></span><span>' + escapeHtml(message) + "</span>"
      : escapeHtml(message);
  }

  function fetchData() {
    var cached = loadCache();
    if (cached && cached.rows && cached.rows.length) {
      state.rows = cached.rows;
      setStatus("Showing cached data from " + new Date(cached.savedAt).toLocaleString() + " — refreshing…", { spinner: true });
      finishLoad();
    } else {
      setStatus("Loading database…", { spinner: true });
    }

    Papa.parse(CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: function (result) {
        state.rows = cleanRows(result.data);
        saveCache(state.rows);
        setStatus(state.rows.length ? "" : "No entries found.");
        finishLoad();
      },
      error: function (err) {
        console.error("CSV load error:", err);
        if (cached && cached.rows && cached.rows.length) {
          setStatus("Showing cached data from " + new Date(cached.savedAt).toLocaleString() + " — couldn't reach the latest sheet.");
        } else {
          setStatus("Couldn't load the database. Please try again later.", { error: true });
        }
      }
    });
  }

  function finishLoad() {
    buildCategoryChips(state.rows);
    updateCategoryChipsActive();
    buildYearOptions(state.rows);
    els.yearFilter.value = state.year;
    buildGenreOptions(state.rows);
    els.genreFilter.value = state.genre;
    buildCountryOptions(state.rows);
    els.countryFilter.value = state.country;
    buildSubmitDropdowns(state.rows);
    updateFiltersToggleCount();
    updateSubtitleStats(state.rows);
    state.recentSet = computeRecentSet(state.rows);
    renderLatestStrip(state.rows);
    renderFeaturedStrip(state.rows);
    renderRecentList(state.rows);
    renderFavoritesStrip(state.rows);
    renderSpotlightSidebar(state.rows);
    render();
    applyDeepLinkFromHash();
  }

  window.addEventListener("resize", function () {
    if (!els.spotlightSidebar.hidden) positionSpotlightSidebar();
  });

  function get(row, key) {
    return (row[key] || "").trim();
  }

  // Prefer the split Genre 1/2/3 columns; fall back to a single ";"-separated Genre column.
  function readGenres(row) {
    var out = [];
    ["Genre 1", "Genre 2", "Genre 3"].forEach(function (k) {
      var v = get(row, k);
      if (v) out.push(v);
    });
    if (!out.length) {
      var legacy = get(row, "Genre");
      if (legacy) out = legacy.split(";").map(function (s) { return s.trim(); }).filter(Boolean);
    }
    // dedupe, preserve order
    var seen = {};
    return out.filter(function (g) { if (seen[g]) return false; seen[g] = true; return true; });
  }

  function cleanRows(rawRows) {
    return rawRows
      .map(function (row) {
        var artist = get(row, "Artist");
        var song = get(row, "Song Title");
        var director = get(row, "Director");
        return {
          rowNum: get(row, "Row #"),
          artist: artist,
          song: song,
          director: director,
          category: get(row, "Category"),
          youtube: get(row, "YouTube Link"),
          mvg: get(row, "MVG Link"),
          year: get(row, "Year"),
          releaseDate: fixReleaseDate(get(row, "Release date")),
          studio: get(row, "Studio"),
          producer: get(row, "Producer"),
          dp: get(row, "DP"),
          editor: get(row, "Editor"),
          choreographer: get(row, "Choreographer"),
          country: get(row, "Country"),
          genres: readGenres(row),
          description: get(row, "Description"),
          feature: /^(true|yes|y|1|x)$/i.test(get(row, "Feature")),
          spotlight: /^(true|yes|y|1|x)$/i.test(get(row, "Spotlight")),
          // Precomputed once so search doesn't re-lowercase/concatenate these
          // on every keystroke across 12,000+ rows. Covers the named-person/
          // crew fields; Genre/Country/Description are left out since those
          // already have their own filter dropdowns.
          searchHaystack: [
            artist, song, director,
            get(row, "Producer"), get(row, "DP"), get(row, "Editor"),
            get(row, "Choreographer"), get(row, "Studio")
          ].join(" ").toLowerCase()
        };
      })
      .filter(function (row) {
        return row.artist !== "" || row.song !== "";
      });
  }

  // Tokenized, order-independent, cross-field search: every word in the query
  // must appear *somewhere* across artist/song/director combined — so
  // "romanek hurt" matches director "Mark Romanek" + song "Hurt", and
  // "mark romanek" / "romanek mark" both match the same entries.
  function matchesQuery(row, q) {
    if (!q) return true;
    var tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return true;
    return tokens.every(function (t) { return row.searchHaystack.indexOf(t) !== -1; });
  }

  function viewFieldFor(row) {
    if (state.view === "director") return row.director;
    if (state.view === "artist") return row.artist;
    return row.song;
  }

  function matchesLetter(row) {
    if (!state.activeLetter) return true;
    return letterBucket(viewFieldFor(row)) === state.activeLetter;
  }

  function matchesYear(row) {
    if (!state.year) return true;
    if (state.year === YEAR_NONE) return !row.year;
    return row.year === state.year;
  }

  function matchesGenre(row) {
    if (!state.genre) return true;
    var genres = row.genres || [];
    if (state.genre === GENRE_NONE) return !genres.length;
    return genres.indexOf(state.genre) !== -1;
  }

  function matchesCountry(row) {
    if (!state.country) return true;
    if (state.country === COUNTRY_NONE) return !row.country;
    return normalizeCountry(row.country) === state.country;
  }

  function matchesBaseFilters(row) {
    if (state.category && row.category !== state.category) return false;
    if (!matchesYear(row)) return false;
    if (!matchesGenre(row)) return false;
    if (!matchesCountry(row)) return false;
    if (state.mvgOnly && !row.mvg) return false;
    return matchesQuery(row, state.query);
  }

  function matchesFilters(row) {
    if (!matchesBaseFilters(row)) return false;
    return matchesLetter(row);
  }

  function hasActiveFilters() {
    return !!(state.category || state.year || state.genre || state.country || state.mvgOnly || state.activeLetter);
  }

  function activeFilterCount() {
    var n = 0;
    if (state.category) n++;
    if (state.year) n++;
    if (state.genre) n++;
    if (state.country) n++;
    if (state.mvgOnly) n++;
    return n;
  }

  function updateFiltersToggleCount() {
    var n = activeFilterCount();
    els.filtersToggleCount.hidden = n === 0;
    els.filtersToggleCount.textContent = String(n);
  }

  function clearAllFilters() {
    state.category = "";
    state.year = "";
    state.genre = "";
    state.country = "";
    state.mvgOnly = false;
    state.activeLetter = null;
    state.query = "";
    els.search.value = "";
    updateCategoryChipsActive();
    els.yearFilter.value = "";
    els.genreFilter.value = "";
    els.countryFilter.value = "";
    els.mvgOnlyToggle.checked = false;
    updateFiltersToggleCount();
  }

  function buildCategoryChips(rows) {
    var counts = {};
    rows.forEach(function (r) {
      if (r.category) counts[r.category] = (counts[r.category] || 0) + 1;
    });
    var cats = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    var html = '<button type="button" class="chip active" data-category="">All (' + rows.length + ")</button>";
    cats.forEach(function (c) {
      html += '<button type="button" class="chip" data-category="' + escapeHtml(c) + '">' + escapeHtml(c) + " (" + counts[c] + ")</button>";
    });
    els.categoryFilters.innerHTML = html;
  }

  function yearSortKey(y) {
    var m = String(y).match(/\d{4}/);
    return m ? parseInt(m[0], 10) : 0;
  }

  function buildYearOptions(rows) {
    var counts = {};
    var blankCount = 0;
    rows.forEach(function (r) {
      if (!r.year) { blankCount++; return; }
      counts[r.year] = (counts[r.year] || 0) + 1;
    });
    var years = Object.keys(counts).sort(function (a, b) { return yearSortKey(b) - yearSortKey(a); });
    var html = '<option value="">All Years</option>';
    if (blankCount) html += '<option value="' + YEAR_NONE + '">No Year Listed (' + blankCount + ")</option>";
    years.forEach(function (y) {
      html += '<option value="' + escapeHtml(y) + '">' + escapeHtml(y) + " (" + counts[y] + ")</option>";
    });
    els.yearFilter.innerHTML = html;
  }

  els.yearFilter.addEventListener("change", function () {
    state.year = els.yearFilter.value;
    render();
  });

  function buildGenreOptions(rows) {
    var counts = {};
    var blankCount = 0;
    rows.forEach(function (r) {
      var genres = r.genres || [];
      if (!genres.length) { blankCount++; return; }
      genres.forEach(function (g) { counts[g] = (counts[g] || 0) + 1; });
    });
    var genres = Object.keys(counts).sort(function (a, b) {
      if (counts[b] !== counts[a]) return counts[b] - counts[a];
      return a.localeCompare(b);
    });
    var html = '<option value="">All Genres</option>';
    if (blankCount) html += '<option value="' + GENRE_NONE + '">No Genre Listed (' + blankCount + ")</option>";
    genres.forEach(function (g) {
      html += '<option value="' + escapeHtml(g) + '">' + escapeHtml(g) + " (" + counts[g] + ")</option>";
    });
    els.genreFilter.innerHTML = html;
  }

  els.genreFilter.addEventListener("change", function () {
    state.genre = els.genreFilter.value;
    render();
  });

  function buildCountryOptions(rows) {
    var counts = {};
    var blankCount = 0;
    rows.forEach(function (r) {
      if (!r.country) { blankCount++; return; }
      var name = normalizeCountry(r.country);
      counts[name] = (counts[name] || 0) + 1;
    });
    var countries = Object.keys(counts).sort(function (a, b) {
      return a.localeCompare(b);
    });
    var html = '<option value="">All Countries</option>';
    if (blankCount) html += '<option value="' + COUNTRY_NONE + '">No Country Listed (' + blankCount + ")</option>";
    countries.forEach(function (c) {
      html += '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + " (" + counts[c] + ")</option>";
    });
    els.countryFilter.innerHTML = html;
  }

  els.countryFilter.addEventListener("change", function () {
    state.country = els.countryFilter.value;
    render();
  });

  els.clearFiltersBtn.addEventListener("click", function () {
    clearAllFilters();
    render();
  });

  function applyFiltersExpanded(expanded) {
    els.filtersPanel.hidden = !expanded;
    els.filtersToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  applyFiltersExpanded(loadFiltersExpandedPref());

  els.filtersToggle.addEventListener("click", function () {
    var expanded = els.filtersToggle.getAttribute("aria-expanded") !== "true";
    applyFiltersExpanded(expanded);
    saveFiltersExpandedPref(expanded);
  });

  els.mvgOnlyToggle.addEventListener("change", function () {
    state.mvgOnly = els.mvgOnlyToggle.checked;
    render();
  });

  function updateCategoryChipsActive() {
    Array.prototype.forEach.call(els.categoryFilters.querySelectorAll(".chip"), function (chip) {
      chip.classList.toggle("active", chip.getAttribute("data-category") === state.category);
    });
  }

  els.categoryFilters.addEventListener("click", function (e) {
    var chip = e.target.closest(".chip");
    if (!chip) return;
    state.category = chip.getAttribute("data-category") || "";
    updateCategoryChipsActive();
    render();
  });

  // Full category breakdown -- shown in the blank-results empty state, not
  // the header (see updateSubtitleStats below for that swap).
  function categoryBreakdownText(rows) {
    var counts = {};
    rows.forEach(function (r) {
      var c = r.category || "Uncategorized";
      counts[c] = (counts[c] || 0) + 1;
    });
    var parts = Object.keys(counts)
      .sort(function (a, b) { return counts[b] - counts[a]; })
      .map(function (c) { return counts[c] + " " + c + (counts[c] === 1 ? "" : "s"); });
    return rows.length + " entries — " + parts.join(", ");
  }

  function updateSubtitleStats(rows) {
    els.subtitleStats.textContent = rows.length + " videos — search below, or pick a filter or letter to start browsing.";
  }

  function computeRecentSet(rows) {
    var withNum = rows
      .map(function (r) { return { rowNum: r.rowNum, n: parseInt(r.rowNum, 10) }; })
      .filter(function (x) { return !isNaN(x.n); })
      .sort(function (a, b) { return b.n - a.n; });
    var set = {};
    withNum.slice(0, 8).forEach(function (x) { set[x.rowNum] = true; });
    return set;
  }

  // Shared factory for the arrow-paginated media strips (Latest Submissions, Featured).
  function createMediaStrip(sectionEl) {
    var track = sectionEl.querySelector(".media-strip-track");
    var prev = sectionEl.querySelector(".media-strip-arrow:first-child");
    var next = sectionEl.querySelector(".media-strip-arrow:last-child");

    function updateArrows() {
      prev.disabled = track.scrollLeft <= 0;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;
    }

    track.addEventListener("click", function (e) {
      var card = e.target.closest(".media-strip-card");
      if (!card) return;
      var row = findRowByNum(card.getAttribute("data-row"));
      if (row) openLightbox(row);
    });

    prev.addEventListener("click", function () {
      track.scrollBy({ left: -track.clientWidth, behavior: "smooth" });
    });
    next.addEventListener("click", function () {
      track.scrollBy({ left: track.clientWidth, behavior: "smooth" });
    });
    track.addEventListener("scroll", updateArrows);

    return {
      render: function (rows) {
        if (!rows.length) {
          sectionEl.hidden = true;
          return;
        }
        track.innerHTML = rows.map(function (row) {
          var id = extractYouTubeId(row.youtube);
          var thumbAlt = escapeHtml((row.song || "Untitled") + (row.artist ? " — " + row.artist : ""));
          var thumb = id
            ? '<img src="https://i.ytimg.com/vi/' + id + '/mqdefault.jpg" alt="' + thumbAlt + '" loading="lazy">'
            : "";
          return (
            '<div class="media-strip-card" data-row="' + escapeHtml(row.rowNum) + '">' +
              '<div class="media-strip-thumb">' + thumb + "</div>" +
              '<div class="media-strip-song">' + escapeHtml(row.song || "(untitled)") + "</div>" +
              '<div class="media-strip-artist">' + escapeHtml(row.artist || "") + "</div>" +
            "</div>"
          );
        }).join("");
        sectionEl.hidden = false;
        updateArrows();
      }
    };
  }

  var latestStrip = createMediaStrip(els.latestStrip);
  var featuredStrip = createMediaStrip(els.featuredStrip);
  var favoritesStrip = createMediaStrip(els.favoritesStrip);

  setupCollapsibleStrip(els.latestStrip, els.latestCollapseBtn, "mvg-latest-collapsed", false);
  setupCollapsibleStrip(els.featuredStrip, els.featuredCollapseBtn, "mvg-featured-collapsed", false);
  setupCollapsibleStrip(els.favoritesStrip, els.favoritesCollapseBtn, "mvg-favorites-collapsed", true);

  var latestPool = [];
  function renderLatestStrip(rows) {
    latestPool = rows
      .map(function (r) { return { row: r, n: parseInt(r.rowNum, 10) }; })
      .filter(function (x) { return !isNaN(x.n); })
      .sort(function (a, b) { return b.n - a.n; })
      .slice(0, LATEST_STRIP_COUNT)
      .map(function (x) { return x.row; });
    latestStrip.render(latestPool);
  }

  var featuredPool = [];
  function renderFeaturedStrip(rows) {
    featuredPool = shuffle(rows.filter(function (r) { return r.feature; }));
    featuredStrip.render(featuredPool);
  }

  // Most-recently-viewed first; entries are pushed by openLightbox(). Shown
  // in a vertical popup (recentModal) rather than a horizontal strip.
  var recentPool = [];
  function renderRecentList(rows) {
    recentPool = loadRecentlyViewed()
      .map(function (n) { return findRowByNum(n); })
      .filter(Boolean);

    if (!recentPool.length) {
      els.recentList.innerHTML = '<p class="recent-empty">Videos you open will show up here.</p>';
      return;
    }

    els.recentList.innerHTML = recentPool.map(function (row) {
      var id = extractYouTubeId(row.youtube);
      var thumbAlt = escapeHtml((row.song || "Untitled") + (row.artist ? " — " + row.artist : ""));
      var thumb = id
        ? '<img src="https://i.ytimg.com/vi/' + id + '/mqdefault.jpg" alt="' + thumbAlt + '" loading="lazy">'
        : "";
      return (
        '<button type="button" class="recent-item" data-row="' + escapeHtml(row.rowNum) + '">' +
          '<div class="recent-item-thumb">' + thumb + "</div>" +
          '<div class="recent-item-info">' +
            '<div class="recent-item-song">' + escapeHtml(row.song || "(untitled)") + "</div>" +
            '<div class="recent-item-artist">' + escapeHtml(row.artist || "") + "</div>" +
          "</div>" +
        "</button>"
      );
    }).join("");
  }

  // Most-recently-favorited first.
  var favoritesPool = [];
  function renderFavoritesStrip(rows) {
    var favIds = loadFavorites();
    favoritesPool = favIds
      .slice()
      .reverse()
      .map(function (n) { return findRowByNum(n); })
      .filter(Boolean);
    favoritesStrip.render(favoritesPool);
  }

  // Favorites is a vertical popup on mobile (bottomNavFavorites), not a
  // horizontal strip -- reuses favoritesPool from renderFavoritesStrip.
  function renderFavoritesModalList() {
    if (!favoritesPool.length) {
      els.favoritesModalList.innerHTML = '<p class="recent-empty">Videos you favorite will show up here.</p>';
      return;
    }

    els.favoritesModalList.innerHTML = favoritesPool.map(function (row) {
      var id = extractYouTubeId(row.youtube);
      var thumbAlt = escapeHtml((row.song || "Untitled") + (row.artist ? " — " + row.artist : ""));
      var thumb = id
        ? '<img src="https://i.ytimg.com/vi/' + id + '/mqdefault.jpg" alt="' + thumbAlt + '" loading="lazy">'
        : "";
      return (
        '<button type="button" class="recent-item" data-row="' + escapeHtml(row.rowNum) + '">' +
          '<div class="recent-item-thumb">' + thumb + "</div>" +
          '<div class="recent-item-info">' +
            '<div class="recent-item-song">' + escapeHtml(row.song || "(untitled)") + "</div>" +
            '<div class="recent-item-artist">' + escapeHtml(row.artist || "") + "</div>" +
          "</div>" +
        "</button>"
      );
    }).join("");
  }

  // Unlike Featured (shuffled for variety), Spotlight is a small, deliberate
  // placement — kept in sheet row order rather than randomized.
  var hasSpotlightContent = false;
  function renderSpotlightSidebar(rows) {
    var picks = rows
      .filter(function (r) { return r.spotlight; })
      .sort(function (a, b) { return parseInt(a.rowNum, 10) - parseInt(b.rowNum, 10); })
      .slice(0, SPOTLIGHT_COUNT);

    hasSpotlightContent = picks.length > 0;
    if (!picks.length) {
      els.spotlightSidebar.hidden = true;
      return;
    }

    els.spotlightCards.innerHTML = picks.map(function (row) {
      var id = extractYouTubeId(row.youtube);
      var thumbAlt = escapeHtml((row.song || "Untitled") + (row.artist ? " — " + row.artist : ""));
      var thumb = id
        ? '<img src="https://i.ytimg.com/vi/' + id + '/mqdefault.jpg" alt="' + thumbAlt + '" loading="lazy">'
        : "";
      return (
        '<div class="spotlight-card" data-row="' + escapeHtml(row.rowNum) + '">' +
          '<div class="spotlight-card-thumb">' + thumb + "</div>" +
          '<div class="spotlight-card-info">' +
            '<div class="spotlight-card-song">' + escapeHtml(row.song || "(untitled)") + "</div>" +
            '<div class="spotlight-card-artist">' + escapeHtml(row.artist || "") + "</div>" +
          "</div>" +
        "</div>"
      );
    }).join("");

    els.spotlightSidebar.hidden = false;
    positionSpotlightSidebar();
  }

  function positionSpotlightSidebar() {
    var headerHeight = els.controls ? els.controls.getBoundingClientRect().height : 0;
    els.spotlightSidebar.style.top = (headerHeight + 12) + "px";
  }

  els.spotlightCards.addEventListener("click", function (e) {
    var card = e.target.closest(".spotlight-card");
    if (!card) return;
    var row = findRowByNum(card.getAttribute("data-row"));
    if (row) openLightbox(row);
  });

  function isSameOriginUrl(url) {
    try {
      return new URL(url, location.href).origin === location.origin;
    } catch (e) {
      return false;
    }
  }

  // Renders a crossfading ad slideshow into any container, independent of
  // whoever else is showing the same ad list. Returns a handle so the caller
  // can stop its rotation timer once the container goes away (e.g. the
  // lightbox tearing down its content on every open/close) -- otherwise the
  // timeout chain runs forever against detached nodes.
  function renderAdSlideshowInto(container, ads, defaultSeconds) {
    var rotateTimer = null;
    function stop() { clearTimeout(rotateTimer); }

    if (!ads.length) {
      container.hidden = true;
      container.innerHTML = "";
      return { stop: stop };
    }

    container.innerHTML = ads.map(function (ad, i) {
      var img = '<img src="' + escapeHtml(ad.image) + '" alt="" loading="lazy">';
      // Same-site links (e.g. #submit) should navigate in place -- if this
      // banner sits inside an embedded iframe on the main site, target="_blank"
      // would blow past that embed into a bare new tab on the raw GitHub
      // Pages URL instead of just updating the hash where the user already is.
      var isSameOrigin = ad.link && isSameOriginUrl(ad.link);
      var slideInner = ad.link
        ? '<a href="' + escapeHtml(ad.link) + '"' + (isSameOrigin ? "" : ' target="_blank" rel="noopener noreferrer"') + ">" + img + "</a>"
        : img;
      return '<div class="ad-slide' + (i === 0 ? " is-active" : "") + '">' + slideInner + "</div>";
    }).join("");
    container.hidden = false;

    if (ads.length <= 1) return { stop: stop };

    var slides = Array.prototype.slice.call(container.querySelectorAll(".ad-slide"));
    var index = 0;
    var paused = false;

    // A timeout chain (rather than setInterval) lets each ad carry its own
    // duration from the sheet instead of one fixed interval for all of them.
    function scheduleNext() {
      rotateTimer = setTimeout(function () {
        if (paused) { scheduleNext(); return; }
        slides[index].classList.remove("is-active");
        index = (index + 1) % slides.length;
        slides[index].classList.add("is-active");
        scheduleNext();
      }, Math.max(1, ads[index].seconds) * 1000);
    }

    container.onmouseenter = function () { paused = true; };
    container.onmouseleave = function () { paused = false; };

    scheduleNext();
    return { stop: stop };
  }

  // Shared by both persistent ad placements (sidebar vertical + top
  // horizontal), each pointed at its own sheet so they rotate independently.
  // onLoaded (optional) hands back the parsed ad list for reuse elsewhere,
  // e.g. the lightbox mirroring the top banner without a second fetch.
  function createAdSlideshow(container, csvUrl, defaultSeconds, onLoaded) {
    return function fetchAndRender() {
      if (!csvUrl) return;
      Papa.parse(csvUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function (result) {
          var ads = result.data
            .map(function (row) {
              return {
                seconds: parseFloat(get(row, "Seconds")) || defaultSeconds,
                image: get(row, "Image"),
                link: get(row, "Link")
              };
            })
            .filter(function (ad) { return ad.image; });
          renderAdSlideshowInto(container, ads, defaultSeconds);
          if (onLoaded) onLoaded(ads);
        },
        error: function (err) {
          console.error("Ad sheet load error:", err);
        }
      });
    };
  }

  var topAdsCache = [];
  var lightboxAdController = null;
  var fetchSidebarAds = createAdSlideshow(els.spotlightVerticalAd, AD_CSV_URL, AD_DEFAULT_SECONDS);
  var fetchTopAds = createAdSlideshow(els.adPlaceholder, TOP_AD_CSV_URL, TOP_AD_DEFAULT_SECONDS, function (ads) {
    topAdsCache = ads;
  });

  function categoryTagClass(cat) {
    return CATEGORY_CLASS[cat] || "tag-default";
  }

  function letterBucket(str) {
    var ch = (str || "").trim().charAt(0).toUpperCase();
    if (/[0-9]/.test(ch)) return ch;
    if (/[A-Z]/.test(ch)) return ch;
    return "#";
  }

  function extractYouTubeId(url) {
    var m = String(url || "").match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : null;
  }

  function teardownTV() {
    state.tv.active = false;
    if (state.tv.player && state.tv.player.destroy) {
      try { state.tv.player.destroy(); } catch (e) {}
    }
    state.tv.player = null;
    state.tv.shellBuilt = false;
  }

  function hintMarkup(message) {
    return '<div class="video-embed-hint"><p>' + (message || "Shuffle through a curated playlist of videos matching your current filters.") + "</p>" +
      '<button type="button" class="tv-mode-btn" id="tvStartBtn">📺 Start TV Mode</button> ' +
      '<span class="info-tip" tabindex="0" data-tip="TV Mode shuffles through whatever your current search and filters show. Narrow things down first for a more focused mix.">ⓘ</span>' +
      "</div>";
  }

  function resetVideo() {
    els.videoBox.innerHTML = hintMarkup();
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  var ytApiReady = false;
  var ytApiCallbacks = [];
  function loadYouTubeAPI(cb) {
    if (ytApiReady) { cb(); return; }
    ytApiCallbacks.push(cb);
    if (ytApiCallbacks.length > 1) return;
    window.onYouTubeIframeAPIReady = function () {
      ytApiReady = true;
      ytApiCallbacks.forEach(function (fn) { fn(); });
      ytApiCallbacks = [];
    };
    var tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }

  // Force landscape while a YouTube player (TV Mode or the lightbox) is
  // fullscreen. The Fullscreen API bubbles up from the player's iframe to
  // this top document even though the iframe itself is cross-origin, so we
  // can react to it here. Screen Orientation lock only works on Chrome/
  // Android (incl. this app's TWA wrapper) and silently no-ops elsewhere
  // (e.g. iOS Safari, which has no lock API and just follows device rotation).
  document.addEventListener("fullscreenchange", function () {
    var el = document.fullscreenElement;
    var isOurPlayer = el && (els.videoBox.contains(el) || els.lightbox.contains(el));
    if (!screen.orientation || !screen.orientation.lock) return;
    if (isOurPlayer) {
      screen.orientation.lock("landscape").catch(function () {});
    } else if (screen.orientation.unlock) {
      screen.orientation.unlock();
    }
  });

  function tvLabelFor(row) {
    var parts = [row.song || "(untitled)"];
    if (row.artist) parts.push(row.artist);
    var label = parts.join(" — ");
    if (row.director) label += " · Dir. " + row.director;
    return label;
  }

  function ensureTVShell() {
    if (state.tv.shellBuilt) return;
    els.videoBox.innerHTML =
      '<div class="video-embed-bar"><span class="video-embed-label" id="tvLabel">📺 Loading…</span>' +
      '<span class="tv-controls">' +
      '<button type="button" class="tv-skip">Skip ▶</button>' +
      '<a class="tv-report-link" id="tvReportLink" href="#" target="_blank" rel="noopener noreferrer">Report issue</a>' +
      '<button type="button" class="video-embed-close" aria-label="Exit TV mode">&times;</button>' +
      "</span></div>" +
      '<div class="video-embed-frame"><div id="tvPlayerTarget"></div></div>';
    state.tv.shellBuilt = true;
  }

  function onTVStateChange(e) {
    if (state.tv.active && e.data === YT.PlayerState.ENDED) advanceTV();
  }

  function loadTVTrack(row) {
    var id = extractYouTubeId(row.youtube);
    if (!id) {
      advanceTV();
      return;
    }
    var labelEl = document.getElementById("tvLabel");
    if (labelEl) labelEl.textContent = "📺 " + tvLabelFor(row);
    var reportLink = document.getElementById("tvReportLink");
    if (reportLink) reportLink.href = reportFormUrl(row);
    if (state.tv.player && state.tv.player.loadVideoById) {
      state.tv.player.loadVideoById(id);
    } else {
      loadYouTubeAPI(function () {
        if (!state.tv.active) return;
        state.tv.player = new YT.Player("tvPlayerTarget", {
          videoId: id,
          playerVars: { autoplay: 1, rel: 0 },
          events: { onStateChange: onTVStateChange }
        });
      });
    }
  }

  function advanceTV() {
    state.tv.index++;
    if (state.tv.index >= state.tv.queue.length) {
      state.tv.queue = shuffle(state.tv.queue);
      state.tv.index = 0;
    }
    loadTVTrack(state.tv.queue[state.tv.index]);
  }

  function startTVMode(customPool) {
    closeLightbox();
    var pool = customPool || state.rows.filter(matchesFilters).filter(function (r) { return !!r.youtube; });
    if (!pool.length) {
      els.videoBox.innerHTML = hintMarkup("No videos to play with the current filters.");
      moveVideoPairHome();
      return;
    }
    // Relocating a live <iframe> in the DOM forces the browser to reload it,
    // silently discarding whatever loadVideoById() just did. Only re-home the
    // elements when actually transitioning into TV mode — if it's already
    // active (e.g. switching tracks via a Spotlight click), they're already
    // in place and moving them again would kill the player mid-swap.
    var wasActive = state.tv.active;
    state.tv.active = true;
    state.tv.queue = shuffle(pool);
    state.tv.index = 0;
    if (!wasActive) moveVideoPairHome();
    ensureTVShell();
    loadTVTrack(state.tv.queue[0]);
    scrollBelowStickyHeader(els.videoEmbed);
  }

  els.featuredPlayAll.addEventListener("click", function () {
    startTVMode(featuredPool.filter(function (r) { return !!r.youtube; }));
  });

  els.latestPlayAll.addEventListener("click", function () {
    startTVMode(latestPool.filter(function (r) { return !!r.youtube; }));
  });

  els.recentPlayAll.addEventListener("click", function () {
    startTVMode(recentPool.filter(function (r) { return !!r.youtube; }));
  });

  els.favoritesPlayAll.addEventListener("click", function () {
    startTVMode(favoritesPool.filter(function (r) { return !!r.youtube; }));
  });

  els.videoBox.addEventListener("click", function (e) {
    if (e.target.closest("#tvStartBtn")) {
      startTVMode();
      return;
    }
    if (e.target.closest(".tv-skip")) {
      advanceTV();
      return;
    }
    if (e.target.closest(".video-embed-close")) {
      if (state.tv.active) teardownTV();
      resetVideo();
      moveVideoPairHome();
    }
  });

  // ---- Lightbox ----

  function relatedEntries(director, excludeRowNum) {
    if (!director) return [];
    return state.rows.filter(function (r) {
      return r.director === director && r.rowNum !== excludeRowNum && r.youtube;
    }).slice(0, 3);
  }

  function lightboxRelatedHtml(director, excludeRowNum) {
    var related = relatedEntries(director, excludeRowNum);
    if (!related.length) return "";
    var items = related.map(function (r) {
      return '<button type="button" class="related-btn" data-row="' + escapeHtml(r.rowNum) + '">' + escapeHtml(r.song || "(untitled)") + "</button>";
    }).join("");
    return '<div class="lightbox-related"><span class="lightbox-related-label">More by ' + escapeHtml(director) + ":</span>" + items + "</div>";
  }

  function creditsHtml(row) {
    var pairs = [];
    if (row.director) pairs.push(["Director", row.director]);
    if (row.releaseDate) pairs.push(["Release date", row.releaseDate]);
    else if (row.year) pairs.push(["Year", row.year]);
    if (row.studio) pairs.push(["Studio", row.studio]);
    if (row.country) pairs.push(["Country", normalizeCountry(row.country)]);
    if (row.producer) pairs.push(["Producer", row.producer]);
    if (row.dp) pairs.push(["DP", row.dp]);
    if (row.editor) pairs.push(["Editor", row.editor]);
    if (row.choreographer) pairs.push(["Choreographer", row.choreographer]);
    if (!pairs.length) return "";
    var rowsHtml = pairs.map(function (p) {
      return "<dt>" + escapeHtml(p[0]) + "</dt><dd>" + escapeHtml(p[1]) + "</dd>";
    }).join("");
    return '<dl class="lightbox-credits">' + rowsHtml + "</dl>";
  }

  var ICON_INSTAGRAM = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.2c3.2 0 3.6 0 4.9.07 1.3.06 2.2.27 2.9.56.8.3 1.4.7 2 1.4.6.6 1 1.2 1.4 2 .3.7.5 1.6.6 2.9.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.06 1.3-.27 2.2-.56 2.9a5.8 5.8 0 0 1-1.4 2 5.8 5.8 0 0 1-2 1.4c-.7.3-1.6.5-2.9.56-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.3-.06-2.2-.27-2.9-.56a5.8 5.8 0 0 1-2-1.4 5.8 5.8 0 0 1-1.4-2c-.3-.7-.5-1.6-.56-2.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.06-1.3.27-2.2.56-2.9.3-.8.7-1.4 1.4-2 .6-.6 1.2-1 2-1.4.7-.3 1.6-.5 2.9-.56C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.15 0-3.52 0-4.76.07-1.03.05-1.6.22-1.97.36-.5.2-.85.42-1.22.79-.37.37-.6.72-.79 1.22-.14.37-.3.94-.36 1.97C2.8 8.48 2.8 8.85 2.8 12s0 3.52.1 4.76c.06 1.03.22 1.6.36 1.97.2.5.42.85.79 1.22.37.37.72.6 1.22.79.37.14.94.3 1.97.36 1.24.06 1.6.07 4.76.07s3.52 0 4.76-.07c1.03-.06 1.6-.22 1.97-.36.5-.2.85-.42 1.22-.79.37-.37.6-.72.79-1.22.14-.37.3-.94.36-1.97.06-1.24.07-1.6.07-4.76s0-3.52-.07-4.76c-.06-1.03-.22-1.6-.36-1.97a3.3 3.3 0 0 0-.79-1.22 3.3 3.3 0 0 0-1.22-.79c-.37-.14-.94-.3-1.97-.36C15.52 4 15.15 4 12 4Zm0 3.4a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2Zm0 1.8a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Zm5.86-2a1.08 1.08 0 1 1-2.16 0 1.08 1.08 0 0 1 2.16 0Z"/></svg>';

  function destroyLightboxPlayer() {
    if (state.lightboxPlayer && state.lightboxPlayer.destroy) {
      try { state.lightboxPlayer.destroy(); } catch (e) {}
    }
    state.lightboxPlayer = null;
  }

  function showLightboxVideoFallback(youtubeUrl) {
    var frame = document.getElementById("lightboxVideoFrame");
    if (!frame) return;
    // replace the whole aspect-ratio-locked frame (not just its contents) since the
    // fallback message isn't absolutely positioned the way the iframe/player is.
    var replacement = document.createElement("div");
    replacement.className = "lightbox-video-empty";
    replacement.innerHTML = "This video can't be played here.<br>" +
      '<a class="lightbox-fallback-link" href="' + escapeHtml(youtubeUrl) + '" target="_blank" rel="noopener noreferrer">▶ Watch on YouTube</a>';
    frame.replaceWith(replacement);
  }

  function openLightbox(row) {
    if (state.tv.active) { teardownTV(); resetVideo(); moveVideoPairHome(); }
    destroyLightboxPlayer();
    els.spotlightSidebar.classList.add("is-hidden-for-lightbox");
    state.lightboxRowNum = row.rowNum;
    document.title = (row.song || "Untitled") + (row.artist ? " — " + row.artist : "") + " | MVG Library";
    pushRecentlyViewed(row.rowNum);
    renderRecentList(state.rows);

    var id = extractYouTubeId(row.youtube);
    var videoHtml = id
      ? '<div class="lightbox-video-frame" id="lightboxVideoFrame"><div id="lightboxPlayerTarget"></div></div>'
      : '<div class="lightbox-video-empty">No video available for this entry.</div>';

    var sub = [];
    if (row.artist) sub.push(escapeHtml(row.artist));

    var tagHtml = row.category ? '<span class="tag ' + categoryTagClass(row.category) + '">' + escapeHtml(row.category) + "</span>" : "";
    var genreTags = (row.genres || []).map(function (g) {
      return '<span class="tag tag-default">' + escapeHtml(g) + "</span>";
    }).join("");

    var descHtml = row.description
      ? '<p class="lightbox-desc">' + escapeHtml(row.description) + "</p>"
      : '<p class="lightbox-desc placeholder">No writeup yet.</p>';

    var links = "";
    if (row.mvg) {
      links += '<a class="icon-btn" href="' + escapeHtml(row.mvg) + '" target="_blank" rel="noopener noreferrer" title="View on Instagram" aria-label="View on Instagram">' + ICON_INSTAGRAM + "</a>";
    }

    if (lightboxAdController) { lightboxAdController.stop(); lightboxAdController = null; }

    els.lightboxContent.innerHTML =
      '<div class="ad-placeholder" id="lightboxAdPlaceholder" hidden></div>' +
      videoHtml +
      '<div class="lightbox-body">' +
      '<div class="lightbox-title-row">' +
      '<h2 class="lightbox-title">' + escapeHtml(row.song || "(untitled)") + "</h2>" +
      '<div class="lightbox-title-actions">' +
      '<button type="button" class="lightbox-fav-btn' + (isFavorite(row.rowNum) ? " is-active" : "") + '" data-rownum="' + escapeHtml(row.rowNum) + '" title="Favorite" aria-label="Toggle favorite">' + (isFavorite(row.rowNum) ? "♥" : "♡") + "</button>" +
      '<button type="button" class="lightbox-widen-btn" title="Widen player" aria-label="Toggle player size">⤢</button>' +
      '<a class="lightbox-report-link" href="' + escapeHtml(reportFormUrl(row)) + '" target="_blank" rel="noopener noreferrer">Report issue</a>' +
      "</div>" +
      "</div>" +
      (sub.length ? '<p class="lightbox-subtitle">' + sub.join(" · ") + "</p>" : "") +
      '<div class="lightbox-tag-row">' + tagHtml + genreTags + "</div>" +
      creditsHtml(row) +
      descHtml +
      (links ? '<div class="lightbox-links">' + links + "</div>" : "") +
      lightboxRelatedHtml(row.director, row.rowNum) +
      "</div>";

    var lightboxAdEl = document.getElementById("lightboxAdPlaceholder");
    if (lightboxAdEl) lightboxAdController = renderAdSlideshowInto(lightboxAdEl, topAdsCache, TOP_AD_DEFAULT_SECONDS);

    els.lightbox.hidden = false;
    els.lightboxPanel.scrollTop = 0;
    lockBodyScroll();
    pushModalHistory();
    applyLightboxSize();

    if (id) {
      var rowNumAtOpen = row.rowNum;
      var youtubeUrl = row.youtube;
      loadYouTubeAPI(function () {
        // bail if the lightbox was closed or switched to another entry while the API was loading
        if (els.lightbox.hidden || state.lightboxRowNum !== rowNumAtOpen) return;
        state.lightboxPlayer = new YT.Player("lightboxPlayerTarget", {
          videoId: id,
          playerVars: { autoplay: 1, rel: 0 },
          events: {
            onError: function (e) {
              // 100: video not found/private, 101 & 150: embedding disabled by the owner
              if (e.data === 100 || e.data === 101 || e.data === 150) {
                destroyLightboxPlayer();
                showLightboxVideoFallback(youtubeUrl);
              }
            }
          }
        });
      });
    }
  }

  function closeLightbox() {
    if (els.lightbox.hidden) return;
    destroyLightboxPlayer();
    if (lightboxAdController) { lightboxAdController.stop(); lightboxAdController = null; }
    els.spotlightSidebar.classList.remove("is-hidden-for-lightbox");
    els.lightbox.hidden = true;
    els.lightboxContent.innerHTML = "";
    state.lightboxRowNum = null;
    document.title = DEFAULT_TITLE;
    unlockBodyScroll();
  }

  // Populated once real data loads -- same live-derived, always-current
  // lists the filter dropdowns use, so there's no separate static list to
  // maintain here.
  function buildSubmitDropdowns(rows) {
    function uniqueSorted(getValues) {
      var seen = {};
      rows.forEach(function (r) {
        getValues(r).forEach(function (v) { if (v) seen[v] = true; });
      });
      return Object.keys(seen).sort(function (a, b) { return a.localeCompare(b); });
    }

    var categories = uniqueSorted(function (r) { return [r.category]; });
    els.submitCategory.innerHTML = '<option value="">Choose…</option>' +
      categories.map(function (c) { return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + "</option>"; }).join("");

    var genres = uniqueSorted(function (r) { return r.genres || []; });
    els.submitGenre.innerHTML = '<option value="">Choose…</option>' +
      genres.map(function (g) { return '<option value="' + escapeHtml(g) + '">' + escapeHtml(g) + "</option>"; }).join("");

    var countries = uniqueSorted(function (r) { return r.country ? [normalizeCountry(r.country)] : []; });
    els.submitCountry.innerHTML = '<option value="">Choose…</option>' +
      countries.map(function (c) { return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + "</option>"; }).join("");
  }

  function openSubmitModal() {
    els.submitModal.hidden = false;
    els.submitModal.querySelector(".lightbox-panel").scrollTop = 0;
    lockBodyScroll();
    pushModalHistory();
  }

  function closeSubmitModal() {
    if (els.submitModal.hidden) return;
    els.submitModal.hidden = true;
    unlockBodyScroll();
  }

  els.openSubmitBtn.addEventListener("click", openSubmitModal);

  // Two mutually-exclusive mobile views (see styles.css): Home (browse --
  // Latest Submissions, ad banner, TV Mode, Featured) and Search (tabs,
  // search box, filters, results). Home is the default landing state;
  // Search is only entered via the bottom nav's Search button. No-op on
  // desktop, where both sets of sections are always shown regardless.
  var bottomNavViewButtons = [
    { btn: els.bottomNavHome, view: "home" },
    { btn: els.bottomNavSearch, view: "search" }
  ];

  function setMobileView(view) {
    state.mobileView = view;
    document.body.classList.toggle("mobile-view-home", view === "home");
    document.body.classList.toggle("mobile-view-search", view === "search");
    bottomNavViewButtons.forEach(function (entry) {
      entry.btn.classList.toggle("is-active", entry.view === view);
    });
  }

  setMobileView("home");

  els.bottomNavHome.addEventListener("click", function () {
    setMobileView("home");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  els.bottomNavSearch.addEventListener("click", function () {
    setMobileView("search");
    window.scrollTo({ top: 0, behavior: "smooth" });
    els.search.focus();
  });

  els.bottomNavFavorites.addEventListener("click", openFavoritesModal);

  els.bottomNavTV.addEventListener("click", function () {
    setMobileView("home");
    scrollBelowStickyHeader(els.videoEmbed);
  });

  els.bottomNavSettings.addEventListener("click", openSettingsModal);

  function closeHeaderMenu() {
    if (!els.headerLinks.classList.contains("is-open")) return;
    els.headerLinks.classList.remove("is-open");
    els.headerMenuBtn.setAttribute("aria-expanded", "false");
    unlockBodyScroll();
  }

  els.headerMenuBtn.addEventListener("click", function () {
    if (els.headerLinks.classList.contains("is-open")) {
      dismissTopModal();
      return;
    }
    els.headerLinks.classList.add("is-open");
    els.headerMenuBtn.setAttribute("aria-expanded", "true");
    lockBodyScroll();
    pushModalHistory();
  });

  // Closing on any link/button click inside the menu covers navigation,
  // opening a modal, or signing in/out -- all of which should collapse it.
  // The explicit close (X) button is a dismiss action, so it goes through
  // dismissTopModal() to consume the pushed history entry via a real back
  // navigation, same as the outside-click handler below.
  els.headerLinks.addEventListener("click", function (e) {
    if (e.target.closest("#headerMenuClose")) {
      dismissTopModal();
      return;
    }
    if (e.target.closest("a, button")) closeHeaderMenu();
  });

  document.addEventListener("click", function (e) {
    if (!els.headerLinks.classList.contains("is-open")) return;
    if (e.target.closest("#headerLinks") || e.target.closest("#headerMenuBtn")) return;
    dismissTopModal();
  });

  // Lets external links (e.g. an ad banner) open the submit modal directly,
  // e.g. https://mauimauricio83.github.io/MVG-Library/#submit -- doesn't
  // need state.rows loaded, so it's independent of applyDeepLinkFromHash().
  function applySubmitHash() {
    if (location.hash === "#submit") openSubmitModal();
  }
  window.addEventListener("hashchange", applySubmitHash);
  applySubmitHash();

  var THEME_KEY = "mvg-theme";

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    Array.prototype.forEach.call(els.themeToggle.querySelectorAll(".settings-theme-btn"), function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-theme-choice") === theme);
    });
  }

  els.themeToggle.addEventListener("click", function (e) {
    var btn = e.target.closest(".settings-theme-btn");
    if (!btn) return;
    var theme = btn.getAttribute("data-theme-choice");
    try { localStorage.setItem(THEME_KEY, theme); } catch (err) {}
    applyTheme(theme);
  });

  function openRecentModal() {
    renderRecentList(state.rows);
    els.recentModal.hidden = false;
    els.recentModal.querySelector(".lightbox-panel").scrollTop = 0;
    lockBodyScroll();
    pushModalHistory();
  }

  function closeRecentModal() {
    if (els.recentModal.hidden) return;
    els.recentModal.hidden = true;
    unlockBodyScroll();
  }

  els.openRecentBtn.addEventListener("click", openRecentModal);

  els.recentModal.addEventListener("click", function (e) {
    if (e.target.closest(".lightbox-close") || e.target.closest(".lightbox-backdrop")) {
      dismissTopModal();
      return;
    }
    var item = e.target.closest(".recent-item");
    if (item) {
      var row = findRowByNum(item.getAttribute("data-row"));
      if (row) {
        closeRecentModal();
        openLightbox(row);
      }
    }
  });

  function openFavoritesModal() {
    renderFavoritesStrip(state.rows);
    renderFavoritesModalList();
    els.favoritesModal.hidden = false;
    els.favoritesModal.querySelector(".lightbox-panel").scrollTop = 0;
    lockBodyScroll();
    pushModalHistory();
  }

  function closeFavoritesModal() {
    if (els.favoritesModal.hidden) return;
    els.favoritesModal.hidden = true;
    unlockBodyScroll();
  }

  els.favoritesModal.addEventListener("click", function (e) {
    if (e.target.closest(".lightbox-close") || e.target.closest(".lightbox-backdrop")) {
      dismissTopModal();
      return;
    }
    var item = e.target.closest(".recent-item");
    if (item) {
      var row = findRowByNum(item.getAttribute("data-row"));
      if (row) {
        closeFavoritesModal();
        openLightbox(row);
      }
    }
  });

  els.favoritesModalPlayAll.addEventListener("click", function () {
    startTVMode(favoritesPool.filter(function (r) { return !!r.youtube; }));
  });

  function openSettingsModal() {
    els.settingsSyncNote.hidden = !currentUser;
    els.settingsStatus.hidden = true;
    var currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(currentTheme);
    els.settingsModal.hidden = false;
    els.settingsModal.querySelector(".lightbox-panel").scrollTop = 0;
    lockBodyScroll();
    pushModalHistory();
  }

  function closeSettingsModal() {
    if (els.settingsModal.hidden) return;
    els.settingsModal.hidden = true;
    unlockBodyScroll();
  }

  els.openSettingsBtn.addEventListener("click", openSettingsModal);

  els.settingsModal.addEventListener("click", function (e) {
    if (e.target.closest(".lightbox-close") || e.target.closest(".lightbox-backdrop")) dismissTopModal();
  });

  els.clearRecentBtn.addEventListener("click", function () {
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch (e) {}
    // pushToFirestore() sends the now-empty list, so the account copy is
    // cleared too rather than resurrecting the history on next sign-in.
    pushToFirestore();
    renderRecentList(state.rows);
    els.settingsStatus.textContent = "Recently Viewed history cleared.";
    els.settingsStatus.hidden = false;
  });

  els.submitModal.addEventListener("click", function (e) {
    if (e.target.closest(".lightbox-close") || e.target.closest(".lightbox-backdrop")) dismissTopModal();
  });

  els.submitForm.addEventListener("submit", function (e) {
    e.preventDefault();

    var formData = new FormData(els.submitForm);
    // Honeypot: real visitors never see or fill this field.
    if (formData.get("website")) return;

    if (!SUBMIT_WEBAPP_URL) {
      console.error("SUBMIT_WEBAPP_URL isn't configured yet.");
      return;
    }

    els.submitFormBtn.disabled = true;
    els.submitFormStatus.hidden = true;

    fetch(SUBMIT_WEBAPP_URL, { method: "POST", body: formData })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        els.submitFormStatus.textContent = "Thanks! We'll review it and add it to the library.";
        els.submitFormStatus.className = "submit-form-status is-success";
        els.submitFormStatus.hidden = false;
        els.submitForm.reset();
        setTimeout(closeSubmitModal, 2200);
      })
      .catch(function (err) {
        console.error("Submission failed:", err);
        els.submitFormStatus.textContent = "Something went wrong -- please try again in a moment.";
        els.submitFormStatus.className = "submit-form-status is-error";
        els.submitFormStatus.hidden = false;
      })
      .finally(function () {
        els.submitFormBtn.disabled = false;
      });
  });

  // The widen button lives inside the per-entry HTML openLightbox() regenerates,
  // so it's queried fresh each time rather than cached — a stale reference would
  // point at a node that's already gone.
  function applyLightboxSize() {
    var isLarge = state.lightboxSize === "large";
    els.lightboxPanel.classList.toggle("size-large", isLarge);
    var btn = els.lightboxContent.querySelector(".lightbox-widen-btn");
    if (!btn) return;
    btn.textContent = isLarge ? "⤡" : "⤢";
    btn.title = isLarge ? "Shrink player" : "Widen player";
  }

  els.lightbox.addEventListener("click", function (e) {
    if (e.target.closest(".lightbox-close") || e.target.closest(".lightbox-backdrop")) {
      dismissTopModal();
      return;
    }
    if (e.target.closest(".lightbox-widen-btn")) {
      state.lightboxSize = state.lightboxSize === "large" ? "small" : "large";
      saveLightboxSizePref(state.lightboxSize);
      applyLightboxSize();
      return;
    }
    var favBtn = e.target.closest(".lightbox-fav-btn");
    if (favBtn) {
      var nowFavorite = toggleFavorite(favBtn.getAttribute("data-rownum"));
      favBtn.classList.toggle("is-active", nowFavorite);
      favBtn.textContent = nowFavorite ? "♥" : "♡";
      renderFavoritesStrip(state.rows);
      return;
    }
    var relBtn = e.target.closest(".related-btn");
    if (relBtn) {
      var row = findRowByNum(relBtn.getAttribute("data-row"));
      if (row) openLightbox(row);
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var anyOpen = !els.lightbox.hidden || !els.submitModal.hidden || !els.settingsModal.hidden ||
      !els.recentModal.hidden || !els.favoritesModal.hidden || els.headerLinks.classList.contains("is-open");
    if (anyOpen) dismissTopModal();
  });

  document.addEventListener("click", function (e) {
    var tip = e.target.closest ? e.target.closest(".info-tip") : null;
    document.querySelectorAll(".info-tip.is-open").forEach(function (el) {
      if (el !== tip) el.classList.remove("is-open");
    });
    if (tip) tip.classList.toggle("is-open");
  });

  function renderEntry(row) {
    var sub = [];
    if (state.view !== "artist" && row.artist) sub.push(escapeHtml(row.artist));
    if (state.view !== "director" && row.director) sub.push("Dir. " + escapeHtml(row.director));
    if (row.year) sub.push(escapeHtml(row.year));

    var links = "";
    if (row.mvg) {
      links += '<a class="icon-btn" href="' + escapeHtml(row.mvg) + '" target="_blank" rel="noopener noreferrer" title="View on Instagram" aria-label="View on Instagram">' + ICON_INSTAGRAM + "</a>";
    }

    var newBadge = state.recentSet[row.rowNum] ? '<span class="new-badge">New</span>' : "";

    return (
      '<li class="entry" data-row="' + escapeHtml(row.rowNum) + '">' +
      '<div class="entry-row" role="button" tabindex="0" aria-haspopup="dialog">' +
      '<span class="entry-chevron" aria-hidden="true">&#9656;</span>' +
      '<span class="entry-main">' +
      '<span class="entry-title">' + escapeHtml(row.song || "(untitled)") + newBadge + "</span>" +
      (sub.length ? '<span class="entry-sub">' + sub.join(" &middot; ") + "</span>" : "") +
      "</span>" +
      (row.category ? '<span class="tag ' + categoryTagClass(row.category) + '">' + escapeHtml(row.category) + "</span>" : "") +
      (links ? '<span class="entry-links">' + links + "</span>" : "") +
      "</div>" +
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

  var renderToken = 0;
  var CHUNK_ENTRY_BUDGET = 150;

  function renderSectionsChunked(sections, startIndex, myToken) {
    if (myToken !== renderToken) return;
    var html = "";
    var budget = CHUNK_ENTRY_BUDGET;
    var i = startIndex;
    while (i < sections.length && budget > 0) {
      var section = sections[i];
      html += renderGroupSection(section.id, section.heading, section.rows);
      budget -= section.rows.length;
      i++;
    }
    if (html) els.results.insertAdjacentHTML("beforeend", html);
    if (i < sections.length) {
      requestAnimationFrame(function () { renderSectionsChunked(sections, i, myToken); });
    }
  }

  function render(sync) {
    moveVideoPairHome();
    updateFiltersToggleCount();
    // On mobile, Featured sits between the search box and the results list,
    // so while actively typing (results often obscured further by the
    // on-screen keyboard) it just pushes the results the user is looking
    // for further down. Hidden via CSS (see styles.css) while searching.
    document.body.classList.toggle("is-searching", !!state.query);
    var myToken = ++renderToken;

    var baseFiltered = state.rows.filter(matchesBaseFilters);
    var availableLetters = {};
    baseFiltered.forEach(function (row) {
      availableLetters[letterBucket(viewFieldFor(row))] = true;
    });
    renderJumpNav(availableLetters);

    // Rendering all ~12,000+ rows up front is the single biggest cost on first
    // load. Nothing is filtered/searched/letter-jumped yet, so there's nothing
    // useful to show anyway — skip the render entirely until the user acts.
    // TV Mode is unaffected: it reads state.rows directly, not this DOM.
    if (!state.query && !hasActiveFilters()) {
      els.results.innerHTML = '<div class="empty-state">' + escapeHtml(categoryBreakdownText(state.rows)) + "</div>";
      els.jumpBottom.hidden = true;
      els.spotlightSidebar.hidden = true;
      return;
    }

    var filtered = state.activeLetter ? baseFiltered.filter(matchesLetter) : baseFiltered;

    if (!filtered.length) {
      if (hasActiveFilters()) {
        els.results.innerHTML = '<div class="empty-state">No entries match the current filters' +
          (state.query ? ' for "' + escapeHtml(state.query) + '"' : "") + '.<br>' +
          '<button type="button" class="clear-filters-btn">Clear filters</button></div>';
      } else {
        els.results.innerHTML = '<div class="empty-state">No entries match your search.</div>';
      }
      els.jumpBottom.hidden = true;
      els.spotlightSidebar.hidden = true;
      return;
    }

    els.jumpBottom.hidden = false;
    if (hasSpotlightContent) {
      els.spotlightSidebar.hidden = false;
      positionSpotlightSidebar();
    } else {
      els.spotlightSidebar.hidden = true;
    }

    var groupIdCounter = 0;
    var sections;

    if (state.view === "song") {
      var byLetter = groupBy(filtered, function (r) { return letterBucket(r.song); });
      var keys = sortByJumpLetter(Object.keys(byLetter));
      sections = keys.map(function (key) {
        return { id: "grp-" + groupIdCounter++, heading: key, rows: sortByField(byLetter[key], "song") };
      });
    } else {
      var keyFn = state.view === "director" ? function (r) { return r.director; } : function (r) { return r.artist; };
      var groups = groupBy(filtered, keyFn);
      var names = sortedKeys(groups);
      sections = names.map(function (name) {
        return { id: "grp-" + groupIdCounter++, heading: name, rows: sortByField(groups[name], "song") };
      });
    }

    els.results.innerHTML = "";

    if (sync) {
      var html = sections.map(function (s) { return renderGroupSection(s.id, s.heading, s.rows); }).join("");
      els.results.innerHTML = html;
    } else {
      renderSectionsChunked(sections, 0, myToken);
    }
  }

  function renderJumpNav(availableLetters) {
    var html = JUMP_LETTERS.filter(function (letter) {
      return availableLetters.hasOwnProperty(letter);
    }).map(function (letter) {
      var active = state.activeLetter === letter;
      return '<button class="jump-btn' + (active ? " active" : "") + '" data-letter="' + letter + '">' + letter + "</button>";
    }).join("");
    els.jumpTop.innerHTML = html;
    els.jumpBottom.innerHTML = html;
  }

  function onJumpClick(e) {
    var btn = e.target.closest(".jump-btn");
    if (!btn || btn.disabled) return;
    var letter = btn.getAttribute("data-letter");
    state.activeLetter = state.activeLetter === letter ? null : letter;
    render();
  }

  els.jumpTop.addEventListener("click", onJumpClick);
  els.jumpBottom.addEventListener("click", onJumpClick);

  function handleEntryActivate(rowEl) {
    var li = rowEl.closest(".entry");
    if (!li) return;
    var rowNum = li.getAttribute("data-row");
    var row = findRowByNum(rowNum);
    if (row) openLightbox(row);
  }

  els.results.addEventListener("click", function (e) {
    if (e.target.closest(".clear-filters-btn")) {
      clearAllFilters();
      render();
      return;
    }
    if (e.target.closest("a")) return;
    var row = e.target.closest(".entry-row");
    if (row) handleEntryActivate(row);
  });

  els.results.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var row = e.target.closest(".entry-row");
    if (row) {
      e.preventDefault();
      handleEntryActivate(row);
    }
  });

  function setActiveTab(view) {
    state.view = view;
    state.activeLetter = null;
    els.tabs.forEach(function (t) {
      var active = t.getAttribute("data-view") === view;
      t.classList.toggle("active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  els.tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      setActiveTab(tab.getAttribute("data-view"));
      render();
    });
  });

  function applyDeepLinkFromHash() {
    var m = location.hash.match(/^#row-(.+)$/);
    if (!m || !state.rows.length) return;
    var rowNum = decodeURIComponent(m[1]);
    var row = findRowByNum(rowNum);
    if (!row) return;
    openLightbox(row);
  }

  window.addEventListener("hashchange", applyDeepLinkFromHash);

  var searchTimer = null;
  els.search.addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.query = els.search.value.trim();
      if (state.query) state.activeLetter = null;
      render();
    }, 120);
  });

  els.signInBtn.addEventListener("click", function () {
    auth.signInWithPopup(googleProvider).catch(function (err) {
      console.error("Sign-in failed:", err);
    });
  });

  els.signOutBtn.addEventListener("click", function () {
    auth.signOut();
  });

  auth.onAuthStateChanged(function (user) {
    currentUser = user;
    els.signInBtn.hidden = !!user;
    els.headerAccount.hidden = !user;
    if (user) {
      els.headerAvatar.src = user.photoURL || "";
      els.headerUserName.textContent = user.displayName || user.email || "";
      syncFromFirestore();
    }
  });

  fetchData();
  fetchSidebarAds();
  fetchTopAds();
})();
