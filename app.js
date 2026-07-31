(function () {
  "use strict";

  var APP_VERSION = "5.4.0"; // bump alongside CHANGELOG.md on each meaningful commit

  var DEFAULT_TITLE = document.title;

  var CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRfeg4mWGWZgOc5ZC-84iBQP3XM4TBopECjBg8moFHmKj0pfOCID05iSC2Xfmf3Y4X8W5PP5r_GCY7a/pub?gid=1998671230&single=true&output=csv";

  // Published catalog snapshot (Firestore `videos` collection, written by
  // the admin panel's Publish button / scripts/publish-snapshot.js) -- the
  // public site reads this instead of the CSV above, so per-visitor cost
  // stays one cheap cacheable GET regardless of how much admin write
  // traffic happens. Storage rules make this path publicly readable, so no
  // download token is needed in the URL.
  var SNAPSHOT_URL = "https://firebasestorage.googleapis.com/v0/b/mvg-library.firebasestorage.app/o/catalog%2Fsnapshot.json?alt=media";

  // Rough decompressed size of the snapshot, used only to drive the loading
  // bar's percentage (see fetchJsonWithProgress) -- doesn't need to be exact,
  // just close enough that the bar reaches ~100% around when the fetch
  // actually finishes. Bump occasionally as the catalog grows.
  var SNAPSHOT_APPROX_BYTES = 24000000;

  // Latest blog posts from themusicvideoguy.com/news -- written same-origin
  // by scripts/fetch-blog-latest.js (daily GitHub Action, same one that
  // regenerates the SEO hub pages) since Squarespace's own JSON feed has no
  // CORS headers and can't be fetched directly from this domain.
  var BLOG_LATEST_URL = "blog-latest.json";

  // Ad slideshow, sourced from a small published sheet -- columns: Seconds
  // (how long that ad shows before advancing), Image, Link.
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
    loadingBar: document.getElementById("loadingBar"),
    loadingBarFill: document.getElementById("loadingBarFill"),
    loadingBanner: document.getElementById("loadingBanner"),
    loadingBannerText: document.getElementById("loadingBannerText"),
    loadingBannerPercent: document.getElementById("loadingBannerPercent"),
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
    tvGenreGrid: document.getElementById("tvGenreGrid"),
    tvYearDial: document.getElementById("tvYearDial"),
    mvgOnlyLabel: document.getElementById("mvgOnlyLabel"),
    mvgOnlyTip: document.getElementById("mvgOnlyTip"),
    genreTip: document.getElementById("genreTip"),
    countryFilter: document.getElementById("countryFilter"),
    mvgOnlyToggle: document.getElementById("mvgOnlyToggle"),
    filtersToggle: document.getElementById("filtersToggle"),
    filtersPanel: document.getElementById("filtersPanel"),
    filtersGroup: document.getElementById("filtersGroup"),
    tvModal: document.getElementById("tvModal"),
    tvAdPlaceholder: document.getElementById("tvAdPlaceholder"),
    tvFiltersSlot: document.getElementById("tvFiltersSlot"),
    filtersToggleCount: document.getElementById("filtersToggleCount"),
    clearFiltersBtn: document.getElementById("clearFiltersBtn"),
    tvSkipBtn: document.getElementById("tvSkipBtn"),
    tvReportLink: document.getElementById("tvReportLink"),
    tvPowerSwitch: document.getElementById("tvPowerSwitch"),
    tvAdminEditBtn: document.getElementById("tvAdminEditBtn"),
    tvAdminDeleteBtn: document.getElementById("tvAdminDeleteBtn"),
    tvFavBtn: document.getElementById("tvFavBtn"),
    tvInfoBtn: document.getElementById("tvInfoBtn"),
    tvInfoPanel: document.getElementById("tvInfoPanel"),
    tvFilterTabs: document.getElementById("tvFilterTabs"),
    tvYearDialRing: document.getElementById("tvYearDialRing"),
    tvYearLever: document.getElementById("tvYearLever"),
    tvCustomPane: document.getElementById("tvCustomPane"),
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
    favoritesTitle: document.getElementById("favoritesTitle"),
    favoritesShareBtn: document.getElementById("favoritesShareBtn"),
    favoritesShareStatus: document.getElementById("favoritesShareStatus"),
    favoritesSeeMoreBtn: document.getElementById("favoritesSeeMoreBtn"),
    openRecentBtn: document.getElementById("openRecentBtn"),
    recentModal: document.getElementById("recentModal"),
    recentModalClose: document.getElementById("recentModalClose"),
    recentList: document.getElementById("recentList"),
    latestCollapseBtn: document.getElementById("latestCollapseBtn"),
    featuredCollapseBtn: document.getElementById("featuredCollapseBtn"),
    latestSeeMoreBtn: document.getElementById("latestSeeMoreBtn"),
    featuredSeeMoreBtn: document.getElementById("featuredSeeMoreBtn"),
    spotlightSidebar: document.getElementById("spotlightSidebar"),
    spotlightCards: document.getElementById("spotlightCards"),
    blogLatestSidebar: document.getElementById("blogLatestSidebar"),
    blogLatestCards: document.getElementById("blogLatestCards"),
    blogLatestExtra: document.getElementById("blogLatestExtra"),
    appFooter: document.getElementById("appFooter"),
    signInBtn: document.getElementById("signInBtn"),
    topBarSignInBtn: document.getElementById("topBarSignInBtn"),
    signOutBtn: document.getElementById("signOutBtn"),
    headerAccount: document.getElementById("headerAccount"),
    headerAvatar: document.getElementById("headerAvatar"),
    headerUserName: document.getElementById("headerUserName"),
    sidebarHomeBtn: document.getElementById("sidebarHomeBtn"),
    topBarHomeLink: document.getElementById("topBarHomeLink"),
    sidebarTVBtn: document.getElementById("sidebarTVBtn"),
    sidebarFavoritesBtn: document.getElementById("sidebarFavoritesBtn"),
    topBarSearchInput: document.getElementById("topBarSearchInput"),
    topBarSearchClear: document.getElementById("topBarSearchClear"),
    topBarSettingsBtn: document.getElementById("topBarSettingsBtn"),
    topBarAdminBtn: document.getElementById("topBarAdminBtn"),
    openSubmitBtn: document.getElementById("openSubmitBtn"),
    submitModal: document.getElementById("submitModal"),
    submitClose: document.getElementById("submitClose"),
    submitForm: document.getElementById("submitForm"),
    submitCategory: document.getElementById("submitCategory"),
    submitGenre: document.getElementById("submitGenre"),
    submitCountry: document.getElementById("submitCountry"),
    submitFormBtn: document.getElementById("submitFormBtn"),
    submitFormStatus: document.getElementById("submitFormStatus"),
    submitThanksModal: document.getElementById("submitThanksModal"),
    submitThanksBack: document.getElementById("submitThanksBack"),
    submitThanksAgain: document.getElementById("submitThanksAgain"),
    msgBoardTab: document.getElementById("msgBoardTab"),
    msgBoardPanel: document.getElementById("msgBoardPanel"),
    msgBoardClose: document.getElementById("msgBoardClose"),
    msgBoardMessages: document.getElementById("msgBoardMessages"),
    msgBoardForm: document.getElementById("msgBoardForm"),
    msgBoardInput: document.getElementById("msgBoardInput"),
    msgBoardSigninNote: document.getElementById("msgBoardSigninNote"),
    msgBoardSignInBtn: document.getElementById("msgBoardSignInBtn"),
    msgBoardBlockedNote: document.getElementById("msgBoardBlockedNote"),
    headerMenuBtn: document.getElementById("headerMenuBtn"),
    headerLinks: document.getElementById("headerLinks"),
    headerMenuClose: document.getElementById("headerMenuClose"),
    bottomNavHome: document.getElementById("bottomNavHome"),
    bottomNavFavorites: document.getElementById("bottomNavFavorites"),
    bottomNavSearch: document.getElementById("bottomNavSearch"),
    bottomNavTV: document.getElementById("bottomNavTV"),
    bottomNavSettings: document.getElementById("bottomNavSettings"),
    openPodcastBtn: document.getElementById("openPodcastBtn"),
    podcastModal: document.getElementById("podcastModal"),
    podcastModalClose: document.getElementById("podcastModalClose"),
    openAdminBtn: document.getElementById("openAdminBtn"),
    adminModal: document.getElementById("adminModal"),
    adminClose: document.getElementById("adminClose"),
    adminLandingView: document.getElementById("adminLandingView"),
    adminGoManageBtn: document.getElementById("adminGoManageBtn"),
    adminGoAddBtn: document.getElementById("adminGoAddBtn"),
    adminGoBulkBtn: document.getElementById("adminGoBulkBtn"),
    adminGoPublishBtn: document.getElementById("adminGoPublishBtn"),
    adminLandingStatus: document.getElementById("adminLandingStatus"),
    adminBackBtn: document.getElementById("adminBackBtn"),
    adminStatus: document.getElementById("adminStatus"),
    adminEntriesList: document.getElementById("adminEntriesList"),
    adminSearchInput: document.getElementById("adminSearchInput"),
    adminListView: document.getElementById("adminListView"),
    adminAddBtn: document.getElementById("adminAddBtn"),
    adminForm: document.getElementById("adminForm"),
    adminFormTitle: document.getElementById("adminFormTitle"),
    adminFormCancelBtn: document.getElementById("adminFormCancelBtn"),
    adminFormSaveBtn: document.getElementById("adminFormSaveBtn"),
    adminFormStatus: document.getElementById("adminFormStatus"),
    adminBulkBtn: document.getElementById("adminBulkBtn"),
    adminBulkView: document.getElementById("adminBulkView"),
    adminBulkTextarea: document.getElementById("adminBulkTextarea"),
    adminBulkPreviewBtn: document.getElementById("adminBulkPreviewBtn"),
    adminBulkCancelBtn: document.getElementById("adminBulkCancelBtn"),
    adminBulkStatus: document.getElementById("adminBulkStatus"),
    adminBulkPreview: document.getElementById("adminBulkPreview"),
    adminBulkCommitRow: document.getElementById("adminBulkCommitRow"),
    adminBulkCommitBtn: document.getElementById("adminBulkCommitBtn"),
    adminPublishBtn: document.getElementById("adminPublishBtn"),
    openSettingsBtn: document.getElementById("openSettingsBtn"),
    settingsModal: document.getElementById("settingsModal"),
    settingsSyncNote: document.getElementById("settingsSyncNote"),
    clearRecentBtn: document.getElementById("clearRecentBtn"),
    favoritesSyncNote: document.getElementById("favoritesSyncNote"),
    clearFavoritesBtn: document.getElementById("clearFavoritesBtn"),
    shareFavoritesBtn: document.getElementById("shareFavoritesBtn"),
    autoplayToggle: document.getElementById("autoplayToggle"),
    themeToggle: document.getElementById("themeToggle"),
    settingsStatus: document.getElementById("settingsStatus")
  };

  els.appFooter.innerHTML = "v" + APP_VERSION + " · Created by MnC · 2026" +
    ' <a href="cloud.html" class="cloud-link" aria-label="Word Cloud"><span>c</span><span>l</span><span>o</span><span>u</span><span>d</span></a>';

  var LATEST_STRIP_COUNT = 50;
  var SPOTLIGHT_COUNT = 6; // desktop grid shows all 6; mobile caps the visible count via CSS (see .spotlight-card:nth-child)

  var YEAR_NONE = "__no-year__";
  var GENRE_NONE = "__no-genre__";
  var COUNTRY_NONE = "__no-country__";

  // TV Mode swaps the shared Year/Genre filters for coarser, browsing-
  // friendlier buckets (see enterTVFilterMode/exitTVFilterMode) -- exact
  // year/genre picking makes sense when you're hunting for something
  // specific on Search, but is too fussy for "surprise me" channel surfing.
  // Year has three granularities, switched via the dial's lever (see
  // tvYearBucketForRow/state.tvYearGranularity): Eras (this list -- 2000s/
  // 90s/80s/70s each split into three, "Years" for the dial-lever value,
  // not to be confused with TV_YEAR_* below), Decades (coarser, no splits),
  // and Years (exact, computed from the data -- see activeYearBuckets()).
  var TV_ERA_BUCKETS = [
    { key: "2020s", label: "2020s", shortLabel: "20s", min: 2020, max: 2029 },
    { key: "2010s", label: "2010s", shortLabel: "10s", min: 2010, max: 2019 },
    { key: "2000s-late", label: "Late-2000s", shortLabel: "L00s", min: 2007, max: 2009 },
    { key: "2000s-mid", label: "Mid-2000s", shortLabel: "M00s", min: 2004, max: 2006 },
    { key: "2000s-early", label: "Early-2000s", shortLabel: "E00s", min: 2000, max: 2003 },
    { key: "1990s-late", label: "Late-90s", shortLabel: "L90s", min: 1997, max: 1999 },
    { key: "1990s-mid", label: "Mid-90s", shortLabel: "M90s", min: 1994, max: 1996 },
    { key: "1990s-early", label: "Early-90s", shortLabel: "E90s", min: 1990, max: 1993 },
    { key: "1980s-late", label: "Late-80s", shortLabel: "L80s", min: 1987, max: 1989 },
    { key: "1980s-mid", label: "Mid-80s", shortLabel: "M80s", min: 1984, max: 1986 },
    { key: "1980s-early", label: "Early-80s", shortLabel: "E80s", min: 1980, max: 1983 },
    { key: "1970s-late", label: "Late-70s", shortLabel: "L70s", min: 1977, max: 1979 },
    { key: "1970s-mid", label: "Mid-70s", shortLabel: "M70s", min: 1974, max: 1976 },
    { key: "1970s-early", label: "Early-70s", shortLabel: "E70s", min: 1970, max: 1973 },
    { key: "pre-mv", label: "Pre-Music Video", shortLabel: "Pre-MV", min: -Infinity, max: 1969 }
  ];

  // Coarser than TV_ERA_BUCKETS -- no Early/Mid/Late split, just the plain
  // decade.
  var TV_DECADE_BUCKETS = [
    { key: "d-2020s", label: "2020s", shortLabel: "20s", min: 2020, max: 2029 },
    { key: "d-2010s", label: "2010s", shortLabel: "10s", min: 2010, max: 2019 },
    { key: "d-2000s", label: "2000s", shortLabel: "00s", min: 2000, max: 2009 },
    { key: "d-1990s", label: "90s", shortLabel: "90s", min: 1990, max: 1999 },
    { key: "d-1980s", label: "80s", shortLabel: "80s", min: 1980, max: 1989 },
    { key: "d-1970s", label: "70s", shortLabel: "70s", min: 1970, max: 1979 },
    { key: "d-pre-mv", label: "Pre-Music Video", shortLabel: "Pre", min: -Infinity, max: 1969 }
  ];

  // 10 broad groups covering the catalog's ~190 distinct genre tags. Exact
  // tags not listed here (new/rare ones) fall back to "other" rather than
  // breaking the grouping.
  var TV_GENRE_GROUPS = [
    { key: "pop", label: "Pop", color: "#ef5b5b" },
    { key: "rock", label: "Rock", color: "#f4b942" },
    { key: "metal-punk", label: "Metal & Punk", color: "#8a5cf6" },
    { key: "hiphop", label: "Hip-Hop/Rap", color: "#ff8c42" },
    { key: "rnb", label: "R&B/Soul/Funk", color: "#e0568c" },
    { key: "electronic", label: "Electronic/Dance", color: "#33c9dc" },
    { key: "country", label: "Country/Folk", color: "#b5834d" },
    { key: "world", label: "Latin/World/Reggae", color: "#4caf6e" },
    { key: "jazz", label: "Jazz/Blues/Classical", color: "#6f93ea" },
    { key: "other", label: "Other", color: "#9aa0a6" }
  ];

  var TV_GENRE_MAP = {
    "Pop": "pop", "Pop Rock": "pop", "Pop/Rock": "pop", "Teen Pop": "pop", "Euro Pop": "pop",
    "French Pop": "pop", "K-Pop": "pop", "J-Pop": "pop", "Indie Pop": "pop", "P-Pop": "pop",
    "Mandopop": "pop", "Punjabi Pop": "pop", "Indian Pop": "pop", "Korean Pop": "pop",
    "Vocal Pop": "pop", "Traditional Vocal Pop": "pop", "Britpop": "pop", "Christmas: Pop": "pop",
    "Arabic Pop": "pop",

    "Rock": "rock", "Alternative": "rock", "Alternative Rock": "rock", "Indie Rock": "rock",
    "Classic Rock": "rock", "Hard Rock": "rock", "New Wave & Post-Punk": "rock", "New Wave": "rock",
    "Southern Rock": "rock", "Arena Rock": "rock", "Prog-Rock/Art Rock": "rock", "Progressive": "rock",
    "Psychedelic Rock": "rock", "Psychedelic": "rock", "Folk-Rock": "rock", "Soft Rock": "rock",
    "Goth Rock": "rock", "Goth & Industrial": "rock", "Japanese Rock": "rock", "Chinese Rock": "rock",
    "American Alternative": "rock", "British Alternative": "rock", "Album-Oriented Rock (AOR)": "rock",
    "Indie & Lo-Fi": "rock", "Rock & Roll": "rock",

    "Metal": "metal-punk", "Heavy Metal": "metal-punk", "Hard Rock & Metal": "metal-punk",
    "Thrash & Speed Metal": "metal-punk", "Death Metal": "metal-punk", "Death Metal/Black Metal": "metal-punk",
    "Pop Metal": "metal-punk", "Hair Metal": "metal-punk", "Punk": "metal-punk",
    "Hardcore & Punk": "metal-punk", "Pop Punk": "metal-punk", "Industrial": "metal-punk",

    "Rap/Hip Hop": "hiphop", "Gangsta & Hardcore": "hiphop", "Gangsta Rap": "hiphop",
    "Old School Rap": "hiphop", "West Coast Rap": "hiphop", "East Coast Rap": "hiphop",
    "Southern Rap": "hiphop", "Pop Rap": "hiphop", "Alternative Rap": "hiphop",
    "Experimental Rap": "hiphop", "Hardcore Rap": "hiphop", "Dirty South": "hiphop",
    "Freestyle": "hiphop", "East Coast": "hiphop", "West Coast": "hiphop",

    "R&B/Soul": "rnb", "R&B": "rnb", "Contemporary R&B": "rnb", "Neo-Soul": "rnb",
    "Soul": "rnb", "Classic R&B": "rnb", "Funk": "rnb",

    "Electronic": "electronic", "Dance": "electronic", "Dance & Electronic": "electronic",
    "Electronica": "electronic", "House": "electronic", "Techno": "electronic", "Trance": "electronic",
    "Dubstep": "electronic", "Drum & Bass": "electronic", "Breakbeat": "electronic",
    "Downtempo": "electronic", "IDM/Experimental": "electronic", "Big Beat": "electronic",
    "Ambient": "electronic", "Jungle/Drum'n'bass": "electronic", "Afro House": "electronic",
    "World Dance": "electronic", "Alternative Dance": "electronic", "Bass": "electronic",

    "Country": "country", "Contemporary Country": "country", "Traditional Country": "country",
    "Alt-Country & Americana": "country", "Country & Bluegrass": "country", "Bluegrass": "country",
    "Americana": "country", "Honky-Tonk": "country", "Folk": "country", "Contemporary Folk": "country",
    "Alternative Folk": "country", "Traditional Folk": "country", "Singer/Songwriter": "country",
    "Singer Songwriter": "country", "Contemporary Singer/Songwriter": "country", "Roots Rock": "country",
    "Country Gospel": "country",

    "Latin Music": "world", "Raices": "world", "International": "world", "World": "world",
    "Worldwide": "world", "Caribbean & Cuba": "world", "Reggae": "world", "Dancehall": "world",
    "Modern Dancehall": "world", "Afrobeats": "world", "Afro-Beat": "world", "Africa": "world",
    "North African": "world", "Middle East": "world", "Far East & Asia": "world", "Bollywood": "world",
    "Regional Indian": "world", "Tamil": "world", "Europe": "world", "Ska": "world",

    "Jazz": "jazz", "Vocal Jazz": "jazz", "Bebop": "jazz", "Avant Garde & Free Jazz": "jazz",
    "Traditional Jazz & Ragtime": "jazz", "Jazz Fusion": "jazz", "Classical": "jazz",
    "Classical Crossover": "jazz", "Blues": "jazz", "Chicago Blues": "jazz", "Delta Blues": "jazz",
    "Acoustic Blues": "jazz", "Electric Blues Guitar": "jazz", "Modern Blues": "jazz",
    "Contemporary Blues": "jazz", "Standards": "jazz", "Big Band": "jazz", "Easy Listening": "jazz",
    "Lounge": "jazz", "New Age": "jazz",

    "Soundtrack": "other", "Soundtracks": "other", "Original Score": "other", "Musicals": "other",
    "Broadway & Vocalists": "other", "Christian": "other", "Christian & Gospel": "other",
    "Christian Contemporary Music": "other", "CCM": "other", "Gospel": "other", "Holiday": "other",
    "Christmas": "other", "Christmas: R&B": "other", "Children's Music": "other", "Lullabies": "other",
    "Sing-A-Longs": "other", "Comedy": "other", "Standup Comedy": "other",
    "Poetry, Spoken Word & Interviews": "other", "Spoken Word": "other", "Karaoke": "other",
    "Educational": "other", "Environmental": "other", "Meditation": "other",
    "Fitness & Workout": "other", "Vocal": "other", "Instrumental": "other", "Miscellaneous": "other",
    "Oldies & Retro": "other", "Oldies": "other", "Old School": "other", "Tribute": "other",
    "Styles": "other", "Music": "other"
  };

  function tvEraBucketFor(yearValue) {
    var y = parseInt(yearValue, 10);
    if (isNaN(y)) return "pre-mv";
    for (var i = 0; i < TV_ERA_BUCKETS.length; i++) {
      var b = TV_ERA_BUCKETS[i];
      if (y >= b.min && y <= b.max) return b.key;
    }
    return "pre-mv";
  }

  function tvDecadeBucketFor(yearValue) {
    var y = parseInt(yearValue, 10);
    if (isNaN(y)) return "d-pre-mv";
    for (var i = 0; i < TV_DECADE_BUCKETS.length; i++) {
      var b = TV_DECADE_BUCKETS[i];
      if (y >= b.min && y <= b.max) return b.key;
    }
    return "d-pre-mv";
  }

  // Dispatches on state.tvYearGranularity (set by the dial's lever -- see
  // #tvYearLever) so matchesYear() and renderTVYearDial() share one
  // definition of "which bucket does this row fall into." "years" mode has
  // no fixed bucket list -- the bucket key IS the row's own year string, so
  // it just needs an exact match (see activeYearBuckets() for how those
  // options get built).
  function tvYearBucketForRow(row) {
    if (state.tvYearGranularity === "decades") return tvDecadeBucketFor(row.year);
    if (state.tvYearGranularity === "years") return row.year ? String(row.year) : null;
    return tvEraBucketFor(row.year);
  }

  // Builds the option list for whichever granularity is active. Eras/
  // Decades are fixed lists; Years is computed from the data -- one bucket
  // per distinct year actually present (ascending), no shortLabel since
  // there can be 80+ of them and a per-tick label would be unreadable (see
  // the fine-tick styling in renderTVYearDial()).
  function activeYearBuckets(rows) {
    if (state.tvYearGranularity === "decades") return TV_DECADE_BUCKETS;
    if (state.tvYearGranularity === "years") {
      var years = {};
      rows.forEach(function (r) { if (r.year) years[r.year] = true; });
      return Object.keys(years).sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); })
        .map(function (y) { return { key: y, label: y, shortLabel: "" }; });
    }
    return TV_ERA_BUCKETS;
  }

  function tvGenreGroupsForRow(row) {
    var genres = row.genres || [];
    if (!genres.length) return ["other"];
    var groups = {};
    genres.forEach(function (g) { groups[TV_GENRE_MAP[g] || "other"] = true; });
    return Object.keys(groups);
  }

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
    closeTVModal();
    closeSubmitModal();
    closeSubmitThanksModal();
    closeSettingsModal();
    closeRecentModal();
    closePodcastModal();
    closeAdminModal();
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
    // TV Mode now lives permanently inside #tvModal (a lightbox), not the
    // main content flow, so it's no longer part of this defensive
    // re-anchoring -- only Favorites still needs it. The ad banner has its
    // own fixed spot further up (right after Spotlight, before Latest
    // Submissions). Featured stays anchored after the jump nav.
    els.latestStrip.after(els.favoritesStrip);
    els.jumpTop.after(els.featuredStrip);
  }

  function findRowByNum(rowNum) {
    return state.rows.filter(function (r) { return r.rowNum === rowNum; })[0] || null;
  }

  // Must be declared before `state` below -- state.view calls this at
  // initialization time, and `var`-hoisted-but-unassigned constants (like
  // a LAST_TAB_KEY declared further down the file) would still be
  // `undefined` at that point, silently breaking the restore.
  var LAST_TAB_KEY = "mvg-last-tab";
  var VALID_TABS = { director: true, artist: true, song: true };

  function loadLastTabPref() {
    try {
      var saved = localStorage.getItem(LAST_TAB_KEY);
      return VALID_TABS[saved] ? saved : "director";
    } catch (e) {
      return "director";
    }
  }

  var state = {
    rows: [],
    view: loadLastTabPref(),
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
    // active: a track pool has been picked (armed or actually playing).
    // started: the viewer has pressed play -- a real YT player exists.
    // Armed-but-not-started is the "channel ready" static screen.
    tv: { active: false, started: false, queue: [], index: 0, player: null, shellBuilt: false },
    // Whether the shared Year/Genre filters are currently showing TV Mode's
    // coarse buckets instead of the exact Search values -- see
    // enterTVFilterMode/exitTVFilterMode. homeYear/GenreBeforeTV hold the
    // Search-page selection while TV Mode has it swapped out, so closing the
    // modal restores exactly what was selected before.
    tvFilterMode: false,
    homeYearBeforeTV: "",
    homeGenreBeforeTV: "",
    homeMvgOnlyBeforeTV: false,
    homeFiltersExpandedBeforeTV: false,
    tvActiveTab: "genre",
    tvYearGranularity: "eras",
    isAdmin: false,
    adminRows: [],
    adminBulkParsed: [],
    // { feature, spotlight } of the row currently loaded into the admin
    // edit form, or null when adding new -- captured at load time so the
    // save handler's cap-eviction "did this flag just flip?" check doesn't
    // depend on state.adminRows being populated (it isn't, when editing a
    // single row straight from the lightbox -- see openAdminEditForRow()).
    adminFormOriginal: null,
    // Where the form/bulk-import subview was entered from -- "list" (full
    // Manage Entries was already loaded), "landing" (skipped loading the
    // list -- Add/Bulk Import shortcuts), or "lightbox" (single-doc edit
    // from the lightbox's admin button). Controls where Cancel/Back and a
    // successful save return to, and whether saving needs to patch/show a
    // list that may never have been loaded.
    adminReturnView: "landing"
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

  function saveLastTabPref(view) {
    try {
      localStorage.setItem(LAST_TAB_KEY, view);
    } catch (e) {}
  }

  var AUTOPLAY_KEY = "mvg-autoplay";

  function loadAutoplayPref() {
    try {
      return localStorage.getItem(AUTOPLAY_KEY) !== "off";
    } catch (e) {
      return true;
    }
  }

  function saveAutoplayPref(on) {
    try {
      localStorage.setItem(AUTOPLAY_KEY, on ? "on" : "off");
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
  var SHARE_FAVORITES_KEY = "mvg-share-favorites";

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
    if (isSharingFavorites()) pushPublicFavorites();
  }

  // Whether this browser has turned on the public favorites link (see
  // shareFavoritesBtn) -- a local-only convenience flag, not a security
  // boundary (that's firestore.rules' job on /publicFavorites/{uid}).
  function isSharingFavorites() {
    try {
      return localStorage.getItem(SHARE_FAVORITES_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  // /publicFavorites/{uid} is a separate, world-readable doc from the
  // private /users/{uid} one -- keeps recentlyViewed out of anything a
  // share link could expose. Called both when the user turns sharing on
  // and (via pushToFirestore, whenever sharing is already on) on every
  // favorite change after that, so the shared link stays current.
  function pushPublicFavorites() {
    if (!currentUser) return;
    db.collection("publicFavorites").doc(currentUser.uid).set({
      favorites: loadFavorites(),
      displayName: currentUser.displayName || "",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function (err) {
      console.error("Publishing shared favorites failed:", err);
    });
  }

  function deletePublicFavorites() {
    if (!currentUser) return Promise.resolve();
    return db.collection("publicFavorites").doc(currentUser.uid).delete().catch(function (err) {
      console.error("Removing shared favorites failed:", err);
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

  // localStorage caps out around 5-10MB per origin -- the ~22MB snapshot
  // blew straight through that, so every single visit silently failed to
  // cache (the try/catch swallowed the QuotaExceededError) and re-fetched
  // the full file over the network every time. IndexedDB's quota is a
  // fraction of free disk space, easily enough headroom, so this switches
  // the cache there instead -- same one-key-holds-the-whole-blob shape,
  // just async now.
  var CACHE_DB_NAME = "mvg-cache";
  var CACHE_STORE = "kv";

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

  function saveCache(rows) {
    openCacheDb().then(function (db) {
      var tx = db.transaction(CACHE_STORE, "readwrite");
      tx.objectStore(CACHE_STORE).put({ rows: rows, savedAt: Date.now() }, CACHE_KEY);
    }).catch(function (err) {
      console.error("Cache save failed:", err);
    });
  }

  // Resolves to null on any failure (unsupported/blocked storage, empty
  // cache, corrupt entry) rather than rejecting -- callers treat "no cache"
  // and "cache read failed" the same way, so there's no need to distinguish.
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

  function setStatus(message, opts) {
    opts = opts || {};
    els.status.classList.toggle("error", !!opts.error);
    els.status.innerHTML = opts.spinner
      ? '<span class="spinner-small"></span><span>' + escapeHtml(message) + "</span>"
      : escapeHtml(message);
  }

  function showLoadingBar() {
    els.loadingBar.classList.remove("is-indeterminate", "is-done");
    els.loadingBarFill.style.width = "0%";
    els.loadingBar.hidden = false;
    // The thin top bar is easy to miss, especially on phones -- the banner
    // below the header is a bigger, harder-to-miss version of the same
    // progress, shown/hidden on the same schedule. CSS keeps it mobile-only.
    els.loadingBanner.classList.remove("is-done");
    els.loadingBannerPercent.textContent = "0%";
    els.loadingBanner.hidden = false;
  }

  function updateLoadingBar(fraction) {
    var pct = Math.max(2, Math.min(100, Math.round(fraction * 100)));
    els.loadingBarFill.style.width = pct + "%";
    els.loadingBannerPercent.textContent = pct + "%";
  }

  function hideLoadingBar() {
    els.loadingBarFill.style.width = "100%";
    els.loadingBar.classList.add("is-done");
    els.loadingBannerPercent.textContent = "100%";
    els.loadingBanner.classList.add("is-done");
    setTimeout(function () {
      els.loadingBar.hidden = true;
      els.loadingBanner.hidden = true;
    }, 300);
  }

  // Same result as fetch(url).then(r => r.json()), but reports download
  // progress along the way -- the ~13k-row snapshot is a single multi-hundred-KB
  // JSON file with no natural progress events otherwise, which on a slow
  // connection can otherwise leave visitors staring at a bare spinner for a
  // while. Falls back to the indeterminate sweep (no onProgress calls) when
  // the browser can't stream the body. Progress is measured against
  // approxTotalBytes (the *decompressed* size) rather than the Content-Length
  // header -- now that the snapshot is served gzip-encoded, Content-Length
  // reflects the compressed transfer size while the bytes read off the stream
  // are the decompressed ones the browser hands back, so the two no longer
  // agree.
  function fetchJsonWithProgress(url, approxTotalBytes, onProgress) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      if (!res.body) return res.json();

      var reader = res.body.getReader();
      var chunks = [];
      var received = 0;

      function pump() {
        return reader.read().then(function (result) {
          if (result.done) {
            var text = new TextDecoder("utf-8").decode(
              chunks.reduce(function (acc, chunk) {
                var merged = new Uint8Array(acc.length + chunk.length);
                merged.set(acc);
                merged.set(chunk, acc.length);
                return merged;
              }, new Uint8Array(0))
            );
            return JSON.parse(text);
          }
          chunks.push(result.value);
          received += result.value.length;
          onProgress(Math.min(1, received / approxTotalBytes));
          return pump();
        });
      }
      return pump();
    });
  }

  function fetchData() {
    // Cache read (IndexedDB) and the network fetch both start immediately,
    // in parallel -- the cache is only there to show something instantly
    // while the network is still in flight, so it shouldn't add its own
    // latency in front of the request that actually matters.
    var cached = null;
    var networkDone = false;

    loadCache().then(function (c) {
      cached = c;
      if (networkDone) return; // network already won the race -- nothing to do
      if (cached && cached.rows && cached.rows.length) {
        state.rows = cached.rows;
        setStatus("Showing cached data from " + new Date(cached.savedAt).toLocaleString() + " — refreshing…", { spinner: true });
        finishLoad();
      } else {
        setStatus("Loading database…", { spinner: true });
      }
    });

    showLoadingBar();
    var sawProgress = false;

    fetchJsonWithProgress(SNAPSHOT_URL, SNAPSHOT_APPROX_BYTES, function (fraction) {
      sawProgress = true;
      updateLoadingBar(fraction);
    })
      .then(function (rows) {
        // Snapshot is already in cleanRows()'s exact shape (built by
        // publishSnapshot()/scripts/publish-snapshot.js) -- no mapping needed.
        networkDone = true;
        state.rows = rows;
        saveCache(state.rows);
        setStatus(state.rows.length ? "" : "No entries found.");
        hideLoadingBar();
        finishLoad();
      })
      .catch(function (err) {
        networkDone = true;
        console.error("Snapshot load error:", err);
        els.loadingBar.hidden = true;
        els.loadingBanner.hidden = true;
        if (cached && cached.rows && cached.rows.length) {
          setStatus("Showing cached data from " + new Date(cached.savedAt).toLocaleString() + " — couldn't reach the latest snapshot.");
        } else {
          setStatus("Couldn't load the database. Please try again later.", { error: true });
        }
      });

    // If bytes never came through (streaming unsupported, or no
    // Content-Length to compute a fraction from), switch to the
    // indeterminate sweep instead of leaving the bar frozen at 0%.
    setTimeout(function () {
      if (!sawProgress && !els.loadingBar.hidden) els.loadingBar.classList.add("is-indeterminate");
    }, 150);
  }

  function finishLoad() {
    prepareRowsForSearch(state.rows);
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
    applyFavoritesShareFromHash();
    updateStripRowHeightVar();
  }

  window.addEventListener("resize", function () {
    if (!els.spotlightSidebar.hidden) positionSpotlightSidebar();
    updateTopBarHeightVar();
    updateStripRowHeightVar();
  });

  // The top bar is sticky (see styles.css), so the left sidebar rail and the
  // sticky search/tabs row both need to sit exactly below it rather than
  // overlapping -- measured instead of hardcoded since the top bar's height
  // isn't fixed (wraps differently at narrow widths, social icons hide on
  // mobile, etc.).
  function updateTopBarHeightVar() {
    var topBar = document.querySelector(".top-bar");
    if (!topBar) return;
    document.documentElement.style.setProperty("--topbar-h", topBar.getBoundingClientRect().height + "px");
  }
  updateTopBarHeightVar();

  // Latest/Featured/Favorites' collapsed grid (desktop only, see
  // styles.css) used to crop at a flat 380px guess, which cut the second
  // row's caption text off partway through instead of showing two full
  // rows -- a card's actual height depends on the thumb's rendered width
  // (16:9, and the grid's auto-fill column count changes with viewport
  // width), so it's measured the same way --topbar-h is instead of another
  // fixed guess. Only meaningful on desktop, where that crop applies.
  function updateStripRowHeightVar() {
    var card = document.querySelector("#featuredStrip .media-strip-card, #latestStrip .media-strip-card");
    if (!card) return;
    document.documentElement.style.setProperty("--strip-row-h", card.getBoundingClientRect().height + "px");
  }

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
          sponsored: /^(true|yes|y|1|x)$/i.test(get(row, "Sponsored")),
          // Precomputed once so search doesn't re-lowercase/concatenate these
          // on every keystroke across 12,000+ rows. Covers the named-person/
          // crew fields plus the description writeup, so things like "blue,"
          // "dancing," or a specific visual effect mentioned in a video's
          // description are searchable too, not just who made it. Genre/
          // Country are left out since those already have their own filter
          // dropdowns.
          searchHaystack: [
            artist, song, director,
            get(row, "Producer"), get(row, "DP"), get(row, "Editor"),
            get(row, "Choreographer"), get(row, "Studio"),
            get(row, "Description")
          ].join(" ").toLowerCase()
        };
      })
      .filter(function (row) {
        return row.artist !== "" || row.song !== "";
      });
  }

  // Strips accents ("Åkerlund" -> "akerlund") so search doesn't require typing
  // the exact diacritic -- NFD decomposition splits a letter from its
  // combining accent mark, then the accent marks (U+0300-U+036f) are dropped.
  function normalizeText(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  // Precomputed once per row when data loads (not per keystroke): an
  // accent-stripped haystack for fast substring search, and a deduped list of
  // individual words from just the name-ish fields (not the full haystack,
  // which includes descriptions) for the fuzzy-typo fallback below -- keeping
  // that list short keeps fuzzy matching cheap.
  function prepareRowsForSearch(rows) {
    rows.forEach(function (row) {
      row.searchHaystackNorm = normalizeText(row.searchHaystack);
      var nameText = [row.artist, row.song, row.director, row.producer, row.dp, row.editor, row.choreographer, row.studio].join(" ");
      var seen = {};
      row.nameWords = normalizeText(nameText).split(/\s+/).filter(function (w) {
        if (w.length < 3 || seen[w]) return false;
        seen[w] = true;
        return true;
      });
    });
  }

  // Classic edit-distance DP, but bails out early once a row's minimum
  // possible distance already exceeds maxDist -- across 13k rows x several
  // words each, that pruning is what keeps this affordable.
  function levenshteinWithinBound(a, b, maxDist) {
    if (Math.abs(a.length - b.length) > maxDist) return false;
    var la = a.length, lb = b.length;
    var prev = new Array(lb + 1);
    for (var j = 0; j <= lb; j++) prev[j] = j;
    for (var i = 1; i <= la; i++) {
      var curr = [i];
      var rowMin = i;
      for (var j2 = 1; j2 <= lb; j2++) {
        var cost = a.charAt(i - 1) === b.charAt(j2 - 1) ? 0 : 1;
        var val = Math.min(prev[j2] + 1, curr[j2 - 1] + 1, prev[j2 - 1] + cost);
        curr[j2] = val;
        if (val < rowMin) rowMin = val;
      }
      if (rowMin > maxDist) return false;
      prev = curr;
    }
    return prev[lb] <= maxDist;
  }

  function fuzzyTokenMatch(token, words) {
    var maxDist = token.length <= 6 ? 1 : 2;
    for (var i = 0; i < words.length; i++) {
      if (levenshteinWithinBound(token, words[i], maxDist)) return true;
    }
    return false;
  }

  // Per-query-string plan, cached until the query text changes: which tokens
  // to look for, and which of those tokens get the (slower) fuzzy fallback --
  // only tokens with *zero* exact matches anywhere in the catalog, so a
  // normal query (real matches exist) never pays the fuzzy cost at all, and
  // only a genuine typo/near-miss like "ackerlund" for "Åkerlund" does.
  var queryPlanCache = { query: null, tokens: [], fuzzyEnabled: [] };
  function getQueryPlan(q) {
    if (queryPlanCache.query === q) return queryPlanCache;
    var tokens = normalizeText(q).split(/\s+/).filter(Boolean);
    var fuzzyEnabled = tokens.map(function (t) {
      if (t.length < 4) return false; // too short to fuzz safely
      for (var i = 0; i < state.rows.length; i++) {
        if (state.rows[i].searchHaystackNorm.indexOf(t) !== -1) return false;
      }
      return true;
    });
    queryPlanCache = { query: q, tokens: tokens, fuzzyEnabled: fuzzyEnabled };
    return queryPlanCache;
  }

  // Tokenized, order-independent, cross-field search: every word in the query
  // must appear *somewhere* across artist/song/director combined — so
  // "romanek hurt" matches director "Mark Romanek" + song "Hurt", and
  // "mark romanek" / "romanek mark" both match the same entries. Accent-
  // insensitive, with a fuzzy fallback for near-miss spellings (see above).
  function matchesQuery(row, q) {
    if (!q) return true;
    var plan = getQueryPlan(q);
    if (!plan.tokens.length) return true;
    return plan.tokens.every(function (t, idx) {
      if (row.searchHaystackNorm.indexOf(t) !== -1) return true;
      return plan.fuzzyEnabled[idx] && fuzzyTokenMatch(t, row.nameWords);
    });
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
    if (state.tvFilterMode) return tvYearBucketForRow(row) === state.year;
    if (state.year === YEAR_NONE) return !row.year;
    return row.year === state.year;
  }

  function matchesGenre(row) {
    if (!state.genre) return true;
    if (state.tvFilterMode) return tvGenreGroupsForRow(row).indexOf(state.genre) !== -1;
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

  // Shared factory for the arrow-paginated media strips (Latest Submissions,
  // Featured, Favorites). opts.emptyMessage keeps the section visible (with
  // that message in place of cards) instead of hiding it when there's no
  // data -- for Favorites, now its own dedicated page rather than a Home
  // section that only shows up once you have favorites. opts.showDescription
  // adds a clamped description line per card (Favorites only, at the user's
  // request -- Latest/Featured stay as they were).
  function createMediaStrip(sectionEl, opts) {
    opts = opts || {};
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
        if (!rows.length && !opts.emptyMessage) {
          sectionEl.hidden = true;
          return;
        }
        track.innerHTML = !rows.length
          ? '<p class="media-strip-empty">' + escapeHtml(opts.emptyMessage) + "</p>"
          : rows.map(function (row) {
            var id = extractYouTubeId(row.youtube);
            var thumbAlt = escapeHtml((row.song || "Untitled") + (row.artist ? " — " + row.artist : ""));
            var thumb = id
              ? '<img src="https://i.ytimg.com/vi/' + id + '/mqdefault.jpg" alt="' + thumbAlt + '" loading="lazy">'
              : "";
            var artistLine = row.artist || "";
            if (row.director) artistLine += (artistLine ? " · " : "") + "Dir. " + row.director;
            var descLine = opts.showDescription && row.description
              ? '<div class="media-strip-desc">' + escapeHtml(row.description) + "</div>"
              : "";
            var sponsoredBadge = row.sponsored
              ? '<span class="sponsored-badge">Sponsored</span>'
              : "";
            return (
              '<div class="media-strip-card" data-row="' + escapeHtml(row.rowNum) + '">' +
                '<div class="media-strip-thumb">' + thumb + sponsoredBadge + "</div>" +
                '<div class="media-strip-song">' + escapeHtml(row.song || "(untitled)") + "</div>" +
                '<div class="media-strip-artist">' + escapeHtml(artistLine) + "</div>" +
                descLine +
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
  var favoritesStrip = createMediaStrip(els.favoritesStrip, {
    emptyMessage: "Videos you favorite will show up here.",
    showDescription: true
  });

  setupCollapsibleStrip(els.latestStrip, els.latestCollapseBtn, "mvg-latest-collapsed", false);
  setupCollapsibleStrip(els.featuredStrip, els.featuredCollapseBtn, "mvg-featured-collapsed", false);

  // Desktop-only: the gallery grid is capped to ~2 rows by default (see
  // styles.css) so it doesn't push everything else several scrolls down.
  // Not used on mobile, which keeps the horizontal scroll strip.
  function setupSeeMore(sectionEl, btn) {
    btn.addEventListener("click", function () {
      var expanded = sectionEl.classList.toggle("is-expanded");
      btn.textContent = expanded ? "See less ▴" : "See more ▾";
    });
  }

  setupSeeMore(els.latestStrip, els.latestSeeMoreBtn);
  setupSeeMore(els.featuredStrip, els.featuredSeeMoreBtn);
  setupSeeMore(els.favoritesStrip, els.favoritesSeeMoreBtn);

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
  // Non-null while viewing someone else's shared favorites (via #favs-UID) --
  // guards renderFavoritesStrip against clobbering that view, since it's
  // still called from various local-favorite-changed spots regardless of
  // which favorites view is currently on screen.
  var sharedFavoritesUid = null;

  function renderFavoritesStrip(rows) {
    if (sharedFavoritesUid) return;
    var favIds = loadFavorites();
    favoritesPool = favIds
      .slice()
      .reverse()
      .map(function (n) { return findRowByNum(n); })
      .filter(Boolean);
    els.favoritesTitle.textContent = "❤ Favorites";
    els.favoritesShareBtn.hidden = false;
    els.favoritesShareStatus.hidden = true;
    favoritesStrip.render(favoritesPool);
  }

  // Read-only view of another signed-in user's public favorites
  // (/publicFavorites/{uid}, world-readable -- see firestore.rules).
  // Reuses the same #favoritesStrip page/UI as your own favorites, just
  // pointed at their list and title instead.
  function renderSharedFavorites(uid) {
    db.collection("publicFavorites").doc(uid).get().then(function (doc) {
      if (!doc.exists) {
        alert("This favorites link isn't available -- it may have been turned off.");
        return;
      }
      var data = doc.data();
      var ids = Array.isArray(data.favorites) ? data.favorites : [];
      sharedFavoritesUid = uid;
      favoritesPool = ids.map(findRowByNum).filter(Boolean);
      els.favoritesTitle.textContent = (data.displayName ? data.displayName + "’s" : "Shared") + " Favorites";
      els.favoritesShareBtn.hidden = true;
      els.favoritesShareStatus.hidden = true;
      favoritesStrip.render(favoritesPool);
      setDesktopView("favorites");
      setMobileView("favorites");
    }).catch(function (err) {
      console.error("Loading shared favorites failed:", err);
    });
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
      var artistLine = row.artist || "";
      if (row.director) artistLine += (artistLine ? " · " : "") + "Dir. " + row.director;
      var descLine = row.description
        ? '<div class="spotlight-card-excerpt">' + escapeHtml(row.description) + "</div>"
        : "";
      var sponsoredBadge = row.sponsored
        ? '<span class="sponsored-badge">Sponsored</span>'
        : "";
      return (
        '<div class="spotlight-card" data-row="' + escapeHtml(row.rowNum) + '">' +
          '<div class="spotlight-card-thumb">' + thumb + sponsoredBadge + "</div>" +
          '<div class="spotlight-card-info">' +
            '<div class="spotlight-card-song">' + escapeHtml(row.song || "(untitled)") + "</div>" +
            '<div class="spotlight-card-artist">' + escapeHtml(artistLine) + "</div>" +
            descLine +
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

  // Latest blog posts (themusicvideoguy.com/news), fetched once at startup
  // from a same-origin static file -- see BLOG_LATEST_URL. Independent of
  // the video catalog, so this has its own small fetch rather than piggybacking
  // on fetchData().
  // Matches COUNT in scripts/fetch-blog-latest.js -- capped here too as a
  // safety net, not just trusted from the fetched JSON. First 2 get the
  // full big-thumbnail card treatment; the next 4 (once the blog actually
  // has that many recent posts -- right now it only has 3) render as a
  // compact list below with a small thumbnail beside the text instead of
  // a full card, so the section can grow past 2 without repeating that
  // much visual weight.
  var NEWS_COUNT = 6;
  var NEWS_CARD_COUNT = 2;

  function renderBlogLatest(posts) {
    if (!posts || !posts.length) {
      els.blogLatestSidebar.hidden = true;
      return;
    }
    posts = posts.slice(0, NEWS_COUNT);
    var cardPosts = posts.slice(0, NEWS_CARD_COUNT);
    var extraPosts = posts.slice(NEWS_CARD_COUNT);

    els.blogLatestCards.innerHTML = cardPosts.map(function (post) {
      var thumb = post.image
        ? '<img src="' + escapeHtml(post.image) + '" alt="' + escapeHtml(post.title) + '" loading="lazy">'
        : "";
      return (
        '<a class="spotlight-card blog-latest-card" href="' + escapeHtml(post.url) + '" target="_blank" rel="noopener noreferrer">' +
          '<div class="spotlight-card-thumb">' + thumb + "</div>" +
          '<div class="spotlight-card-info">' +
            '<div class="spotlight-card-song">' + escapeHtml(post.title) + "</div>" +
            '<div class="blog-latest-excerpt">' + escapeHtml(post.excerpt || "") + "</div>" +
          "</div>" +
        "</a>"
      );
    }).join("");

    if (extraPosts.length) {
      els.blogLatestExtra.innerHTML = extraPosts.map(function (post) {
        var thumb = post.image
          ? '<img src="' + escapeHtml(post.image) + '" alt="' + escapeHtml(post.title) + '" loading="lazy">'
          : "";
        return (
          '<a class="blog-latest-extra-item" href="' + escapeHtml(post.url) + '" target="_blank" rel="noopener noreferrer">' +
            '<div class="blog-latest-extra-thumb">' + thumb + "</div>" +
            '<div class="blog-latest-extra-info">' +
              '<div class="blog-latest-extra-title">' + escapeHtml(post.title) + "</div>" +
              '<div class="blog-latest-excerpt">' + escapeHtml(post.excerpt || "") + "</div>" +
            "</div>" +
          "</a>"
        );
      }).join("");
      els.blogLatestExtra.hidden = false;
    } else {
      els.blogLatestExtra.hidden = true;
    }

    els.blogLatestSidebar.hidden = false;
  }

  function fetchBlogLatest() {
    fetch(BLOG_LATEST_URL)
      .then(function (res) { return res.ok ? res.json() : []; })
      .then(renderBlogLatest)
      .catch(function (err) { console.error("Blog latest load error:", err); });
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

  // null = the top-ad CSV hasn't finished loading yet; [] = loaded but empty.
  // The lightbox mirrors this banner, but opens independently of when the
  // fetch resolves -- on a cold app launch it competes with the (much
  // larger) main data fetch for bandwidth, so a video can easily get
  // tapped before this one lands. Rather than the lightbox just reading
  // whatever's in the cache at that instant (and silently showing nothing
  // if it's too early), callers wait via onTopAdsReady() so the banner
  // still appears once the data does arrive.
  var topAdsCache = null;
  var topAdsWaiters = [];
  function onTopAdsReady(cb) {
    if (topAdsCache !== null) { cb(topAdsCache); return; }
    topAdsWaiters.push(cb);
  }

  var lightboxAdController = null;
  var fetchTopAds = createAdSlideshow(els.adPlaceholder, TOP_AD_CSV_URL, TOP_AD_DEFAULT_SECONDS, function (ads) {
    topAdsCache = ads;
    topAdsWaiters.forEach(function (cb) { cb(ads); });
    topAdsWaiters = [];
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
    state.tv.started = false;
    if (state.tv.player && state.tv.player.destroy) {
      try { state.tv.player.destroy(); } catch (e) {}
    }
    state.tv.player = null;
    state.tv.shellBuilt = false;
    els.tvSkipBtn.hidden = true;
    els.tvReportLink.hidden = true;
    els.tvPowerSwitch.hidden = true;
    els.tvFavBtn.hidden = true;
    els.tvInfoBtn.hidden = true;
    els.tvAdminEditBtn.hidden = true;
    els.tvAdminDeleteBtn.hidden = true;
    els.tvInfoPanel.hidden = true;
  }

  var tvAdController = null;

  // A ring of 15 short tick buttons around a center hub, instead of a
  // dropdown -- picking a decade is more "spin the dial" than "look up an
  // exact value," so it gets the same playful treatment as the genre tiles.
  // Positions are computed here (percent left/top around the ring) rather
  // than with CSS trig, matching the word-cloud sphere's approach elsewhere
  // in this codebase. The center hub shows the full label + count for
  // whatever's selected (or the totals when nothing is) and doubles as the
  // reset-to-All control.
  function renderTVYearDial(rows) {
    var buckets = activeYearBuckets(rows);
    var counts = {};
    buckets.forEach(function (b) { counts[b.key] = 0; });
    rows.forEach(function (r) {
      var k = tvYearBucketForRow(r);
      if (k != null && counts.hasOwnProperty(k)) counts[k]++;
    });

    // "Years" mode can have 80+ ticks -- too many for a per-tick label to
    // stay readable, so those render as small unlabeled notches instead of
    // the Eras/Decades circular buttons (the center hub is what shows the
    // label once one's tapped).
    var fine = state.tvYearGranularity === "years";
    var n = buckets.length;
    var radius = 42; // percent of the ring's own box
    var ticksHtml = "";
    buckets.forEach(function (b, i) {
      var angleDeg = n ? -90 - (360 / n) * i : -90; // start at 12 o'clock, go counter-clockwise
      var angleRad = angleDeg * Math.PI / 180;
      var x = 50 + radius * Math.cos(angleRad);
      var y = 50 + radius * Math.sin(angleRad);
      var active = state.year === b.key ? " is-active" : "";
      var cls = fine ? "tv-year-tick tv-year-tick-fine" : "tv-year-tick";
      ticksHtml += '<button type="button" class="' + cls + active + '" data-year="' + escapeHtml(b.key) +
        '" style="left:' + x.toFixed(2) + '%;top:' + y.toFixed(2) + '%;" aria-label="' +
        escapeHtml(b.label) + " (" + counts[b.key] + ')">' + (fine ? "" : escapeHtml(b.shortLabel)) + "</button>";
    });

    var selected = null;
    buckets.forEach(function (b) { if (b.key === state.year) selected = b; });
    var centerLabel = selected ? selected.label : (fine ? "All Years" : "All " + (state.tvYearGranularity === "decades" ? "Decades" : "Eras"));
    var centerCount = (selected ? counts[selected.key] : rows.length) + " videos";

    els.tvYearDialRing.innerHTML = ticksHtml +
      '<button type="button" class="tv-year-dial-center" id="tvYearDialCenter">' +
        '<span class="tv-year-dial-center-label">' + escapeHtml(centerLabel) + "</span>" +
        '<span class="tv-year-dial-center-count">' + centerCount + "</span>" +
      "</button>";

    Array.prototype.forEach.call(els.tvYearLever.querySelectorAll(".tv-year-lever-opt"), function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-granularity") === state.tvYearGranularity);
    });
  }

  els.tvYearLever.addEventListener("click", function (e) {
    var opt = e.target.closest(".tv-year-lever-opt");
    if (!opt) return;
    var granularity = opt.getAttribute("data-granularity");
    if (granularity === state.tvYearGranularity) return;
    state.tvYearGranularity = granularity;
    state.year = ""; // bucket keys aren't comparable across granularities
    renderTVYearDial(state.rows);
    updateFiltersToggleCount();
    render();
  });

  els.tvYearDial.addEventListener("click", function (e) {
    var tick = e.target.closest(".tv-year-tick");
    var center = e.target.closest("#tvYearDialCenter");
    if (!tick && !center) return;
    if (tick) {
      var key = tick.getAttribute("data-year");
      state.year = state.year === key ? "" : key; // tapping the active tick again clears it
    } else {
      state.year = ""; // center hub doubles as the reset-to-All control
    }
    renderTVYearDial(state.rows);
    updateFiltersToggleCount();
    render();
  });

  // Colorful tappable tiles instead of a dropdown -- genre is a "browse by
  // vibe" pick in TV Mode, not a precise lookup, so it gets the more playful
  // treatment. Counts (over the full catalog, not the currently-armed pool)
  // help set expectations before tapping. Re-rendered on every tap so the
  // active tile's highlight stays in sync.
  function renderTVGenreGrid(rows) {
    var counts = {};
    TV_GENRE_GROUPS.forEach(function (g) { counts[g.key] = 0; });
    rows.forEach(function (r) {
      tvGenreGroupsForRow(r).forEach(function (key) { counts[key]++; });
    });
    var html = '<button type="button" class="tv-genre-tile tv-genre-tile-all' +
      (state.genre === "" ? " is-active" : "") + '" data-genre="">All Genres</button>';
    TV_GENRE_GROUPS.forEach(function (g) {
      var active = state.genre === g.key ? " is-active" : "";
      html += '<button type="button" class="tv-genre-tile' + active + '" data-genre="' + g.key +
        '" style="--tile-color:' + g.color + '"><span class="tv-genre-tile-label">' + escapeHtml(g.label) +
        '</span><span class="tv-genre-tile-count">' + counts[g.key] + "</span></button>";
    });
    els.tvGenreGrid.innerHTML = html;
  }

  els.tvGenreGrid.addEventListener("click", function (e) {
    var tile = e.target.closest(".tv-genre-tile");
    if (!tile) return;
    var key = tile.getAttribute("data-genre");
    state.genre = state.genre === key ? "" : key; // tapping the active tile again clears it
    renderTVGenreGrid(state.rows);
    updateFiltersToggleCount();
    render();
  });

  // Swaps the shared Year filter (and the Genre dropdown, for a tile grid)
  // to TV Mode's coarse buckets, translating whatever exact Search
  // selection was active into its closest bucket equivalent (so switching
  // into TV Mode doesn't just discard it). exitTVFilterMode() restores the
  // exact Search options/selection and the dropdown.
  // Genre and Year each get their own "page" (tv-genre-grid / tv-year-dial)
  // switched via tvFilterTabs instead of both being stacked and visible at
  // once -- halves how much the filters panel has to scroll through.
  function updateTVFilterTabUI() {
    Array.prototype.forEach.call(els.tvFilterTabs.querySelectorAll(".tv-filter-tab"), function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-tab") === state.tvActiveTab);
    });
    els.tvGenreGrid.hidden = state.tvActiveTab !== "genre";
    els.tvYearDial.hidden = state.tvActiveTab !== "era";
    els.tvCustomPane.hidden = state.tvActiveTab !== "custom";
  }

  els.tvFilterTabs.addEventListener("click", function (e) {
    var tab = e.target.closest(".tv-filter-tab");
    if (!tab) return;
    state.tvActiveTab = tab.getAttribute("data-tab");
    updateTVFilterTabUI();
  });

  function enterTVFilterMode() {
    if (state.tvFilterMode) return;
    state.homeYearBeforeTV = state.year;
    state.homeGenreBeforeTV = state.genre;
    state.homeMvgOnlyBeforeTV = state.mvgOnly;
    state.homeFiltersExpandedBeforeTV = els.filtersPanel.hidden ? false : true;
    state.tvFilterMode = true;
    state.tvYearGranularity = "eras";
    state.year = state.homeYearBeforeTV ? tvEraBucketFor(state.homeYearBeforeTV === YEAR_NONE ? "" : state.homeYearBeforeTV) : "";
    state.genre = state.homeGenreBeforeTV ? (TV_GENRE_MAP[state.homeGenreBeforeTV] || "other") : "";
    // MVG Reels/tooltips are hidden in TV Mode (see below) to keep the panel
    // short -- reset the toggle rather than silently applying a filter the
    // viewer has no way to see or turn off while it's active.
    state.mvgOnly = false;
    els.mvgOnlyToggle.checked = false;
    els.yearFilter.hidden = true;
    els.genreFilter.hidden = true;
    els.mvgOnlyLabel.hidden = true;
    els.mvgOnlyTip.hidden = true;
    els.genreTip.hidden = true;
    // No reason to collapse/expand filters in TV Mode -- they're the whole
    // point of the panel there, not an optional extra like on Search.
    els.filtersToggle.hidden = true;
    applyFiltersExpanded(true);
    els.tvFilterTabs.hidden = false;
    state.tvActiveTab = "genre";
    updateTVFilterTabUI();
    renderTVYearDial(state.rows);
    renderTVGenreGrid(state.rows);
    updateFiltersToggleCount();
  }

  function exitTVFilterMode() {
    if (!state.tvFilterMode) return;
    state.tvFilterMode = false;
    state.year = state.homeYearBeforeTV;
    state.genre = state.homeGenreBeforeTV;
    state.mvgOnly = state.homeMvgOnlyBeforeTV;
    els.mvgOnlyToggle.checked = state.mvgOnly;
    els.yearFilter.hidden = false;
    els.tvYearDial.hidden = true;
    els.genreFilter.hidden = false;
    els.tvGenreGrid.hidden = true;
    els.mvgOnlyLabel.hidden = false;
    els.mvgOnlyTip.hidden = false;
    els.genreTip.hidden = false;
    els.filtersToggle.hidden = false;
    els.tvFilterTabs.hidden = true;
    applyFiltersExpanded(!!state.homeFiltersExpandedBeforeTV);
    buildYearOptions(state.rows);
    buildGenreOptions(state.rows);
    els.yearFilter.value = state.year;
    els.genreFilter.value = state.genre;
    updateFiltersToggleCount();
  }

  // TV Mode is a lightbox (matching the video lightbox's default size) that
  // bundles the shared filters and the ad banner in with the player, rather
  // than living inline on the page -- opening it borrows #filtersGroup from
  // its normal spot on Home for the duration (harmless: Home isn't
  // interactive behind an open modal anyway) and mirrors the same ad feed
  // the main banner and video lightbox already show (see onTopAdsReady()).
  function openTVModal() {
    if (!els.tvModal.hidden) return;
    closeLightbox();
    els.tvFiltersSlot.appendChild(els.filtersGroup);
    enterTVFilterMode();
    els.tvModal.hidden = false;
    els.tvModal.querySelector(".lightbox-panel").scrollTop = 0;
    lockBodyScroll();
    pushModalHistory();
    if (!tvAdController) {
      onTopAdsReady(function (ads) {
        if (els.tvModal.hidden) return;
        tvAdController = renderAdSlideshowInto(els.tvAdPlaceholder, ads, TOP_AD_DEFAULT_SECONDS);
      });
    }
  }

  // Opens the modal and immediately arms it with a random pick from the
  // current filters -- used by the plain "TV Mode" entry points (sidebar,
  // bottom nav), which don't already have a specific video in mind the way
  // a "Play All" button does. Guarded so re-clicking the entry point while
  // already open doesn't interrupt whatever's already armed/playing.
  function openTVModalFresh() {
    if (!els.tvModal.hidden) return;
    openTVModal();
    armTV();
  }

  function closeTVModal() {
    if (els.tvModal.hidden) return;
    if (state.tv.active) teardownTV();
    els.videoBox.innerHTML = "";
    exitTVFilterMode();
    els.controls.after(els.filtersGroup); // restore to its normal Home position
    els.tvModal.hidden = true;
    unlockBodyScroll();
    if (tvAdController) { tvAdController.stop(); tvAdController = null; }
  }

  function emptyTVMarkup() {
    return '<div class="video-embed-hint"><p>No videos match the current filters. Adjust the filters below to find something to play.</p></div>';
  }

  // The "channel ready" screen shown once a track is armed but before the
  // viewer presses play -- static/noise standing in for the picked video's
  // thumbnail, title and artist deliberately withheld until they commit to
  // watching, TV-channel-surfing style rather than announcing what's next.
  function tvStaticMarkup() {
    return '<div class="tv-static-wrap">' +
      '<div class="tv-static-noise"></div>' +
      '<button type="button" class="tv-static-play" id="tvArmedPlayBtn" aria-label="Play">' +
        '<span class="tv-static-play-icon">▶</span>' +
      "</button>" +
      '<p class="tv-static-hint">Tap to play</p>' +
    "</div>";
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

  // No title bar -- the YouTube player itself already shows the video's
  // title, so a duplicate label above it was redundant. Skip/Report
  // issue/Exit now live in .filters-toggle-row instead (see
  // playArmedTV()/startTVMode()/teardownTV() for their show/hide).
  function ensureTVShell() {
    if (state.tv.shellBuilt) return;
    els.videoBox.innerHTML = '<div class="video-embed-frame"><div id="tvPlayerTarget"></div></div>';
    state.tv.shellBuilt = true;
  }

  function onTVStateChange(e) {
    if (state.tv.active && e.data === YT.PlayerState.ENDED) advanceTV();
  }

  // Without this, a video that's gone private/deleted (100) or has
  // embedding disabled by the owner (101/150 -- the same codes the
  // video-detail lightbox's player checks) just sits there stalled instead
  // of playing anything, since the iframe never reaches PLAYING/ENDED.
  // Skipping straight to the next track keeps the "channel" running instead
  // of silently stopping.
  function onTVError(e) {
    if (state.tv.active && (e.data === 100 || e.data === 101 || e.data === 150)) {
      advanceTV();
    }
  }

  // startPaused: when set, the new track loads cued (first frame, not
  // playing) instead of autoplaying -- used when filters change mid-track
  // to preserve whatever play/pause state the viewer was already in (see
  // refreshTVPoolIfActive). Skipping/advancing/starting fresh always play,
  // as before.
  // Reuses the lightbox's own tag-row/credits/description markup and
  // classes (creditsHtml(), categoryTagClass()) so the info panel looks
  // consistent with the full entry view, without actually opening a second
  // lightbox on top of TV Mode (which would tear down playback -- see
  // openLightbox()).
  function tvInfoMarkup(row) {
    var sub = row.artist ? '<p class="tv-info-subtitle">' + escapeHtml(row.artist) + "</p>" : "";
    var tagHtml = row.category ? '<span class="tag ' + categoryTagClass(row.category) + '">' + escapeHtml(row.category) + "</span>" : "";
    var genreTags = (row.genres || []).map(function (g) {
      return '<span class="tag tag-default">' + escapeHtml(g) + "</span>";
    }).join("");
    var descHtml = row.description
      ? '<p class="lightbox-desc">' + escapeHtml(row.description) + "</p>"
      : '<p class="lightbox-desc placeholder">No writeup yet.</p>';
    return '<h3 class="tv-info-title">' + escapeHtml(row.song || "(untitled)") + "</h3>" +
      sub +
      '<div class="lightbox-tag-row">' + tagHtml + genreTags + "</div>" +
      creditsHtml(row) +
      descHtml;
  }

  // Keeps the report link, favorite state, admin edit/delete visibility,
  // and info panel content in sync with whatever's actually loaded --
  // called every time the track changes (loadTVTrack is the one place all
  // of armTV/playArmedTV/advanceTV/refreshTVPoolIfActive funnel through).
  function updateTVTrackDetails(row) {
    els.tvReportLink.href = reportFormUrl(row);
    var fav = isFavorite(row.rowNum);
    els.tvFavBtn.classList.toggle("is-active", fav);
    els.tvFavBtn.textContent = fav ? "♥" : "♡";
    els.tvAdminEditBtn.hidden = !state.isAdmin;
    els.tvAdminDeleteBtn.hidden = !state.isAdmin;
    els.tvInfoPanel.innerHTML = tvInfoMarkup(row);
  }

  function loadTVTrack(row, startPaused) {
    var id = extractYouTubeId(row.youtube);
    if (!id) {
      advanceTV();
      return;
    }
    updateTVTrackDetails(row);
    if (state.tv.player && state.tv.player.loadVideoById) {
      if (startPaused && state.tv.player.cueVideoById) {
        state.tv.player.cueVideoById(id);
      } else {
        state.tv.player.loadVideoById(id);
      }
    } else {
      loadYouTubeAPI(function () {
        if (!state.tv.active) return;
        state.tv.player = new YT.Player("tvPlayerTarget", {
          videoId: id,
          playerVars: { autoplay: startPaused ? 0 : 1, rel: 0 },
          events: { onStateChange: onTVStateChange, onError: onTVError }
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

  // Keeps TV Mode "live" while it's open -- without this, changing a filter
  // only affected the pool a fresh Start TV Mode / Skip would draw from,
  // leaving whatever was already playing stuck until the viewer manually
  // closed and reopened the modal. Preserves play/pause state across the
  // swap (paused stays paused on the new pick, playing keeps playing) to
  // feel like actually changing the channel rather than restarting a video.
  // Before the viewer has pressed play there's no play/pause state to
  // preserve, so it just re-arms (re-rolls the hidden pick) instead.
  function refreshTVPoolIfActive() {
    if (els.tvModal.hidden) return;
    if (!state.tv.started) {
      armTV();
      return;
    }
    var pool = state.rows.filter(matchesFilters).filter(function (r) { return !!r.youtube; });
    if (!pool.length) {
      armTV(); // tears the player down and shows the no-matches message
      return;
    }
    var wasPaused = false;
    if (state.tv.player && state.tv.player.getPlayerState) {
      try { wasPaused = state.tv.player.getPlayerState() !== YT.PlayerState.PLAYING; } catch (e) {}
    }
    state.tv.queue = shuffle(pool);
    state.tv.index = 0;
    loadTVTrack(state.tv.queue[0], wasPaused);
  }

  // Reflects play/pause state on the ever-present power switch (replaces
  // the old "Exit" button -- see #tvPowerSwitch) rather than only showing a
  // control while actually playing.
  function updateTVPowerSwitch(isOn) {
    els.tvPowerSwitch.classList.toggle("is-on", isOn);
    els.tvPowerSwitch.setAttribute("aria-pressed", isOn ? "true" : "false");
  }

  // Picks a random track from the current filters and shows the static
  // "channel ready" screen instead of playing it immediately -- see
  // tvStaticMarkup(). Also used to re-roll while armed (filter changes) and
  // to return to the armed screen after exiting an actively playing track
  // (toggling the power switch off).
  function armTV() {
    teardownTV();
    var pool = state.rows.filter(matchesFilters).filter(function (r) { return !!r.youtube; });
    if (!pool.length) {
      els.videoBox.innerHTML = emptyTVMarkup();
      return;
    }
    state.tv.active = true;
    state.tv.queue = shuffle(pool);
    state.tv.index = 0;
    els.videoBox.innerHTML = tvStaticMarkup();
    els.tvPowerSwitch.hidden = false;
    updateTVPowerSwitch(false);
  }

  function playArmedTV() {
    if (!state.tv.active || !state.tv.queue.length) return;
    state.tv.started = true;
    ensureTVShell();
    loadTVTrack(state.tv.queue[state.tv.index]);
    els.tvSkipBtn.hidden = false;
    els.tvReportLink.hidden = false;
    els.tvFavBtn.hidden = false;
    els.tvInfoBtn.hidden = false;
    els.tvPowerSwitch.hidden = false;
    updateTVPowerSwitch(true);
  }

  // Used by "Play All" (Featured/Latest/Recently Viewed/Favorites), which
  // already has a specific curated list in mind -- so it skips the armed/
  // hidden-identity screen and just plays index 0 immediately, unlike the
  // plain TV Mode entry points (see openTVModalFresh/armTV).
  function startTVMode(customPool) {
    openTVModal();
    var pool = customPool || state.rows.filter(matchesFilters).filter(function (r) { return !!r.youtube; });
    if (!pool.length) {
      els.videoBox.innerHTML = emptyTVMarkup();
      return;
    }
    state.tv.active = true;
    state.tv.started = true;
    state.tv.queue = shuffle(pool);
    state.tv.index = 0;
    ensureTVShell();
    loadTVTrack(state.tv.queue[0]);
    els.tvSkipBtn.hidden = false;
    els.tvReportLink.hidden = false;
    els.tvFavBtn.hidden = false;
    els.tvInfoBtn.hidden = false;
    els.tvPowerSwitch.hidden = false;
    updateTVPowerSwitch(true);
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
    if (e.target.closest("#tvArmedPlayBtn")) playArmedTV();
  });

  // Skip/Report issue/Exit live beside Clear filters (in
  // .filters-toggle-row) rather than in a player overlay bar -- easier to
  // reach on mobile without a thumb covering the video, and there's no bar
  // left to put them in now that the redundant title is gone. Skip only
  // matters once actually playing (see playArmedTV()/startTVMode() for the
  // show, teardownTV() for the hide).
  els.tvSkipBtn.addEventListener("click", function () {
    advanceTV();
  });

  // Ever-present power switch (replaces the old "Exit" button) -- visible
  // the whole time TV Mode is open, armed or playing, not just while
  // playing. Off -> on presses play on whatever's armed; on -> off goes
  // back to the armed/static screen (same as the old Exit).
  els.tvPowerSwitch.addEventListener("click", function () {
    if (state.tv.started) {
      armTV();
    } else {
      playArmedTV();
    }
  });

  els.tvFavBtn.addEventListener("click", function () {
    var row = state.tv.queue[state.tv.index];
    if (!row) return;
    var nowFavorite = toggleFavorite(row.rowNum);
    els.tvFavBtn.classList.toggle("is-active", nowFavorite);
    els.tvFavBtn.textContent = nowFavorite ? "♥" : "♡";
    renderFavoritesStrip(state.rows);
  });

  // Toggles a lightweight info panel in place (title/tags/credits/
  // description, reusing the lightbox's own markup -- see tvInfoMarkup())
  // rather than opening the real entry lightbox, which would tear down TV
  // playback (see openLightbox()).
  els.tvInfoBtn.addEventListener("click", function () {
    els.tvInfoPanel.hidden = !els.tvInfoPanel.hidden;
  });

  els.tvAdminEditBtn.addEventListener("click", function () {
    var row = state.tv.queue[state.tv.index];
    if (!row) return;
    closeTVModal();
    openAdminEditForRow(row.rowNum);
  });

  els.tvAdminDeleteBtn.addEventListener("click", function () {
    var row = state.tv.queue[state.tv.index];
    if (!row) return;
    var label = (row.artist ? row.artist + " — " : "") + (row.song || "(untitled)");
    deleteRowByAdmin(row.rowNum, label, closeTVModal);
  });

  els.tvModal.addEventListener("click", function (e) {
    if (e.target.closest(".lightbox-close") || e.target.closest(".lightbox-backdrop")) dismissTopModal();
  });

  // ---- Lightbox ----

  // Same director scores highest (an explicit creative-credit match), same
  // artist next, then one point per overlapping genre -- ranked rather than
  // filtered-and-truncated so a video with several weak genre overlaps
  // doesn't crowd out a single strong director/artist match.
  function relatedEntries(row) {
    var genres = row.genres || [];
    var scored = [];
    state.rows.forEach(function (r) {
      if (r.rowNum === row.rowNum || !r.youtube) return;
      var score = 0;
      if (row.director && r.director === row.director) score += 3;
      if (row.artist && r.artist === row.artist) score += 2;
      if (genres.length && r.genres) {
        score += r.genres.filter(function (g) { return genres.indexOf(g) !== -1; }).length;
      }
      if (score > 0) scored.push({ row: r, score: score });
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, 6).map(function (x) { return x.row; });
  }

  function lightboxRelatedHtml(row) {
    var related = relatedEntries(row);
    if (!related.length) return "";
    var items = related.map(function (r) {
      var label = escapeHtml(r.song || "(untitled)") + (r.artist ? " — " + escapeHtml(r.artist) : "");
      return '<button type="button" class="related-btn" data-row="' + escapeHtml(r.rowNum) + '">' + label + "</button>";
    }).join("");
    return '<div class="lightbox-related"><span class="lightbox-related-label">Related:</span>' + items + "</div>";
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
    if (state.tv.active) { teardownTV(); els.videoBox.innerHTML = ""; moveVideoPairHome(); }
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

    var adminEditBtn = state.isAdmin
      ? '<button type="button" class="lightbox-admin-edit-btn" data-rownum="' + escapeHtml(row.rowNum) + '" title="Edit entry (admin)" aria-label="Edit entry">✎ Edit</button>'
      : "";
    var adminDeleteBtn = state.isAdmin
      ? '<button type="button" class="lightbox-admin-delete-btn" data-rownum="' + escapeHtml(row.rowNum) + '" data-label="' + escapeHtml((row.artist ? row.artist + " — " : "") + (row.song || "(untitled)")) + '" title="Delete entry (admin)" aria-label="Delete entry">🗑 Delete</button>'
      : "";

    els.lightboxContent.innerHTML =
      '<div class="ad-placeholder" id="lightboxAdPlaceholder" hidden></div>' +
      videoHtml +
      '<div class="lightbox-body">' +
      '<div class="lightbox-title-row">' +
      '<h2 class="lightbox-title">' + escapeHtml(row.song || "(untitled)") + "</h2>" +
      '<div class="lightbox-title-actions">' +
      adminEditBtn +
      adminDeleteBtn +
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
      lightboxRelatedHtml(row) +
      "</div>";

    els.lightbox.hidden = false;
    els.lightboxPanel.scrollTop = 0;
    lockBodyScroll();
    pushModalHistory();
    applyLightboxSize();

    var lightboxAdEl = document.getElementById("lightboxAdPlaceholder");
    if (lightboxAdEl) {
      var adRowNumAtOpen = row.rowNum;
      onTopAdsReady(function (ads) {
        // bail if the lightbox was closed or switched to another entry
        // while waiting for the ad data to arrive -- checked after
        // els.lightbox.hidden is set above so this also works correctly
        // when the callback fires synchronously (cache already warm)
        if (els.lightbox.hidden || state.lightboxRowNum !== adRowNumAtOpen) return;
        lightboxAdController = renderAdSlideshowInto(lightboxAdEl, ads, TOP_AD_DEFAULT_SECONDS);
      });
    }

    if (id) {
      var rowNumAtOpen = row.rowNum;
      var youtubeUrl = row.youtube;
      loadYouTubeAPI(function () {
        // bail if the lightbox was closed or switched to another entry while the API was loading
        if (els.lightbox.hidden || state.lightboxRowNum !== rowNumAtOpen) return;
        state.lightboxPlayer = new YT.Player("lightboxPlayerTarget", {
          videoId: id,
          playerVars: { autoplay: loadAutoplayPref() ? 1 : 0, rel: 0 },
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

  // Its own popup (not a swapped-in section of #submitModal) so it reads
  // unmistakably as "something just happened" after hitting Submit,
  // rather than a content change the submitter might not notice on a
  // long form they've scrolled down. closeSubmitModal()/openSubmitThanksModal()
  // is an internal transition (like the lightbox<->recent-modal pattern
  // elsewhere) -- one popup replacing another, not a real dismiss.
  function openSubmitThanksModal() {
    els.submitThanksModal.hidden = false;
    els.submitThanksModal.querySelector(".lightbox-panel").scrollTop = 0;
    lockBodyScroll();
    pushModalHistory();
  }

  function closeSubmitThanksModal() {
    if (els.submitThanksModal.hidden) return;
    els.submitThanksModal.hidden = true;
    unlockBodyScroll();
  }

  els.submitThanksModal.addEventListener("click", function (e) {
    if (e.target.closest(".lightbox-close") || e.target.closest(".lightbox-backdrop")) dismissTopModal();
  });

  // Message board: a docked popout panel (not a lightbox -- it doesn't block
  // the rest of the page, so it isn't part of closeAllModalsHard()/history
  // stacking). Anyone can open it and read; the Firestore listener is only
  // attached the first time it's opened, so signed-out browsing costs nothing.
  // Posting requires sign-in (enforced client-side by hiding the composer,
  // and server-side by the /messages Firestore rules).
  var msgBoardListenerStarted = false;
  var msgBoardLastDocs = [];

  // Admin moderation state -- only populated once an admin opens the board
  // (startMsgBoardModListeners), so signed-out/non-admin visitors never pay
  // for these two extra listeners.
  var msgBoardModListenersStarted = false;
  var msgBoardMutedSet = {};
  var msgBoardBannedSet = {};

  // The current user's own muted/banned status -- watched independently of
  // admin status so the composer can be swapped for an explanation, and kept
  // live so a mute/ban applied mid-session takes effect without a reload.
  var msgBoardOwnStatusUnsub = null;
  var msgBoardOwnMuted = false;
  var msgBoardOwnBanned = false;

  function formatMsgBoardTime(date) {
    if (!date) return "";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " +
      date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function renderMsgBoardMessages(docs) {
    msgBoardLastDocs = docs;
    if (!docs.length) {
      els.msgBoardMessages.innerHTML = '<p class="msgboard-empty">No messages yet -- say hi!</p>';
      return;
    }
    // Firestore query below orders newest-first (so `limit` keeps the most
    // recent messages); reverse here to display oldest-to-newest, like a
    // normal chat thread.
    var ordered = docs.slice().reverse();
    els.msgBoardMessages.innerHTML = ordered.map(function (doc) {
      var d = doc.data();
      var when = d.createdAt && d.createdAt.toDate ? formatMsgBoardTime(d.createdAt.toDate()) : "";
      var authorName = d.authorName || "Anonymous";
      var admin = "";
      if (state.isAdmin && d.authorUid && d.authorUid !== currentUser.uid) {
        var isMuted = !!msgBoardMutedSet[d.authorUid];
        var isBanned = !!msgBoardBannedSet[d.authorUid];
        var nameAttr = escapeHtml(authorName);
        admin = '<div class="msgboard-admin-controls">' +
          '<button type="button" class="msgboard-admin-delete" data-msgid="' + doc.id + '">Delete</button>' +
          '<button type="button" class="msgboard-admin-mute' + (isMuted ? " is-active" : "") + '" data-uid="' + d.authorUid + '" data-name="' + nameAttr + '">' + (isMuted ? "Unmute" : "Mute") + "</button>" +
          '<button type="button" class="msgboard-admin-ban' + (isBanned ? " is-active" : "") + '" data-uid="' + d.authorUid + '" data-name="' + nameAttr + '">' + (isBanned ? "Unban" : "Ban") + "</button>" +
        "</div>";
      }
      return '<div class="msgboard-message">' +
        '<div class="msgboard-message-meta">' +
          '<span class="msgboard-message-author">' + escapeHtml(authorName) + "</span>" +
          '<span class="msgboard-message-time">' + escapeHtml(when) + "</span>" +
        "</div>" +
        '<div class="msgboard-message-text">' + escapeHtml(d.text || "") + "</div>" +
        admin +
      "</div>";
    }).join("");
    els.msgBoardMessages.scrollTop = els.msgBoardMessages.scrollHeight;
  }

  function startMsgBoardListener() {
    if (msgBoardListenerStarted) return;
    msgBoardListenerStarted = true;
    db.collection("messages").orderBy("createdAt", "desc").limit(50)
      .onSnapshot(function (snap) {
        renderMsgBoardMessages(snap.docs);
      }, function (err) {
        console.error("Message board listener failed:", err);
      });
  }

  // Small collections (one doc per muted/banned user) -- loading them in
  // full into local sets is simpler and cheaper than a per-message existence
  // check, and lets Mute/Ban buttons show the correct Unmute/Unban label.
  function startMsgBoardModListeners() {
    if (msgBoardModListenersStarted) return;
    msgBoardModListenersStarted = true;
    db.collection("mutedUsers").onSnapshot(function (snap) {
      msgBoardMutedSet = {};
      snap.forEach(function (doc) { msgBoardMutedSet[doc.id] = true; });
      renderMsgBoardMessages(msgBoardLastDocs);
    }, function (err) {
      console.error("Muted-users listener failed:", err);
    });
    db.collection("bannedUsers").onSnapshot(function (snap) {
      msgBoardBannedSet = {};
      snap.forEach(function (doc) { msgBoardBannedSet[doc.id] = true; });
      renderMsgBoardMessages(msgBoardLastDocs);
    }, function (err) {
      console.error("Banned-users listener failed:", err);
    });
  }

  function watchMsgBoardOwnStatus() {
    if (msgBoardOwnStatusUnsub) { msgBoardOwnStatusUnsub(); msgBoardOwnStatusUnsub = null; }
    msgBoardOwnMuted = false;
    msgBoardOwnBanned = false;
    if (!currentUser) { updateMsgBoardComposer(); return; }
    var uid = currentUser.uid;
    var unsubMuted = db.collection("mutedUsers").doc(uid).onSnapshot(function (doc) {
      msgBoardOwnMuted = doc.exists;
      updateMsgBoardComposer();
    });
    var unsubBanned = db.collection("bannedUsers").doc(uid).onSnapshot(function (doc) {
      msgBoardOwnBanned = doc.exists;
      updateMsgBoardComposer();
    });
    msgBoardOwnStatusUnsub = function () { unsubMuted(); unsubBanned(); };
  }

  function updateMsgBoardComposer() {
    var blocked = msgBoardOwnBanned || msgBoardOwnMuted;
    els.msgBoardForm.hidden = !currentUser || blocked;
    els.msgBoardSigninNote.hidden = !!currentUser;
    els.msgBoardBlockedNote.hidden = !currentUser || !blocked;
    if (currentUser && blocked) {
      els.msgBoardBlockedNote.textContent = msgBoardOwnBanned
        ? "You've been banned from posting to the message board."
        : "You've been muted and can't post right now.";
    }
  }

  function openMsgBoard() {
    els.msgBoardPanel.hidden = false;
    els.msgBoardTab.setAttribute("aria-expanded", "true");
    startMsgBoardListener();
    if (state.isAdmin) startMsgBoardModListeners();
    updateMsgBoardComposer();
  }

  function closeMsgBoard() {
    if (els.msgBoardPanel.hidden) return;
    els.msgBoardPanel.hidden = true;
    els.msgBoardTab.setAttribute("aria-expanded", "false");
  }

  els.msgBoardTab.addEventListener("click", function () {
    if (els.msgBoardPanel.hidden) openMsgBoard(); else closeMsgBoard();
  });
  els.msgBoardClose.addEventListener("click", closeMsgBoard);

  els.msgBoardSignInBtn.addEventListener("click", function () {
    auth.signInWithPopup(googleProvider).catch(function (err) {
      console.error("Sign-in failed:", err);
    });
  });

  els.msgBoardForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!currentUser) return;
    var text = els.msgBoardInput.value.trim();
    if (!text) return;

    var sendBtn = els.msgBoardForm.querySelector("button");
    sendBtn.disabled = true;
    db.collection("messages").add({
      text: text,
      authorUid: currentUser.uid,
      authorName: currentUser.displayName || currentUser.email || "Anonymous",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () {
      els.msgBoardInput.value = "";
    }).catch(function (err) {
      console.error("Posting message failed:", err);
    }).finally(function () {
      sendBtn.disabled = false;
    });
  });

  // Admin moderation actions, delegated since renderMsgBoardMessages()
  // regenerates the message list's innerHTML on every update.
  els.msgBoardMessages.addEventListener("click", function (e) {
    if (!state.isAdmin) return;

    var delBtn = e.target.closest(".msgboard-admin-delete");
    if (delBtn) {
      var msgId = delBtn.getAttribute("data-msgid");
      db.collection("messages").doc(msgId).delete().catch(function (err) {
        console.error("Delete message failed:", err);
        alert("Delete failed: " + err.message);
      });
      return;
    }

    var muteBtn = e.target.closest(".msgboard-admin-mute");
    if (muteBtn) {
      var muteUid = muteBtn.getAttribute("data-uid");
      var muteName = muteBtn.getAttribute("data-name") || "";
      var muteRef = db.collection("mutedUsers").doc(muteUid);
      if (msgBoardMutedSet[muteUid]) {
        muteRef.delete().catch(function (err) {
          console.error("Unmute failed:", err);
          alert("Unmute failed: " + err.message);
        });
      } else {
        muteRef.set({
          mutedAt: firebase.firestore.FieldValue.serverTimestamp(),
          mutedBy: currentUser.uid,
          name: muteName
        }).catch(function (err) {
          console.error("Mute failed:", err);
          alert("Mute failed: " + err.message);
        });
      }
      return;
    }

    var banBtn = e.target.closest(".msgboard-admin-ban");
    if (banBtn) {
      var banUid = banBtn.getAttribute("data-uid");
      var banName = banBtn.getAttribute("data-name") || "";
      var banRef = db.collection("bannedUsers").doc(banUid);
      if (msgBoardBannedSet[banUid]) {
        banRef.delete().catch(function (err) {
          console.error("Unban failed:", err);
          alert("Unban failed: " + err.message);
        });
        return;
      }
      if (!window.confirm("Ban " + banName + "? This also deletes all of their existing messages.")) return;
      banRef.set({
        bannedAt: firebase.firestore.FieldValue.serverTimestamp(),
        bannedBy: currentUser.uid,
        name: banName
      }).then(function () {
        return db.collection("messages").where("authorUid", "==", banUid).get();
      }).then(function (snap) {
        if (snap.empty) return;
        var batch = db.batch();
        snap.forEach(function (doc) { batch.delete(doc.ref); });
        return batch.commit();
      }).catch(function (err) {
        console.error("Ban failed:", err);
        alert("Ban failed: " + err.message);
      });
    }
  });

  // Two mutually-exclusive mobile views (see styles.css): Home (browse --
  // Latest Submissions, ad banner, Featured) and Search (tabs, search box,
  // filters, results). Home is the default landing state; Search is only
  // entered via the bottom nav's Search button. No-op on desktop, where
  // both sets of sections are always shown regardless. TV Mode is a
  // lightbox (see openTVModal()), not a view -- its bottom-nav button just
  // opens the modal and was never part of this active-view tracking.
  var bottomNavViewButtons = [
    { btn: els.bottomNavHome, view: "home" },
    { btn: els.bottomNavSearch, view: "search" },
    { btn: els.bottomNavFavorites, view: "favorites" }
  ];

  function setMobileView(view) {
    state.mobileView = view;
    document.body.classList.toggle("mobile-view-home", view === "home");
    document.body.classList.toggle("mobile-view-search", view === "search");
    document.body.classList.toggle("mobile-view-favorites", view === "favorites");
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

  els.bottomNavFavorites.addEventListener("click", function () {
    sharedFavoritesUid = null;
    renderFavoritesStrip(state.rows);
    setMobileView("favorites");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  els.bottomNavTV.addEventListener("click", openTVModalFresh);

  els.bottomNavSettings.addEventListener("click", openSettingsModal);

  // Desktop's equivalent of the mobile view switch above: Home (default,
  // no class) is the full page exactly as it's always been -- Latest/
  // Featured stay right where they are. Search, Favorites, and TV are
  // dedicated alternate views (see styles.css) reached via the sidebar's
  // Home/Favorites links, the top-bar search bar, or TV Mode's own button
  // (TV Mode itself is a lightbox, not a view -- see openTVModal()).
  function setDesktopView(view) {
    document.body.classList.toggle("desktop-view-search", view === "search");
    document.body.classList.toggle("desktop-view-favorites", view === "favorites");
  }

  els.sidebarHomeBtn.addEventListener("click", function () {
    setDesktopView("home");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  els.topBarHomeLink.addEventListener("click", function (e) {
    e.preventDefault();
    setDesktopView("home");
    setMobileView("home");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  els.sidebarTVBtn.addEventListener("click", openTVModalFresh);

  els.sidebarFavoritesBtn.addEventListener("click", function () {
    sharedFavoritesUid = null;
    renderFavoritesStrip(state.rows);
    setDesktopView("favorites");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Ever-present search bar (YouTube/Spotify-style) replacing the old
  // icon-triggered overlay -- desktop-view-search is now driven purely by
  // "is there a query," so there's no separate open/close state to get
  // stuck in. Focusing the (empty) box still reveals tabs/filters/jump nav
  // immediately, matching the old icon-click behavior, so browsing by
  // tab/letter doesn't require typing first -- and unlike a blur-triggered
  // revert, it STAYS revealed while clicking around that cluster (tabs,
  // filters, jump-nav letters all blur the input too, which would otherwise
  // slam the view back to Home mid-click). The clear (x) button and Escape
  // are the explicit ways back to Home.
  function resetTopBarSearch() {
    els.topBarSearchInput.value = "";
    els.search.value = "";
    state.query = "";
    els.topBarSearchClear.hidden = true;
    setDesktopView("home");
    render();
  }

  els.topBarSearchInput.addEventListener("focus", function () {
    setDesktopView("search");
  });

  var topBarSearchTimer = null;
  els.topBarSearchInput.addEventListener("input", function () {
    els.topBarSearchClear.hidden = !els.topBarSearchInput.value;
    clearTimeout(topBarSearchTimer);
    topBarSearchTimer = setTimeout(function () {
      state.query = els.topBarSearchInput.value.trim();
      if (state.query) state.activeLetter = null;
      els.search.value = state.query; // keep the mobile search box in sync
      setDesktopView("search");
      render();
    }, 120);
  });

  els.topBarSearchInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      els.topBarSearchInput.blur();
    } else if (e.key === "Escape") {
      resetTopBarSearch();
      els.topBarSearchInput.blur();
    }
  });

  els.topBarSearchClear.addEventListener("click", function () {
    // Order matters: focusing fires the focus listener above (which enters
    // search view), so it has to happen BEFORE resetTopBarSearch's own
    // setDesktopView("home") for Home to be the state that actually sticks.
    els.topBarSearchInput.focus();
    resetTopBarSearch();
  });

  els.topBarSettingsBtn.addEventListener("click", openSettingsModal);
  els.topBarAdminBtn.addEventListener("click", openAdminModal);

  // On mobile the sidebar is a fullscreen modal (history-integrated,
  // scroll-locked, auto-closes on item click/outside click/Escape). On
  // desktop it's a persistent rail that just widens/narrows on toggle --
  // no history entry, no scroll lock, and it doesn't auto-collapse just
  // because something inside it was clicked.
  function isMobileHeaderMenu() {
    return window.matchMedia("(max-width: 640px)").matches;
  }

  function closeHeaderMenu() {
    if (!els.headerLinks.classList.contains("is-open")) return;
    els.headerLinks.classList.remove("is-open");
    els.headerMenuBtn.setAttribute("aria-expanded", "false");
    if (isMobileHeaderMenu()) unlockBodyScroll();
  }

  els.headerMenuBtn.addEventListener("click", function () {
    var isOpen = els.headerLinks.classList.contains("is-open");
    if (isOpen) {
      if (isMobileHeaderMenu()) dismissTopModal(); else closeHeaderMenu();
      return;
    }
    els.headerLinks.classList.add("is-open");
    els.headerMenuBtn.setAttribute("aria-expanded", "true");
    if (isMobileHeaderMenu()) {
      lockBodyScroll();
      pushModalHistory();
    }
  });

  // Desktop's sidebar starts expanded (labels visible) rather than
  // collapsed to an icon rail -- mobile must NOT get this (it would open
  // the fullscreen overlay on every load), so it's set here in JS rather
  // than just adding "is-open" in the HTML.
  if (!isMobileHeaderMenu()) {
    els.headerLinks.classList.add("is-open");
    els.headerMenuBtn.setAttribute("aria-expanded", "true");
  }

  // Closing on any link/button click inside the menu covers navigation,
  // opening a modal, or signing in/out -- all of which should collapse it
  // on mobile (a transient fullscreen overlay). The explicit close (X)
  // button is a dismiss action, so it goes through dismissTopModal() to
  // consume the pushed history entry via a real back navigation, same as
  // the outside-click handler below. Desktop's persistent rail ignores
  // both -- it only opens/closes via the hamburger itself.
  els.headerLinks.addEventListener("click", function (e) {
    if (!isMobileHeaderMenu()) return;
    if (e.target.closest("#headerMenuClose")) {
      dismissTopModal();
      return;
    }
    if (e.target.closest("a, button")) closeHeaderMenu();
  });

  document.addEventListener("click", function (e) {
    if (!isMobileHeaderMenu()) return;
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

  function openPodcastModal() {
    els.podcastModal.hidden = false;
    els.podcastModal.querySelector(".lightbox-panel").scrollTop = 0;
    lockBodyScroll();
    pushModalHistory();
  }

  function closePodcastModal() {
    if (els.podcastModal.hidden) return;
    els.podcastModal.hidden = true;
    unlockBodyScroll();
  }

  els.openPodcastBtn.addEventListener("click", openPodcastModal);

  els.podcastModal.addEventListener("click", function (e) {
    if (e.target.closest(".lightbox-close") || e.target.closest(".lightbox-backdrop")) {
      dismissTopModal();
    }
  });

  function applyAutoplayToggle(on) {
    Array.prototype.forEach.call(els.autoplayToggle.querySelectorAll(".settings-theme-btn"), function (btn) {
      btn.classList.toggle("is-active", (btn.getAttribute("data-autoplay-choice") === "on") === on);
    });
  }

  els.autoplayToggle.addEventListener("click", function (e) {
    var btn = e.target.closest(".settings-theme-btn");
    if (!btn) return;
    var on = btn.getAttribute("data-autoplay-choice") === "on";
    saveAutoplayPref(on);
    applyAutoplayToggle(on);
  });

  function openSettingsModal() {
    els.settingsSyncNote.hidden = !currentUser;
    els.favoritesSyncNote.hidden = !currentUser;
    els.settingsStatus.hidden = true;
    var currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(currentTheme);
    applyAutoplayToggle(loadAutoplayPref());
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

  els.clearFavoritesBtn.addEventListener("click", function () {
    saveFavorites([]);
    // pushToFirestore() sends the now-empty list, so the account copy is
    // cleared too rather than resurrecting the favorites on next sign-in.
    pushToFirestore();
    renderFavoritesStrip(state.rows);
    els.settingsStatus.textContent = "Favorites cleared.";
    els.settingsStatus.hidden = false;
  });

  // Shared by both share buttons -- Settings' original one, and the
  // favoritesShareBtn beside Play All on the Favorites page itself, which
  // is the more discoverable spot for it (see task: "should be visible as
  // a button beside play all").
  function updateShareButtons() {
    var sharing = isSharingFavorites();
    els.shareFavoritesBtn.textContent = sharing ? "Stop sharing" : "Get link";
    els.favoritesShareBtn.textContent = sharing ? "Stop sharing" : "Share Favorites";
  }
  updateShareButtons();

  function toggleShareFavorites(showStatus) {
    if (!currentUser) {
      showStatus("Sign in to share your favorites.");
      return;
    }

    if (isSharingFavorites()) {
      try { localStorage.setItem(SHARE_FAVORITES_KEY, "0"); } catch (e) {}
      deletePublicFavorites();
      updateShareButtons();
      showStatus("Sharing turned off.");
      return;
    }

    try { localStorage.setItem(SHARE_FAVORITES_KEY, "1"); } catch (e) {}
    pushPublicFavorites();
    updateShareButtons();

    var link = location.origin + location.pathname + "#favs-" + currentUser.uid;
    var announce = function (copied) {
      showStatus((copied ? "Link copied: " : "Your link: ") + link);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(function () { announce(true); }).catch(function () { announce(false); });
    } else {
      announce(false);
    }
  }

  els.shareFavoritesBtn.addEventListener("click", function () {
    toggleShareFavorites(function (msg) {
      els.settingsStatus.textContent = msg;
      els.settingsStatus.hidden = false;
    });
  });

  els.favoritesShareBtn.addEventListener("click", function () {
    toggleShareFavorites(function (msg) {
      els.favoritesShareStatus.textContent = msg;
      els.favoritesShareStatus.hidden = false;
    });
  });

  // ---- Admin panel (Manage Entries) ----------------------------------
  // Reads live from Firestore's `videos` collection (not the public
  // snapshot -- see Phase 5) so admin edits are visible immediately.
  // Firestore security rules restrict `videos` read/write to signed-in
  // users present in the `admins` collection; state.isAdmin here only
  // controls UI visibility, it isn't itself a security boundary.

  function openAdminModalChrome() {
    els.adminModal.hidden = false;
    els.adminModal.querySelector(".lightbox-panel").scrollTop = 0;
    lockBodyScroll();
    pushModalHistory();
  }

  // Opens the modal onto the landing chooser -- deliberately does NOT load
  // anything. Manage Entries (full browse/search) is the only path that
  // reads the whole `videos` collection; Add Entry and Bulk Import reserve
  // fresh IDs via meta/counters instead of scanning for the max, so they
  // don't need it loaded at all.
  function openAdminModal() {
    state.adminReturnView = "landing";
    els.adminLandingStatus.hidden = true;
    showAdminLanding();
    openAdminModalChrome();
  }

  function showAdminLanding() {
    els.adminForm.hidden = true;
    els.adminBulkView.hidden = true;
    els.adminListView.hidden = true;
    els.adminLandingView.hidden = false;
  }

  function goAdminManageEntries() {
    state.adminReturnView = "list";
    els.adminStatus.hidden = true;
    els.adminSearchInput.value = "";
    showAdminList();
    return loadAdminEntries();
  }

  // Jumps straight to editing a specific entry (e.g. from the lightbox's
  // admin Edit button) without reading the entire ~13k-doc `videos`
  // collection just to populate one form -- fetches only that one document.
  function openAdminEditForRow(rowNum) {
    state.adminReturnView = "lightbox";
    closeLightbox();
    showAdminForm(null);
    openAdminModalChrome();
    els.adminFormTitle.textContent = "Loading…";
    els.adminFormSaveBtn.disabled = true;
    db.collection("videos").doc(rowNum).get().then(function (doc) {
      if (!doc.exists) {
        els.adminFormTitle.textContent = "Entry not found";
        els.adminFormStatus.textContent = "No entry with rowNum " + rowNum + ".";
        els.adminFormStatus.className = "admin-status is-error";
        els.adminFormStatus.hidden = false;
        return;
      }
      showAdminForm(doc.data());
    }).catch(function (err) {
      console.error("Admin single-entry load failed:", err);
      els.adminFormTitle.textContent = "Couldn't load entry";
      els.adminFormStatus.textContent = err.message;
      els.adminFormStatus.className = "admin-status is-error";
      els.adminFormStatus.hidden = false;
      els.adminFormSaveBtn.disabled = false;
    });
  }

  // Removes a row from state.rows and re-derives everything the public UI
  // shows from it -- no network fetch, mirrors what a real reload would do
  // but working off the locally-patched array. Skips applyDeepLinkFromHash()
  // deliberately: the row that hash might reference no longer exists.
  function removeRowAndRerender(rowNum) {
    state.rows = state.rows.filter(function (r) { return r.rowNum !== rowNum; });
    saveCache(state.rows);
    buildCategoryChips(state.rows);
    updateCategoryChipsActive();
    buildYearOptions(state.rows);
    els.yearFilter.value = state.year;
    buildGenreOptions(state.rows);
    els.genreFilter.value = state.genre;
    buildCountryOptions(state.rows);
    els.countryFilter.value = state.country;
    updateFiltersToggleCount();
    updateSubtitleStats(state.rows);
    state.recentSet = computeRecentSet(state.rows);
    renderLatestStrip(state.rows);
    renderFeaturedStrip(state.rows);
    renderRecentList(state.rows);
    renderFavoritesStrip(state.rows);
    renderSpotlightSidebar(state.rows);
    render();
  }

  // Deletes straight from wherever a single entry is being viewed
  // (admin-only) -- single-doc delete, same cost profile as the Edit
  // button. Removing it from state.rows makes it disappear from the
  // current page immediately; clearing the URL hash stops a stale #row-N
  // link from trying to reopen it. The public snapshot isn't updated until
  // Publish, same as any other single admin change -- lands on the admin
  // landing screen afterward with Publish one click away, rather than
  // silently leaving it unpublished. closeModalFn closes whatever view the
  // delete was triggered from (the lightbox, or TV Mode) before showing
  // the admin landing confirmation.
  function deleteRowByAdmin(rowNum, label, closeModalFn) {
    if (!window.confirm('Delete "' + label + '"? This can\'t be undone.')) return;
    db.collection("videos").doc(rowNum).delete().then(function () {
      closeModalFn();
      removeRowAndRerender(rowNum);
      removeAdminRowLocal(rowNum);
      if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
      state.adminReturnView = "landing";
      showAdminLanding();
      openAdminModalChrome();
      els.adminLandingStatus.textContent = 'Deleted "' + label + '". Remember to Publish so the live site reflects it.';
      els.adminLandingStatus.className = "admin-status";
      els.adminLandingStatus.hidden = false;
    }).catch(function (err) {
      console.error("Admin delete failed:", err);
      alert("Delete failed: " + err.message);
    });
  }

  function deleteRowFromLightbox(rowNum, label) {
    deleteRowByAdmin(rowNum, label, closeLightbox);
  }

  // Cancel/Back from the form or bulk-import subview -- returns to wherever
  // it was entered from, without fabricating a partial list if Manage
  // Entries was never loaded.
  function returnFromAdminSubview() {
    if (state.adminReturnView === "list") showAdminList();
    else showAdminLanding();
  }

  function showAdminList() {
    els.adminLandingView.hidden = true;
    els.adminForm.hidden = true;
    els.adminBulkView.hidden = true;
    els.adminListView.hidden = false;
  }

  // Reserves `count` sequential rowNums atomically via meta/counters, so
  // Add Entry / Bulk Import can assign fresh IDs without ever scanning the
  // `videos` collection for the current max.
  function reserveRowNums(count) {
    var counterRef = db.collection("meta").doc("counters");
    return db.runTransaction(function (tx) {
      return tx.get(counterRef).then(function (doc) {
        var next = doc.exists && doc.data().nextRowNum ? doc.data().nextRowNum : 1;
        var reserved = [];
        for (var i = 0; i < count; i++) reserved.push(String(next + i));
        tx.set(counterRef, { nextRowNum: next + count }, { merge: true });
        return reserved;
      });
    });
  }

  function findAdminRowByNum(rowNum) {
    return state.adminRows.filter(function (r) { return r.rowNum === rowNum; })[0] || null;
  }

  // Updates the already-loaded state.adminRows in place instead of re-reading
  // the entire ~13k-doc collection after every single add/edit/delete --
  // Manage Entries only needs display fields (not the Firestore-only
  // featureAt/spotlightAt/createdAt/updatedAt bookkeeping), so a plain local
  // merge keeps the list accurate without another network read.
  function upsertAdminRowLocal(rowNum, fields) {
    var plain = {
      rowNum: rowNum, artist: fields.artist, song: fields.song, director: fields.director,
      category: fields.category, youtube: fields.youtube, mvg: fields.mvg, year: fields.year,
      releaseDate: fields.releaseDate, studio: fields.studio, producer: fields.producer,
      dp: fields.dp, editor: fields.editor, choreographer: fields.choreographer, country: fields.country,
      genres: fields.genres, description: fields.description, feature: fields.feature, spotlight: fields.spotlight,
      sponsored: fields.sponsored
    };
    var idx = -1;
    for (var i = 0; i < state.adminRows.length; i++) {
      if (state.adminRows[i].rowNum === rowNum) { idx = i; break; }
    }
    if (idx === -1) state.adminRows.push(plain); else state.adminRows[idx] = plain;
  }

  function removeAdminRowLocal(rowNum) {
    state.adminRows = state.adminRows.filter(function (r) { return r.rowNum !== rowNum; });
  }

  function showAdminForm(row) {
    els.adminLandingView.hidden = true;
    els.adminListView.hidden = true;
    els.adminBulkView.hidden = true;
    els.adminForm.hidden = false;
    els.adminForm.scrollTop = 0;
    els.adminFormStatus.hidden = true;
    els.adminFormSaveBtn.disabled = false;
    els.adminFormTitle.textContent = row ? "Edit Entry" : "Add Entry";
    els.adminForm.reset();
    state.adminFormOriginal = row ? { feature: !!row.feature, spotlight: !!row.spotlight, sponsored: !!row.sponsored } : null;
    var f = els.adminForm;
    f.elements.rowNum.value = row ? row.rowNum : "";
    if (row) {
      ["artist", "song", "director", "category", "youtube", "mvg", "year", "releaseDate",
        "studio", "producer", "dp", "editor", "choreographer", "country", "description"].forEach(function (key) {
        if (f.elements[key]) f.elements[key].value = row[key] || "";
      });
      f.elements.genres.value = (row.genres || []).join(", ");
      f.elements.feature.checked = !!row.feature;
      f.elements.spotlight.checked = !!row.spotlight;
      f.elements.sponsored.checked = !!row.sponsored;
    }
  }

  // Ported from the Apps Script onEdit cap-eviction logic (see CHANGELOG) --
  // same algorithm, retargeted at Firestore documents instead of Sheet
  // ranges. Docs with no timestamp sort as oldest (see reconcile-caps.js).
  function enforceCap(field, timestampField, cap) {
    return db.collection("videos").where(field, "==", true).get().then(function (snap) {
      if (snap.size <= cap) return;
      var docs = snap.docs.slice().sort(function (a, b) {
        var ta = a.data()[timestampField], tb = b.data()[timestampField];
        var ma = ta ? ta.toMillis() : 0;
        var mb = tb ? tb.toMillis() : 0;
        if (ma !== mb) return ma - mb;
        return parseInt(a.data().rowNum, 10) - parseInt(b.data().rowNum, 10);
      });
      var toEvict = docs.slice(0, docs.length - cap);
      var batch = db.batch();
      toEvict.forEach(function (d) {
        var patch = {};
        patch[field] = false;
        patch[timestampField] = null;
        patch.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        batch.update(d.ref, patch);
      });
      return batch.commit();
    });
  }

  // ---- Publish snapshot ------------------------------------------------
  // Reads the full `videos` collection and republishes catalog/snapshot.json
  // in Cloud Storage -- the file the public site actually reads (see
  // SNAPSHOT_URL/fetchData()). Admin-only per Storage rules.
  function publishSnapshot() {
    return db.collection("videos").get().then(function (snap) {
      var rows = snap.docs.map(function (doc) {
        var d = doc.data();
        return {
          rowNum: d.rowNum || "",
          artist: d.artist || "",
          song: d.song || "",
          director: d.director || "",
          category: d.category || "",
          youtube: d.youtube || "",
          mvg: d.mvg || "",
          year: d.year || "",
          releaseDate: d.releaseDate || "",
          studio: d.studio || "",
          producer: d.producer || "",
          dp: d.dp || "",
          editor: d.editor || "",
          choreographer: d.choreographer || "",
          country: d.country || "",
          genres: d.genres || [],
          description: d.description || "",
          feature: !!d.feature,
          spotlight: !!d.spotlight,
          sponsored: !!d.sponsored,
          // youtubeSearchText (the uploader's own YouTube description/tags,
          // backfilled via scripts/backfill-youtube-metadata.js) fills the
          // search gap for entries with no curated description of our own.
          searchHaystack: [d.artist, d.song, d.director, d.producer, d.dp, d.editor, d.choreographer, d.studio, d.description, d.youtubeSearchText].join(" ").toLowerCase()
        };
      });
      // Firestore's collection get() doesn't guarantee row order -- sort by
      // rowNum ascending (matching the original CSV's stable order) so
      // downstream consumers that rely on a deterministic row order (e.g.
      // generate-seo-pages.js's slug-collision numbering) don't have entries
      // randomly swap URLs between publishes.
      rows.sort(function (a, b) { return parseInt(a.rowNum, 10) - parseInt(b.rowNum, 10); });
      var jsonBlob = new Blob([JSON.stringify(rows)], { type: "application/json" });
      var ref = firebase.storage().ref("catalog/snapshot.json");
      // Gzip before upload -- the JSON is highly repetitive (same field names
      // on every row) and compresses to roughly a quarter of its raw size,
      // which matters a lot for visitors on slow/mobile connections. Browsers
      // decompress Content-Encoding: gzip transparently, so fetchData() needs
      // no changes on the read side. Falls back to an uncompressed upload on
      // browsers without CompressionStream (Safari < 16.4) rather than
      // failing the publish outright.
      var uploadPromise = window.CompressionStream
        ? new Response(jsonBlob.stream().pipeThrough(new CompressionStream("gzip"))).blob().then(function (gzBlob) {
            return ref.put(gzBlob, { cacheControl: "public, max-age=300", contentType: "application/json", contentEncoding: "gzip" });
          })
        : ref.put(jsonBlob, { cacheControl: "public, max-age=300", contentType: "application/json" });
      return uploadPromise.then(function () {
        return { count: rows.length };
      });
    });
  }

  els.adminPublishBtn.addEventListener("click", function () {
    els.adminPublishBtn.disabled = true;
    runAdminPublish(els.adminStatus).then(function () {
      els.adminPublishBtn.disabled = false;
    });
  });

  // ---- Bulk import/upsert ---------------------------------------------
  // Header-row-driven paste: columns are matched by name (via the same
  // `get()`/`readGenres()`/`fixReleaseDate()` helpers cleanRows() uses for
  // the CSV), not position, so pasting a spreadsheet range with columns in
  // whatever order they happen to be in just works -- no more manual
  // cut-and-paste-shifted-by-N-columns to realign fields.

  var BULK_BATCH_SIZE = 500;

  // Header matching is case-insensitive and alias-aware -- the master sheet
  // and the "Submissions" intake sheet spell some columns differently
  // ("YouTube Link" vs "Youtube Link", "Year" vs "Year of release", "DP" vs
  // "Director of Photography"), which is exactly the kind of mismatch that
  // used to force manual cut-and-paste column realignment. Any of these
  // spellings works regardless of which sheet you're pasting from.
  var BULK_FIELD_ALIASES = {
    rowNum: ["row #", "row#", "row number"],
    artist: ["artist"],
    song: ["song title", "song"],
    director: ["director"],
    category: ["category"],
    youtube: ["youtube link", "youtube"],
    mvg: ["mvg link", "mvg"],
    year: ["year", "year of release"],
    releaseDate: ["release date", "release date (optional)"],
    studio: ["studio"],
    producer: ["producer"],
    dp: ["dp", "director of photography"],
    editor: ["editor"],
    choreographer: ["choreographer"],
    country: ["country"],
    description: ["description"],
    feature: ["feature"],
    spotlight: ["spotlight"],
    sponsored: ["sponsored"]
  };
  var BULK_GENRE_SPLIT_ALIASES = ["genre 1", "genre 2", "genre 3"];
  var BULK_GENRE_LEGACY_ALIASES = ["genre"];

  // Normalizes a PapaParse-parsed row's keys (trim + lowercase) once, so
  // every alias lookup below is a simple case-insensitive map read instead
  // of a repeated case-sensitive scan.
  function normalizeBulkRow(raw) {
    var norm = {};
    Object.keys(raw).forEach(function (k) {
      norm[k.trim().toLowerCase()] = raw[k];
    });
    return norm;
  }

  function pickAlias(normRow, aliases) {
    for (var i = 0; i < aliases.length; i++) {
      var v = normRow[aliases[i]];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  }

  function readBulkGenres(normRow) {
    var out = [];
    BULK_GENRE_SPLIT_ALIASES.forEach(function (alias) {
      var v = normRow[alias];
      if (v != null && String(v).trim() !== "") out.push(String(v).trim());
    });
    if (!out.length) {
      var legacy = pickAlias(normRow, BULK_GENRE_LEGACY_ALIASES);
      if (legacy) out = legacy.split(";").map(function (s) { return s.trim(); }).filter(Boolean);
    }
    var seen = {};
    return out.filter(function (g) { if (seen[g]) return false; seen[g] = true; return true; });
  }

  function showAdminBulk() {
    els.adminLandingView.hidden = true;
    els.adminListView.hidden = true;
    els.adminForm.hidden = true;
    els.adminBulkView.hidden = false;
    els.adminBulkTextarea.value = "";
    els.adminBulkStatus.hidden = true;
    els.adminBulkPreview.innerHTML = "";
    els.adminBulkCommitRow.hidden = true;
    state.adminBulkParsed = [];
  }

  function isTruthyFlagText(raw) {
    return /^(true|yes|y|1|x)$/i.test(String(raw || "").trim());
  }

  function buildBulkDoc(norm, rowNum, isNew, existing) {
    var feature = isTruthyFlagText(pickAlias(norm, BULK_FIELD_ALIASES.feature));
    var spotlight = isTruthyFlagText(pickAlias(norm, BULK_FIELD_ALIASES.spotlight));
    var sponsored = isTruthyFlagText(pickAlias(norm, BULK_FIELD_ALIASES.sponsored));
    var wasFeature = existing ? !!existing.feature : false;
    var wasSpotlight = existing ? !!existing.spotlight : false;

    var doc = {
      rowNum: rowNum,
      artist: pickAlias(norm, BULK_FIELD_ALIASES.artist),
      song: pickAlias(norm, BULK_FIELD_ALIASES.song),
      director: pickAlias(norm, BULK_FIELD_ALIASES.director),
      category: pickAlias(norm, BULK_FIELD_ALIASES.category),
      youtube: pickAlias(norm, BULK_FIELD_ALIASES.youtube),
      mvg: pickAlias(norm, BULK_FIELD_ALIASES.mvg),
      year: pickAlias(norm, BULK_FIELD_ALIASES.year),
      releaseDate: fixReleaseDate(pickAlias(norm, BULK_FIELD_ALIASES.releaseDate)),
      studio: pickAlias(norm, BULK_FIELD_ALIASES.studio),
      producer: pickAlias(norm, BULK_FIELD_ALIASES.producer),
      dp: pickAlias(norm, BULK_FIELD_ALIASES.dp),
      editor: pickAlias(norm, BULK_FIELD_ALIASES.editor),
      choreographer: pickAlias(norm, BULK_FIELD_ALIASES.choreographer),
      country: pickAlias(norm, BULK_FIELD_ALIASES.country),
      genres: readBulkGenres(norm),
      description: pickAlias(norm, BULK_FIELD_ALIASES.description),
      feature: feature,
      spotlight: spotlight,
      sponsored: sponsored,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (isNew) doc.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    if (feature !== wasFeature) doc.featureAt = feature ? firebase.firestore.FieldValue.serverTimestamp() : null;
    if (spotlight !== wasSpotlight) doc.spotlightAt = spotlight ? firebase.firestore.FieldValue.serverTimestamp() : null;
    return doc;
  }

  // Async: unlike the old version, this never scans the whole `videos`
  // collection. Rows that specify an existing Row # are looked up
  // individually (one read per such row, not per the whole catalog); rows
  // with no Row # (the common case -- pasting brand-new submissions) get
  // fresh IDs from a single reserveRowNums() transaction, so a pure bulk-add
  // costs 1 read + 1 write total regardless of how many rows are pasted.
  function parseBulkImportText(text) {
    var parsed = Papa.parse(text.trim(), { header: true, delimiter: "\t", skipEmptyLines: true });
    var entries = parsed.data.map(function (raw) {
      var norm = normalizeBulkRow(raw);
      var rowNum = pickAlias(norm, BULK_FIELD_ALIASES.rowNum);
      var artist = pickAlias(norm, BULK_FIELD_ALIASES.artist);
      var song = pickAlias(norm, BULK_FIELD_ALIASES.song);
      return { norm: norm, rowNum: rowNum, valid: artist !== "" || song !== "" };
    });

    var withRowNum = entries.filter(function (e) { return e.valid && e.rowNum; });
    var withoutRowNum = entries.filter(function (e) { return e.valid && !e.rowNum; });

    var lookups = Promise.all(withRowNum.map(function (e) {
      return db.collection("videos").doc(e.rowNum).get();
    }));
    var reservation = withoutRowNum.length ? reserveRowNums(withoutRowNum.length) : Promise.resolve([]);

    return Promise.all([lookups, reservation]).then(function (results) {
      var lookupDocs = results[0];
      var reservedIds = results[1];
      var existingByRowNum = {};
      withRowNum.forEach(function (e, i) {
        existingByRowNum[e.rowNum] = lookupDocs[i].exists ? lookupDocs[i].data() : null;
      });

      var nextReserved = 0;
      return entries.map(function (e) {
        if (!e.valid) return { valid: false };
        var rowNum, existing, isNew;
        if (e.rowNum) {
          rowNum = e.rowNum;
          existing = existingByRowNum[rowNum];
          isNew = !existing;
        } else {
          rowNum = reservedIds[nextReserved++];
          existing = null;
          isNew = true;
        }
        return { rowNum: rowNum, isNew: isNew, doc: buildBulkDoc(e.norm, rowNum, isNew, existing), valid: true };
      });
    });
  }

  function renderBulkPreview(rows) {
    if (!rows.length) {
      els.adminBulkPreview.innerHTML = '<p class="admin-empty">Nothing to preview -- paste some rows first.</p>';
      return;
    }
    els.adminBulkPreview.innerHTML = rows.map(function (r) {
      if (!r.valid) {
        return '<div class="admin-bulk-preview-row is-invalid"><span>(skipped -- no Artist or Song Title)</span><span class="admin-bulk-badge will-skip">Skip</span></div>';
      }
      var badge = r.isNew
        ? '<span class="admin-bulk-badge will-create">Create #' + escapeHtml(r.rowNum) + '</span>'
        : '<span class="admin-bulk-badge will-update">Update #' + escapeHtml(r.rowNum) + '</span>';
      return '<div class="admin-bulk-preview-row"><span>' + escapeHtml(r.doc.artist) + ' — ' + escapeHtml(r.doc.song) + '</span>' + badge + '</div>';
    }).join("");
  }

  els.adminBulkBtn.addEventListener("click", function () { state.adminReturnView = "list"; showAdminBulk(); });
  els.adminGoBulkBtn.addEventListener("click", function () { state.adminReturnView = "landing"; showAdminBulk(); });
  els.adminBulkCancelBtn.addEventListener("click", returnFromAdminSubview);

  els.adminBulkPreviewBtn.addEventListener("click", function () {
    var text = els.adminBulkTextarea.value;
    if (!text.trim()) {
      els.adminBulkStatus.textContent = "Paste some rows first.";
      els.adminBulkStatus.className = "admin-status is-error";
      els.adminBulkStatus.hidden = false;
      return;
    }
    els.adminBulkPreviewBtn.disabled = true;
    els.adminBulkStatus.textContent = "Checking rows…";
    els.adminBulkStatus.className = "admin-status";
    els.adminBulkStatus.hidden = false;
    parseBulkImportText(text).then(function (rows) {
      els.adminBulkPreviewBtn.disabled = false;
      state.adminBulkParsed = rows.filter(function (r) { return r.valid; });
      renderBulkPreview(rows);
      var validCount = state.adminBulkParsed.length;
      els.adminBulkStatus.textContent = validCount + " of " + rows.length + " rows ready to import.";
      els.adminBulkStatus.className = "admin-status";
      els.adminBulkCommitRow.hidden = validCount === 0;
    }).catch(function (err) {
      console.error("Bulk preview failed:", err);
      els.adminBulkPreviewBtn.disabled = false;
      els.adminBulkStatus.textContent = "Couldn't check rows: " + err.message;
      els.adminBulkStatus.className = "admin-status is-error";
    });
  });

  els.adminBulkCommitBtn.addEventListener("click", function () {
    var rows = state.adminBulkParsed;
    if (!rows.length) return;

    els.adminBulkCommitBtn.disabled = true;
    els.adminBulkStatus.textContent = "Importing " + rows.length + " rows…";
    els.adminBulkStatus.hidden = false;

    var chunks = [];
    for (var i = 0; i < rows.length; i += BULK_BATCH_SIZE) chunks.push(rows.slice(i, i + BULK_BATCH_SIZE));

    var chain = Promise.resolve();
    chunks.forEach(function (chunk) {
      chain = chain.then(function () {
        var batch = db.batch();
        chunk.forEach(function (r) { batch.set(db.collection("videos").doc(r.rowNum), r.doc, { merge: true }); });
        return batch.commit();
      });
    });

    var createdCount = rows.filter(function (r) { return r.isNew; }).length;
    var updatedCount = rows.length - createdCount;
    var anyFeature = rows.some(function (r) { return r.doc.feature; });
    var anySpotlight = rows.some(function (r) { return r.doc.spotlight; });

    chain.then(function () {
      var evictions = [];
      if (anyFeature) evictions.push(enforceCap("feature", "featureAt", 30));
      if (anySpotlight) evictions.push(enforceCap("spotlight", "spotlightAt", SPOTLIGHT_COUNT));
      return Promise.all(evictions);
    }).then(function () {
      // Bulk imports auto-publish so new entries go live without a separate
      // manual step -- single add/edit/delete still requires the Publish
      // button, since those are typically one-off and you may want to batch
      // several before republishing.
      return publishSnapshot();
    }).then(function () {
      els.adminBulkCommitBtn.disabled = false;
      var summary = createdCount + " created, " + updatedCount + " updated, and published to the live site.";
      // Patch locally rather than re-reading -- cheap either way, and keeps
      // state.adminRows accurate if Manage Entries gets opened next.
      rows.forEach(function (r) { upsertAdminRowLocal(r.rowNum, r.doc); });
      if (state.adminReturnView === "list") {
        showAdminList();
        renderAdminEntries();
        setAdminStatus(summary);
      } else {
        showAdminLanding();
        els.adminLandingStatus.textContent = summary;
        els.adminLandingStatus.className = "admin-status";
        els.adminLandingStatus.hidden = false;
      }
    }).catch(function (err) {
      console.error("Bulk import failed:", err);
      els.adminBulkCommitBtn.disabled = false;
      els.adminBulkStatus.textContent = "Import failed: " + err.message;
      els.adminBulkStatus.className = "admin-status is-error";
    });
  });

  function closeAdminModal() {
    if (els.adminModal.hidden) return;
    els.adminModal.hidden = true;
    unlockBodyScroll();
  }

  function setAdminStatus(text, isError) {
    els.adminStatus.textContent = text;
    els.adminStatus.className = "admin-status" + (isError ? " is-error" : "");
    els.adminStatus.hidden = !text;
  }

  function loadAdminEntries(statusOverride) {
    setAdminStatus("Loading entries…");
    els.adminEntriesList.innerHTML = "";
    return db.collection("videos").get().then(function (snap) {
      state.adminRows = snap.docs.map(function (doc) { return doc.data(); });
      setAdminStatus(statusOverride || (state.adminRows.length + " entries loaded."));
      renderAdminEntries();
    }).catch(function (err) {
      console.error("Admin load failed:", err);
      setAdminStatus("Couldn't load entries: " + err.message, true);
    });
  }

  function renderAdminEntries() {
    var query = els.adminSearchInput.value.trim().toLowerCase();
    var rows = state.adminRows.filter(function (r) {
      if (!query) return true;
      return (r.artist + " " + r.song + " " + r.director).toLowerCase().indexOf(query) !== -1;
    });
    // Most recently added first, same convention as the Latest strip.
    rows = rows.slice().sort(function (a, b) { return parseInt(b.rowNum, 10) - parseInt(a.rowNum, 10); });

    if (!rows.length) {
      els.adminEntriesList.innerHTML = '<p class="admin-empty">No matching entries.</p>';
      return;
    }

    els.adminEntriesList.innerHTML = rows.map(function (r) {
      var badges = "";
      if (r.feature) badges += '<span class="admin-badge">Feature</span>';
      if (r.spotlight) badges += '<span class="admin-badge">Spotlight</span>';
      if (r.sponsored) badges += '<span class="admin-badge admin-badge-sponsored">Sponsored</span>';
      return (
        '<div class="admin-row" data-rownum="' + r.rowNum + '">' +
          '<div class="admin-row-main">' +
            '<div class="admin-row-title">' + escapeHtml(r.artist) + ' — ' + escapeHtml(r.song) + '</div>' +
            '<div class="admin-row-sub">#' + escapeHtml(r.rowNum) + (r.director ? " · " + escapeHtml(r.director) : "") + " " + badges + '</div>' +
          '</div>' +
          '<div class="admin-row-actions">' +
            '<button type="button" class="admin-row-btn" data-admin-action="edit" data-rownum="' + r.rowNum + '">Edit</button>' +
            '<button type="button" class="admin-row-btn admin-row-btn-danger" data-admin-action="delete" data-rownum="' + r.rowNum + '">Delete</button>' +
          '</div>' +
        '</div>'
      );
    }).join("");
  }

  els.openAdminBtn.addEventListener("click", openAdminModal);

  els.adminModal.addEventListener("click", function (e) {
    if (e.target.closest(".lightbox-close") || e.target.closest(".lightbox-backdrop")) {
      dismissTopModal();
      return;
    }
    var editBtn = e.target.closest('[data-admin-action="edit"]');
    if (editBtn) {
      showAdminForm(findAdminRowByNum(editBtn.getAttribute("data-rownum")));
      return;
    }
    var deleteBtn = e.target.closest('[data-admin-action="delete"]');
    if (deleteBtn) {
      var rowNum = deleteBtn.getAttribute("data-rownum");
      var row = findAdminRowByNum(rowNum);
      var label = row ? row.artist + " — " + row.song : "entry #" + rowNum;
      if (!window.confirm('Delete "' + label + '"? This can\'t be undone.')) return;
      db.collection("videos").doc(rowNum).delete().then(function () {
        removeAdminRowLocal(rowNum);
        renderAdminEntries();
        setAdminStatus('Deleted "' + label + '".');
      }).catch(function (err) {
        console.error("Admin delete failed:", err);
        setAdminStatus("Delete failed: " + err.message, true);
      });
    }
  });

  els.adminGoManageBtn.addEventListener("click", goAdminManageEntries);
  els.adminBackBtn.addEventListener("click", showAdminLanding);

  els.adminGoAddBtn.addEventListener("click", function () { state.adminReturnView = "landing"; showAdminForm(null); });
  els.adminAddBtn.addEventListener("click", function () { state.adminReturnView = "list"; showAdminForm(null); });
  els.adminFormCancelBtn.addEventListener("click", returnFromAdminSubview);

  function runAdminPublish(statusEl) {
    statusEl.textContent = "Publishing snapshot…";
    statusEl.className = "admin-status";
    statusEl.hidden = false;
    return publishSnapshot().then(function (result) {
      statusEl.textContent = "Published " + result.count + " entries to the live site.";
    }).catch(function (err) {
      console.error("Publish failed:", err);
      statusEl.textContent = "Publish failed: " + err.message;
      statusEl.className = "admin-status is-error";
    });
  }

  els.adminGoPublishBtn.addEventListener("click", function () {
    els.adminGoPublishBtn.disabled = true;
    runAdminPublish(els.adminLandingStatus).then(function () {
      els.adminGoPublishBtn.disabled = false;
    });
  });

  els.adminForm.addEventListener("submit", function (e) {
    e.preventDefault();

    var formData = new FormData(els.adminForm);
    var existingRowNum = String(formData.get("rowNum") || "").trim();
    var isNew = !existingRowNum;

    els.adminFormSaveBtn.disabled = true;
    els.adminFormStatus.hidden = true;

    // New entries reserve a fresh ID via meta/counters (1 read + 1 write,
    // regardless of whether the full list was ever loaded) instead of
    // scanning state.adminRows for the current max.
    var rowNumPromise = isNew ? reserveRowNums(1).then(function (ids) { return ids[0]; }) : Promise.resolve(existingRowNum);

    rowNumPromise.then(function (rowNum) {
      var feature = formData.get("feature") === "on";
      var spotlight = formData.get("spotlight") === "on";
      var sponsored = formData.get("sponsored") === "on";
      var wasFeature = state.adminFormOriginal ? state.adminFormOriginal.feature : false;
      var wasSpotlight = state.adminFormOriginal ? state.adminFormOriginal.spotlight : false;
      var genres = String(formData.get("genres") || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);

      function field(name) { return String(formData.get(name) || "").trim(); }

      var doc = {
        rowNum: rowNum,
        artist: field("artist"),
        song: field("song"),
        director: field("director"),
        category: field("category"),
        youtube: field("youtube"),
        mvg: field("mvg"),
        year: field("year"),
        releaseDate: field("releaseDate"),
        studio: field("studio"),
        producer: field("producer"),
        dp: field("dp"),
        editor: field("editor"),
        choreographer: field("choreographer"),
        country: field("country"),
        genres: genres,
        description: field("description"),
        feature: feature,
        spotlight: spotlight,
        sponsored: sponsored,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (isNew) doc.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      // Only touch *At when a flag actually flips -- leave an already-true
      // flag's original timestamp alone so cap-eviction ordering stays correct.
      if (feature !== wasFeature) doc.featureAt = feature ? firebase.firestore.FieldValue.serverTimestamp() : null;
      if (spotlight !== wasSpotlight) doc.spotlightAt = spotlight ? firebase.firestore.FieldValue.serverTimestamp() : null;

      return db.collection("videos").doc(rowNum).set(doc, { merge: true }).then(function () {
        var evictions = [];
        if (feature && !wasFeature) evictions.push(enforceCap("feature", "featureAt", 30));
        if (spotlight && !wasSpotlight) evictions.push(enforceCap("spotlight", "spotlightAt", SPOTLIGHT_COUNT));
        return Promise.all(evictions);
      }).then(function () {
        // A single edit opened straight from the lightbox never loaded the
        // full list -- just close instead of paying for a ~13k-doc read only
        // to show a list the admin didn't ask for. From the landing
        // shortcut, there's no list to refresh either -- go back to landing
        // with a confirmation. Only from Manage Entries itself is there a
        // loaded list worth patching in place.
        if (state.adminReturnView === "lightbox") {
          dismissTopModal();
        } else if (state.adminReturnView === "list") {
          upsertAdminRowLocal(rowNum, doc);
          showAdminList();
          renderAdminEntries();
          setAdminStatus((isNew ? "Added " : "Updated ") + doc.artist + " — " + doc.song + ".");
        } else {
          upsertAdminRowLocal(rowNum, doc);
          showAdminLanding();
          els.adminLandingStatus.textContent = (isNew ? "Added " : "Updated ") + doc.artist + " — " + doc.song + ".";
          els.adminLandingStatus.className = "admin-status";
          els.adminLandingStatus.hidden = false;
        }
      });
    }).catch(function (err) {
      console.error("Admin save failed:", err);
      els.adminFormStatus.textContent = "Save failed: " + err.message;
      els.adminFormStatus.hidden = false;
      els.adminFormSaveBtn.disabled = false;
    });
  });

  els.adminSearchInput.addEventListener("input", renderAdminEntries);

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
        els.submitForm.reset();
        els.submitFormStatus.hidden = true;
        // A dedicated popup (with the Ko-fi ask from the Support page,
        // plus Go back/Submit again) replaces the old inline status
        // message + 2.2s auto-close -- reads unmistakably as "something
        // just happened" instead of a content change that's easy to miss
        // on a long form, and gives an explicit next action.
        closeSubmitModal();
        openSubmitThanksModal();
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

  els.submitThanksBack.addEventListener("click", dismissTopModal);

  els.submitThanksAgain.addEventListener("click", function () {
    closeSubmitThanksModal();
    openSubmitModal();
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
    var adminEditBtn = e.target.closest(".lightbox-admin-edit-btn");
    if (adminEditBtn) {
      openAdminEditForRow(adminEditBtn.getAttribute("data-rownum"));
      return;
    }
    var adminDeleteBtn = e.target.closest(".lightbox-admin-delete-btn");
    if (adminDeleteBtn) {
      deleteRowFromLightbox(adminDeleteBtn.getAttribute("data-rownum"), adminDeleteBtn.getAttribute("data-label"));
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
    var anyOpen = !els.lightbox.hidden || !els.tvModal.hidden || !els.submitModal.hidden || !els.submitThanksModal.hidden ||
      !els.settingsModal.hidden ||
      !els.recentModal.hidden || !els.podcastModal.hidden ||
      !els.adminModal.hidden || els.headerLinks.classList.contains("is-open");
    if (anyOpen) dismissTopModal();
    if (!els.msgBoardPanel.hidden) closeMsgBoard();
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

    // Thumbnail is only shown on desktop (see styles.css) -- mobile keeps
    // the compact text-row list unchanged. Always included in the markup
    // either way so there's no separate desktop/mobile render path.
    var id = extractYouTubeId(row.youtube);
    var thumbAlt = escapeHtml((row.song || "Untitled") + (row.artist ? " — " + row.artist : ""));
    var thumb = '<div class="entry-thumb">' +
      (id ? '<img src="https://i.ytimg.com/vi/' + id + '/mqdefault.jpg" alt="' + thumbAlt + '" loading="lazy">' : "") +
      "</div>";

    return (
      '<li class="entry" data-row="' + escapeHtml(row.rowNum) + '">' +
      '<div class="entry-row" role="button" tabindex="0" aria-haspopup="dialog">' +
      thumb +
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
    refreshTVPoolIfActive();
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
      return;
    }

    els.jumpBottom.hidden = false;

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
      var view = tab.getAttribute("data-view");
      setActiveTab(view);
      saveLastTabPref(view);
      render();
    });
  });

  // Sync the tab buttons' active/aria state to the restored view -- the
  // HTML hardcodes "By Director" as active by default.
  setActiveTab(state.view);

  function applyDeepLinkFromHash() {
    var m = location.hash.match(/^#row-(.+)$/);
    if (!m || !state.rows.length) return;
    var rowNum = decodeURIComponent(m[1]);
    var row = findRowByNum(rowNum);
    if (!row) return;
    openLightbox(row);
  }

  window.addEventListener("hashchange", applyDeepLinkFromHash);

  // #favs-<uid> (shareFavoritesBtn's link format) opens someone else's
  // public favorites list read-only -- same convention as #row-N, just a
  // different prefix so the two never collide.
  function applyFavoritesShareFromHash() {
    var m = location.hash.match(/^#favs-(.+)$/);
    if (!m || !state.rows.length) return;
    renderSharedFavorites(decodeURIComponent(m[1]));
  }

  window.addEventListener("hashchange", applyFavoritesShareFromHash);

  var searchTimer = null;
  els.search.addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.query = els.search.value.trim();
      if (state.query) state.activeLetter = null;
      els.topBarSearchInput.value = state.query; // keep the desktop search bar in sync
      els.topBarSearchClear.hidden = !state.query;
      render();
    }, 120);
  });

  els.search.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    els.search.blur(); // dismisses the on-screen keyboard on mobile
    scrollBelowStickyHeader(els.results);
  });

  els.signInBtn.addEventListener("click", function () {
    auth.signInWithPopup(googleProvider).catch(function (err) {
      console.error("Sign-in failed:", err);
    });
  });

  els.topBarSignInBtn.addEventListener("click", function () {
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
    els.topBarSignInBtn.hidden = !!user;
    els.headerAccount.hidden = !user;
    if (user) {
      els.headerAvatar.src = user.photoURL || "";
      els.headerUserName.textContent = user.displayName || user.email || "";
      syncFromFirestore();
      db.collection("admins").doc(user.uid).get().then(function (doc) {
        state.isAdmin = doc.exists;
        els.openAdminBtn.hidden = !state.isAdmin;
        els.topBarAdminBtn.hidden = !state.isAdmin;
        // Covers the case where the board was opened before this admin
        // check resolved -- openMsgBoard() itself only starts the mod
        // listeners when state.isAdmin is already true.
        if (state.isAdmin && !els.msgBoardPanel.hidden) startMsgBoardModListeners();
      }).catch(function (err) {
        console.error("Admin check failed:", err);
        state.isAdmin = false;
        els.openAdminBtn.hidden = true;
        els.topBarAdminBtn.hidden = true;
      });
    } else {
      state.isAdmin = false;
      els.openAdminBtn.hidden = true;
      els.topBarAdminBtn.hidden = true;
    }
    watchMsgBoardOwnStatus();
  });

  fetchData();
  fetchTopAds();
  fetchBlogLatest();
})();
