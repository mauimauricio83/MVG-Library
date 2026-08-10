(function () {
  "use strict";

  var APP_VERSION = "5.35.0"; // bump alongside CHANGELOG.md on each meaningful commit

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
    filtersGroup: document.getElementById("filtersGroup"),
    tvModal: document.getElementById("tvModal"),
    tvAdPlaceholder: document.getElementById("tvAdPlaceholder"),
    tvFiltersSlot: document.getElementById("tvFiltersSlot"),
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
    tvYearDragLabel: document.getElementById("tvYearDragLabel"),
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
    sidebarPlaylistsBtn: document.getElementById("sidebarPlaylistsBtn"),
    savePlaylistBtn: document.getElementById("savePlaylistBtn"),
    tvPlaylistBtn: document.getElementById("tvPlaylistBtn"),
    tvCropBtn: document.getElementById("tvCropBtn"),
    tvMirrorBtn: document.getElementById("tvMirrorBtn"),
    tvInterlaceBtn: document.getElementById("tvInterlaceBtn"),
    playlistsPage: document.getElementById("playlistsPage"),
    playlistsChipRow: document.getElementById("playlistsChipRow"),
    playlistsEmptyMsg: document.getElementById("playlistsEmptyMsg"),
    playlistsNewBtn: document.getElementById("playlistsNewBtn"),
    playlistDetail: document.getElementById("playlistDetail"),
    playlistDetailName: document.getElementById("playlistDetailName"),
    playlistPlayAllBtn: document.getElementById("playlistPlayAllBtn"),
    playlistRenameBtn: document.getElementById("playlistRenameBtn"),
    playlistDeleteBtn: document.getElementById("playlistDeleteBtn"),
    tvCustomList: document.getElementById("tvCustomList"),
    tvChannelPane: document.getElementById("tvChannelPane"),
    tvChannelStatus: document.getElementById("tvChannelStatus"),
    addPlaylistPopover: document.getElementById("addPlaylistPopover"),
    addPlaylistList: document.getElementById("addPlaylistList"),
    addPlaylistClose: document.getElementById("addPlaylistClose"),
    addPlaylistNewName: document.getElementById("addPlaylistNewName"),
    addPlaylistCreateBtn: document.getElementById("addPlaylistCreateBtn"),
    sidebarProfilesBtn: document.getElementById("sidebarProfilesBtn"),
    navModeWatchBtn: document.getElementById("navModeWatchBtn"),
    navModeConnectBtn: document.getElementById("navModeConnectBtn"),
    profilesPage: document.getElementById("profilesPage"),
    profilesEditBtn: document.getElementById("profilesEditBtn"),
    profilesBrowse: document.getElementById("profilesBrowse"),
    profilesSigninNote: document.getElementById("profilesSigninNote"),
    discoverSection: document.getElementById("discoverSection"),
    discoverGrid: document.getElementById("discoverGrid"),
    discoverSeeMoreBtn: document.getElementById("discoverSeeMoreBtn"),
    profilesGrid: document.getElementById("profilesGrid"),
    profilesFilters: document.getElementById("profilesFilters"),
    profilesSearchInput: document.getElementById("profilesSearchInput"),
    profilesRoleFilter: document.getElementById("profilesRoleFilter"),
    profilesEmptyMsg: document.getElementById("profilesEmptyMsg"),
    profileEditor: document.getElementById("profileEditor"),
    profileEditorBackBtn: document.getElementById("profileEditorBackBtn"),
    profileEditorIntro: document.getElementById("profileEditorIntro"),
    profilesRequestsBtn: document.getElementById("profilesRequestsBtn"),
    profileRequestsBadge: document.getElementById("profileRequestsBadge"),
    profileRequestsView: document.getElementById("profileRequestsView"),
    profileRequestsBackBtn: document.getElementById("profileRequestsBackBtn"),
    profileIncomingRequests: document.getElementById("profileIncomingRequests"),
    profileIncomingEmpty: document.getElementById("profileIncomingEmpty"),
    profileOutgoingRequests: document.getElementById("profileOutgoingRequests"),
    profileOutgoingEmpty: document.getElementById("profileOutgoingEmpty"),
    profileNameInput: document.getElementById("profileNameInput"),
    profileRoleInput: document.getElementById("profileRoleInput"),
    profileBioInput: document.getElementById("profileBioInput"),
    profileReelInput: document.getElementById("profileReelInput"),
    profilePhotoInput: document.getElementById("profilePhotoInput"),
    profilePhotoPreview: document.getElementById("profilePhotoPreview"),
    profileSaveBtn: document.getElementById("profileSaveBtn"),
    profileDeleteBtn: document.getElementById("profileDeleteBtn"),
    profileEditorStatus: document.getElementById("profileEditorStatus"),
    profileClearLocationBtn: document.getElementById("profileClearLocationBtn"),
    profileLocationLabel: document.getElementById("profileLocationLabel"),
    profileLocationMap: document.getElementById("profileLocationMap"),
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
    adminFormGenreSelect: document.getElementById("adminFormGenreSelect"),
    adminFormCountrySelect: document.getElementById("adminFormCountrySelect"),
    suggestEditModal: document.getElementById("suggestEditModal"),
    suggestEditClose: document.getElementById("suggestEditClose"),
    suggestEditForm: document.getElementById("suggestEditForm"),
    suggestEditIntro: document.getElementById("suggestEditIntro"),
    suggestEditField: document.getElementById("suggestEditField"),
    suggestEditCurrent: document.getElementById("suggestEditCurrent"),
    suggestEditValue: document.getElementById("suggestEditValue"),
    suggestEditNote: document.getElementById("suggestEditNote"),
    suggestEditSubmitBtn: document.getElementById("suggestEditSubmitBtn"),
    suggestEditStatus: document.getElementById("suggestEditStatus"),
    adminGoSuggestionsBtn: document.getElementById("adminGoSuggestionsBtn"),
    adminSuggestionsBadge: document.getElementById("adminSuggestionsBadge"),
    adminSuggestionsView: document.getElementById("adminSuggestionsView"),
    adminSuggestionsBackBtn: document.getElementById("adminSuggestionsBackBtn"),
    adminSuggestionsStatus: document.getElementById("adminSuggestionsStatus"),
    adminSuggestionsList: document.getElementById("adminSuggestionsList"),
    adminGoVerificationsBtn: document.getElementById("adminGoVerificationsBtn"),
    adminVerificationsBadge: document.getElementById("adminVerificationsBadge"),
    adminVerificationsView: document.getElementById("adminVerificationsView"),
    adminVerificationsBackBtn: document.getElementById("adminVerificationsBackBtn"),
    adminVerificationsStatus: document.getElementById("adminVerificationsStatus"),
    adminVerificationsList: document.getElementById("adminVerificationsList"),
    sidebarProfilesBadge: document.getElementById("sidebarProfilesBadge"),
    adminGoBlogBtn: document.getElementById("adminGoBlogBtn"),
    blogEditorPage: document.getElementById("blogEditorPage"),
    blogEditorCloseBtn: document.getElementById("blogEditorCloseBtn"),
    adminBlogListView: document.getElementById("adminBlogListView"),
    adminBlogBackBtn: document.getElementById("adminBlogBackBtn"),
    adminBlogNewBtn: document.getElementById("adminBlogNewBtn"),
    adminBlogListStatus: document.getElementById("adminBlogListStatus"),
    adminBlogList: document.getElementById("adminBlogList"),
    adminBlogForm: document.getElementById("adminBlogForm"),
    adminBlogFormTitle: document.getElementById("adminBlogFormTitle"),
    adminBlogPostId: document.getElementById("adminBlogPostId"),
    adminBlogTitleInput: document.getElementById("adminBlogTitleInput"),
    adminBlogSlugInput: document.getElementById("adminBlogSlugInput"),
    adminBlogAuthorInput: document.getElementById("adminBlogAuthorInput"),
    adminBlogDateInput: document.getElementById("adminBlogDateInput"),
    adminBlogExcerptInput: document.getElementById("adminBlogExcerptInput"),
    adminBlogCoverInput: document.getElementById("adminBlogCoverInput"),
    adminBlogCoverPreview: document.getElementById("adminBlogCoverPreview"),
    adminBlogToolbar: document.getElementById("adminBlogToolbar"),
    adminBlogBodyInput: document.getElementById("adminBlogBodyInput"),
    adminBlogLinkBtn: document.getElementById("adminBlogLinkBtn"),
    adminBlogUnlinkBtn: document.getElementById("adminBlogUnlinkBtn"),
    adminBlogImageBtn: document.getElementById("adminBlogImageBtn"),
    adminBlogVideoBtn: document.getElementById("adminBlogVideoBtn"),
    adminBlogInlineImageInput: document.getElementById("adminBlogInlineImageInput"),
    adminBlogSaveDraftBtn: document.getElementById("adminBlogSaveDraftBtn"),
    adminBlogPublishBtn: document.getElementById("adminBlogPublishBtn"),
    adminBlogCancelBtn: document.getElementById("adminBlogCancelBtn"),
    adminBlogFormStatus: document.getElementById("adminBlogFormStatus"),
    adminGoChannelBtn: document.getElementById("adminGoChannelBtn"),
    adminChannelView: document.getElementById("adminChannelView"),
    adminChannelBackBtn: document.getElementById("adminChannelBackBtn"),
    adminChannelRestartBtn: document.getElementById("adminChannelRestartBtn"),
    adminChannelStatus: document.getElementById("adminChannelStatus"),
    adminChannelModeOrdered: document.getElementById("adminChannelModeOrdered"),
    adminChannelModeShuffled: document.getElementById("adminChannelModeShuffled"),
    adminChannelReshuffleBtn: document.getElementById("adminChannelReshuffleBtn"),
    adminChannelVideoSearch: document.getElementById("adminChannelVideoSearch"),
    adminChannelVideoResults: document.getElementById("adminChannelVideoResults"),
    adminChannelPlaylistSelect: document.getElementById("adminChannelPlaylistSelect"),
    adminChannelAddPlaylistBtn: document.getElementById("adminChannelAddPlaylistBtn"),
    adminChannelQueueCount: document.getElementById("adminChannelQueueCount"),
    adminChannelQueueDuration: document.getElementById("adminChannelQueueDuration"),
    adminChannelQueueList: document.getElementById("adminChannelQueueList"),
    adminChannelShuffleRow: document.getElementById("adminChannelShuffleRow"),
    adminChannelInsertUrl: document.getElementById("adminChannelInsertUrl"),
    adminChannelInsertTime: document.getElementById("adminChannelInsertTime"),
    adminChannelInsertBtn: document.getElementById("adminChannelInsertBtn"),
    adminChannelInsertStatus: document.getElementById("adminChannelInsertStatus"),
    adminChannelScheduledInsertRow: document.getElementById("adminChannelScheduledInsertRow"),
    adminChannelScheduledInsertText: document.getElementById("adminChannelScheduledInsertText"),
    adminChannelCancelInsertBtn: document.getElementById("adminChannelCancelInsertBtn"),
    adminChannelPreviewBox: document.getElementById("adminChannelPreviewBox"),
    adminChannelPreviewLabel: document.getElementById("adminChannelPreviewLabel"),
    submitFormBtn: document.getElementById("submitFormBtn"),
    submitVideoLinkHint: document.getElementById("submitVideoLinkHint"),
    submitFormStatus: document.getElementById("submitFormStatus"),
    submitThanksModal: document.getElementById("submitThanksModal"),
    submitThanksBack: document.getElementById("submitThanksBack"),
    submitThanksAgain: document.getElementById("submitThanksAgain"),
    profileThanksModal: document.getElementById("profileThanksModal"),
    profileThanksBack: document.getElementById("profileThanksBack"),
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
    dmModal: document.getElementById("dmModal"),
    dmModalClose: document.getElementById("dmModalClose"),
    dmModalTitle: document.getElementById("dmModalTitle"),
    dmMessages: document.getElementById("dmMessages"),
    dmStatus: document.getElementById("dmStatus"),
    dmComposerForm: document.getElementById("dmComposerForm"),
    dmComposerInput: document.getElementById("dmComposerInput"),
    dmSendBtn: document.getElementById("dmSendBtn"),
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
    adminBulkBackdoorCheckbox: document.getElementById("adminBulkBackdoorCheckbox"),
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

  // "land" mirrors the existing "cloud" easter-egg link -- same rainbow
  // letter-hop style (shares .cloud-link), opposite side. Points at
  // land.html, a standalone stylized title card meant to be screenshotted
  // as a 16:9 thumbnail image, not a real navigation entry point.
  els.appFooter.innerHTML =
    '<a href="land.html" class="cloud-link land-link" aria-label="Land"><span>l</span><span>a</span><span>n</span><span>d</span></a>' +
    '<span class="app-footer-text">v' + APP_VERSION + " · Created by MnC · 2026</span>" +
    '<a href="cloud.html" class="cloud-link" aria-label="Word Cloud"><span>c</span><span>l</span><span>o</span><span>u</span><span>d</span></a>';

  var LATEST_STRIP_COUNT = 50;
  var LATEST_TOP_RANDOM_COUNT = 3; // strictly the newest -- randomized among themselves so a reload doesn't always show the same order
  var LATEST_TOP_POOL_SIZE = 20; // window the top-3 draw from
  // Entries below this rowNum are internal research/backfill, not real
  // user submissions -- Latest Submissions should only ever draw from
  // rowNum >= this floor. rowNum 13179 (Jill Blutt -- "Untitled") is the
  // earliest confirmed real submission. row.backdoor (admin bulk-import
  // checkbox, see BULK_FIELD_ALIASES/buildBulkDoc) is the general
  // per-entry escape valve for anything *above* the floor that still isn't
  // a real submission -- e.g. a future bulk research/backfill import,
  // which is exactly what the old hardcoded LATEST_EXCLUDED_RANGES rowNum
  // list (the 50-entry Michel Gondry block, now entirely below the floor
  // anyway) was a one-off version of.
  var LATEST_MIN_ROWNUM = 13179;

  function isEligibleLatestSubmission(row) {
    var n = parseInt(row.rowNum, 10);
    if (isNaN(n) || n < LATEST_MIN_ROWNUM) return false;
    if (row.backdoor) return false;
    return true;
  }
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
    { key: "pop", label: "Pop" },
    { key: "rock", label: "Rock" },
    { key: "metal-punk", label: "Metal & Punk" },
    { key: "hiphop", label: "Hip-Hop/Rap" },
    { key: "rnb", label: "R&B/Soul/Funk" },
    { key: "electronic", label: "Electronic/Dance" },
    { key: "country", label: "Country/Folk" },
    { key: "world", label: "Latin/World/Reggae" },
    { key: "jazz", label: "Jazz/Blues/Classical" },
    { key: "other", label: "Other" }
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

  // Returns null (not the Pre-Music Video bucket) for a blank/unparseable
  // year -- "Pre-Music Video" means "older than the format existed," not
  // "we don't know when this was released." Undated rows just don't
  // belong to any year bucket and stay unreachable via the year dial,
  // same as they already are via the Genre tiles' "no genre" case.
  function tvEraBucketFor(yearValue) {
    var y = parseInt(yearValue, 10);
    if (isNaN(y)) return null;
    for (var i = 0; i < TV_ERA_BUCKETS.length; i++) {
      var b = TV_ERA_BUCKETS[i];
      if (y >= b.min && y <= b.max) return b.key;
    }
    return "pre-mv";
  }

  function tvDecadeBucketFor(yearValue) {
    var y = parseInt(yearValue, 10);
    if (isNaN(y)) return null;
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
  // Decades are fixed lists (newest first); Years is computed from the data
  // -- one bucket per distinct year actually present, also newest first to
  // match, no shortLabel since there can be 80+ of them and a per-tick
  // label would be unreadable (see the fine-tick styling in
  // renderTVYearDial()).
  function activeYearBuckets(rows) {
    if (state.tvYearGranularity === "decades") return TV_DECADE_BUCKETS;
    if (state.tvYearGranularity === "years") {
      var years = {};
      rows.forEach(function (r) { if (r.year) years[r.year] = true; });
      return Object.keys(years).sort(function (a, b) { return parseInt(b, 10) - parseInt(a, 10); })
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

  // In-house description first; YouTube's own uploader description/tags
  // (backfilled via scripts/backfill-youtube-metadata.js) as fallback.
  // Vimeo has no equivalent data source yet -- a Vimeo-only entry with no
  // in-house description just shows no description, not a bug, there's
  // nothing to fall back to until that gap is backfilled separately.
  function resultDescription(row) {
    return row.description || row.youtubeSearchText || "";
  }

  // Thumb-left/description-right list card -- the Search results view's
  // card template (see render()/renderGroupSection() below). Used to be
  // Advanced Search's own card before that page was sunset in favor of
  // just using this look for Search directly.
  function resultCardHtml(row) {
    var thumbAlt = escapeHtml((row.song || "Untitled") + (row.artist ? " — " + row.artist : ""));
    var thumb = videoThumbImgHtml(row, thumbAlt);
    var artistLine = row.artist || "";
    if (row.director) artistLine += (artistLine ? " · " : "") + "Dir. " + row.director;
    var desc = resultDescription(row);
    return '<div class="result-card" data-row="' + escapeHtml(row.rowNum) + '">' +
      '<div class="result-card-thumb">' + thumb + "</div>" +
      '<div class="result-card-info">' +
        '<div class="result-card-song">' + escapeHtml(row.song || "(untitled)") + "</div>" +
        '<div class="result-card-artist">' + escapeHtml(artistLine) + "</div>" +
        (desc ? '<p class="result-card-desc">' + escapeHtml(desc) + "</p>" : "") +
      "</div>" +
    "</div>";
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
    closeDmThread();
    closeTVModal();
    closeSubmitModal();
    closeSubmitThanksModal();
    closeProfileThanksModal();
    closeSettingsModal();
    closeRecentModal();
    closePodcastModal();
    closeAdminModal();
    closeSuggestEditModal();
    closeBlogEditorPage();
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

  var CACHE_KEY = "mvg-wiki-cache-v5"; // bumped: v4 rows predate the release-date artifact fix
  var LIGHTBOX_SIZE_KEY = "mvg-lightbox-size";
  var LIGHTBOX_CROP_KEY = "mvg-lightbox-crop";
  var TV_CROP_KEY = "mvg-tv-crop";

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
    lightboxProfileUid: null,
    lightboxPlayer: null,
    lightboxSize: loadLightboxSizePref(),
    lightboxCrop: loadLightboxCropPref(),
    // Admin debug toggles, session-only (not persisted -- these are testing
    // tools, not viewer preferences, so they always start off).
    lightboxMirror: false,
    lightboxInterlaceHz: 0, // 0 = off, else 50 or 60
    // Never persisted across page loads (see applyNavMode()'s comment) --
    // always starts on "watch", matching the page's own default view
    // (Home), so the switch and what's actually on screen never disagree.
    navMode: "watch",
    recentSet: {},
    // active: a track pool has been picked (armed or actually playing).
    // started: the viewer has pressed play -- a real YT player exists.
    // Armed-but-not-started is the "channel ready" static screen.
    tv: { active: false, started: false, queue: [], index: 0, player: null, shellBuilt: false, crop: loadTVCropPref(), mirror: false, interlaceHz: 0 },
    // Whether the shared Year/Genre filters are currently showing TV Mode's
    // coarse buckets instead of the exact Search values -- see
    // enterTVFilterMode/exitTVFilterMode. homeYear/GenreBeforeTV hold the
    // Search-page selection while TV Mode has it swapped out, so closing the
    // modal restores exactly what was selected before.
    tvFilterMode: false,
    homeYearBeforeTV: "",
    homeGenreBeforeTV: "",
    homeMvgOnlyBeforeTV: false,
    tvActiveTab: "genre",
    tvYearGranularity: "eras",
    // Set when a playlist is picked on TV Mode's Custom tab -- while set,
    // armTV()/refreshTVPoolIfActive() draw from this instead of
    // matchesFilters(), same as "Play All"'s customPool. Cleared by
    // picking a Genre/Era value or closing TV Mode.
    tvCustomPool: null,
    tvCustomPlaylistId: null,
    // Channel Mode -- the shared, synchronized queue (TV Mode's 4th tab).
    // doc mirrors the `channel/current` Firestore doc verbatim once loaded;
    // everything else here is local playback/session bookkeeping, not
    // synced state itself (every client derives its own position from
    // doc.anchorAt + doc.items, see computeChannelPosition()).
    channel: {
      doc: null,           // { items:[{rowNum|provider+videoId, duration, addedAt}], mode, shuffleSeed, anchorAt, scheduledInsert }, null until first loaded
      unsub: null,         // live listener while Channel tab is active
      resyncTimer: null,
      tuned: false,        // true once actively playing in Channel mode
      currentKind: null,   // "queue" | "insert" -- what's currently loaded
      currentOrder: null,  // the (possibly shuffled) item array the currently-loaded track came from ("queue" kind)
      currentIndex: -1,
      currentInsertVideoId: null // set when currentKind is "insert"
    },
    // Which playlist is open on the Playlists page (see renderPlaylistsPage()).
    selectedPlaylistId: null,
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

  function loadLightboxCropPref() {
    try {
      return localStorage.getItem(LIGHTBOX_CROP_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function saveLightboxCropPref(isCropped) {
    try {
      localStorage.setItem(LIGHTBOX_CROP_KEY, isCropped ? "1" : "0");
    } catch (e) {}
  }

  function loadTVCropPref() {
    try {
      return localStorage.getItem(TV_CROP_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function saveTVCropPref(isCropped) {
    try {
      localStorage.setItem(TV_CROP_KEY, isCropped ? "1" : "0");
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

  // Playlists: named lists of rowNums, same localStorage-first-then-
  // Firestore-sync shape as favorites (see pushToFirestore/
  // syncFromFirestore below) but multiple/named, so they need their own
  // key and array-of-objects shape rather than favorites' flat array.
  var PLAYLISTS_KEY = "mvg-playlists";

  function loadPlaylists() {
    try {
      var raw = JSON.parse(localStorage.getItem(PLAYLISTS_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  }

  function savePlaylists(list) {
    try {
      localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function findPlaylist(id) {
    var list = loadPlaylists();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function generatePlaylistId() {
    return "pl-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function createPlaylist(name, rowNums) {
    var list = loadPlaylists();
    var playlist = {
      id: generatePlaylistId(),
      name: (name || "").trim() || "Untitled Playlist",
      rowNums: rowNums ? rowNums.slice() : [],
      updatedAt: Date.now()
    };
    list.push(playlist);
    savePlaylists(list);
    pushToFirestore();
    return playlist;
  }

  function renamePlaylist(id, name) {
    var list = loadPlaylists();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        list[i].name = (name || "").trim() || list[i].name;
        list[i].updatedAt = Date.now();
        break;
      }
    }
    savePlaylists(list);
    pushToFirestore();
  }

  function deletePlaylist(id) {
    var list = loadPlaylists().filter(function (p) { return p.id !== id; });
    savePlaylists(list);
    pushToFirestore();
  }

  // Returns the new "is in this playlist" state, mirroring toggleFavorite().
  function togglePlaylistEntry(id, rowNum) {
    var list = loadPlaylists();
    var nowIn = false;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        var idx = list[i].rowNums.indexOf(rowNum);
        if (idx === -1) { list[i].rowNums.push(rowNum); nowIn = true; }
        else { list[i].rowNums.splice(idx, 1); nowIn = false; }
        list[i].updatedAt = Date.now();
        break;
      }
    }
    savePlaylists(list);
    pushToFirestore();
    return nowIn;
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
      recentlyViewed: loadRecentlyViewed(),
      playlists: loadPlaylists()
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
      var remotePlaylists = Array.isArray(remote.playlists) ? remote.playlists : [];
      var localFavorites = loadFavorites();
      var localRecent = loadRecentlyViewed();
      var localPlaylists = loadPlaylists();

      var mergedFavorites = remoteFavorites.concat(
        localFavorites.filter(function (id) { return remoteFavorites.indexOf(id) === -1; })
      );
      var mergedRecent = remoteRecent.length ? remoteRecent : localRecent;
      // Remote wins for a playlist that exists on both (by id); local-only
      // playlists (created signed-out, or on a device that hasn't synced
      // yet) get appended rather than dropped.
      var remotePlaylistIds = remotePlaylists.map(function (p) { return p.id; });
      var mergedPlaylists = remotePlaylists.concat(
        localPlaylists.filter(function (p) { return remotePlaylistIds.indexOf(p.id) === -1; })
      );

      saveFavorites(mergedFavorites);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(mergedRecent.slice(0, RECENT_MAX)));
      } catch (e) {}
      savePlaylists(mergedPlaylists);

      pushToFirestore();
      renderFavoritesStrip(state.rows);
      renderRecentList(state.rows);
      renderPlaylistsPage();
      renderTVCustomPane();
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
    updateSubtitleStats(state.rows);
    state.recentSet = computeRecentSet(state.rows);
    renderLatestStrip(state.rows);
    renderFeaturedStrip(state.rows);
    renderRecentList(state.rows);
    renderFavoritesStrip(state.rows);
    renderSpotlightSidebar(state.rows);
    renderDiscoverSection(state.rows);
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
            var thumbAlt = escapeHtml((row.song || "Untitled") + (row.artist ? " — " + row.artist : ""));
            var thumb = videoThumbImgHtml(row, thumbAlt);
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
      btn.textContent = expanded ? "See less ▴" : "See all ▾";
    });
  }

  setupSeeMore(els.latestStrip, els.latestSeeMoreBtn);
  setupSeeMore(els.featuredStrip, els.featuredSeeMoreBtn);
  setupSeeMore(els.favoritesStrip, els.favoritesSeeMoreBtn);

  var latestPool = [];
  // A pure top-N-by-rowNum cutoff meant Latest Submissions could go
  // wall-to-wall a single big bulk import until enough newer individual
  // submissions pushed it out -- same problem the word cloud has (see
  // cloud.js). Now: the top few slots are randomized among the truly newest
  // entries (so a reload doesn't always show the exact same order), and the
  // rest are drawn by real submission-age quota (1wk/2wk/3wk/4-6wk) with a
  // uniform shuffle within each bucket -- see ageBucketSample().
  function renderLatestStrip(rows) {
    var newestFirst = rows
      .filter(isEligibleLatestSubmission)
      .map(function (r) { return { row: r, n: parseInt(r.rowNum, 10) }; })
      .sort(function (a, b) { return b.n - a.n; })
      .map(function (x) { return x.row; });

    var topPool = newestFirst.slice(0, LATEST_TOP_POOL_SIZE);
    var topPicks = shuffle(topPool).slice(0, LATEST_TOP_RANDOM_COUNT);
    var topPicksSet = {};
    topPicks.forEach(function (r) { topPicksSet[r.rowNum] = true; });

    var candidates = newestFirst.filter(function (r) { return !topPicksSet[r.rowNum]; });
    var restPicks = ageBucketSample(candidates, LATEST_STRIP_COUNT - topPicks.length);

    // Selection was weighted-random; display order still reads newest-first
    // so it doesn't look shuffled at a glance.
    latestPool = topPicks.concat(restPicks).sort(function (a, b) {
      return parseInt(b.rowNum, 10) - parseInt(a.rowNum, 10);
    });
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
      var thumbAlt = escapeHtml((row.song || "Untitled") + (row.artist ? " — " + row.artist : ""));
      var thumb = videoThumbImgHtml(row, thumbAlt);
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
    els.favoritesTitle.textContent = "Favorites";
    els.favoritesShareBtn.hidden = false;
    els.favoritesShareStatus.hidden = true;
    favoritesStrip.render(favoritesPool);
  }

  // ---- Playlists ---------------------------------------------------
  // Named lists of rowNums (see loadPlaylists()/createPlaylist() etc. near
  // the favorites data functions). The page has two levels: a chip row
  // listing every playlist, and a detail strip (reusing createMediaStrip(),
  // same as Favorites) for whichever one's selected.
  var playlistDetailStrip = createMediaStrip(els.playlistDetail, {
    emptyMessage: "This playlist is empty. Add videos via the + button on any video's page.",
    showDescription: true
  });

  function renderPlaylistsPage() {
    var list = loadPlaylists();
    els.playlistsEmptyMsg.hidden = !!list.length;
    els.playlistsChipRow.innerHTML = list.map(function (p) {
      var active = p.id === state.selectedPlaylistId ? " is-active" : "";
      return '<button type="button" class="playlists-chip' + active + '" data-id="' + escapeHtml(p.id) + '">' +
        escapeHtml(p.name) + ' <span class="playlists-chip-count">' + p.rowNums.length + "</span></button>";
    }).join("");

    if (!list.length) {
      state.selectedPlaylistId = null;
      els.playlistDetail.hidden = true;
      return;
    }
    var stillExists = list.some(function (p) { return p.id === state.selectedPlaylistId; });
    if (!stillExists) state.selectedPlaylistId = list[0].id;
    renderPlaylistDetail();
  }

  function renderPlaylistDetail() {
    var playlist = findPlaylist(state.selectedPlaylistId);
    if (!playlist) {
      els.playlistDetail.hidden = true;
      return;
    }
    els.playlistDetailName.textContent = playlist.name;
    var rows = playlist.rowNums.map(findRowByNum).filter(Boolean);
    playlistDetailStrip.render(rows);
    Array.prototype.forEach.call(els.playlistsChipRow.querySelectorAll(".playlists-chip"), function (chip) {
      chip.classList.toggle("is-active", chip.getAttribute("data-id") === state.selectedPlaylistId);
    });
  }

  els.sidebarPlaylistsBtn.addEventListener("click", function () {
    sharedFavoritesUid = null;
    renderPlaylistsPage();
    setDesktopView("playlists");
    setMobileView("playlists");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  els.playlistsChipRow.addEventListener("click", function (e) {
    var chip = e.target.closest(".playlists-chip");
    if (!chip) return;
    state.selectedPlaylistId = chip.getAttribute("data-id");
    renderPlaylistDetail();
  });

  els.playlistsNewBtn.addEventListener("click", function () {
    var name = window.prompt("Playlist name:");
    if (name === null) return;
    var playlist = createPlaylist(name, []);
    state.selectedPlaylistId = playlist.id;
    renderPlaylistsPage();
  });

  els.playlistPlayAllBtn.addEventListener("click", function () {
    var playlist = findPlaylist(state.selectedPlaylistId);
    if (!playlist) return;
    var rows = playlist.rowNums.map(findRowByNum).filter(function (r) { return r && hasVideo(r); });
    startTVMode(rows);
  });

  els.playlistRenameBtn.addEventListener("click", function () {
    var playlist = findPlaylist(state.selectedPlaylistId);
    if (!playlist) return;
    var name = window.prompt("Rename playlist:", playlist.name);
    if (name === null) return;
    renamePlaylist(playlist.id, name);
    renderPlaylistsPage();
  });

  els.playlistDeleteBtn.addEventListener("click", function () {
    var playlist = findPlaylist(state.selectedPlaylistId);
    if (!playlist) return;
    if (!window.confirm('Delete "' + playlist.name + '"? This can\'t be undone.')) return;
    deletePlaylist(playlist.id);
    state.selectedPlaylistId = null;
    renderPlaylistsPage();
  });

  // "Save as Playlist" on Search -- snapshots the currently-matching rows
  // into a new playlist at save time (a fixed list, not a live/re-run
  // search) so it behaves consistently with the "add a single video"
  // method elsewhere: a playlist is always just a plain list of rowNums.
  els.savePlaylistBtn.addEventListener("click", function () {
    var matches = state.rows.filter(matchesFilters);
    if (!matches.length) {
      alert("No results to save -- adjust your search or filters first.");
      return;
    }
    var name = window.prompt("Save these " + matches.length + " results as a playlist named:");
    if (name === null) return;
    var playlist = createPlaylist(name, matches.map(function (r) { return r.rowNum; }));
    state.selectedPlaylistId = playlist.id;
    renderPlaylistsPage();
  });

  // ---- Add-to-playlist popover ---------------------------------------
  // One shared instance, repositioned/repurposed per trigger (the
  // lightbox's + button, TV Mode's + button) rather than building a new
  // popover per video.
  var addPlaylistRowNum = null;

  function renderAddPlaylistList() {
    var list = loadPlaylists();
    if (!list.length) {
      els.addPlaylistList.innerHTML = '<p class="add-playlist-empty">No playlists yet -- create one below.</p>';
      return;
    }
    els.addPlaylistList.innerHTML = list.map(function (p) {
      var inIt = p.rowNums.indexOf(addPlaylistRowNum) !== -1;
      return '<button type="button" class="add-playlist-item' + (inIt ? " is-in" : "") + '" data-id="' + escapeHtml(p.id) + '">' +
        '<span class="add-playlist-item-check">' + (inIt ? "✓" : "") + '</span>' +
        '<span class="add-playlist-item-name">' + escapeHtml(p.name) + '</span>' +
        '<span class="add-playlist-item-count">' + p.rowNums.length + "</span>" +
        "</button>";
    }).join("");
  }

  function openAddToPlaylistPopover(rowNum, anchorEl) {
    addPlaylistRowNum = rowNum;
    renderAddPlaylistList();
    els.addPlaylistNewName.value = "";
    els.addPlaylistPopover.hidden = false;
    var rect = anchorEl.getBoundingClientRect();
    var popW = 260;
    var left = Math.min(rect.left, window.innerWidth - popW - 8);
    els.addPlaylistPopover.style.top = (rect.bottom + 8) + "px";
    els.addPlaylistPopover.style.left = Math.max(8, left) + "px";
  }

  function closeAddToPlaylistPopover() {
    els.addPlaylistPopover.hidden = true;
    addPlaylistRowNum = null;
  }

  // Re-renders whichever playlist-driven UI is currently visible after an
  // add/remove/create so counts stay in sync without needing to close the
  // popover first.
  function refreshPlaylistUIAfterChange() {
    renderPlaylistsPage();
    renderTVCustomPane();
  }

  els.addPlaylistList.addEventListener("click", function (e) {
    var item = e.target.closest(".add-playlist-item");
    if (!item || !addPlaylistRowNum) return;
    togglePlaylistEntry(item.getAttribute("data-id"), addPlaylistRowNum);
    renderAddPlaylistList();
    refreshPlaylistUIAfterChange();
  });

  els.addPlaylistCreateBtn.addEventListener("click", function () {
    var name = els.addPlaylistNewName.value.trim();
    if (!name || !addPlaylistRowNum) return;
    createPlaylist(name, [addPlaylistRowNum]);
    els.addPlaylistNewName.value = "";
    renderAddPlaylistList();
    refreshPlaylistUIAfterChange();
  });

  els.addPlaylistClose.addEventListener("click", closeAddToPlaylistPopover);

  document.addEventListener("click", function (e) {
    if (els.addPlaylistPopover.hidden) return;
    // Use composedPath() (fixed at dispatch time) rather than e.target.closest()
    // -- the list's own click handler re-renders .add-playlist-item nodes
    // (toggle -> renderAddPlaylistList()) before this bubbles to document,
    // which would detach e.target and make closest() miss the popover.
    var path = e.composedPath ? e.composedPath() : [e.target];
    var insideTrigger = path.some(function (node) {
      return node.nodeType === 1 && (
        node.id === "addPlaylistPopover" ||
        node.classList.contains("lightbox-playlist-btn") ||
        node.id === "tvPlaylistBtn"
      );
    });
    if (insideTrigger) return;
    closeAddToPlaylistPopover();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !els.addPlaylistPopover.hidden) closeAddToPlaylistPopover();
  });

  els.tvPlaylistBtn.addEventListener("click", function () {
    var row = state.tv.queue[state.tv.index];
    if (row) openAddToPlaylistPopover(row.rowNum, els.tvPlaylistBtn);
  });

  // ---- Profiles: public musician/director/production directory ---------
  // A draft/first-pass feature: a public directory (profiles/{uid} in
  // Firestore, public-read/owner-write -- see firestore.rules) of short
  // profiles with one embedded YouTube reel each, so musicians and
  // productions can find each other's work. Deliberately minimal for now --
  // no matching/messaging, just browse + a "request to collaborate" style
  // link is left for a later pass.
  var PROFILE_ROLE_LABELS = { musician: "Musician / artist", director: "Director", production: "Production / studio" };
  var profilesCache = [];
  var pendingPhotoBlob = null;
  var pendingPhotoPreviewUrl = null;

  // Verified status lives in its own tiny world-readable collection
  // (verifiedProfiles/{uid}, doc presence = verified) rather than a field
  // on the profile doc itself -- same existence-check pattern as
  // mutedUsers/bannedUsers, and it means approving a request never needs
  // write access to someone ELSE's profiles/{uid} doc (which the owner-only
  // write rule there deliberately doesn't grant, even to admins).
  var verifiedProfileUids = {};

  function loadVerifiedProfiles() {
    return db.collection("verifiedProfiles").get().then(function (snap) {
      verifiedProfileUids = {};
      snap.forEach(function (doc) { verifiedProfileUids[doc.id] = true; });
    }).catch(function (err) {
      console.error("Loading verified profiles failed:", err);
    });
  }

  function verifiedBadgeHtml(uid) {
    return verifiedProfileUids[uid]
      ? ' <span class="verified-badge" title="Verified — confirmed by an admin">✓</span>'
      : "";
  }

  function renderProfileCard(profile) {
    var roleLabel = PROFILE_ROLE_LABELS[profile.role] || profile.role || "";
    var initial = (profile.displayName || "?").trim().slice(0, 1).toUpperCase();
    var photoHtml = profile.photoURL
      ? '<img src="' + escapeHtml(profile.photoURL) + '" alt="" loading="lazy">'
      : escapeHtml(initial);
    // Small overlapping badge (Facebook-style online-dot position) marking
    // whether this profile has a reel -- the one thing worth flagging at a
    // glance in the compact mobile list view (see .profile-card-reel-badge
    // and the mobile @media override in styles.css).
    var reelBadge = profile.youtubeUrl
      ? '<span class="profile-card-reel-badge" title="Has a reel">▶</span>'
      : "";
    return '<button type="button" class="profile-card" data-uid="' + escapeHtml(profile.uid) + '">' +
      '<div class="profile-card-photo">' + photoHtml + reelBadge + "</div>" +
      '<div class="profile-card-info">' +
      '<div class="profile-card-name">' + escapeHtml(profile.displayName || "Untitled") + verifiedBadgeHtml(profile.uid) + "</div>" +
      '<div class="profile-card-role">' + escapeHtml(roleLabel) + "</div>" +
      (profile.locationLabel ? '<div class="profile-card-location">' + ICON_PIN + ' ' + escapeHtml(profile.locationLabel) + "</div>" : "") +
      (profile.bio ? '<p class="profile-card-bio">' + escapeHtml(profile.bio) + "</p>" : "") +
      "</div>" +
      "</button>";
  }

  function renderProfilesGrid(profiles) {
    els.profilesGrid.innerHTML = profiles.map(renderProfileCard).join("");
    els.profilesEmptyMsg.hidden = !!profiles.length;
    // "No profiles yet" only makes sense when the directory is genuinely
    // empty -- a filter/search that matches nothing needs its own message
    // so it doesn't read as "nobody has ever made a profile."
    els.profilesEmptyMsg.textContent = profilesCache.length
      ? "No profiles match your search/filter."
      : "No profiles yet — be the first to create one.";
  }

  var profilesSearchDebounce = null;
  function applyProfilesFilter() {
    var role = els.profilesRoleFilter.value;
    var q = els.profilesSearchInput.value.trim().toLowerCase();
    var filtered = profilesCache.filter(function (p) {
      if (role && p.role !== role) return false;
      if (!q) return true;
      var haystack = ((p.displayName || "") + " " + (p.bio || "") + " " + (p.locationLabel || "")).toLowerCase();
      return haystack.indexOf(q) !== -1;
    });
    renderProfilesGrid(filtered);
  }

  function loadAllProfiles() {
    // Members-only directory -- profiles/{uid} now requires request.auth !=
    // null to read (see firestore.rules), so don't even try while signed
    // out; updateProfilesAuthUI() already hides the grid in that case.
    if (!currentUser) return Promise.resolve();
    return Promise.all([db.collection("profiles").get(), loadVerifiedProfiles()]).then(function (results) {
      var snap = results[0];
      var profiles = snap.docs.map(function (doc) {
        var d = doc.data();
        d.uid = doc.id;
        return d;
      });
      profiles.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
      profilesCache = profiles;
      applyProfilesFilter();
    }).catch(function (err) {
      console.error("Loading profiles failed:", err);
      els.profilesGrid.innerHTML = "";
      els.profilesEmptyMsg.hidden = false;
    });
  }

  els.profilesRoleFilter.addEventListener("change", applyProfilesFilter);
  els.profilesSearchInput.addEventListener("input", function () {
    clearTimeout(profilesSearchDebounce);
    profilesSearchDebounce = setTimeout(applyProfilesFilter, 150);
  });

  function updateProfilesAuthUI() {
    els.profilesEditBtn.hidden = !currentUser;
    els.profilesSigninNote.hidden = !!currentUser;
    // Members-only directory -- browsing itself is gated behind sign-in
    // now (firestore.rules requires request.auth != null to read), not
    // just creating a profile.
    els.profilesGrid.hidden = !currentUser;
    els.profilesFilters.hidden = !currentUser;
    if (!currentUser) els.profilesEmptyMsg.hidden = true;
  }

  function showProfilesBrowse() {
    els.profilesBrowse.hidden = false;
    els.profileEditor.hidden = true;
    els.profileRequestsView.hidden = true;
  }

  function showProfileEditorView() {
    els.profilesBrowse.hidden = true;
    els.profileEditor.hidden = false;
    els.profileRequestsView.hidden = true;
  }

  function showProfileRequestsView() {
    els.profilesBrowse.hidden = true;
    els.profileEditor.hidden = true;
    els.profileRequestsView.hidden = false;
  }

  function resetProfilePhotoPick() {
    if (pendingPhotoPreviewUrl) URL.revokeObjectURL(pendingPhotoPreviewUrl);
    pendingPhotoBlob = null;
    pendingPhotoPreviewUrl = null;
    els.profilePhotoInput.value = "";
  }

  // Downscales to at most 400px on the long edge before upload -- keeps
  // storage/bandwidth cheap without needing a server-side image pipeline
  // (matches the "keep it cheap" approach the snapshot gzip already takes).
  function resizeImageFile(file, maxSide) {
    maxSide = maxSide || 400;
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        var w = Math.round(img.width * scale);
        var h = Math.round(img.height * scale);
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob(function (blob) {
          if (blob) resolve(blob); else reject(new Error("Image encode failed"));
        }, "image/jpeg", 0.85);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Image load failed"));
      };
      img.src = url;
    });
  }

  // ---- Location pinning (captured now, matchmaking uses it later) ------
  // Leaflet + OpenStreetMap tiles -- no API key/billing account needed,
  // unlike Google Maps, which matters for a hobby project already avoiding
  // paid dependencies elsewhere (see the AdSense-only monetization so far).
  var profileLocationMapInstance = null;
  var profileLocationMarker = null;
  var pendingLocation = null;
  var pendingLocationLabel = "";

  function setProfileLocationLabel(text) {
    pendingLocationLabel = text || "";
    els.profileLocationLabel.textContent = pendingLocationLabel;
  }

  // Best-effort only -- Nominatim's free reverse-geocoding endpoint, no key
  // required for reasonable browser-referer traffic. Falls back to plain
  // coordinates (still fully usable for matchmaking later) if it fails.
  function reverseGeocode(lat, lng) {
    setProfileLocationLabel(lat.toFixed(3) + ", " + lng.toFixed(3));
    fetch("https://nominatim.openstreetmap.org/reverse?format=json&lat=" + lat + "&lon=" + lng + "&zoom=10")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (pendingLocation && pendingLocation.lat === lat && pendingLocation.lng === lng && data && data.address) {
          var a = data.address;
          var place = a.city || a.town || a.village || a.county || "";
          var label = [place, a.country].filter(Boolean).join(", ");
          if (label) setProfileLocationLabel(label);
        }
      })
      .catch(function () {});
  }

  function setProfileLocationMarker(lat, lng, pan) {
    pendingLocation = { lat: lat, lng: lng };
    if (profileLocationMarker) {
      profileLocationMarker.setLatLng([lat, lng]);
    } else {
      profileLocationMarker = L.marker([lat, lng]).addTo(profileLocationMapInstance);
    }
    if (pan) profileLocationMapInstance.setView([lat, lng], 9);
    els.profileClearLocationBtn.hidden = false;
    reverseGeocode(lat, lng);
  }

  function clearProfileLocation() {
    pendingLocation = null;
    setProfileLocationLabel("");
    els.profileClearLocationBtn.hidden = true;
    if (profileLocationMarker) {
      profileLocationMapInstance.removeLayer(profileLocationMarker);
      profileLocationMarker = null;
    }
  }

  // Created once and reused -- Leaflet throws if you re-init a map on a
  // container that already has one. Must run after the editor is actually
  // visible (invalidateSize() fixes up tile sizing for a container that
  // was 0x0 while hidden).
  function ensureProfileLocationMap() {
    if (profileLocationMapInstance) {
      profileLocationMapInstance.invalidateSize();
      return;
    }
    profileLocationMapInstance = L.map(els.profileLocationMap, { worldCopyJump: true }).setView([20, 0], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 18
    }).addTo(profileLocationMapInstance);
    profileLocationMapInstance.on("click", function (e) {
      setProfileLocationMarker(e.latlng.lat, e.latlng.lng, false);
    });
    setTimeout(function () { profileLocationMapInstance.invalidateSize(); }, 0);
  }

  els.profileClearLocationBtn.addEventListener("click", clearProfileLocation);

  function openProfileEditorForm() {
    if (!currentUser) return;
    resetProfilePhotoPick();
    els.profilePhotoPreview.hidden = true;
    els.profileEditorStatus.hidden = true;
    els.profileNameInput.value = "";
    els.profileRoleInput.value = "musician";
    els.profileBioInput.value = "";
    els.profileReelInput.value = "";
    els.profileDeleteBtn.hidden = true;
    els.profileEditorIntro.hidden = true;
    clearProfileLocation();
    showProfileEditorView();
    ensureProfileLocationMap();
    db.collection("profiles").doc(currentUser.uid).get().then(function (doc) {
      if (!doc.exists) {
        els.profileEditorIntro.hidden = false;
        return;
      }
      var d = doc.data();
      els.profileNameInput.value = d.displayName || "";
      els.profileRoleInput.value = d.role || "musician";
      els.profileBioInput.value = d.bio || "";
      els.profileReelInput.value = d.youtubeUrl || "";
      if (d.photoURL) {
        els.profilePhotoPreview.src = d.photoURL;
        els.profilePhotoPreview.hidden = false;
      }
      if (d.location) {
        setProfileLocationMarker(d.location.lat, d.location.lng, true);
        if (d.locationLabel) setProfileLocationLabel(d.locationLabel);
      }
      els.profileDeleteBtn.hidden = false;
    });
  }

  els.sidebarProfilesBtn.addEventListener("click", function () {
    sharedFavoritesUid = null;
    showProfilesBrowse();
    updateProfilesAuthUI();
    loadAllProfiles();
    // Refreshes the Requests badge count so it's already accurate before
    // the Requests tab is ever clicked, not just after.
    if (currentUser) loadCollabRequests();
    setDesktopView("profiles");
    setMobileView("profiles");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // ---- Watch / Connect nav-mode switch -----------------------------
  // Two audiences share this sidebar: casual viewers (Home/TV/Favorites/
  // Playlists/Submit/Recently Viewed) and industry members using Profiles
  // (and whatever the matchmaking system adds later). Rather than a real
  // account-type field -- more onboarding friction, and locks people into
  // one lane -- this is just a display filter over the same nav: anyone can
  // flip it anytime, nothing is actually gated. Items opt in via
  // data-nav-mode="watch"/"connect" in index.html; untagged items (Discord,
  // Settings, sign-in, etc.) stay visible in both modes.
  //
  // Deliberately NOT persisted across page loads (no localStorage) --  the
  // page's own default view is always Home/Watch on a fresh load regardless
  // of what was last selected, so persisting the switch separately let it
  // drift out of sync with what's actually on screen (switch shows
  // "Connect" from a past visit, page shows Watch's Home content). Starting
  // both from the same fixed default keeps them honest.
  function applyNavMode() {
    els.headerLinks.classList.toggle("nav-mode-connect", state.navMode === "connect");
    els.navModeWatchBtn.classList.toggle("is-active", state.navMode === "watch");
    els.navModeWatchBtn.setAttribute("aria-pressed", state.navMode === "watch" ? "true" : "false");
    els.navModeConnectBtn.classList.toggle("is-active", state.navMode === "connect");
    els.navModeConnectBtn.setAttribute("aria-pressed", state.navMode === "connect" ? "true" : "false");
  }

  applyNavMode();

  els.navModeWatchBtn.addEventListener("click", function () {
    state.navMode = "watch";
    applyNavMode();
    setDesktopView("home");
    setMobileView("home");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  els.navModeConnectBtn.addEventListener("click", function () {
    state.navMode = "connect";
    applyNavMode();
    els.sidebarProfilesBtn.click();
  });

  els.profilesEditBtn.addEventListener("click", openProfileEditorForm);
  els.profileEditorBackBtn.addEventListener("click", showProfilesBrowse);

  els.profilesGrid.addEventListener("click", function (e) {
    var card = e.target.closest(".profile-card");
    if (!card) return;
    var uid = card.getAttribute("data-uid");
    var profile = profilesCache.filter(function (p) { return p.uid === uid; })[0];
    if (profile) openProfileLightbox(profile);
  });

  els.profilePhotoInput.addEventListener("change", function () {
    var file = els.profilePhotoInput.files[0];
    if (!file) return;
    resizeImageFile(file).then(function (blob) {
      pendingPhotoBlob = blob;
      if (pendingPhotoPreviewUrl) URL.revokeObjectURL(pendingPhotoPreviewUrl);
      pendingPhotoPreviewUrl = URL.createObjectURL(blob);
      els.profilePhotoPreview.src = pendingPhotoPreviewUrl;
      els.profilePhotoPreview.hidden = false;
    }).catch(function (err) {
      console.error("Photo resize failed:", err);
      els.profileEditorStatus.textContent = "Couldn't read that image -- try a different file.";
      els.profileEditorStatus.className = "profile-editor-status is-error";
      els.profileEditorStatus.hidden = false;
    });
  });

  els.profileEditor.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!currentUser) return;
    var name = els.profileNameInput.value.trim();
    if (!name) return;
    els.profileSaveBtn.disabled = true;
    els.profileEditorStatus.hidden = true;

    var uploadPromise = pendingPhotoBlob
      ? firebase.storage().ref("profile-photos/" + currentUser.uid).put(pendingPhotoBlob, { contentType: "image/jpeg" })
          .then(function (snap) { return snap.ref.getDownloadURL(); })
      : Promise.resolve(els.profilePhotoPreview.hidden ? "" : els.profilePhotoPreview.src);

    uploadPromise.then(function (photoURL) {
      var profileData = {
        displayName: name,
        role: els.profileRoleInput.value,
        bio: els.profileBioInput.value.trim(),
        youtubeUrl: els.profileReelInput.value.trim(),
        photoURL: photoURL || "",
        updatedAt: Date.now()
      };
      // .set() without merge replaces the whole doc, so simply omitting
      // these keys when there's no pin is enough to clear a previously
      // saved location (see clearProfileLocation()).
      if (pendingLocation) {
        profileData.location = pendingLocation;
        profileData.locationLabel = pendingLocationLabel;
      }
      return db.collection("profiles").doc(currentUser.uid).set(profileData);
    }).then(function () {
      resetProfilePhotoPick();
      showProfilesBrowse();
      loadAllProfiles();
      openProfileThanksModal();
    }).catch(function (err) {
      console.error("Saving profile failed:", err);
      els.profileEditorStatus.textContent = "Something went wrong -- please try again.";
      els.profileEditorStatus.className = "profile-editor-status is-error";
      els.profileEditorStatus.hidden = false;
    }).finally(function () {
      els.profileSaveBtn.disabled = false;
    });
  });

  els.profileDeleteBtn.addEventListener("click", function () {
    if (!currentUser) return;
    if (!window.confirm("Delete your profile? This can't be undone.")) return;
    db.collection("profiles").doc(currentUser.uid).delete().then(function () {
      resetProfilePhotoPick();
      showProfilesBrowse();
      loadAllProfiles();
    }).catch(function (err) {
      console.error("Deleting profile failed:", err);
    });
  });

  // Reuses the entry-lightbox shell (els.lightbox/els.lightboxContent) rather
  // than building a second modal -- see CLAUDE.md's modal pattern note. Only
  // renders Widen/Crop (no fav/playlist/admin buttons, which are row-only
  // concepts a profile doesn't have).
  var profileLightboxMapInstance = null;

  function destroyProfileLightboxMap() {
    if (profileLightboxMapInstance) {
      profileLightboxMapInstance.remove();
      profileLightboxMapInstance = null;
    }
  }

  function openProfileLightbox(profile) {
    if (state.tv.active) { teardownTV(); els.videoBox.innerHTML = ""; moveVideoPairHome(); }
    destroyLightboxPlayer();
    destroyProfileLightboxMap();
    els.spotlightSidebar.classList.add("is-hidden-for-lightbox");
    state.lightboxRowNum = null;
    state.lightboxProfileUid = profile.uid;
    document.title = (profile.displayName || "Profile") + " | MVG Library";

    var id = extractYouTubeId(profile.youtubeUrl);
    var videoHtml = id
      ? '<div class="lightbox-video-frame" id="lightboxVideoFrame"><div id="lightboxPlayerTarget"></div></div>'
      : '<div class="lightbox-video-empty">No reel uploaded yet.</div>';

    var roleLabel = PROFILE_ROLE_LABELS[profile.role] || profile.role || "";
    var photoHtml = profile.photoURL
      ? '<img class="profile-lightbox-photo" src="' + escapeHtml(profile.photoURL) + '" alt="">'
      : '<div class="profile-lightbox-photo profile-lightbox-photo-placeholder">' +
        escapeHtml((profile.displayName || "?").trim().slice(0, 1).toUpperCase()) + "</div>";

    els.lightboxContent.innerHTML =
      videoHtml +
      '<div class="lightbox-body">' +
      '<div class="lightbox-title-row">' +
      '<div class="profile-lightbox-head">' +
      photoHtml +
      "<div>" +
      '<h2 class="lightbox-title">' + escapeHtml(profile.displayName || "Untitled") + verifiedBadgeHtml(profile.uid) + "</h2>" +
      '<p class="lightbox-subtitle">' + escapeHtml(roleLabel) + "</p>" +
      "</div></div>" +
      (id
        ? '<div class="lightbox-title-actions">' +
          '<button type="button" class="lightbox-widen-btn" title="Widen player" aria-label="Toggle player size">⤢</button>' +
          '<button type="button" class="lightbox-crop-btn" title="Crop to 4:3" aria-label="Toggle 4:3 crop">4:3</button>' +
          "</div>"
        : "") +
      "</div>" +
      (profile.uid !== currentUser.uid
        ? '<div class="profile-lightbox-actions" id="profileRequestArea">' +
          '<button type="button" class="profile-request-btn" disabled>Checking…</button>' +
          "</div>"
        : "") +
      (profile.location ? '<div class="profile-lightbox-map" id="profileLightboxMap"></div>' : "") +
      (profile.locationLabel ? '<p class="profile-card-location">' + ICON_PIN + ' ' + escapeHtml(profile.locationLabel) + "</p>" : "") +
      (profile.bio ? '<p class="lightbox-desc">' + escapeHtml(profile.bio) + "</p>" : "") +
      profileCreditsHtml(profile) +
      profileVerifyAreaHtml(profile) +
      "</div>";

    els.lightbox.hidden = false;
    els.lightboxPanel.scrollTop = 0;
    lockBodyScroll();
    pushModalHistory();
    applyLightboxSize();
    applyLightboxCrop();

    if (profile.location) {
      profileLightboxMapInstance = L.map("profileLightboxMap", {
        dragging: false, scrollWheelZoom: false, zoomControl: false,
        doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false
      }).setView([profile.location.lat, profile.location.lng], 9);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18
      }).addTo(profileLightboxMapInstance);
      L.marker([profile.location.lat, profile.location.lng]).addTo(profileLightboxMapInstance);
      setTimeout(function () { if (profileLightboxMapInstance) profileLightboxMapInstance.invalidateSize(); }, 0);
    }

    if (id) {
      var uidAtOpen = profile.uid;
      loadYouTubeAPI(function () {
        if (els.lightbox.hidden || state.lightboxProfileUid !== uidAtOpen) return;
        state.lightboxPlayer = new YT.Player("lightboxPlayerTarget", {
          videoId: id,
          playerVars: { autoplay: loadAutoplayPref() ? 1 : 0, rel: 0, controls: state.lightboxCrop ? 0 : 1 }
        });
      });
    }

    if (profile.uid !== currentUser.uid) {
      var profileUidAtOpen = profile.uid;
      checkCollabStatus(profile.uid).then(function (req) {
        if (els.lightbox.hidden || state.lightboxProfileUid !== profileUidAtOpen) return;
        renderProfileRequestArea(profile, req);
      });
    } else if (!verifiedProfileUids[profile.uid] && findCatalogCreditsForProfile(profile).length) {
      var ownUidAtOpen = profile.uid;
      checkVerificationStatus(profile.uid).then(function (pending) {
        if (els.lightbox.hidden || state.lightboxProfileUid !== ownUidAtOpen) return;
        renderProfileVerifyArea(pending);
      });
    }
  }

  // ---- "Request to collaborate" -- the first real matchmaking action ---
  // No in-app messaging yet, so an accepted request's whole job is to swap
  // emails (each side's own, taken from their own auth token -- see
  // firestore.rules) so people can actually follow up outside the app.
  function collabRequestsRef() { return db.collection("collabRequests"); }

  // Checks both directions -- a profile might have already requested ME
  // before I open theirs, and that should read as "respond to their
  // request", not offer to send a duplicate one.
  function checkCollabStatus(otherUid) {
    var mine = collabRequestsRef().where("fromUid", "==", currentUser.uid).where("toUid", "==", otherUid).limit(1).get();
    var theirs = collabRequestsRef().where("fromUid", "==", otherUid).where("toUid", "==", currentUser.uid).limit(1).get();
    return Promise.all([mine, theirs]).then(function (snaps) {
      var doc = !snaps[0].empty ? snaps[0].docs[0] : (!snaps[1].empty ? snaps[1].docs[0] : null);
      if (!doc) return null;
      var data = doc.data();
      data.id = doc.id;
      return data;
    }).catch(function (err) {
      console.error("Checking collab status failed:", err);
      return null;
    });
  }

  function renderProfileRequestArea(profile, req) {
    var area = document.getElementById("profileRequestArea");
    if (!area) return; // lightbox moved on already
    if (!req) {
      area.innerHTML = '<button type="button" class="profile-request-btn" id="profileRequestBtn" data-uid="' + escapeHtml(profile.uid) + '">Request to collaborate</button>';
      return;
    }
    if (req.status === "pending" && req.fromUid === currentUser.uid) {
      area.innerHTML = '<button type="button" class="profile-request-btn" disabled>Request sent</button>' +
        '<button type="button" class="profile-delete-btn" data-request-action="rescind" data-id="' + escapeHtml(req.id) + '">Rescind</button>';
      return;
    }
    if (req.status === "pending") {
      area.innerHTML = '<button type="button" class="profile-request-btn is-active" id="profileViewIncomingBtn">This person wants to collaborate — respond in Requests</button>';
      return;
    }
    if (req.status === "accepted") {
      area.innerHTML = '<button type="button" class="profile-request-btn is-active" data-message-uid="' + escapeHtml(profile.uid) + '" data-message-name="' + escapeHtml(profile.displayName || "") + '">Connected — Message</button>';
      return;
    }
    area.innerHTML = '<button type="button" class="profile-request-btn" disabled>Request declined</button>';
  }

  function sendCollabRequest(profile) {
    var message = window.prompt("Say a little about what you'd like to collaborate on (optional):", "") || "";
    if (message.length > 300) message = message.slice(0, 300);
    var area = document.getElementById("profileRequestArea");
    if (area) area.innerHTML = '<button type="button" class="profile-request-btn" disabled>Sending…</button>';
    collabRequestsRef().add({
      fromUid: currentUser.uid,
      fromEmail: currentUser.email,
      fromName: currentUser.displayName || currentUser.email,
      toUid: profile.uid,
      toName: profile.displayName || "",
      message: message,
      status: "pending",
      createdAt: Date.now()
    }).then(function () {
      renderProfileRequestArea(profile, { status: "pending", fromUid: currentUser.uid });
    }).catch(function (err) {
      console.error("Sending collab request failed:", err);
      if (area) area.innerHTML = '<button type="button" class="profile-request-btn" id="profileRequestBtn" data-uid="' + escapeHtml(profile.uid) + '">Request to collaborate</button>';
      alert("Couldn't send that request -- please try again.");
    });
  }

  function renderRequestRow(req, direction) {
    var name = direction === "incoming" ? (req.fromName || "Someone") : (req.toName || "That profile");
    var statusLabel = req.status === "pending" ? "Pending" : req.status === "accepted" ? "Accepted" : "Declined";
    var actionsHtml = "";
    if (direction === "incoming" && req.status === "pending") {
      actionsHtml =
        '<button type="button" class="profile-delete-btn" data-request-action="decline" data-id="' + escapeHtml(req.id) + '">Decline</button>' +
        '<button type="button" class="media-strip-play-all" data-request-action="accept" data-id="' + escapeHtml(req.id) + '">Accept</button>';
    } else if (direction === "outgoing" && req.status === "pending") {
      actionsHtml = '<button type="button" class="profile-delete-btn" data-request-action="rescind" data-id="' + escapeHtml(req.id) + '">Rescind</button>';
    } else if (req.status === "accepted") {
      var otherUid = direction === "incoming" ? req.fromUid : req.toUid;
      actionsHtml = '<button type="button" class="profile-request-btn is-active" data-message-uid="' + escapeHtml(otherUid) + '" data-message-name="' + escapeHtml(name) + '">Message</button>';
    }
    return '<div class="profile-request-row">' +
      '<div class="profile-request-row-info">' +
      '<div class="profile-request-row-name">' + escapeHtml(name) + '</div>' +
      (req.message ? '<p class="profile-request-row-message">' + escapeHtml(req.message) + "</p>" : "") +
      '<div class="profile-request-row-status">' + statusLabel + "</div>" +
      "</div>" +
      (actionsHtml ? '<div class="profile-request-row-actions">' + actionsHtml + "</div>" : "") +
      "</div>";
  }

  function loadCollabRequests() {
    var incomingPromise = collabRequestsRef().where("toUid", "==", currentUser.uid).get();
    var outgoingPromise = collabRequestsRef().where("fromUid", "==", currentUser.uid).get();
    return Promise.all([incomingPromise, outgoingPromise]).then(function (snaps) {
      function toList(snap) {
        return snap.docs.map(function (doc) {
          var d = doc.data();
          d.id = doc.id;
          return d;
        }).sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      }
      var incoming = toList(snaps[0]);
      var outgoing = toList(snaps[1]);

      els.profileIncomingRequests.innerHTML = incoming.map(function (r) { return renderRequestRow(r, "incoming"); }).join("");
      els.profileIncomingEmpty.hidden = !!incoming.length;
      els.profileOutgoingRequests.innerHTML = outgoing.map(function (r) { return renderRequestRow(r, "outgoing"); }).join("");
      els.profileOutgoingEmpty.hidden = !!outgoing.length;

      var pendingIncomingCount = incoming.filter(function (r) { return r.status === "pending"; }).length;
      els.profileRequestsBadge.textContent = String(pendingIncomingCount);
      els.profileRequestsBadge.hidden = !pendingIncomingCount;
      notifyPendingRequests = pendingIncomingCount;
      renderCombinedNotifyBadge();
    }).catch(function (err) {
      console.error("Loading collab requests failed:", err);
    });
  }

  // ---- Site-wide notification badge --------------------------------------
  // Surfaces the same "pending incoming request" count Requests already
  // tracked (previously only visible once already on the Profiles page)
  // plus a lightweight DM "someone's waiting on a reply" count, on the
  // sidebar's Profiles link itself -- visible from the hamburger menu
  // regardless of which mode (Watch/Connect) or page you're currently on,
  // rather than only after already navigating into Connect > Requests.
  // Deliberately not a live listener (would mean two always-on Firestore
  // subscriptions per signed-in visitor for a nice-to-have counter) --
  // refreshed on sign-in and every time the menu opens instead.
  var notifyPendingRequests = 0;
  var notifyUnreadDms = 0;

  function renderCombinedNotifyBadge() {
    var total = notifyPendingRequests + notifyUnreadDms;
    els.sidebarProfilesBadge.textContent = String(total);
    els.sidebarProfilesBadge.hidden = !total;
  }

  function markDmThreadRead(threadId) {
    if (!currentUser) return;
    var patch = {};
    patch["lastReadAt_" + currentUser.uid] = Date.now();
    dmThreadRef(threadId).update(patch).catch(function (err) {
      console.error("Marking thread read failed:", err);
    });
  }

  // A thread counts as "waiting on you" if the last message wasn't yours
  // and arrived after your own lastReadAt_<uid> marker for that thread
  // (set by markDmThreadRead() whenever you actually open it) -- an
  // approximation of "unread" (per-thread, not per-message), which is
  // plenty for a simple notification count.
  function refreshUnreadDmCount() {
    if (!currentUser) { notifyUnreadDms = 0; renderCombinedNotifyBadge(); return Promise.resolve(); }
    var readField = "lastReadAt_" + currentUser.uid;
    return db.collection("dmThreads").where("participants", "array-contains", currentUser.uid).get().then(function (snap) {
      var count = 0;
      snap.forEach(function (doc) {
        var d = doc.data();
        if (!d.lastMessageAt || d.lastMessageFromUid === currentUser.uid) return;
        if (d.lastMessageAt > (d[readField] || 0)) count++;
      });
      notifyUnreadDms = count;
      renderCombinedNotifyBadge();
    }).catch(function (err) {
      console.error("Checking unread DMs failed:", err);
    });
  }

  function refreshNotificationBadge() {
    if (!currentUser) {
      notifyPendingRequests = 0;
      notifyUnreadDms = 0;
      renderCombinedNotifyBadge();
      return;
    }
    loadCollabRequests();
    refreshUnreadDmCount();
  }

  function respondToRequest(id, accept) {
    var update = accept
      ? { status: "accepted", respondedAt: Date.now(), toEmail: currentUser.email }
      : { status: "declined", respondedAt: Date.now() };
    if (!accept) {
      collabRequestsRef().doc(id).update(update).then(function () {
        loadCollabRequests();
      }).catch(function (err) {
        console.error("Responding to collab request failed:", err);
        alert("Couldn't update that request -- please try again.");
      });
      return;
    }
    // Accepting also writes a deterministic per-pair marker doc
    // (acceptedPairs) -- purely so dmThreads' create rule (firestore.rules)
    // can verify the two people are actually connected without an
    // arbitrary query. collabRequests doc IDs are auto-generated, not
    // derivable from the pair, so rules can't exists()-check one directly;
    // acceptedPairs reuses the same sortedPairId scheme as dmThreads so it
    // can.
    collabRequestsRef().doc(id).get().then(function (doc) {
      if (!doc.exists) throw new Error("Request no longer exists");
      var fromUid = doc.data().fromUid;
      var batch = db.batch();
      batch.update(collabRequestsRef().doc(id), update);
      batch.set(db.collection("acceptedPairs").doc(sortedPairId(fromUid, currentUser.uid)), {
        participants: [fromUid, currentUser.uid].sort(),
        acceptedAt: Date.now()
      });
      return batch.commit();
    }).then(function () {
      loadCollabRequests();
    }).catch(function (err) {
      console.error("Responding to collab request failed:", err);
      alert("Couldn't update that request -- please try again.");
    });
  }

  // Withdraws a still-pending outgoing request -- deletes the doc outright
  // rather than marking it "withdrawn", so the sender can just send a new
  // one later if they change their mind (sendCollabRequest()/
  // checkCollabStatus() have no separate handling for a withdrawn state,
  // they just see no request at all). Only ever offered for pending
  // requests (see renderRequestRow()/renderProfileRequestArea()) --
  // firestore.rules only allows the original sender to delete, and only
  // while still pending, so an accepted/declined request can't be erased
  // this way even if someone hand-crafts the call.
  function rescindCollabRequest(id, onDone) {
    collabRequestsRef().doc(id).delete().then(function () {
      if (onDone) onDone();
    }).catch(function (err) {
      console.error("Rescinding collab request failed:", err);
      alert("Couldn't rescind that request -- please try again.");
    });
  }

  els.profilesRequestsBtn.addEventListener("click", function () {
    showProfileRequestsView();
    loadCollabRequests();
  });

  els.profileRequestsBackBtn.addEventListener("click", showProfilesBrowse);

  els.profileRequestsView.addEventListener("click", function (e) {
    var messageBtn = e.target.closest("[data-message-uid]");
    if (messageBtn) {
      openDmThread(messageBtn.getAttribute("data-message-uid"), messageBtn.getAttribute("data-message-name"));
      return;
    }
    var actionBtn = e.target.closest("[data-request-action]");
    if (!actionBtn) return;
    var id = actionBtn.getAttribute("data-id");
    var action = actionBtn.getAttribute("data-request-action");
    if (action === "rescind") {
      rescindCollabRequest(id, loadCollabRequests);
      return;
    }
    respondToRequest(id, action === "accept");
  });

  // ---- Private 1:1 messaging -- only reachable via a "Message" action on
  // an accepted collab request (see acceptedPairs / respondToRequest
  // above), never a standalone inbox. Thread ID is a deterministic sorted
  // pair of UIDs, so there's at most one thread per pair and either
  // party's Message click resolves to the same doc.
  function sortedPairId(uidA, uidB) {
    return uidA < uidB ? uidA + "_" + uidB : uidB + "_" + uidA;
  }

  function dmThreadRef(threadId) { return db.collection("dmThreads").doc(threadId); }

  var dmThreadId = null;
  var dmMessagesUnsub = null;

  function ensureDmThread(otherUid) {
    var threadId = sortedPairId(currentUser.uid, otherUid);
    var ref = dmThreadRef(threadId);
    return ref.get().then(function (doc) {
      if (doc.exists) return threadId;
      return ref.set({
        participants: [currentUser.uid, otherUid].sort(),
        createdAt: Date.now()
      }).then(function () { return threadId; });
    });
  }

  function renderDmMessage(msg) {
    var mine = msg.fromUid === currentUser.uid;
    return '<div class="dm-message' + (mine ? " is-mine" : "") + '"><div class="dm-message-bubble">' + escapeHtml(msg.text) + "</div></div>";
  }

  function subscribeDmMessages(threadId) {
    if (dmMessagesUnsub) { dmMessagesUnsub(); dmMessagesUnsub = null; }
    dmMessagesUnsub = dmThreadRef(threadId).collection("messages").orderBy("createdAt", "asc").onSnapshot(function (snap) {
      var msgs = snap.docs.map(function (doc) { return doc.data(); });
      els.dmMessages.innerHTML = msgs.length
        ? msgs.map(renderDmMessage).join("")
        : '<p class="profiles-empty">No messages yet — say hi.</p>';
      els.dmMessages.scrollTop = els.dmMessages.scrollHeight;
    }, function (err) {
      console.error("Loading messages failed:", err);
      els.dmStatus.textContent = "Couldn't load messages.";
      els.dmStatus.className = "admin-status is-error";
      els.dmStatus.hidden = false;
    });
  }

  function openDmThread(otherUid, otherName) {
    els.dmModalTitle.textContent = "Message " + (otherName || "");
    els.dmMessages.innerHTML = '<p class="profiles-empty">Loading…</p>';
    els.dmStatus.hidden = true;
    els.dmComposerInput.value = "";
    els.dmSendBtn.disabled = true;
    els.dmModal.hidden = false;
    lockBodyScroll();
    pushModalHistory();
    var openedForUid = otherUid;
    ensureDmThread(otherUid).then(function (threadId) {
      if (els.dmModal.hidden || openedForUid !== otherUid) return; // closed or superseded while creating
      dmThreadId = threadId;
      els.dmSendBtn.disabled = false;
      subscribeDmMessages(threadId);
      markDmThreadRead(threadId);
      notifyUnreadDms = Math.max(0, notifyUnreadDms - 1);
      renderCombinedNotifyBadge();
    }).catch(function (err) {
      console.error("Opening thread failed:", err);
      els.dmMessages.innerHTML = "";
      els.dmStatus.textContent = "Couldn't open this conversation — please try again.";
      els.dmStatus.className = "admin-status is-error";
      els.dmStatus.hidden = false;
    });
  }

  function closeDmThread() {
    if (els.dmModal.hidden) return;
    if (dmMessagesUnsub) { dmMessagesUnsub(); dmMessagesUnsub = null; }
    dmThreadId = null;
    els.dmModal.hidden = true;
    unlockBodyScroll();
  }

  els.dmModal.addEventListener("click", function (e) {
    if (e.target.closest("#dmModalClose") || e.target.closest(".lightbox-backdrop")) dismissTopModal();
  });

  els.dmComposerForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = els.dmComposerInput.value.trim();
    if (!text || !dmThreadId) return;
    els.dmSendBtn.disabled = true;
    var threadId = dmThreadId;
    dmThreadRef(threadId).collection("messages").add({
      fromUid: currentUser.uid,
      text: text,
      createdAt: Date.now()
    }).then(function () {
      return dmThreadRef(threadId).update({
        lastMessageText: text,
        lastMessageAt: Date.now(),
        lastMessageFromUid: currentUser.uid
      });
    }).then(function () {
      els.dmComposerInput.value = "";
      els.dmSendBtn.disabled = false;
      els.dmComposerInput.focus();
    }).catch(function (err) {
      console.error("Sending message failed:", err);
      els.dmSendBtn.disabled = false;
      els.dmStatus.textContent = "Message failed to send — please try again.";
      els.dmStatus.className = "admin-status is-error";
      els.dmStatus.hidden = false;
    });
  });

  // ---- TV Mode's Custom tab: pick a playlist as the channel's source ---
  function renderTVCustomPane() {
    var list = loadPlaylists();
    if (!list.length) {
      els.tvCustomList.innerHTML = '<p class="tv-custom-empty">No playlists yet. Add videos to one via the + button on a video, or save a search as a playlist from the Search page.</p>';
      return;
    }
    els.tvCustomList.innerHTML = list.map(function (p) {
      var active = state.tvCustomPlaylistId === p.id ? " is-active" : "";
      return '<button type="button" class="tv-custom-item' + active + '" data-id="' + escapeHtml(p.id) + '">' +
        '<span class="tv-custom-item-name">' + escapeHtml(p.name) + '</span>' +
        '<span class="tv-custom-item-count">' + p.rowNums.length + "</span>" +
        "</button>";
    }).join("");
  }

  els.tvCustomList.addEventListener("click", function (e) {
    var item = e.target.closest(".tv-custom-item");
    if (!item) return;
    var playlist = findPlaylist(item.getAttribute("data-id"));
    if (!playlist) return;
    var rows = playlist.rowNums.map(findRowByNum).filter(function (r) { return r && hasVideo(r); });
    if (!rows.length) {
      alert("This playlist has no playable videos yet.");
      return;
    }
    state.tvCustomPool = rows;
    state.tvCustomPlaylistId = playlist.id;
    renderTVCustomPane();
    armTV();
  });

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
      els.favoritesTitle.textContent = (data.displayName ? data.displayName + "'s" : "Shared") + " Favorites";
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
  // placement — kept in sheet row order rather than randomized. Reversed
  // (newest-flagged rowNum first) per explicit request.
  var hasSpotlightContent = false;
  function renderSpotlightSidebar(rows) {
    var picks = rows
      .filter(function (r) { return r.spotlight; })
      .sort(function (a, b) { return parseInt(b.rowNum, 10) - parseInt(a.rowNum, 10); })
      .slice(0, SPOTLIGHT_COUNT);

    hasSpotlightContent = picks.length > 0;
    if (!picks.length) {
      els.spotlightSidebar.hidden = true;
      return;
    }

    els.spotlightCards.innerHTML = picks.map(function (row) {
      var thumbAlt = escapeHtml((row.song || "Untitled") + (row.artist ? " — " + row.artist : ""));
      var thumb = videoThumbImgHtml(row, thumbAlt);
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

  // ---- Discover: unbounded randomized browsing (see the HTML comment
  // above #discoverSection) -- not curated like Spotlight/Featured, just a
  // fresh random draw from the whole catalog, "See more" appending further
  // random picks indefinitely.
  var DISCOVER_INITIAL_DESKTOP = 30;
  var DISCOVER_INITIAL_MOBILE = 10;
  var DISCOVER_MORE_DESKTOP = 24;
  var DISCOVER_MORE_MOBILE = 8;

  var discoverShownSet = {}; // rowNum -> true, so repeats are avoided until a full lap's done

  function isMobileViewport() {
    return window.matchMedia("(max-width: 640px)").matches;
  }

  function discoverCardHtml(row) {
    var thumbAlt = escapeHtml((row.song || "Untitled") + (row.artist ? " — " + row.artist : ""));
    var thumb = videoThumbImgHtml(row, thumbAlt);
    var artistLine = row.artist || "";
    if (row.director) artistLine += (artistLine ? " · " : "") + "Dir. " + row.director;
    return '<div class="spotlight-card" data-row="' + escapeHtml(row.rowNum) + '">' +
      '<div class="spotlight-card-thumb">' + thumb + "</div>" +
      '<div class="spotlight-card-info">' +
        '<div class="spotlight-card-song">' + escapeHtml(row.song || "(untitled)") + "</div>" +
        '<div class="spotlight-card-artist">' + escapeHtml(artistLine) + "</div>" +
      "</div>" +
    "</div>";
  }

  // Random sample of `count` NEW rows (not shown yet this session). Once
  // fewer than `count` unseen rows remain, starts a fresh lap through the
  // whole catalog instead of just dead-ending once everything's been shown
  // once -- the whole point of "unbounded".
  function sampleDiscoverRows(count) {
    var pool = state.rows.filter(function (r) { return hasVideo(r) && !discoverShownSet[r.rowNum]; });
    if (pool.length < count) {
      discoverShownSet = {};
      pool = state.rows.filter(function (r) { return hasVideo(r); });
    }
    return shuffle(pool).slice(0, count);
  }

  function appendDiscoverRows(count) {
    var picks = sampleDiscoverRows(count);
    picks.forEach(function (r) { discoverShownSet[r.rowNum] = true; });
    els.discoverGrid.insertAdjacentHTML("beforeend", picks.map(discoverCardHtml).join(""));
  }

  function renderDiscoverSection(rows) {
    if (!rows.some(hasVideo)) { els.discoverSection.hidden = true; return; }
    els.discoverSection.hidden = false;
    els.discoverGrid.innerHTML = "";
    discoverShownSet = {};
    appendDiscoverRows(isMobileViewport() ? DISCOVER_INITIAL_MOBILE : DISCOVER_INITIAL_DESKTOP);
  }

  els.discoverSeeMoreBtn.addEventListener("click", function () {
    appendDiscoverRows(isMobileViewport() ? DISCOVER_MORE_MOBILE : DISCOVER_MORE_DESKTOP);
  });

  els.discoverGrid.addEventListener("click", function (e) {
    var card = e.target.closest(".spotlight-card");
    if (!card) return;
    var row = findRowByNum(card.getAttribute("data-row"));
    if (row) openLightbox(row);
  });

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

  function extractVimeoId(url) {
    var m = String(url || "").match(/vimeo\.com\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/|)(\d+)/);
    return m ? m[1] : null;
  }

  // Catalog entries carry a `youtube` and/or `vimeo` URL field (see
  // BULK_FIELD_ALIASES / the single add-edit form) -- this is the one place
  // that decides which provider a row's video actually is, so every
  // thumbnail/player call site branches through it instead of assuming
  // YouTube. youtube wins if a row somehow has both (shouldn't happen via
  // the admin UI, which treats them as alternatives).
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

  // YouTube has a predictable thumbnail URL per video ID (i.ytimg.com);
  // Vimeo doesn't, so its thumbnail is fetched once via oEmbed at
  // save-time and cached on the row as `vimeoThumb` (see
  // fetchVimeoThumbnail() / the admin add-edit and bulk-import submit
  // paths) rather than hit Vimeo's API on every visitor pageview.
  function getRowThumbUrl(row) {
    var ref = getRowVideoRef(row);
    if (!ref) return null;
    if (ref.provider === "youtube") return "https://i.ytimg.com/vi/" + ref.id + "/mqdefault.jpg";
    return row.vimeoThumb || null;
  }

  function videoThumbImgHtml(row, altText) {
    var src = getRowThumbUrl(row);
    return src ? '<img src="' + src + '" alt="' + altText + '" loading="lazy">' : "";
  }

  var vimeoApiReady = false;
  var vimeoApiCallbacks = [];
  function loadVimeoAPI(cb) {
    if (vimeoApiReady) { cb(); return; }
    vimeoApiCallbacks.push(cb);
    if (vimeoApiCallbacks.length > 1) return;
    var tag = document.createElement("script");
    tag.onload = function () {
      vimeoApiReady = true;
      vimeoApiCallbacks.forEach(function (fn) { fn(); });
      vimeoApiCallbacks = [];
    };
    tag.src = "https://player.vimeo.com/api/player.js";
    document.head.appendChild(tag);
  }

  // Common surface over YT.Player and Vimeo.Player so the three player-
  // creation call sites (profile reel, TV Mode, video-detail lightbox)
  // don't each need their own provider branch. `targetElId` is an empty
  // container div both SDKs replace with their own iframe in place.
  function createVideoPlayer(targetElId, ref, opts) {
    opts = opts || {};
    if (ref.provider === "youtube") {
      loadYouTubeAPI(function () {
        if (opts.isStale && opts.isStale()) return;
        var player = new YT.Player(targetElId, {
          videoId: ref.id,
          playerVars: { autoplay: opts.autoplay ? 1 : 0, rel: 0, controls: opts.controls === false ? 0 : 1 },
          events: {
            onStateChange: function (e) {
              if (opts.onEnded && e.data === YT.PlayerState.ENDED) opts.onEnded();
            },
            onError: function (e) {
              // 100: video not found/private, 101 & 150: embedding disabled by the owner
              if (opts.onError && (e.data === 100 || e.data === 101 || e.data === 150)) opts.onError();
            }
          }
        });
        if (opts.onReady) opts.onReady(player);
      });
    } else {
      loadVimeoAPI(function () {
        if (opts.isStale && opts.isStale()) return;
        var player = new Vimeo.Player(targetElId, {
          id: ref.id,
          autoplay: !!opts.autoplay,
          controls: opts.controls !== false
        });
        player.on("ended", function () { if (opts.onEnded) opts.onEnded(); });
        player.on("error", function () { if (opts.onError) opts.onError(); });
        if (opts.onReady) opts.onReady(player);
      });
    }
  }

  // One-time lookup of a Vimeo video's thumbnail via its public oEmbed
  // endpoint (CORS-enabled) -- called at admin save-time (single add/edit
  // and bulk-import preview), not per-visitor, so the public site never
  // needs to talk to Vimeo directly. Resolves null on any failure (private/
  // deleted video, network error) rather than rejecting, since a missing
  // thumbnail shouldn't block saving the entry.
  function fetchVimeoThumbnail(vimeoId) {
    return fetch("https://vimeo.com/api/oembed.json?url=" + encodeURIComponent("https://vimeo.com/" + vimeoId))
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) { return (data && data.thumbnail_url) || null; })
      .catch(function () { return null; });
  }

  function teardownTV() {
    teardownChannelMode();
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
    els.tvPlaylistBtn.hidden = true;
    els.tvCropBtn.hidden = true;
    els.tvMirrorBtn.hidden = true;
    els.tvInterlaceBtn.hidden = true;
    els.tvInfoBtn.hidden = true;
    els.tvAdminEditBtn.hidden = true;
    els.tvAdminDeleteBtn.hidden = true;
    els.tvInfoPanel.hidden = true;
    state.tv.mirror = false;
    state.tv.interlaceHz = 0;
    setInterlaceHz("tv", 0);
  }

  var tvAdController = null;

  // Buckets/counts from the last full renderTVYearDial(), reused by
  // applyTVYearSelection() so dragging the dial only has to reposition the
  // hand and flip a couple of classes/text nodes per pointermove instead of
  // rebuilding all ~80 tick elements every frame.
  var tvYearDialCache = { buckets: [], counts: {}, totalRows: 0 };

  // A ring of short tick buttons around a center hub, instead of a
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
    tvYearDialCache.buckets = buckets;
    tvYearDialCache.counts = counts;
    tvYearDialCache.totalRows = rows.length;

    // "Years" mode can have 80+ ticks -- too many for a per-tick label to
    // stay readable, so those render as a big clock face instead of the
    // Eras/Decades circular buttons: a ring of small minute-notch marks
    // (always visible, not just on hover/active -- see .tv-year-tick-mark)
    // sitting near the outer edge of a drawn circle, with a hand pointing
    // at whichever's selected since 80 near-identical notches are hard to
    // tell apart otherwise. The center hub shows the label once one's
    // tapped.
    var fine = state.tvYearGranularity === "years";
    els.tvYearDialRing.classList.toggle("is-fine", fine);
    var n = buckets.length;
    var radius = fine ? 46 : 42; // percent of the ring's own box -- fine ticks sit closer to the drawn circle's edge
    var ticksHtml = "";
    buckets.forEach(function (b, i) {
      var angleDeg = n ? -90 - (360 / n) * i : -90; // start at 12 o'clock, go counter-clockwise
      var cssRotate = angleDeg + 90; // convert to a CSS rotate() where 0deg = up, clockwise-positive
      var angleRad = angleDeg * Math.PI / 180;
      var x = 50 + radius * Math.cos(angleRad);
      var y = 50 + radius * Math.sin(angleRad);
      var active = state.year === b.key ? " is-active" : "";
      var label = " (" + counts[b.key] + ")";
      if (fine) {
        ticksHtml += '<button type="button" class="tv-year-tick tv-year-tick-fine' + active + '" data-year="' + escapeHtml(b.key) +
          '" style="left:' + x.toFixed(2) + '%;top:' + y.toFixed(2) + '%;transform:translate(-50%, -50%) rotate(' + cssRotate.toFixed(1) + 'deg);" aria-label="' +
          escapeHtml(b.label) + label + '"><span class="tv-year-tick-mark"></span></button>';
      } else {
        ticksHtml += '<button type="button" class="tv-year-tick' + active + '" data-year="' + escapeHtml(b.key) +
          '" style="left:' + x.toFixed(2) + '%;top:' + y.toFixed(2) + '%;" aria-label="' +
          escapeHtml(b.label) + label + '">' + escapeHtml(b.shortLabel) + "</button>";
      }
    });

    // Hand comes before the center hub in the DOM (and neither has an
    // explicit z-index) so the opaque hub -- painted later -- covers the
    // hand's base instead of the hand poking out from underneath it.
    els.tvYearDialRing.innerHTML = ticksHtml +
      '<div class="tv-year-dial-hand"></div>' +
      '<button type="button" class="tv-year-dial-center" id="tvYearDialCenter">' +
        '<span class="tv-year-dial-center-label"></span>' +
        '<span class="tv-year-dial-center-count"></span>' +
      "</button>";

    Array.prototype.forEach.call(els.tvYearLever.querySelectorAll(".tv-year-lever-opt"), function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-granularity") === state.tvYearGranularity);
    });

    applyTVYearSelection(state.year);
  }

  // Cheap visual-only update (active tick, hand angle, center hub text) --
  // used both by the click/tap path and on every pointermove while dragging
  // the dial, where rebuilding all ~80 tick elements per frame would be too
  // slow. Does NOT touch state.mvgOnly/render()/the actual filtered pool --
  // callers decide when to commit that (immediately for a tap, only at
  // drag-end for a drag, so whipping the dial around doesn't reload the
  // player 30 times a second).
  function applyTVYearSelection(key) {
    state.year = key;
    // Picking (or even just browsing) an Era/Decade/Year value means the
    // viewer wants catalog-wide filtering again, not a fixed playlist.
    state.tvCustomPool = null;
    state.tvCustomPlaylistId = null;
    var buckets = tvYearDialCache.buckets;
    var counts = tvYearDialCache.counts;
    var n = buckets.length;
    var selected = null;
    var selectedIndex = -1;
    buckets.forEach(function (b, i) {
      if (b.key === key) { selected = b; selectedIndex = i; }
    });

    Array.prototype.forEach.call(els.tvYearDialRing.querySelectorAll(".tv-year-tick"), function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-year") === key);
    });

    var hand = els.tvYearDialRing.querySelector(".tv-year-dial-hand");
    if (hand) {
      var angleDeg = selectedIndex >= 0 && n ? -90 - (360 / n) * selectedIndex : -90;
      hand.style.transform = "translateX(-50%) rotate(" + (angleDeg + 90).toFixed(1) + "deg)";
    }

    var fine = state.tvYearGranularity === "years";
    var centerLabel = selected ? selected.label : (fine ? "All Years" : "All " + (state.tvYearGranularity === "decades" ? "Decades" : "Eras"));
    var centerCount = (selected ? counts[selected.key] : tvYearDialCache.totalRows) + " videos";
    var labelEl = els.tvYearDialRing.querySelector(".tv-year-dial-center-label");
    var countEl = els.tvYearDialRing.querySelector(".tv-year-dial-center-count");
    if (labelEl) labelEl.textContent = centerLabel;
    if (countEl) countEl.textContent = centerCount;
  }

  els.tvYearLever.addEventListener("click", function (e) {
    var opt = e.target.closest(".tv-year-lever-opt");
    if (!opt) return;
    var granularity = opt.getAttribute("data-granularity");
    if (granularity === state.tvYearGranularity) return;
    state.tvYearGranularity = granularity;
    state.year = ""; // bucket keys aren't comparable across granularities
    renderTVYearDial(state.rows);
    render();
  });

  // Drag-to-tune: press anywhere on the ring (or the initial tick you land
  // on) and drag around it like a real dial -- the nearest bucket is
  // computed from the pointer's angle relative to the ring's center, not
  // from which element is under the cursor, so it tracks smoothly between
  // ticks instead of only reacting when the pointer happens to cross one.
  // A label follows the pointer showing what you'd land on; the actual
  // filter (render()) only commits on release, so spinning through many
  // buckets doesn't reload the player dozens of times.
  var tvYearDragActive = false;
  var tvYearDragMoved = false;

  function tvYearBucketForClientPoint(clientX, clientY) {
    var buckets = tvYearDialCache.buckets;
    var n = buckets.length;
    if (!n) return null;
    var rect = els.tvYearDialRing.getBoundingClientRect();
    var dx = clientX - (rect.left + rect.width / 2);
    var dy = clientY - (rect.top + rect.height / 2);
    var angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
    var step = 360 / n;
    // Inverse of the placement formula in renderTVYearDial()
    // (angleDeg(tick_i) = -90 - step*i), solved for the nearest i.
    var idx = Math.round((((-90 - angleDeg) % 360) + 360) % 360 / step) % n;
    return buckets[idx];
  }

  function tvYearDragTo(clientX, clientY) {
    var bucket = tvYearBucketForClientPoint(clientX, clientY);
    if (!bucket) return;
    if (state.year !== bucket.key) applyTVYearSelection(bucket.key);
    els.tvYearDragLabel.textContent = bucket.label;
    els.tvYearDragLabel.style.left = clientX + "px";
    els.tvYearDragLabel.style.top = clientY + "px";
    els.tvYearDragLabel.hidden = false;
  }

  els.tvYearDialRing.addEventListener("pointerdown", function (e) {
    if (e.target.closest("#tvYearDialCenter")) return; // hub keeps its own tap-to-reset
    tvYearDragActive = true;
    tvYearDragMoved = false;
    try { els.tvYearDialRing.setPointerCapture(e.pointerId); } catch (err) {}
    tvYearDragTo(e.clientX, e.clientY);
  });

  els.tvYearDialRing.addEventListener("pointermove", function (e) {
    if (!tvYearDragActive) return;
    tvYearDragMoved = true;
    tvYearDragTo(e.clientX, e.clientY);
  });

  function tvYearDragEnd() {
    if (!tvYearDragActive) return;
    tvYearDragActive = false;
    els.tvYearDragLabel.hidden = true;
    render();
  }
  els.tvYearDialRing.addEventListener("pointerup", tvYearDragEnd);
  els.tvYearDialRing.addEventListener("pointercancel", tvYearDragEnd);

  // Keyboard/no-pointer-movement fallback (Tab to a tick, press Enter/
  // Space; or a plain click) -- suppressed after an actual drag gesture so
  // the click a pointerup naturally fires afterward doesn't re-trigger a
  // second, possibly different, selection.
  els.tvYearDialRing.addEventListener("click", function (e) {
    if (tvYearDragMoved) { tvYearDragMoved = false; return; }
    var center = e.target.closest("#tvYearDialCenter");
    if (center) {
      applyTVYearSelection("");
      render();
      return;
    }
    var tick = e.target.closest(".tv-year-tick");
    if (tick) {
      applyTVYearSelection(tick.getAttribute("data-year"));
      render();
    }
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
        '"><span class="tv-genre-tile-label">' + escapeHtml(g.label) +
        '</span><span class="tv-genre-tile-count">' + counts[g.key] + "</span></button>";
    });
    els.tvGenreGrid.innerHTML = html;
  }

  els.tvGenreGrid.addEventListener("click", function (e) {
    var tile = e.target.closest(".tv-genre-tile");
    if (!tile) return;
    var key = tile.getAttribute("data-genre");
    state.genre = state.genre === key ? "" : key; // tapping the active tile again clears it
    // Picking a genre means catalog-wide filtering again, not a fixed playlist.
    state.tvCustomPool = null;
    state.tvCustomPlaylistId = null;
    renderTVGenreGrid(state.rows);
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
    els.tvChannelPane.hidden = state.tvActiveTab !== "channel";
  }

  els.tvFilterTabs.addEventListener("click", function (e) {
    var tab = e.target.closest(".tv-filter-tab");
    if (!tab) return;
    var wasChannel = state.tvActiveTab === "channel";
    var nowChannel = tab.getAttribute("data-tab") === "channel";
    state.tvActiveTab = tab.getAttribute("data-tab");
    updateTVFilterTabUI();
    if (nowChannel) {
      tuneChannelMode();
    } else if (wasChannel) {
      // Leaving the shared channel for a regular filter tab -- back to the
      // normal armed/static "tap to play" flow, same as any other tab pick.
      teardownChannelMode();
      armTV();
    }
  });

  function enterTVFilterMode() {
    if (state.tvFilterMode) return;
    state.homeYearBeforeTV = state.year;
    state.homeGenreBeforeTV = state.genre;
    state.homeMvgOnlyBeforeTV = state.mvgOnly;
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
    els.savePlaylistBtn.hidden = true; // Search-only -- nothing to "save as playlist" in TV Mode
    els.tvFilterTabs.hidden = false;
    state.tvActiveTab = "genre";
    updateTVFilterTabUI();
    renderTVYearDial(state.rows);
    renderTVGenreGrid(state.rows);
    renderTVCustomPane();
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
    els.savePlaylistBtn.hidden = false;
    els.tvFilterTabs.hidden = true;
    buildYearOptions(state.rows);
    buildGenreOptions(state.rows);
    els.yearFilter.value = state.year;
    els.genreFilter.value = state.genre;
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
    state.tvCustomPool = null;
    state.tvCustomPlaylistId = null;
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

  // Slot quotas by real submission age (createdAt), not rowNum rank --
  // protects Latest Submissions from being wall-to-wall a single huge bulk
  // import (the same class of problem the word cloud has, see cloud.js's
  // LATEST_POOL comment) while matching real calendar-week recency.
  var LATEST_AGE_BUCKETS = [
    { maxDays: 7, share: 0.40 },
    { maxDays: 14, share: 0.30 },
    { maxDays: 21, share: 0.20 },
    { maxDays: 42, share: 0.10 }
  ];

  function daysOld(row) {
    if (!row.createdAt) return null;
    return (Date.now() - row.createdAt) / 86400000;
  }

  // Buckets candidates by real age into the weekly tiers above, each with an
  // explicit slot quota (share * count), uniformly shuffled within itself --
  // age controls how many slots come from around how recent, nothing more.
  // Anything older than the oldest tier, or missing createdAt entirely
  // (older/imported entries that pre-date timestamp tracking), falls into a
  // residual pool used only to backfill shortfalls, so the strip still
  // reads as "mostly recent, but always a mix of everything else" even
  // before real age data exists for the whole catalog.
  function ageBucketSample(candidates, count) {
    var buckets = LATEST_AGE_BUCKETS.map(function () { return []; });
    candidates.forEach(function (row) {
      var age = daysOld(row);
      if (age == null) return;
      for (var i = 0; i < LATEST_AGE_BUCKETS.length; i++) {
        if (age <= LATEST_AGE_BUCKETS[i].maxDays) { buckets[i].push(row); break; }
      }
    });

    var picked = [];
    var pickedSet = {};
    function takeFrom(list, n) {
      var pool = shuffle(list);
      for (var i = 0; i < pool.length && n > 0; i++) {
        var row = pool[i];
        if (pickedSet[row.rowNum]) continue;
        picked.push(row);
        pickedSet[row.rowNum] = true;
        n--;
      }
    }

    LATEST_AGE_BUCKETS.forEach(function (bucket, i) {
      takeFrom(buckets[i], Math.round(count * bucket.share));
    });

    if (picked.length < count) {
      var everyoneElse = candidates.filter(function (row) { return !pickedSet[row.rowNum]; });
      takeFrom(everyoneElse, count - picked.length);
    }

    return picked.slice(0, count);
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

  // Admin debug tool: an approximation of interlace flicker, NOT a real
  // interlaced signal -- there's no pixel/canvas access into a cross-origin
  // YouTube/Vimeo iframe, so the actual source frames can't be read or
  // resampled. This overlays a repeating-linear-gradient scanline pattern
  // on top of the real (progressive) video and shifts it by one line on a
  // timer, alternating which set of lines reads as darkened -- a
  // requestAnimationFrame loop (not a CSS animation) checks elapsed time
  // against the target period so the flip cadence is a real 50/60Hz
  // regardless of the display's own refresh rate, rather than however a
  // browser happens to schedule a CSS animation. On a 60Hz display, a 50Hz
  // target will show slight beating/jitter -- physically inherent to
  // emulating one rate on a display running another, not a bug to chase.
  // Real NTSC has ~486 active scanlines split into two ~243-line fields.
  // Matching that exactly scales line pitch with the player's actual
  // rendered height the way a real interlaced signal's would -- but at
  // typical player sizes, true 243-line-per-field pitch is finer than a
  // browser can render legibly over compressed video (the CSS reads as a
  // faint haze, not scanlines). This coarsens to roughly a third of the
  // real line count -- still scales with player height, just chosen for
  // visibility over broadcast accuracy.
  var INTERLACE_TOTAL_LINES = 162;
  var INTERLACE_OVERLAY_IDS = { lightbox: "lightboxInterlaceOverlay", tv: "tvInterlaceOverlay" };
  var interlaceHz = { lightbox: 0, tv: 0 };
  var interlaceField = { lightbox: false, tv: false };
  var interlaceLastFlip = { lightbox: 0, tv: 0 };
  var interlaceRAF = null;

  function interlaceFrameEl(which) {
    return which === "tv" ? els.videoBox.querySelector(".video-embed-frame") : document.getElementById("lightboxVideoFrame");
  }

  function tickInterlace(now) {
    Object.keys(INTERLACE_OVERLAY_IDS).forEach(function (which) {
      var hz = interlaceHz[which];
      if (!hz) return;
      if (now - interlaceLastFlip[which] < 1000 / hz) return;
      interlaceLastFlip[which] = now;
      interlaceField[which] = !interlaceField[which];
      var el = document.getElementById(INTERLACE_OVERLAY_IDS[which]);
      var frame = interlaceFrameEl(which);
      if (!el || !frame) return;
      // Recomputed on every flip (not just on toggle/resize) so a crop
      // toggle, widen, or window resize between flips is picked up for
      // free without a separate resize listener.
      var linePx = Math.max(1, frame.clientHeight / INTERLACE_TOTAL_LINES);
      el.style.backgroundSize = "100% " + (linePx * 2) + "px";
      el.style.backgroundPositionY = interlaceField[which] ? linePx + "px" : "0px";
    });
    interlaceRAF = requestAnimationFrame(tickInterlace);
  }

  function setInterlaceHz(which, hz) {
    interlaceHz[which] = hz;
    var el = document.getElementById(INTERLACE_OVERLAY_IDS[which]);
    if (el) el.hidden = !hz;
    if (hz && interlaceRAF == null) interlaceRAF = requestAnimationFrame(tickInterlace);
    if (!interlaceHz.lightbox && !interlaceHz.tv && interlaceRAF != null) {
      cancelAnimationFrame(interlaceRAF);
      interlaceRAF = null;
    }
  }

  // Cycles Off -> 60Hz -> 50Hz -> Off on each click.
  function nextInterlaceHz(hz) {
    if (hz === 60) return 50;
    if (hz === 50) return 0;
    return 60;
  }

  var TV_PLAYER_TARGET_INNER_HTML = '<div id="tvPlayerTarget"></div><div class="video-interlace-overlay" id="tvInterlaceOverlay" hidden></div>';
  var TV_PLAYER_TARGET_HTML = '<div class="video-embed-frame">' + TV_PLAYER_TARGET_INNER_HTML + '</div>';

  // No title bar -- the YouTube player itself already shows the video's
  // title, so a duplicate label above it was redundant. Skip/Report
  // issue/Exit now live in .filters-toggle-row instead (see
  // playArmedTV()/startTVMode()/teardownTV() for their show/hide).
  function ensureTVShell() {
    if (state.tv.shellBuilt) return;
    els.videoBox.innerHTML = TV_PLAYER_TARGET_HTML;
    state.tv.shellBuilt = true;
    applyTVCrop();
    applyTVMirror();
    applyTVInterlace();
  }

  // Same visual-only crop as the lightbox player's applyLightboxCrop() --
  // see that function's comment. Persisted separately (TV_CROP_KEY) since
  // TV Mode and the video-detail lightbox are used differently enough that
  // forcing one preference onto the other would surprise people.
  function applyTVCrop() {
    var frame = els.videoBox.querySelector(".video-embed-frame");
    var isCropped = !!state.tv.crop;
    if (frame) frame.classList.toggle("is-crop-4-3", isCropped);
    els.tvCropBtn.classList.toggle("is-active", isCropped);
    els.tvCropBtn.title = isCropped ? "Restore 16:9" : "Crop to 4:3";
  }

  function applyTVMirror() {
    var frame = els.videoBox.querySelector(".video-embed-frame");
    if (frame) frame.classList.toggle("is-mirrored", !!state.tv.mirror);
    els.tvMirrorBtn.classList.toggle("is-active", !!state.tv.mirror);
  }

  function applyTVInterlace() {
    setInterlaceHz("tv", state.tv.interlaceHz);
    els.tvInterlaceBtn.classList.toggle("is-active", !!state.tv.interlaceHz);
    els.tvInterlaceBtn.textContent = state.tv.interlaceHz ? "Interlace " + state.tv.interlaceHz + "Hz" : "Interlace";
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

  // Reuses the existing player in place (loadVideoById/loadVideo) when the
  // next track is the SAME provider as what's already loaded -- avoids a
  // visible player teardown/rebuild on every skip. A provider switch (a
  // YouTube track followed by a Vimeo one, or vice versa) can't reuse the
  // other SDK's player, so it tears down and rebuilds the target div fresh.
  function loadTVTrack(row, startPaused) {
    var ref = getRowVideoRef(row);
    if (!ref) {
      advanceTV();
      return;
    }
    updateTVTrackDetails(row);

    if (state.tv.player && state.tv.playerProvider === ref.provider && ref.provider === "youtube" && state.tv.player.loadVideoById) {
      if (startPaused && state.tv.player.cueVideoById) {
        state.tv.player.cueVideoById(ref.id);
      } else {
        state.tv.player.loadVideoById(ref.id);
      }
      return;
    }
    if (state.tv.player && state.tv.playerProvider === ref.provider && ref.provider === "vimeo" && state.tv.player.loadVideo) {
      state.tv.player.loadVideo(ref.id).then(function () {
        if (startPaused) state.tv.player.pause(); else state.tv.player.play();
      }).catch(function () { if (state.tv.active) advanceTV(); });
      return;
    }

    if (state.tv.player && state.tv.player.destroy) {
      try { state.tv.player.destroy(); } catch (e) {}
    }
    state.tv.player = null;
    var frame = els.videoBox.querySelector(".video-embed-frame");
    if (frame) frame.innerHTML = TV_PLAYER_TARGET_INNER_HTML;
    setInterlaceHz("tv", state.tv.interlaceHz); // re-applies to the freshly rebuilt overlay div
    createVideoPlayer("tvPlayerTarget", ref, {
      autoplay: !startPaused,
      controls: !state.tv.crop,
      isStale: function () { return !state.tv.active; },
      onEnded: function () { if (state.tv.active) advanceTV(); },
      onError: function () { if (state.tv.active) advanceTV(); },
      onReady: function (player) {
        state.tv.player = player;
        state.tv.playerProvider = ref.provider;
      }
    });
  }

  function advanceTV() {
    state.tv.index++;
    if (state.tv.index >= state.tv.queue.length) {
      state.tv.queue = shuffle(state.tv.queue);
      state.tv.index = 0;
    }
    loadTVTrack(state.tv.queue[state.tv.index]);
  }

  // ---- Channel Mode -------------------------------------------------------
  // TV Mode's 4th tab: a single shared, synchronized "channel" every visitor
  // watching it sees the same position in, driven entirely by client-side
  // time math against one Firestore doc (`channel/current`) -- no server
  // pushing anything, no Cloud Function advancing an index. Every client
  // independently computes "what's on right now" from a fixed anchor
  // timestamp plus each queue item's cached duration:
  //   elapsed = (now - anchorAt) mod totalDuration
  // then walks the cumulative durations to find which item that falls in
  // and how far into it. Playback then just chains forward via the video
  // player's own onEnded (see loadChannelTrackAt), with a periodic
  // wall-clock resync as a safety net against drift (buffering stalls,
  // background-tab throttling, joining mid-video). Editing the queue
  // (admin's DJ-deck panel) doesn't need to notify anyone -- every tuned-in
  // client is listening to the doc and recomputes/rejumps automatically.
  var CHANNEL_RESYNC_INTERVAL_MS = 20000;
  var CHANNEL_DRIFT_TOLERANCE_SEC = 3;

  // mulberry32 -- tiny deterministic PRNG so "Shuffled" mode's order is
  // identical across every client given the same shuffleSeed, unlike
  // Math.random()-based shuffle() used elsewhere (TV Mode's regular pool
  // shuffle is intentionally per-viewer-random; Channel Mode's can't be).
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seededShuffle(arr, seed) {
    var rand = mulberry32(seed || 0);
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // Queue items come in two shapes: catalog-sourced (`{rowNum, duration}`,
  // the original shape) and ad-hoc inserts (`{provider, videoId, title,
  // duration}`, a raw pasted link with no catalog entry at all -- see the
  // admin panel's "Insert a YouTube or Vimeo link"). These three helpers
  // are the one place that distinction is handled, so everything else
  // (scheduling, playback, rendering) can treat any item uniformly.
  function channelItemRef(item) {
    if (!item) return null;
    if (item.provider && item.videoId) return { provider: item.provider, id: item.videoId };
    if (item.rowNum) {
      var row = findRowByNum(item.rowNum);
      return row ? getRowVideoRef(row) : null;
    }
    return null;
  }

  function channelItemTitle(item) {
    if (!item) return "";
    if (item.rowNum) {
      var row = findRowByNum(item.rowNum);
      return row ? ((row.artist ? row.artist + " — " : "") + (row.song || "")) : ("#" + item.rowNum + " (not found)");
    }
    return item.title || "(untitled)";
  }

  function channelItemKey(item) {
    if (!item) return null;
    return item.rowNum ? ("row:" + item.rowNum) : ("adhoc:" + item.provider + ":" + item.videoId);
  }

  // Playable = has a resolvable video ref AND a known duration
  // (unresolved-duration items are skipped from scheduling rather than
  // breaking the whole channel -- see resolveMissingChannelDurations() in
  // the admin panel, which is what fills `duration` in for newly-added items).
  function channelPlayOrder(doc) {
    if (!doc || !doc.items || !doc.items.length) return [];
    var playable = doc.items.filter(function (it) {
      return it.duration > 0 && !!channelItemRef(it);
    });
    return doc.mode === "shuffled" ? seededShuffle(playable, doc.shuffleSeed || 0) : playable;
  }

  // The regular rotation, ignoring any active scheduledInsert overlay (see
  // computeChannelPosition() below) -- kept separate so the admin panel's
  // per-item "plays at" schedule always reflects the underlying queue
  // rotation, which keeps ticking through an interrupt rather than pausing
  // for it (see the comment on activeScheduledInsert()).
  function computeQueueLoopPosition(doc) {
    var order = channelPlayOrder(doc);
    if (!order.length || !doc.anchorAt) return null;
    var total = order.reduce(function (s, it) { return s + it.duration; }, 0);
    if (total <= 0) return null;
    var anchorMs = doc.anchorAt.toMillis ? doc.anchorAt.toMillis() : doc.anchorAt;
    var elapsed = ((Date.now() - anchorMs) / 1000) % total;
    if (elapsed < 0) elapsed += total;
    var acc = 0;
    for (var i = 0; i < order.length; i++) {
      if (elapsed < acc + order[i].duration) return { kind: "queue", order: order, index: i, item: order[i], offsetSec: elapsed - acc };
      acc += order[i].duration;
    }
    return { kind: "queue", order: order, index: 0, item: order[0], offsetSec: 0 };
  }

  // A one-off "cut to this video right now/at this time" override (see the
  // admin panel's "Play immediately" / "At a specific time" insert options)
  // -- deliberately NOT part of `items`/the loop rotation. It's a pure
  // overlay: while it's active, computeChannelPosition() returns it instead
  // of the regular queue position; once its duration elapses, the regular
  // queue resumes wherever the loop's own clock says "now" is (which kept
  // advancing the whole time -- effectively the interrupt "skips ahead"
  // the regular rotation by however long it played, same as a real DJ
  // cutting to something live and then returning to the rotation).
  function activeScheduledInsert(doc) {
    var si = doc && doc.scheduledInsert;
    if (!si || !si.duration) return null;
    var playAtMs = si.playAt && si.playAt.toMillis ? si.playAt.toMillis() : si.playAt;
    var offsetSec = (Date.now() - playAtMs) / 1000;
    if (offsetSec < 0 || offsetSec >= si.duration) return null;
    return {
      kind: "insert",
      item: { provider: si.provider, videoId: si.videoId, title: si.title, duration: si.duration },
      offsetSec: offsetSec
    };
  }

  function computeChannelPosition(doc) {
    return activeScheduledInsert(doc) || computeQueueLoopPosition(doc);
  }

  function updateTVChannelStatus(text) {
    if (els.tvChannelStatus) els.tvChannelStatus.textContent = text;
  }

  function clearChannelResyncTimer() {
    if (state.channel.resyncTimer) { clearInterval(state.channel.resyncTimer); state.channel.resyncTimer = null; }
  }

  // Shows Report/Favorite/Playlist/admin-edit/Info for a real catalog row;
  // an ad-hoc inserted link has none of that (no rowNum to act on), so it
  // just gets a plain title in the info panel and those controls hidden.
  function updateTVChannelTrackDetails(item) {
    if (item.rowNum) {
      var row = findRowByNum(item.rowNum);
      if (row) { updateTVTrackDetails(row); return; }
    }
    els.tvReportLink.hidden = true;
    els.tvFavBtn.hidden = true;
    els.tvPlaylistBtn.hidden = true;
    els.tvAdminEditBtn.hidden = true;
    els.tvAdminDeleteBtn.hidden = true;
    els.tvInfoPanel.innerHTML = '<h3 class="tv-info-title">' + escapeHtml(item.title || "(untitled)") + "</h3>";
  }

  // Loads `pos.item` (from computeChannelPosition() -- either a regular
  // queue entry or an active scheduledInsert) starting at `pos.offsetSec`
  // into the existing TV player shell, then chains to whatever's next on
  // natural end -- same provider-reuse logic as loadTVTrack, just with an
  // extra post-ready seek and a different "what happens next" hook.
  function loadChannelTrackAt(pos) {
    var item = pos.item;
    var ref = channelItemRef(item);
    if (!ref) {
      if (pos.kind === "queue") advanceChannelTrack();
      return;
    }
    var offsetSec = pos.offsetSec;
    updateTVChannelTrackDetails(item);
    state.channel.currentKind = pos.kind;
    if (pos.kind === "queue") {
      state.channel.currentOrder = pos.order;
      state.channel.currentIndex = pos.index;
      state.channel.currentInsertVideoId = null;
      var nextItem = pos.order[(pos.index + 1) % pos.order.length];
      updateTVChannelStatus("🔴 You're tuned into the Channel" +
        (nextItem ? " — up next: " + channelItemTitle(nextItem) : ""));
    } else {
      state.channel.currentOrder = null;
      state.channel.currentIndex = -1;
      state.channel.currentInsertVideoId = item.videoId;
      updateTVChannelStatus("🔴 " + channelItemTitle(item) + " — back to the regular Channel after this");
    }

    function seekOnceReady(player, provider) {
      if (provider === "youtube") {
        try { if (offsetSec > 0.5) player.seekTo(offsetSec, true); } catch (e) {}
      } else if (provider === "vimeo" && player.setCurrentTime) {
        if (offsetSec > 0.5) player.setCurrentTime(offsetSec).catch(function () {});
      }
    }

    if (state.tv.player && state.tv.playerProvider === ref.provider && ref.provider === "youtube" && state.tv.player.loadVideoById) {
      state.tv.player.loadVideoById(ref.id, offsetSec);
      return;
    }
    if (state.tv.player && state.tv.playerProvider === ref.provider && ref.provider === "vimeo" && state.tv.player.loadVideo) {
      state.tv.player.loadVideo(ref.id).then(function () {
        seekOnceReady(state.tv.player, "vimeo");
        state.tv.player.play();
      }).catch(function () { if (state.tv.active) advanceChannelTrack(); });
      return;
    }

    if (state.tv.player && state.tv.player.destroy) {
      try { state.tv.player.destroy(); } catch (e) {}
    }
    state.tv.player = null;
    var frame = els.videoBox.querySelector(".video-embed-frame");
    if (frame) frame.innerHTML = TV_PLAYER_TARGET_INNER_HTML;
    setInterlaceHz("tv", state.tv.interlaceHz);
    createVideoPlayer("tvPlayerTarget", ref, {
      autoplay: true,
      controls: !state.tv.crop,
      isStale: function () { return !state.tv.active || state.tvActiveTab !== "channel"; },
      onEnded: function () { if (state.tv.active && state.tvActiveTab === "channel") advanceChannelTrack(); },
      onError: function () { if (state.tv.active && state.tvActiveTab === "channel") advanceChannelTrack(); },
      onReady: function (player) {
        state.tv.player = player;
        state.tv.playerProvider = ref.provider;
        seekOnceReady(player, ref.provider);
      }
    });
  }

  // Natural end-of-track advance -- just steps to the next item in the same
  // (already-shuffled-if-applicable) order, no reshuffling on wrap. Keeping
  // the order fixed between admin-triggered reshuffles is what lets clients
  // that joined at different times stay on the same page, not just the same
  // video-within-a-loop.
  function advanceChannelTrack() {
    if (state.channel.currentKind === "insert") {
      // The interrupt just ended -- resync falls through to wherever the
      // regular queue's own clock says "now" is (see activeScheduledInsert).
      resyncChannelIfNeeded();
      return;
    }
    var order = state.channel.currentOrder || [];
    if (!order.length) return;
    var next = (state.channel.currentIndex + 1) % order.length;
    loadChannelTrackAt({ kind: "queue", order: order, index: next, item: order[next], offsetSec: 0 });
  }

  // Wall-clock safety net -- re-derives where the channel "should" be right
  // now and corrects if this client has drifted (a different video entirely,
  // or the same video but off by more than a few seconds). Also fires
  // whenever the Firestore doc itself changes, so an admin inserting/
  // removing/reordering while people are tuned in takes effect immediately
  // rather than only on their next natural track-end.
  function resyncChannelIfNeeded() {
    if (state.tvActiveTab !== "channel") return;
    if (!state.channel.doc) {
      updateTVChannelStatus("Nothing in the Channel queue yet.");
      return;
    }
    var pos = computeChannelPosition(state.channel.doc);
    if (!pos) {
      updateTVChannelStatus("Nothing in the Channel queue yet.");
      return;
    }
    var sameTrack = pos.kind === "insert"
      ? (state.channel.currentKind === "insert" && state.channel.currentInsertVideoId === pos.item.videoId)
      : (state.channel.currentKind === "queue" && state.channel.currentOrder && state.channel.currentOrder[state.channel.currentIndex] &&
          pos.order[pos.index] && state.channel.currentIndex === pos.index &&
          channelItemKey(state.channel.currentOrder[state.channel.currentIndex]) === channelItemKey(pos.order[pos.index]));
    if (!sameTrack) {
      loadChannelTrackAt(pos);
      return;
    }
    // Same track -- just check drift against actual playback position.
    // YouTube's getCurrentTime() is synchronous; Vimeo's returns a Promise.
    if (!state.tv.player || !state.tv.player.getCurrentTime) return;
    if (state.tv.playerProvider === "vimeo") {
      state.tv.player.getCurrentTime().then(function (current) {
        if (typeof current === "number" && Math.abs(current - pos.offsetSec) > CHANNEL_DRIFT_TOLERANCE_SEC && state.tv.player.setCurrentTime) {
          state.tv.player.setCurrentTime(pos.offsetSec).catch(function () {});
        }
      }).catch(function () {});
      return;
    }
    try {
      var current = state.tv.player.getCurrentTime();
      if (typeof current === "number" && Math.abs(current - pos.offsetSec) > CHANNEL_DRIFT_TOLERANCE_SEC) {
        state.tv.player.seekTo(pos.offsetSec, true);
      }
    } catch (e) {}
  }

  function subscribeChannelDoc() {
    if (state.channel.unsub) return;
    state.channel.unsub = db.collection("channel").doc("current").onSnapshot(function (doc) {
      state.channel.doc = doc.exists ? doc.data() : null;
      if (state.tvActiveTab === "channel") resyncChannelIfNeeded();
    }, function (err) {
      console.error("Channel doc listener failed:", err);
      updateTVChannelStatus("Couldn't load the Channel right now.");
    });
  }

  function teardownChannelMode() {
    clearChannelResyncTimer();
    if (state.channel.unsub) { state.channel.unsub(); state.channel.unsub = null; }
    state.channel.tuned = false;
    state.channel.currentKind = null;
    state.channel.currentOrder = null;
    state.channel.currentIndex = -1;
    state.channel.currentInsertVideoId = null;
  }

  // Entry point for the Channel tab -- bypasses TV Mode's usual armed/
  // static "tap to play" screen entirely, since there's nothing to arm: you
  // tune in to whatever's already playing, like a real TV channel.
  function tuneChannelMode() {
    teardownTV();
    state.tv.active = true;
    state.tv.started = true;
    state.channel.tuned = true;
    ensureTVShell();
    updateTVChannelStatus("Tuning in…");
    els.tvReportLink.hidden = false;
    els.tvFavBtn.hidden = false;
    els.tvPlaylistBtn.hidden = false;
    els.tvCropBtn.hidden = false;
    els.tvMirrorBtn.hidden = !state.isAdmin;
    els.tvInterlaceBtn.hidden = !state.isAdmin;
    els.tvInfoBtn.hidden = false;
    els.tvPowerSwitch.hidden = true; // no pause on a shared channel -- always on
    els.tvSkipBtn.hidden = true;     // skipping would only diverge this viewer from everyone else

    subscribeChannelDoc();
    if (state.channel.doc) resyncChannelIfNeeded();
    clearChannelResyncTimer();
    state.channel.resyncTimer = setInterval(resyncChannelIfNeeded, CHANNEL_RESYNC_INTERVAL_MS);
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
    // A playlist-driven custom pool ignores Country/etc entirely (it's an
    // explicit, fixed list) -- once playing, there's nothing for a filter
    // change to do; while still armed, armTV() below already draws from it.
    if (state.tvCustomPool && state.tv.started) return;
    if (!state.tv.started) {
      armTV();
      return;
    }
    var pool = state.rows.filter(matchesFilters).filter(function (r) { return hasVideo(r); });
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
    var pool = state.tvCustomPool
      ? state.tvCustomPool.filter(function (r) { return hasVideo(r); })
      : state.rows.filter(matchesFilters).filter(function (r) { return hasVideo(r); });
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
    els.tvPlaylistBtn.hidden = false;
    els.tvCropBtn.hidden = false;
    els.tvMirrorBtn.hidden = !state.isAdmin;
    els.tvInterlaceBtn.hidden = !state.isAdmin;
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
    var pool = customPool || state.rows.filter(matchesFilters).filter(function (r) { return hasVideo(r); });
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
    els.tvPlaylistBtn.hidden = false;
    els.tvCropBtn.hidden = false;
    els.tvMirrorBtn.hidden = !state.isAdmin;
    els.tvInterlaceBtn.hidden = !state.isAdmin;
    els.tvInfoBtn.hidden = false;
    els.tvPowerSwitch.hidden = false;
    updateTVPowerSwitch(true);
  }

  els.featuredPlayAll.addEventListener("click", function () {
    startTVMode(featuredPool.filter(function (r) { return hasVideo(r); }));
  });

  els.latestPlayAll.addEventListener("click", function () {
    startTVMode(latestPool.filter(function (r) { return hasVideo(r); }));
  });

  els.recentPlayAll.addEventListener("click", function () {
    startTVMode(recentPool.filter(function (r) { return hasVideo(r); }));
  });

  els.favoritesPlayAll.addEventListener("click", function () {
    startTVMode(favoritesPool.filter(function (r) { return hasVideo(r); }));
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

  els.tvCropBtn.addEventListener("click", function () {
    state.tv.crop = !state.tv.crop;
    saveTVCropPref(state.tv.crop);
    applyTVCrop();
  });

  els.tvMirrorBtn.addEventListener("click", function () {
    state.tv.mirror = !state.tv.mirror;
    applyTVMirror();
  });

  els.tvInterlaceBtn.addEventListener("click", function () {
    state.tv.interlaceHz = nextInterlaceHz(state.tv.interlaceHz);
    applyTVInterlace();
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
      if (r.rowNum === row.rowNum || !hasVideo(r)) return;
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
      var thumbAlt = escapeHtml((r.song || "Untitled") + (r.artist ? " — " + r.artist : ""));
      var label = escapeHtml(r.song || "(untitled)") + (r.artist ? " — " + escapeHtml(r.artist) : "");
      return '<button type="button" class="related-btn" data-row="' + escapeHtml(r.rowNum) + '">' +
        '<span class="related-btn-thumb">' + videoThumbImgHtml(r, thumbAlt) + "</span>" +
        '<span class="related-btn-label">' + label + "</span>" +
      "</button>";
    }).join("");
    return '<div class="lightbox-related"><span class="lightbox-related-label">Related:</span><div class="related-btn-row">' + items + "</div></div>";
  }

  // ---- Per-video comments -----------------------------------------------
  // Flat `comments` collection (not a subcollection) filtered by rowNum,
  // same shape/convention as the message board's `messages` collection --
  // public read, signed-in + not-banned create, admin-only delete. See
  // firestore.rules and the composite (rowNum, createdAt) index it needs.
  var commentsUnsub = null;

  function lightboxCommentsHtml(row) {
    var composer = currentUser
      ? '<form class="comment-form" id="commentForm" data-rownum="' + escapeHtml(row.rowNum) + '">' +
          '<textarea id="commentInput" rows="2" maxlength="1000" placeholder="Add a comment…" required></textarea>' +
          '<button type="submit" class="submit-form-btn">Post</button>' +
        "</form>"
      : '<p class="comment-signin-note"><button type="button" class="submit-form-btn" id="commentSignInBtn">Sign in with Google</button> to leave a comment.</p>';
    return '<div class="lightbox-comments">' +
      '<h3 class="lightbox-comments-title">Comments</h3>' +
      composer +
      '<div class="comment-list" id="commentList"><p class="comment-empty">Loading comments…</p></div>' +
    "</div>";
  }

  function renderCommentList(docs) {
    var listEl = document.getElementById("commentList");
    if (!listEl) return; // lightbox closed or switched to another row while this snapshot was in flight
    if (!docs.length) {
      listEl.innerHTML = '<p class="comment-empty">No comments yet — be the first.</p>';
      return;
    }
    listEl.innerHTML = docs.map(function (doc) {
      var d = doc.data();
      var when = d.createdAt && d.createdAt.toDate ? formatMsgBoardTime(d.createdAt.toDate()) : "";
      var deleteBtn = state.isAdmin
        ? '<button type="button" class="comment-delete-btn" data-commentid="' + doc.id + '" aria-label="Delete comment" title="Delete comment">' + ICON_TRASH + "</button>"
        : "";
      return '<div class="comment-item">' +
        '<div class="comment-item-meta">' +
          '<span class="comment-item-author">' + escapeHtml(d.authorName || "Anonymous") + "</span>" +
          '<span class="comment-item-time">' + escapeHtml(when) + "</span>" +
          deleteBtn +
        "</div>" +
        '<div class="comment-item-text">' + escapeHtml(d.text || "") + "</div>" +
      "</div>";
    }).join("");
  }

  function startCommentsListener(rowNum) {
    if (commentsUnsub) { commentsUnsub(); commentsUnsub = null; }
    commentsUnsub = db.collection("comments").where("rowNum", "==", rowNum).orderBy("createdAt", "asc").limit(200)
      .onSnapshot(function (snap) {
        renderCommentList(snap.docs);
      }, function (err) {
        console.error("Comments listener failed:", err);
        var listEl = document.getElementById("commentList");
        if (listEl) listEl.innerHTML = '<p class="comment-empty">Couldn\'t load comments.</p>';
      });
  }

  // ---- Suggest an edit ---------------------------------------------------
  // Lightweight crowdsourced data-quality flow: any signed-in visitor can
  // propose a single-field correction from the video lightbox. Nothing
  // applies automatically -- it lands in editSuggestions as "pending" for
  // an admin to Accept (writes the value straight to the video doc and
  // republishes, see goAdminSuggestions() below) or Decline.
  var EDIT_SUGGESTION_FIELDS = [
    { key: "artist", label: "Artist" },
    { key: "song", label: "Song Title" },
    { key: "director", label: "Director" },
    { key: "category", label: "Category" },
    { key: "year", label: "Year" },
    { key: "releaseDate", label: "Release date" },
    { key: "studio", label: "Studio" },
    { key: "producer", label: "Producer" },
    { key: "dp", label: "Director of Photography" },
    { key: "editor", label: "Editor" },
    { key: "choreographer", label: "Choreographer" },
    { key: "country", label: "Country" },
    { key: "genres", label: "Genres (comma-separated)" },
    { key: "description", label: "Description" },
    { key: "youtube", label: "YouTube Link" },
    { key: "vimeo", label: "Vimeo Link" },
    { key: "mvg", label: "MVG Link (Instagram Reel)" }
  ];
  var suggestEditRowNum = null;

  function suggestEditCurrentValue(row, field) {
    if (field === "genres") return (row.genres || []).join(", ");
    return row[field] || "";
  }

  function openSuggestEditModal(rowNum) {
    var row = findRowByNum(rowNum);
    if (!row) return;
    suggestEditRowNum = rowNum;
    els.suggestEditIntro.textContent = 'For "' + (row.song || "this entry") + '"' + (row.artist ? " by " + row.artist : "") + " -- an admin reviews every suggestion before it's applied.";
    els.suggestEditField.innerHTML = EDIT_SUGGESTION_FIELDS.map(function (f) {
      return '<option value="' + f.key + '">' + escapeHtml(f.label) + "</option>";
    }).join("");
    els.suggestEditField.value = EDIT_SUGGESTION_FIELDS[0].key;
    els.suggestEditCurrent.value = suggestEditCurrentValue(row, els.suggestEditField.value);
    els.suggestEditValue.value = "";
    els.suggestEditNote.value = "";
    els.suggestEditStatus.hidden = true;
    els.suggestEditSubmitBtn.disabled = false;
    els.suggestEditModal.hidden = false;
    els.suggestEditModal.querySelector(".lightbox-panel").scrollTop = 0;
    lockBodyScroll();
    pushModalHistory();
  }

  function closeSuggestEditModal() {
    if (els.suggestEditModal.hidden) return;
    els.suggestEditModal.hidden = true;
    unlockBodyScroll();
  }

  els.suggestEditClose.addEventListener("click", dismissTopModal);
  els.suggestEditModal.addEventListener("click", function (e) {
    if (e.target.closest(".lightbox-close") || e.target.closest(".lightbox-backdrop")) dismissTopModal();
  });

  els.suggestEditField.addEventListener("change", function () {
    var row = findRowByNum(suggestEditRowNum);
    if (row) els.suggestEditCurrent.value = suggestEditCurrentValue(row, els.suggestEditField.value);
  });

  els.suggestEditForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!currentUser) {
      auth.signInWithPopup(googleProvider).catch(function (err) { console.error("Sign-in failed:", err); });
      return;
    }
    var row = findRowByNum(suggestEditRowNum);
    if (!row) return;
    var field = els.suggestEditField.value;
    var fieldMeta = EDIT_SUGGESTION_FIELDS.filter(function (f) { return f.key === field; })[0];
    var suggestedValue = els.suggestEditValue.value.trim();
    if (!suggestedValue) return;
    els.suggestEditSubmitBtn.disabled = true;
    db.collection("editSuggestions").add({
      rowNum: row.rowNum,
      field: field,
      fieldLabel: fieldMeta ? fieldMeta.label : field,
      currentValue: suggestEditCurrentValue(row, field),
      suggestedValue: suggestedValue,
      note: els.suggestEditNote.value.trim(),
      entryLabel: (row.artist ? row.artist + " — " : "") + (row.song || "(untitled)"),
      submittedByUid: currentUser.uid,
      submittedByName: currentUser.displayName || currentUser.email || "Anonymous",
      status: "pending",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () {
      els.suggestEditStatus.textContent = "Thanks! An admin will review this suggestion.";
      els.suggestEditStatus.className = "submit-form-status";
      els.suggestEditStatus.hidden = false;
      els.suggestEditValue.value = "";
      els.suggestEditNote.value = "";
    }).catch(function (err) {
      console.error("Submitting edit suggestion failed:", err);
      els.suggestEditStatus.textContent = "Couldn't submit that -- please try again.";
      els.suggestEditStatus.className = "submit-form-status is-error";
      els.suggestEditStatus.hidden = false;
    }).finally(function () {
      els.suggestEditSubmitBtn.disabled = false;
    });
  });

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

  // ---- Profile <-> catalog credit matching ----------------------------

  // Cross-references a Profile's display name against the catalog's own
  // free-text credit fields, so a profile can surface "videos in the
  // library credited to you" without a separate manual linking step.
  // Exact match only (after normalization) -- deliberately no partial/
  // fuzzy matching. A real credit that just doesn't match exactly
  // (spelling/formatting differences) is a false negative, which is the
  // safer failure mode here vs. a false positive linking someone to a
  // video that isn't actually theirs.
  var PROFILE_CREDIT_FIELDS = [
    ["artist", "Artist"],
    ["director", "Director"],
    ["producer", "Producer"],
    ["dp", "DP"],
    ["editor", "Editor"],
    ["choreographer", "Choreographer"],
    ["studio", "Studio"]
  ];
  var PROFILE_CREDITS_MAX = 12;

  // Director is entered "Last name, first name" (see the add/edit form
  // placeholder) -- reversed to natural order before comparing against a
  // profile's displayName. producer/dp/editor/choreographer can list
  // multiple people in one field (formatting varies -- commas, "&", "and")
  // which isn't split apart here, so a multi-name field just won't match
  // any single person exactly; same safer-false-negative tradeoff as above.
  function normalizeCreditName(name, isDirector) {
    var s = String(name || "").trim();
    if (!s) return "";
    if (isDirector) {
      var parts = s.split(",");
      if (parts.length === 2) s = parts[1].trim() + " " + parts[0].trim();
    }
    return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  }

  function findCatalogCreditsForProfile(profile) {
    var target = normalizeCreditName(profile.displayName, false);
    if (!target) return [];
    var matches = [];
    state.rows.forEach(function (row) {
      if (!hasVideo(row)) return;
      for (var i = 0; i < PROFILE_CREDIT_FIELDS.length; i++) {
        var field = PROFILE_CREDIT_FIELDS[i][0];
        var val = normalizeCreditName(row[field], field === "director");
        if (val && val === target) {
          matches.push({ row: row, roleLabel: PROFILE_CREDIT_FIELDS[i][1] });
          break; // one credit tag per video is enough, even if it matches more than one field
        }
      }
    });
    matches.sort(function (a, b) { return parseInt(b.row.rowNum, 10) - parseInt(a.row.rowNum, 10); });
    return matches;
  }

  function profileCreditsHtml(profile) {
    var matches = findCatalogCreditsForProfile(profile);
    if (!matches.length) return "";
    var items = matches.slice(0, PROFILE_CREDITS_MAX).map(function (m) {
      var label = escapeHtml(m.row.song || "(untitled)") + (m.row.artist ? " — " + escapeHtml(m.row.artist) : "");
      return '<button type="button" class="related-btn" data-row="' + escapeHtml(m.row.rowNum) + '" title="' + escapeHtml(m.roleLabel) + ' credit">' + label + "</button>";
    }).join("");
    return '<div class="lightbox-related"><span class="lightbox-related-label">Credits in the library (name match):</span>' + items + "</div>";
  }

  // ---- Profile verification ----------------------------------------------
  // Turns the passive credit-matching above into an active trust signal: a
  // profile owner with at least one matched catalog credit can request a
  // verified badge, an admin reviews the match and approves/declines (see
  // the admin panel's Verification Requests view). Status is a separate
  // request/review doc (verificationRequests, owner+admin read only); the
  // public-facing "is this uid verified" flag lives in its own
  // world-readable verifiedProfiles/{uid} existence-check collection (see
  // loadVerifiedProfiles() above) so approving one never needs write access
  // to someone else's profiles/{uid} doc.
  function profileVerifyAreaHtml(profile) {
    if (profile.uid !== currentUser.uid) return "";
    if (verifiedProfileUids[profile.uid]) return "";
    if (!findCatalogCreditsForProfile(profile).length) return "";
    return '<div class="profile-verify-area" id="profileVerifyArea"><button type="button" class="profile-request-btn" disabled>Checking…</button></div>';
  }

  function renderProfileVerifyArea(pending) {
    var area = document.getElementById("profileVerifyArea");
    if (!area) return; // lightbox moved on already
    area.innerHTML = pending
      ? '<button type="button" class="profile-request-btn" disabled>Verification request pending review</button>'
      : '<button type="button" class="profile-request-btn" id="profileVerifyBtn">Get verified</button>';
  }

  function checkVerificationStatus(uid) {
    return db.collection("verificationRequests").where("profileUid", "==", uid).where("status", "==", "pending").limit(1).get()
      .then(function (snap) { return !snap.empty; })
      .catch(function (err) {
        console.error("Checking verification status failed:", err);
        return false;
      });
  }

  function sendVerificationRequest(profile) {
    var matches = findCatalogCreditsForProfile(profile);
    var area = document.getElementById("profileVerifyArea");
    if (area) area.innerHTML = '<button type="button" class="profile-request-btn" disabled>Sending…</button>';
    db.collection("verificationRequests").add({
      profileUid: profile.uid,
      profileName: profile.displayName || "",
      matchedRowNums: matches.slice(0, 12).map(function (m) { return m.row.rowNum; }),
      status: "pending",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () {
      renderProfileVerifyArea(true);
    }).catch(function (err) {
      console.error("Sending verification request failed:", err);
      if (area) area.innerHTML = '<button type="button" class="profile-request-btn" id="profileVerifyBtn">Get verified</button>';
      alert("Couldn't send that -- please try again.");
    });
  }

  var ICON_INSTAGRAM = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.2c3.2 0 3.6 0 4.9.07 1.3.06 2.2.27 2.9.56.8.3 1.4.7 2 1.4.6.6 1 1.2 1.4 2 .3.7.5 1.6.6 2.9.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.06 1.3-.27 2.2-.56 2.9a5.8 5.8 0 0 1-1.4 2 5.8 5.8 0 0 1-2 1.4c-.7.3-1.6.5-2.9.56-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.3-.06-2.2-.27-2.9-.56a5.8 5.8 0 0 1-2-1.4 5.8 5.8 0 0 1-1.4-2c-.3-.7-.5-1.6-.56-2.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.06-1.3.27-2.2.56-2.9.3-.8.7-1.4 1.4-2 .6-.6 1.2-1 2-1.4.7-.3 1.6-.5 2.9-.56C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.15 0-3.52 0-4.76.07-1.03.05-1.6.22-1.97.36-.5.2-.85.42-1.22.79-.37.37-.6.72-.79 1.22-.14.37-.3.94-.36 1.97C2.8 8.48 2.8 8.85 2.8 12s0 3.52.1 4.76c.06 1.03.22 1.6.36 1.97.2.5.42.85.79 1.22.37.37.72.6 1.22.79.37.14.94.3 1.97.36 1.24.06 1.6.07 4.76.07s3.52 0 4.76-.07c1.03-.06 1.6-.22 1.97-.36.5-.2.85-.42 1.22-.79.37-.37.6-.72.79-1.22.14-.37.3-.94.36-1.97.06-1.24.07-1.6.07-4.76s0-3.52-.07-4.76c-.06-1.03-.22-1.6-.36-1.97a3.3 3.3 0 0 0-.79-1.22 3.3 3.3 0 0 0-1.22-.79c-.37-.14-.94-.3-1.97-.36C15.52 4 15.15 4 12 4Zm0 3.4a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2Zm0 1.8a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Zm5.86-2a1.08 1.08 0 1 1-2.16 0 1.08 1.08 0 0 1 2.16 0Z"/></svg>';

  // Outline icons (Feather/Tabler-style stroke path, matching the top-bar
  // search/settings/admin/sign-in icons) -- per house policy, real emoji
  // (colorful pictographs) never go back in; when a UI element genuinely
  // needs an icon, it's one of these instead. Plain monochrome text
  // symbols already in use elsewhere (▾ ▴ ▶ ✓ ♥ ♡ ✎) are NOT emoji and
  // are explicitly out of scope for this -- don't "fix" those too.
  var ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1em;height:1em;vertical-align:-0.15em"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
  var ICON_PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:0.9em;height:0.9em;vertical-align:-0.1em"><path d="M12 22s7-7.58 7-12a7 7 0 1 0-14 0c0 4.42 7 12 7 12Z"/><circle cx="12" cy="10" r="2.5"/></svg>';

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
    // A profile's credits list (profileCreditsHtml()) can link straight
    // into a video from inside a profile lightbox -- clean up its Leaflet
    // map instance first, since it'd otherwise be left referencing a DOM
    // node this overwrites. No-op if no map is open.
    destroyProfileLightboxMap();
    els.spotlightSidebar.classList.add("is-hidden-for-lightbox");
    state.lightboxRowNum = row.rowNum;
    state.lightboxProfileUid = null;
    document.title = (row.song || "Untitled") + (row.artist ? " — " + row.artist : "") + " | MVG Library";
    pushRecentlyViewed(row.rowNum);
    renderRecentList(state.rows);

    var videoRef = getRowVideoRef(row);
    var id = videoRef ? videoRef.id : null;
    var videoHtml = videoRef
      ? '<div class="lightbox-video-frame" id="lightboxVideoFrame"><div id="lightboxPlayerTarget"></div><div class="video-interlace-overlay" id="lightboxInterlaceOverlay" hidden></div></div>'
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
      ? '<button type="button" class="lightbox-admin-delete-btn" data-rownum="' + escapeHtml(row.rowNum) + '" data-label="' + escapeHtml((row.artist ? row.artist + " — " : "") + (row.song || "(untitled)")) + '" title="Delete entry (admin)" aria-label="Delete entry">' + ICON_TRASH + ' Delete</button>'
      : "";
    // Admin-only debug tools -- not shown to regular visitors.
    var mirrorBtn = state.isAdmin && videoRef
      ? '<button type="button" class="lightbox-mirror-btn" title="Mirror" aria-label="Toggle mirror">Mirror</button>'
      : "";
    var interlaceBtn = state.isAdmin && videoRef
      ? '<button type="button" class="lightbox-interlace-btn" title="Interlace flicker (test)" aria-label="Toggle interlace flicker">Interlace</button>'
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
      '<button type="button" class="lightbox-playlist-btn" data-rownum="' + escapeHtml(row.rowNum) + '" title="Add to playlist" aria-label="Add to playlist">+</button>' +
      '<button type="button" class="lightbox-widen-btn" title="Widen player" aria-label="Toggle player size">⤢</button>' +
      '<button type="button" class="lightbox-crop-btn" title="Crop to 4:3" aria-label="Toggle 4:3 crop">4:3</button>' +
      mirrorBtn +
      interlaceBtn +
      '<a class="lightbox-report-link" href="' + escapeHtml(reportFormUrl(row)) + '" target="_blank" rel="noopener noreferrer">Report issue</a>' +
      '<button type="button" class="suggest-edit-open-btn" data-rownum="' + escapeHtml(row.rowNum) + '">Suggest an edit</button>' +
      "</div>" +
      "</div>" +
      (sub.length ? '<p class="lightbox-subtitle">' + sub.join(" · ") + "</p>" : "") +
      '<div class="lightbox-tag-row">' + tagHtml + genreTags + "</div>" +
      creditsHtml(row) +
      descHtml +
      (links ? '<div class="lightbox-links">' + links + "</div>" : "") +
      lightboxRelatedHtml(row) +
      lightboxCommentsHtml(row) +
      "</div>";

    els.lightbox.hidden = false;
    els.lightboxPanel.scrollTop = 0;
    lockBodyScroll();
    pushModalHistory();
    applyLightboxSize();
    applyLightboxCrop();
    applyLightboxMirror();
    applyLightboxInterlace();
    startCommentsListener(row.rowNum);

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

    if (videoRef) {
      var rowNumAtOpen = row.rowNum;
      var fallbackUrl = row.youtube || row.vimeo;
      createVideoPlayer("lightboxPlayerTarget", videoRef, {
        autoplay: loadAutoplayPref(),
        controls: !state.lightboxCrop,
        isStale: function () { return els.lightbox.hidden || state.lightboxRowNum !== rowNumAtOpen; },
        onError: function () {
          destroyLightboxPlayer();
          showLightboxVideoFallback(fallbackUrl);
        },
        onReady: function (player) { state.lightboxPlayer = player; }
      });
    }
  }

  function closeLightbox() {
    if (els.lightbox.hidden) return;
    destroyLightboxPlayer();
    destroyProfileLightboxMap();
    if (lightboxAdController) { lightboxAdController.stop(); lightboxAdController = null; }
    if (commentsUnsub) { commentsUnsub(); commentsUnsub = null; }
    els.spotlightSidebar.classList.remove("is-hidden-for-lightbox");
    els.lightbox.hidden = true;
    els.lightboxContent.innerHTML = "";
    // Admin debug toggles don't persist across closing the lightbox --
    // avoids leaving them on and surprising the next video, and stops the
    // now-pointless interlace rAF loop.
    state.lightboxMirror = false;
    state.lightboxInterlaceHz = 0;
    setInterlaceHz("lightbox", 0);
    state.lightboxRowNum = null;
    state.lightboxProfileUid = null;
    document.title = DEFAULT_TITLE;
    unlockBodyScroll();
  }

  // Genres requested/expected but not yet tagged on any existing entry --
  // merged into the submission dropdown below so a submitter can pick one
  // before the catalog has a single example of it. The public genre filter
  // (buildGenreOptions()) intentionally does NOT get these -- it's a
  // browse-by-count list, so an option with zero matching entries there
  // would just be a dead end.
  var SUBMIT_GENRE_EXTRAS = ["Trip-Hop"];

  // Populated once real data loads -- same live-derived, always-current
  // lists the filter dropdowns use, so there's no separate static list to
  // maintain here (aside from SUBMIT_GENRE_EXTRAS above).
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

    var genres = uniqueSorted(function (r) { return r.genres || []; }).concat(SUBMIT_GENRE_EXTRAS);
    genres = genres.filter(function (g, i) { return genres.indexOf(g) === i; }).sort(function (a, b) { return a.localeCompare(b); });
    els.submitGenre.innerHTML = '<option value="">Choose…</option>' +
      genres.map(function (g) { return '<option value="' + escapeHtml(g) + '">' + escapeHtml(g) + "</option>"; }).join("");

    var countries = uniqueSorted(function (r) { return r.country ? [normalizeCountry(r.country)] : []; });
    els.submitCountry.innerHTML = '<option value="">Choose…</option>' +
      countries.map(function (c) { return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + "</option>"; }).join("");

    // Admin form's Country/Genres stay free-text inputs (an admin needs to
    // be able to add a value that isn't in the catalog yet) -- these two
    // selects are just a fast-fill shortcut layered on top, same source
    // lists as the public form above.
    var genreOptionsHtml = genres.map(function (g) { return '<option value="' + escapeHtml(g) + '">' + escapeHtml(g) + "</option>"; }).join("");
    els.adminFormGenreSelect.innerHTML = '<option value="">Add an existing genre…</option>' + genreOptionsHtml;

    var countryOptionsHtml = countries.map(function (c) { return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + "</option>"; }).join("");
    els.adminFormCountrySelect.innerHTML = '<option value="">Choose an existing country…</option>' + countryOptionsHtml;
  }

  els.adminFormCountrySelect.addEventListener("change", function () {
    var value = els.adminFormCountrySelect.value;
    if (!value) return;
    els.adminForm.elements.country.value = value;
    els.adminFormCountrySelect.value = "";
  });

  els.adminFormGenreSelect.addEventListener("change", function () {
    var value = els.adminFormGenreSelect.value;
    if (!value) return;
    var input = els.adminForm.elements.genres;
    var current = input.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    if (current.indexOf(value) === -1) current.push(value);
    input.value = current.join(", ");
    els.adminFormGenreSelect.value = "";
  });

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

  // Same pattern as openSubmitThanksModal() above, for a saved profile --
  // reads as "something just happened" instead of the edit form just
  // quietly swapping back to the browse grid underneath it.
  function openProfileThanksModal() {
    els.profileThanksModal.hidden = false;
    els.profileThanksModal.querySelector(".lightbox-panel").scrollTop = 0;
    lockBodyScroll();
    pushModalHistory();
  }

  function closeProfileThanksModal() {
    if (els.profileThanksModal.hidden) return;
    els.profileThanksModal.hidden = true;
    unlockBodyScroll();
  }

  els.profileThanksModal.addEventListener("click", function (e) {
    if (e.target.closest(".lightbox-close") || e.target.closest(".lightbox-backdrop")) dismissTopModal();
  });

  els.profileThanksBack.addEventListener("click", dismissTopModal);

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
    // No bottom-nav slot for Playlists (reached via the hamburger menu
    // instead) -- still a real view, just without its own nav button to
    // highlight.
    document.body.classList.toggle("mobile-view-playlists", view === "playlists");
    document.body.classList.toggle("mobile-view-profiles", view === "profiles");
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
    state.desktopView = view;
    document.body.classList.toggle("desktop-view-search", view === "search");
    document.body.classList.toggle("desktop-view-favorites", view === "favorites");
    document.body.classList.toggle("desktop-view-playlists", view === "playlists");
    document.body.classList.toggle("desktop-view-profiles", view === "profiles");
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
    refreshNotificationBadge();
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
    refreshAdminLandingBadges();
  }

  function showAdminLanding() {
    if (adminChannelScheduleTimer) { clearInterval(adminChannelScheduleTimer); adminChannelScheduleTimer = null; }
    stopAdminChannelPreview();
    els.adminForm.hidden = true;
    els.adminBulkView.hidden = true;
    els.adminListView.hidden = true;
    els.adminSuggestionsView.hidden = true;
    els.adminVerificationsView.hidden = true;
    els.adminBlogListView.hidden = true;
    els.adminChannelView.hidden = true;
    els.adminLandingView.hidden = false;
  }

  function showAdminBlogList() {
    els.adminLandingView.hidden = true;
    els.adminListView.hidden = true;
    els.adminForm.hidden = true;
    els.adminBulkView.hidden = true;
    els.adminSuggestionsView.hidden = true;
    els.adminVerificationsView.hidden = true;
    els.adminChannelView.hidden = true;
    els.adminBlogListView.hidden = false;
  }

  function showAdminSuggestions() {
    els.adminLandingView.hidden = true;
    els.adminListView.hidden = true;
    els.adminForm.hidden = true;
    els.adminBulkView.hidden = true;
    els.adminVerificationsView.hidden = true;
    els.adminChannelView.hidden = true;
    els.adminSuggestionsView.hidden = false;
  }

  function showAdminVerifications() {
    els.adminLandingView.hidden = true;
    els.adminListView.hidden = true;
    els.adminForm.hidden = true;
    els.adminBulkView.hidden = true;
    els.adminSuggestionsView.hidden = true;
    els.adminChannelView.hidden = true;
    els.adminVerificationsView.hidden = false;
  }

  function showAdminChannelView() {
    els.adminLandingView.hidden = true;
    els.adminListView.hidden = true;
    els.adminForm.hidden = true;
    els.adminBulkView.hidden = true;
    els.adminSuggestionsView.hidden = true;
    els.adminVerificationsView.hidden = true;
    els.adminBlogListView.hidden = true;
    els.adminChannelView.hidden = false;
  }

  function goAdminSuggestions() {
    showAdminSuggestions();
    return loadEditSuggestions();
  }

  function loadEditSuggestions() {
    els.adminSuggestionsStatus.textContent = "Loading…";
    els.adminSuggestionsStatus.className = "admin-status";
    els.adminSuggestionsStatus.hidden = false;
    els.adminSuggestionsList.innerHTML = "";
    return db.collection("editSuggestions").where("status", "==", "pending").get().then(function (snap) {
      var docs = snap.docs.slice().sort(function (a, b) {
        var ta = a.data().createdAt, tb = b.data().createdAt;
        return (tb ? tb.toMillis() : 0) - (ta ? ta.toMillis() : 0);
      });
      renderEditSuggestions(docs);
      els.adminSuggestionsStatus.hidden = true;
      updateAdminBadge(els.adminSuggestionsBadge, docs.length);
    }).catch(function (err) {
      console.error("Loading edit suggestions failed:", err);
      els.adminSuggestionsStatus.textContent = "Couldn't load suggestions: " + err.message;
      els.adminSuggestionsStatus.className = "admin-status is-error";
    });
  }

  function renderEditSuggestions(docs) {
    if (!docs.length) {
      els.adminSuggestionsList.innerHTML = '<p class="admin-empty">No pending suggestions.</p>';
      return;
    }
    els.adminSuggestionsList.innerHTML = docs.map(function (doc) {
      var d = doc.data();
      return (
        '<div class="admin-row">' +
          '<div class="admin-row-main">' +
            '<div class="admin-row-title">' + escapeHtml(d.entryLabel || ("#" + d.rowNum)) + " — " + escapeHtml(d.fieldLabel || d.field) + "</div>" +
            '<div class="admin-row-sub">&ldquo;' + escapeHtml(d.currentValue || "(blank)") + '&rdquo; &rarr; &ldquo;' + escapeHtml(d.suggestedValue) + "&rdquo;" +
              (d.note ? " — " + escapeHtml(d.note) : "") + " — suggested by " + escapeHtml(d.submittedByName || "someone") + "</div>" +
          "</div>" +
          '<div class="admin-row-actions">' +
            '<button type="button" class="admin-row-btn" data-suggestion-action="accept" data-id="' + doc.id + '">Accept</button>' +
            '<button type="button" class="admin-row-btn admin-row-btn-danger" data-suggestion-action="decline" data-id="' + doc.id + '">Decline</button>' +
          "</div>" +
        "</div>"
      );
    }).join("");
  }

  function applyEditSuggestion(data) {
    var patch = { updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    if (data.field === "genres") {
      patch.genres = String(data.suggestedValue || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    } else {
      patch[data.field] = data.suggestedValue;
    }
    return db.collection("videos").doc(data.rowNum).update(patch);
  }

  els.adminSuggestionsList.addEventListener("click", function (e) {
    var id = null, accept = null;
    var acceptBtn = e.target.closest('[data-suggestion-action="accept"]');
    var declineBtn = e.target.closest('[data-suggestion-action="decline"]');
    if (acceptBtn) { id = acceptBtn.getAttribute("data-id"); accept = true; }
    else if (declineBtn) { id = declineBtn.getAttribute("data-id"); accept = false; }
    if (!id) return;

    var docRef = db.collection("editSuggestions").doc(id);
    els.adminSuggestionsStatus.hidden = true;
    var chain = accept
      ? docRef.get().then(function (doc) {
          if (!doc.exists) return;
          return applyEditSuggestion(doc.data()).then(function () { return docRef.update({ status: "accepted" }); });
        })
      : docRef.update({ status: "declined" });

    chain.then(function () {
      if (accept) {
        els.adminSuggestionsStatus.textContent = "Applied. Publishing…";
        els.adminSuggestionsStatus.className = "admin-status";
        els.adminSuggestionsStatus.hidden = false;
        return publishSnapshot().then(function (result) {
          els.adminSuggestionsStatus.textContent = "Applied and published " + result.count + " entries to the live site.";
        }).catch(function (err) {
          console.error("Publish failed:", err);
          els.adminSuggestionsStatus.textContent = "Applied, but publish failed: " + err.message + " -- use the Publish button to retry.";
          els.adminSuggestionsStatus.className = "admin-status is-error";
        });
      }
    }).then(function () {
      return loadEditSuggestions();
    }).catch(function (err) {
      console.error("Resolving edit suggestion failed:", err);
      els.adminSuggestionsStatus.textContent = "That didn't go through: " + err.message;
      els.adminSuggestionsStatus.className = "admin-status is-error";
      els.adminSuggestionsStatus.hidden = false;
    });
  });

  function loadVerificationRequests() {
    els.adminVerificationsStatus.textContent = "Loading…";
    els.adminVerificationsStatus.className = "admin-status";
    els.adminVerificationsStatus.hidden = false;
    els.adminVerificationsList.innerHTML = "";
    return db.collection("verificationRequests").where("status", "==", "pending").get().then(function (snap) {
      var docs = snap.docs.slice().sort(function (a, b) {
        var ta = a.data().createdAt, tb = b.data().createdAt;
        return (tb ? tb.toMillis() : 0) - (ta ? ta.toMillis() : 0);
      });
      renderVerificationRequests(docs);
      els.adminVerificationsStatus.hidden = true;
      updateAdminBadge(els.adminVerificationsBadge, docs.length);
    }).catch(function (err) {
      console.error("Loading verification requests failed:", err);
      els.adminVerificationsStatus.textContent = "Couldn't load requests: " + err.message;
      els.adminVerificationsStatus.className = "admin-status is-error";
    });
  }

  function goAdminVerifications() {
    showAdminVerifications();
    return loadVerificationRequests();
  }

  function renderVerificationRequests(docs) {
    if (!docs.length) {
      els.adminVerificationsList.innerHTML = '<p class="admin-empty">No pending verification requests.</p>';
      return;
    }
    els.adminVerificationsList.innerHTML = docs.map(function (doc) {
      var d = doc.data();
      var matchedLabels = (d.matchedRowNums || []).map(function (rn) {
        var row = findRowByNum(rn);
        return row ? (row.song || "(untitled)") + (row.artist ? " — " + row.artist : "") : "#" + rn;
      });
      return (
        '<div class="admin-row">' +
          '<div class="admin-row-main">' +
            '<div class="admin-row-title">' + escapeHtml(d.profileName || "Someone") + "</div>" +
            '<div class="admin-row-sub">Matched credits: ' + (matchedLabels.length ? escapeHtml(matchedLabels.join(", ")) : "(none listed)") + "</div>" +
          "</div>" +
          '<div class="admin-row-actions">' +
            '<button type="button" class="admin-row-btn" data-verification-action="approve" data-id="' + doc.id + '" data-uid="' + escapeHtml(d.profileUid) + '" data-name="' + escapeHtml(d.profileName || "") + '">Approve</button>' +
            '<button type="button" class="admin-row-btn admin-row-btn-danger" data-verification-action="decline" data-id="' + doc.id + '">Decline</button>' +
          "</div>" +
        "</div>"
      );
    }).join("");
  }

  els.adminVerificationsList.addEventListener("click", function (e) {
    var approveBtn = e.target.closest('[data-verification-action="approve"]');
    var declineBtn = e.target.closest('[data-verification-action="decline"]');
    if (!approveBtn && !declineBtn) return;

    var id = (approveBtn || declineBtn).getAttribute("data-id");
    var docRef = db.collection("verificationRequests").doc(id);
    els.adminVerificationsStatus.hidden = true;
    var chain = approveBtn
      ? db.collection("verifiedProfiles").doc(approveBtn.getAttribute("data-uid")).set({
          profileName: approveBtn.getAttribute("data-name") || "",
          approvedAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(function () { return docRef.update({ status: "approved" }); })
      : docRef.update({ status: "declined" });

    chain.then(function () {
      return loadVerificationRequests();
    }).catch(function (err) {
      console.error("Resolving verification request failed:", err);
      els.adminVerificationsStatus.textContent = "That didn't go through: " + err.message;
      els.adminVerificationsStatus.className = "admin-status is-error";
      els.adminVerificationsStatus.hidden = false;
    });
  });

  // ---- Blog Posts (admin editor) -----------------------------------------
  // Self-hosted replacement for the Squarespace-fed News feed -- see
  // blog.html for the public listing/post pages this content actually
  // shows up on. A post's own document ID is pre-generated client-side
  // (db.collection().doc().id, no write) as soon as the editor opens for a
  // NEW post, so image uploads have a real postId to key off of (see
  // uploadBlogInlineImage()) even before the post itself is first saved.
  function slugify(text) {
    return String(text || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  // <input type="date"> works in plain YYYY-MM-DD strings, parsed/formatted
  // at local noon rather than midnight -- midnight is what makes date-only
  // values so prone to shifting a day backward once run through a
  // timezone behind UTC (a very common date-input bug).
  function toDateInputValue(date) {
    if (!date) return "";
    var yyyy = date.getFullYear();
    var mm = String(date.getMonth() + 1).padStart(2, "0");
    var dd = String(date.getDate()).padStart(2, "0");
    return yyyy + "-" + mm + "-" + dd;
  }

  function parseDateInputValue(str) {
    if (!str) return new Date();
    var parts = str.split("-").map(function (s) { return parseInt(s, 10); });
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  }

  var blogPostsCache = [];
  var pendingBlogCoverBlob = null;
  var blogSlugManuallyEdited = false;

  function goAdminBlog() {
    showAdminBlogList();
    return loadBlogPostsAdmin();
  }

  function loadBlogPostsAdmin() {
    els.adminBlogListStatus.textContent = "Loading…";
    els.adminBlogListStatus.className = "admin-status";
    els.adminBlogListStatus.hidden = false;
    els.adminBlogList.innerHTML = "";
    return db.collection("blogPosts").get().then(function (snap) {
      blogPostsCache = snap.docs.map(function (doc) {
        var d = doc.data();
        d.id = doc.id;
        return d;
      }).sort(function (a, b) {
        var ta = a.updatedAt || a.createdAt, tb = b.updatedAt || b.createdAt;
        return (tb ? tb.toMillis() : 0) - (ta ? ta.toMillis() : 0);
      });
      renderAdminBlogList();
      els.adminBlogListStatus.hidden = true;
    }).catch(function (err) {
      console.error("Loading blog posts failed:", err);
      els.adminBlogListStatus.textContent = "Couldn't load posts: " + err.message;
      els.adminBlogListStatus.className = "admin-status is-error";
    });
  }

  function renderAdminBlogList() {
    if (!blogPostsCache.length) {
      els.adminBlogList.innerHTML = '<p class="admin-empty">No posts yet.</p>';
      return;
    }
    els.adminBlogList.innerHTML = blogPostsCache.map(function (p) {
      var badge = p.status === "published"
        ? '<span class="admin-badge">Published</span>'
        : '<span class="admin-badge admin-badge-backdoor">Draft</span>';
      return (
        '<div class="admin-row" data-postid="' + escapeHtml(p.id) + '">' +
          '<div class="admin-row-main">' +
            '<div class="admin-row-title">' + escapeHtml(p.title || "(untitled)") + "</div>" +
            '<div class="admin-row-sub">/' + escapeHtml(p.slug || "") + " " + badge + "</div>" +
          "</div>" +
          '<div class="admin-row-actions">' +
            '<button type="button" class="admin-row-btn" data-blog-action="edit" data-id="' + escapeHtml(p.id) + '">Edit</button>' +
            '<button type="button" class="admin-row-btn admin-row-btn-danger" data-blog-action="delete" data-id="' + escapeHtml(p.id) + '">Delete</button>' +
          "</div>" +
        "</div>"
      );
    }).join("");
  }

  function resetBlogCoverPreview() {
    pendingBlogCoverBlob = null;
    els.adminBlogCoverPreview.hidden = true;
    els.adminBlogCoverPreview.removeAttribute("src");
    els.adminBlogCoverInput.value = "";
  }

  // Its own full-viewport page (see .blog-editor-page in styles.css), not
  // another lightbox -- a 560px-capped modal squeezed the whole form into
  // an unusably cramped two-column grid. Sits stacked on top of the still-
  // open admin modal (z-index 1100 vs. the lightbox's 1000) rather than
  // replacing it, so closing it just reveals the blog list underneath
  // again with no extra state to restore.
  function openBlogEditorPage() {
    els.blogEditorPage.hidden = false;
    lockBodyScroll();
    pushModalHistory();
  }

  function closeBlogEditorPage() {
    if (els.blogEditorPage.hidden) return;
    els.blogEditorPage.hidden = true;
    unlockBodyScroll();
  }

  function openBlogEditor(post) {
    blogSlugManuallyEdited = !!post;
    lastBlogBodyRange = null;
    els.adminBlogFormTitle.textContent = post ? "Edit Post" : "New Post";
    els.adminBlogPostId.value = post ? post.id : db.collection("blogPosts").doc().id;
    els.adminBlogTitleInput.value = post ? (post.title || "") : "";
    els.adminBlogSlugInput.value = post ? (post.slug || "") : "";
    els.adminBlogAuthorInput.value = post ? (post.authorName || "") : ((currentUser && (currentUser.displayName || currentUser.email)) || "");
    var existingDate = post && (post.publishedAt || post.createdAt);
    els.adminBlogDateInput.value = toDateInputValue(existingDate ? existingDate.toDate() : new Date());
    els.adminBlogExcerptInput.value = post ? (post.excerpt || "") : "";
    els.adminBlogBodyInput.innerHTML = post ? (post.body || "") : "";
    resetBlogCoverPreview();
    if (post && post.coverImageURL) {
      els.adminBlogCoverPreview.src = post.coverImageURL;
      els.adminBlogCoverPreview.hidden = false;
    }
    els.adminBlogFormStatus.hidden = true;
    els.adminBlogSaveDraftBtn.disabled = false;
    els.adminBlogPublishBtn.disabled = false;
    openBlogEditorPage();
  }

  els.adminGoBlogBtn.addEventListener("click", goAdminBlog);
  els.adminBlogBackBtn.addEventListener("click", showAdminLanding);
  els.adminBlogNewBtn.addEventListener("click", function () { openBlogEditor(null); });
  // A local close, not dismissTopModal() -- the editor page is stacked on
  // top of the still-open admin modal without its own history entry (see
  // openBlogEditorPage()), so routing through the history-back/closeAll
  // path would take the whole admin modal down with it instead of just
  // returning to the blog list underneath.
  els.adminBlogCancelBtn.addEventListener("click", closeBlogEditorPage);
  els.blogEditorCloseBtn.addEventListener("click", closeBlogEditorPage);

  els.adminBlogTitleInput.addEventListener("input", function () {
    if (!blogSlugManuallyEdited) els.adminBlogSlugInput.value = slugify(els.adminBlogTitleInput.value);
  });
  els.adminBlogSlugInput.addEventListener("input", function () { blogSlugManuallyEdited = true; });

  els.adminBlogList.addEventListener("click", function (e) {
    var editBtn = e.target.closest('[data-blog-action="edit"]');
    if (editBtn) {
      var post = blogPostsCache.filter(function (p) { return p.id === editBtn.getAttribute("data-id"); })[0];
      if (post) openBlogEditor(post);
      return;
    }
    var deleteBtn = e.target.closest('[data-blog-action="delete"]');
    if (deleteBtn) {
      var id = deleteBtn.getAttribute("data-id");
      var toDelete = blogPostsCache.filter(function (p) { return p.id === id; })[0];
      if (!window.confirm('Delete "' + (toDelete ? toDelete.title : "this post") + '"? This can\'t be undone.')) return;
      db.collection("blogPosts").doc(id).delete().then(function () {
        return loadBlogPostsAdmin();
      }).catch(function (err) {
        console.error("Deleting post failed:", err);
        els.adminBlogListStatus.textContent = "Delete failed: " + err.message;
        els.adminBlogListStatus.className = "admin-status is-error";
        els.adminBlogListStatus.hidden = false;
      });
    }
  });

  // ---- Channel Mode admin (DJ deck) ---------------------------------------
  // Edits `channel/current` directly (no separate draft/publish step --
  // every mutation auto-saves) so changes take effect live for anyone
  // already tuned in, DJ-deck style. See computeChannelPosition() /
  // tuneChannelMode() near the rest of TV Mode for the viewer side.
  var adminChannelDraft = null;
  // Re-renders the queue's "Plays at ..." / "Now playing" column periodically
  // while the panel is open -- those are wall-clock-derived, not something
  // Firestore pushes updates for on its own. Started in
  // finishLoadChannelAdmin(), stopped in showAdminLanding()/closeAdminModal()
  // (every path out of this view goes through one of those two).
  var adminChannelScheduleTimer = null;
  var ADMIN_CHANNEL_SCHEDULE_REFRESH_MS = 20000;

  function channelDocRef() {
    return db.collection("channel").doc("current");
  }

  function formatDuration(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    var mm = h ? String(m).padStart(2, "0") : String(m);
    var ss = String(s).padStart(2, "0");
    return h ? (h + ":" + mm + ":" + ss) : (mm + ":" + ss);
  }

  // ---- Live view (side panel) ---------------------------------------------
  // A second, independent tuned-in player -- reuses the exact same
  // computeChannelPosition()/channelItemRef() scheduling functions the real
  // viewer side uses (so it's never a separate, potentially-inconsistent
  // guess at what's live), but keeps its own player/timer state rather than
  // touching state.tv/state.channel, since the admin panel isn't TV Mode
  // and shouldn't fight over the same player instance.
  var adminChannelPreviewPlayer = null;
  var adminChannelPreviewProvider = null;
  var adminChannelPreviewKind = null;
  var adminChannelPreviewIndex = -1;
  var adminChannelPreviewInsertVideoId = null;
  var adminChannelPreviewTimer = null;
  var ADMIN_CHANNEL_PREVIEW_RESYNC_MS = 20000;

  function stopAdminChannelPreview() {
    if (adminChannelPreviewTimer) { clearInterval(adminChannelPreviewTimer); adminChannelPreviewTimer = null; }
    if (adminChannelPreviewPlayer && adminChannelPreviewPlayer.destroy) {
      try { adminChannelPreviewPlayer.destroy(); } catch (e) {}
    }
    adminChannelPreviewPlayer = null;
    adminChannelPreviewKind = null;
    adminChannelPreviewIndex = -1;
    adminChannelPreviewInsertVideoId = null;
    if (els.adminChannelPreviewBox) els.adminChannelPreviewBox.innerHTML = '<p class="admin-empty">Not tuned in.</p>';
    if (els.adminChannelPreviewLabel) els.adminChannelPreviewLabel.textContent = "";
  }

  function loadAdminChannelPreviewTrack(pos) {
    var ref = channelItemRef(pos.item);
    if (!ref) return;
    adminChannelPreviewKind = pos.kind;
    adminChannelPreviewIndex = pos.kind === "queue" ? pos.index : -1;
    adminChannelPreviewInsertVideoId = pos.kind === "insert" ? pos.item.videoId : null;
    els.adminChannelPreviewLabel.textContent = (pos.kind === "insert" ? "Interrupt: " : "Now playing: ") + channelItemTitle(pos.item);

    if (adminChannelPreviewPlayer && adminChannelPreviewPlayer.destroy) {
      try { adminChannelPreviewPlayer.destroy(); } catch (e) {}
    }
    adminChannelPreviewPlayer = null;
    els.adminChannelPreviewBox.innerHTML = '<div id="adminChannelPreviewTarget" style="width:100%;height:100%;"></div>';
    createVideoPlayer("adminChannelPreviewTarget", ref, {
      autoplay: true,
      controls: true,
      isStale: function () { return els.adminChannelView.hidden; },
      onEnded: function () { if (!els.adminChannelView.hidden) resyncAdminChannelPreview(); },
      onError: function () { if (!els.adminChannelView.hidden) resyncAdminChannelPreview(); },
      onReady: function (player) {
        adminChannelPreviewPlayer = player;
        adminChannelPreviewProvider = ref.provider;
        if (pos.offsetSec > 0.5) {
          if (ref.provider === "youtube") { try { player.seekTo(pos.offsetSec, true); } catch (e) {} }
          else if (ref.provider === "vimeo" && player.setCurrentTime) { player.setCurrentTime(pos.offsetSec).catch(function () {}); }
        }
      }
    });
  }

  function resyncAdminChannelPreview() {
    if (els.adminChannelView.hidden || !adminChannelDraft) return;
    var pos = computeChannelPosition(adminChannelDraft);
    if (!pos) {
      els.adminChannelPreviewLabel.textContent = "Nothing in the queue yet.";
      els.adminChannelPreviewBox.innerHTML = '<p class="admin-empty">Not tuned in.</p>';
      return;
    }
    var sameTrack = pos.kind === "insert"
      ? (adminChannelPreviewKind === "insert" && adminChannelPreviewInsertVideoId === pos.item.videoId)
      : (adminChannelPreviewKind === "queue" && adminChannelPreviewIndex === pos.index);
    if (!sameTrack) { loadAdminChannelPreviewTrack(pos); return; }
    if (!adminChannelPreviewPlayer || !adminChannelPreviewPlayer.getCurrentTime) return;
    if (adminChannelPreviewProvider === "vimeo") {
      adminChannelPreviewPlayer.getCurrentTime().then(function (current) {
        if (typeof current === "number" && Math.abs(current - pos.offsetSec) > CHANNEL_DRIFT_TOLERANCE_SEC && adminChannelPreviewPlayer.setCurrentTime) {
          adminChannelPreviewPlayer.setCurrentTime(pos.offsetSec).catch(function () {});
        }
      }).catch(function () {});
      return;
    }
    try {
      var current = adminChannelPreviewPlayer.getCurrentTime();
      if (typeof current === "number" && Math.abs(current - pos.offsetSec) > CHANNEL_DRIFT_TOLERANCE_SEC) {
        adminChannelPreviewPlayer.seekTo(pos.offsetSec, true);
      }
    } catch (e) {}
  }

  function startAdminChannelPreview() {
    stopAdminChannelPreview();
    resyncAdminChannelPreview();
    adminChannelPreviewTimer = setInterval(resyncAdminChannelPreview, ADMIN_CHANNEL_PREVIEW_RESYNC_MS);
  }

  function goAdminChannel() {
    showAdminChannelView();
    return loadChannelAdmin();
  }

  function finishLoadChannelAdmin() {
    els.adminChannelModeOrdered.checked = adminChannelDraft.mode !== "shuffled";
    els.adminChannelModeShuffled.checked = adminChannelDraft.mode === "shuffled";
    els.adminChannelReshuffleBtn.hidden = adminChannelDraft.mode !== "shuffled";
    populateAdminChannelPlaylistSelect();
    renderAdminChannelQueue();
    els.adminChannelStatus.hidden = true;
    resolveMissingChannelDurations();
    if (adminChannelScheduleTimer) clearInterval(adminChannelScheduleTimer);
    adminChannelScheduleTimer = setInterval(renderAdminChannelQueue, ADMIN_CHANNEL_SCHEDULE_REFRESH_MS);
    startAdminChannelPreview();
  }

  function loadChannelAdmin() {
    els.adminChannelStatus.textContent = "Loading…";
    els.adminChannelStatus.className = "admin-status";
    els.adminChannelStatus.hidden = false;
    return channelDocRef().get().then(function (doc) {
      if (doc.exists) {
        adminChannelDraft = doc.data();
        if (!adminChannelDraft.items) adminChannelDraft.items = [];
        if (!adminChannelDraft.mode) adminChannelDraft.mode = "ordered";
        finishLoadChannelAdmin();
        return;
      }
      // First-ever use -- create the doc with a fresh anchor, then read it
      // back so the local copy holds a real resolved Timestamp rather than
      // an unresolved serverTimestamp() sentinel, which would otherwise
      // silently reset the anchor to "now" again on the next unrelated
      // save (add a video, reorder, etc).
      var fresh = {
        items: [], mode: "ordered", shuffleSeed: 0,
        anchorAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      return channelDocRef().set(fresh).then(function () { return channelDocRef().get(); }).then(function (doc2) {
        adminChannelDraft = doc2.data();
        finishLoadChannelAdmin();
      });
    }).catch(function (err) {
      console.error("Loading channel failed:", err);
      els.adminChannelStatus.textContent = "Couldn't load the Channel: " + err.message;
      els.adminChannelStatus.className = "admin-status is-error";
    });
  }

  function saveChannelDoc() {
    adminChannelDraft.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    return channelDocRef().set(adminChannelDraft).catch(function (err) {
      console.error("Saving channel failed:", err);
      els.adminChannelStatus.textContent = "Save failed: " + err.message;
      els.adminChannelStatus.className = "admin-status is-error";
      els.adminChannelStatus.hidden = false;
    });
  }

  function populateAdminChannelPlaylistSelect() {
    var playlists = loadPlaylists();
    if (!playlists.length) {
      els.adminChannelPlaylistSelect.innerHTML = '<option value="">No playlists yet</option>';
      els.adminChannelPlaylistSelect.disabled = true;
      return;
    }
    els.adminChannelPlaylistSelect.disabled = false;
    els.adminChannelPlaylistSelect.innerHTML = playlists.map(function (p) {
      return '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(p.name) + " (" + p.rowNums.length + ")</option>";
    }).join("");
  }

  function formatScheduleClock(date) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  // "When does each item actually play" -- reuses the exact same
  // channelPlayOrder()/computeChannelPosition() the viewer side uses (so
  // this is never out of sync with reality), then walks forward one full
  // loop from right now: the currently-playing item starts `offsetSec`
  // seconds ago, everything after it stacks up by real duration. Keyed by
  // item object reference (not rowNum) since seededShuffle() preserves the
  // original item objects, and rowNum alone wouldn't disambiguate a video
  // added to the queue more than once.
  function computeAdminChannelSchedule() {
    var map = new Map();
    var order = channelPlayOrder(adminChannelDraft);
    if (!order.length || !adminChannelDraft.anchorAt) return map;
    // Deliberately the queue-only position (ignores any active
    // scheduledInsert) -- the regular rotation's "plays at" schedule keeps
    // ticking through an interrupt rather than pausing for it, see
    // activeScheduledInsert()'s comment.
    var pos = computeQueueLoopPosition(adminChannelDraft);
    if (!pos) return map;
    var t = Date.now() - pos.offsetSec * 1000;
    for (var i = 0; i < order.length; i++) {
      var item = order[(pos.index + i) % order.length];
      map.set(item, { startsAt: new Date(t), isNowPlaying: i === 0 });
      t += item.duration * 1000;
    }
    return map;
  }

  function renderAdminChannelQueue() {
    var items = adminChannelDraft.items;
    els.adminChannelQueueCount.textContent = String(items.length);
    var total = items.reduce(function (s, it) { return s + (it.duration || 0); }, 0);
    els.adminChannelQueueDuration.textContent = formatDuration(total);
    renderAdminChannelScheduledInsert();
    if (!items.length) {
      els.adminChannelQueueList.innerHTML = '<p class="admin-empty">Queue is empty -- search for a video or add a playlist below.</p>';
      return;
    }
    var schedule = computeAdminChannelSchedule();
    els.adminChannelQueueList.innerHTML = items.map(function (it, i) {
      var title = escapeHtml(channelItemTitle(it)) + (it.provider ? " (inserted link)" : "");
      var dur = it.duration ? formatDuration(it.duration) : "resolving duration…";
      var sched = schedule.get(it);
      var schedText = sched
        ? (sched.isNowPlaying ? "&#9654; Now playing" : "Plays at " + formatScheduleClock(sched.startsAt))
        : (it.duration ? "Not scheduled (skipped)" : "");
      return (
        '<div class="admin-row">' +
          '<div class="admin-row-main">' +
            '<div class="admin-row-title">' + (i + 1) + ". " + title + "</div>" +
            '<div class="admin-row-sub">' + dur + (schedText ? " · " + schedText : "") + "</div>" +
          "</div>" +
          '<div class="admin-row-actions">' +
            '<button type="button" class="admin-row-btn" data-channel-action="up" data-index="' + i + '"' + (i === 0 ? " disabled" : "") + ">&uarr;</button>" +
            '<button type="button" class="admin-row-btn" data-channel-action="down" data-index="' + i + '"' + (i === items.length - 1 ? " disabled" : "") + ">&darr;</button>" +
            '<button type="button" class="admin-row-btn admin-row-btn-danger" data-channel-action="remove" data-index="' + i + '">Remove</button>' +
          "</div>" +
        "</div>"
      );
    }).join("");
  }

  function renderAdminChannelVideoResults() {
    var query = els.adminChannelVideoSearch.value.trim().toLowerCase();
    if (!query) { els.adminChannelVideoResults.innerHTML = ""; return; }
    var rows = state.rows.filter(function (r) {
      return hasVideo(r) && (r.artist + " " + r.song + " " + (r.director || "")).toLowerCase().indexOf(query) !== -1;
    }).slice(0, 25);
    if (!rows.length) { els.adminChannelVideoResults.innerHTML = '<p class="admin-empty">No matches.</p>'; return; }
    els.adminChannelVideoResults.innerHTML = rows.map(function (r) {
      return (
        '<div class="admin-row">' +
          '<div class="admin-row-main">' +
            '<div class="admin-row-title">' + escapeHtml(r.artist) + " — " + escapeHtml(r.song) + "</div>" +
            '<div class="admin-row-sub">#' + escapeHtml(r.rowNum) + (r.director ? " · " + escapeHtml(r.director) : "") + "</div>" +
          "</div>" +
          '<div class="admin-row-actions">' +
            '<button type="button" class="admin-row-btn" data-channel-action="add-video" data-rownum="' + escapeHtml(r.rowNum) + '">Add to end</button>' +
          "</div>" +
        "</div>"
      );
    }).join("");
  }

  function addRowToChannelQueue(rowNum) {
    var row = findRowByNum(rowNum);
    if (!row || !hasVideo(row)) return;
    adminChannelDraft.items.push({ rowNum: String(rowNum), duration: 0, addedAt: Date.now() });
    renderAdminChannelQueue();
    saveChannelDoc();
    resolveMissingChannelDurations();
  }

  function addPlaylistToChannelQueue(playlistId) {
    var playlist = findPlaylist(playlistId);
    if (!playlist) return;
    var added = 0;
    playlist.rowNums.forEach(function (rn) {
      var row = findRowByNum(rn);
      if (row && hasVideo(row)) {
        adminChannelDraft.items.push({ rowNum: String(rn), duration: 0, addedAt: Date.now() });
        added++;
      }
    });
    if (!added) return;
    renderAdminChannelQueue();
    saveChannelDoc();
    resolveMissingChannelDurations();
  }

  function moveChannelItem(index, dir) {
    var items = adminChannelDraft.items;
    var target = index + dir;
    if (target < 0 || target >= items.length) return;
    var tmp = items[index]; items[index] = items[target]; items[target] = tmp;
    renderAdminChannelQueue();
    saveChannelDoc();
  }

  function removeChannelItem(index) {
    adminChannelDraft.items.splice(index, 1);
    renderAdminChannelQueue();
    saveChannelDoc();
  }

  // No duration data exists anywhere in the catalog today, so it's fetched
  // once per video the first time it's added to the Channel queue and
  // cached on the queue item itself (not written back to the `videos` doc
  // -- keeps this self-contained rather than touching the main catalog
  // schema for a Channel-only need). Vimeo's oEmbed conveniently returns
  // duration directly; YouTube's doesn't, so that branch briefly loads a
  // real (hidden, silent, no-autoplay) player just long enough to read
  // getDuration() off it, then tears it down.
  var channelDurationProbeSeq = 0;

  function resolveDurationForRow(row) {
    var ref = getRowVideoRef(row);
    if (!ref) return Promise.resolve(0);
    return resolveDurationForRef(ref);
  }

  function resolveDurationForRef(ref) {
    if (!ref) return Promise.resolve(0);
    if (ref.provider === "vimeo") {
      return fetch("https://vimeo.com/api/oembed.json?url=" + encodeURIComponent("https://vimeo.com/" + ref.id))
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (data) { return (data && data.duration) || 0; })
        .catch(function () { return 0; });
    }
    return new Promise(function (resolve) {
      // Unique per call -- resolveMissingChannelDurations() now runs several
      // of these concurrently (bulk Shuffle Add), so a shared fixed id would
      // have each probe's setup/teardown stomp on the others'.
      var hiddenId = "channelDurationProbe" + (channelDurationProbeSeq++);
      var div = document.createElement("div");
      div.id = hiddenId;
      div.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:-9999px;";
      document.body.appendChild(div);
      var settled = false;
      var probePlayer = null;
      function finish(sec) {
        if (settled) return;
        settled = true;
        try { if (probePlayer && probePlayer.destroy) probePlayer.destroy(); } catch (e) {}
        div.remove();
        resolve(sec || 0);
      }
      createVideoPlayer(hiddenId, ref, {
        autoplay: false,
        controls: false,
        isStale: function () { return settled; },
        onError: function () { finish(0); },
        onReady: function (player) {
          probePlayer = player;
          var attempts = 0;
          (function poll() {
            var d = 0;
            try { d = player.getDuration(); } catch (e) {}
            if (d > 0 || attempts >= 8) { finish(d); return; }
            attempts++;
            setTimeout(poll, 250);
          })();
        }
      });
      setTimeout(function () { finish(0); }, 6000); // hard cap so a stuck probe can't hang the admin UI
    });
  }

  // Resolves several videos' durations at once (a worker pool, not one
  // Promise.all -- unbounded concurrency here would mean up to a Shuffle
  // Add +1000 worth of hidden YouTube iframes loading simultaneously,
  // which would bog down or crash the tab) and reports progress, since
  // Shuffle Add can mean waiting on hundreds of these. Saves are debounced
  // to one write ~1s after the last resolution lands rather than one
  // Firestore write per video.
  var CHANNEL_DURATION_CONCURRENCY = 5;
  var channelDurationSaveDebounce = null;

  function resolveMissingChannelDurations() {
    var missing = adminChannelDraft.items.filter(function (it) { return !it.duration; });
    if (!missing.length) return;
    var total = missing.length;
    var done = 0;
    var nextIndex = 0;

    function scheduleSave() {
      if (channelDurationSaveDebounce) clearTimeout(channelDurationSaveDebounce);
      channelDurationSaveDebounce = setTimeout(function () { saveChannelDoc(); }, 1000);
    }

    function reportProgress() {
      els.adminChannelStatus.className = "admin-status";
      els.adminChannelStatus.textContent = "Resolving durations: " + done + " / " + total + "…";
      els.adminChannelStatus.hidden = false;
    }

    function worker() {
      if (nextIndex >= missing.length) return Promise.resolve();
      var item = missing[nextIndex++];
      var ref = channelItemRef(item);
      var work = ref ? resolveDurationForRef(ref) : Promise.resolve(0);
      return work.then(function (sec) {
        item.duration = sec;
        done++;
        reportProgress();
        renderAdminChannelQueue();
        scheduleSave();
        return worker();
      });
    }

    reportProgress();
    var pool = [];
    for (var i = 0; i < CHANNEL_DURATION_CONCURRENCY; i++) pool.push(worker());
    Promise.all(pool).then(function () {
      els.adminChannelStatus.hidden = true;
      if (channelDurationSaveDebounce) { clearTimeout(channelDurationSaveDebounce); channelDurationSaveDebounce = null; }
      saveChannelDoc();
    });
  }

  // Bulk-populates the queue with `count` random, not-already-queued
  // catalog videos -- a quick way to seed a long-running Channel without
  // hand-picking hundreds of tracks. Falls back to however many eligible
  // videos actually exist if the catalog (minus what's already queued)
  // has fewer than `count` left.
  function shuffleAddToChannelQueue(count) {
    var queued = {};
    adminChannelDraft.items.forEach(function (it) { queued[it.rowNum] = true; });
    var eligible = state.rows.filter(function (r) { return hasVideo(r) && !queued[r.rowNum]; });
    var picked = shuffle(eligible).slice(0, count);
    if (!picked.length) return;
    picked.forEach(function (row) {
      adminChannelDraft.items.push({ rowNum: String(row.rowNum), duration: 0, addedAt: Date.now() });
    });
    renderAdminChannelQueue();
    saveChannelDoc();
    resolveMissingChannelDurations();
  }

  // ---- Insert a YouTube/Vimeo link (not necessarily in the catalog) ------
  function parseChannelVideoUrl(url) {
    var yt = extractYouTubeId(url);
    if (yt) return { provider: "youtube", id: yt };
    var vm = extractVimeoId(url);
    if (vm) return { provider: "vimeo", id: vm };
    return null;
  }

  function fetchOEmbedTitle(ref) {
    var url = ref.provider === "youtube"
      ? "https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + ref.id)
      : "https://vimeo.com/api/oembed.json?url=" + encodeURIComponent("https://vimeo.com/" + ref.id);
    return fetch(url)
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data) return null;
        return (data.author_name ? data.author_name + " — " : "") + (data.title || "");
      })
      .catch(function () { return null; });
  }

  function renderAdminChannelScheduledInsert() {
    var si = adminChannelDraft.scheduledInsert;
    if (!si) { els.adminChannelScheduledInsertRow.hidden = true; return; }
    var playAtMs = si.playAt && si.playAt.toMillis ? si.playAt.toMillis() : si.playAt;
    var now = Date.now();
    var text;
    if (now < playAtMs) text = 'Scheduled: "' + si.title + '" plays at ' + formatScheduleClock(new Date(playAtMs));
    else if (now < playAtMs + si.duration * 1000) text = '🔴 Playing now: "' + si.title + '"';
    else text = '"' + si.title + '" already aired -- clear this or it\'ll keep showing as pending';
    els.adminChannelScheduledInsertText.textContent = text;
    els.adminChannelScheduledInsertRow.hidden = false;
  }

  function insertChannelVideo() {
    var url = els.adminChannelInsertUrl.value.trim();
    var ref = parseChannelVideoUrl(url);
    if (!ref) {
      els.adminChannelInsertStatus.className = "admin-status is-error";
      els.adminChannelInsertStatus.textContent = "Couldn't recognize that as a YouTube or Vimeo link.";
      els.adminChannelInsertStatus.hidden = false;
      return;
    }
    var timing = document.querySelector('input[name="adminChannelInsertTiming"]:checked').value;
    var playAtMs = null;
    if (timing === "now") {
      playAtMs = Date.now();
    } else if (timing === "at") {
      playAtMs = new Date(els.adminChannelInsertTime.value).getTime();
      if (!els.adminChannelInsertTime.value || isNaN(playAtMs)) {
        els.adminChannelInsertStatus.className = "admin-status is-error";
        els.adminChannelInsertStatus.textContent = "Pick a valid date/time first.";
        els.adminChannelInsertStatus.hidden = false;
        return;
      }
    }

    els.adminChannelInsertBtn.disabled = true;
    els.adminChannelInsertStatus.className = "admin-status";
    els.adminChannelInsertStatus.textContent = "Looking up video…";
    els.adminChannelInsertStatus.hidden = false;

    Promise.all([fetchOEmbedTitle(ref), resolveDurationForRef(ref)]).then(function (results) {
      els.adminChannelInsertBtn.disabled = false;
      var title = results[0] || (ref.provider === "youtube" ? "YouTube video " : "Vimeo video ") + ref.id;
      var duration = results[1];
      if (!duration) {
        els.adminChannelInsertStatus.className = "admin-status is-error";
        els.adminChannelInsertStatus.textContent = "Couldn't determine that video's length -- double check the link and try again.";
        return;
      }
      if (timing === "end") {
        adminChannelDraft.items.push({ provider: ref.provider, videoId: ref.id, title: title, duration: duration, addedAt: Date.now() });
        renderAdminChannelQueue();
      } else {
        // Only one scheduled insert at a time -- setting a new one replaces
        // whatever was pending, same as swapping a cart on a DJ deck.
        adminChannelDraft.scheduledInsert = { provider: ref.provider, videoId: ref.id, title: title, duration: duration, playAt: playAtMs };
        renderAdminChannelScheduledInsert();
      }
      saveChannelDoc();
      els.adminChannelInsertUrl.value = "";
      els.adminChannelInsertStatus.hidden = true;
    });
  }

  els.adminChannelInsertBtn.addEventListener("click", insertChannelVideo);

  Array.prototype.forEach.call(document.querySelectorAll('input[name="adminChannelInsertTiming"]'), function (radio) {
    radio.addEventListener("change", function () {
      els.adminChannelInsertTime.disabled = this.value !== "at";
    });
  });

  els.adminChannelCancelInsertBtn.addEventListener("click", function () {
    adminChannelDraft.scheduledInsert = null;
    saveChannelDoc();
    renderAdminChannelScheduledInsert();
  });

  els.adminGoChannelBtn.addEventListener("click", goAdminChannel);
  els.adminChannelBackBtn.addEventListener("click", showAdminLanding);

  els.adminChannelVideoSearch.addEventListener("input", renderAdminChannelVideoResults);

  els.adminChannelVideoResults.addEventListener("click", function (e) {
    var btn = e.target.closest('[data-channel-action="add-video"]');
    if (!btn) return;
    addRowToChannelQueue(btn.getAttribute("data-rownum"));
  });

  els.adminChannelAddPlaylistBtn.addEventListener("click", function () {
    addPlaylistToChannelQueue(els.adminChannelPlaylistSelect.value);
  });

  els.adminChannelShuffleRow.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-shuffle-count]");
    if (!btn) return;
    shuffleAddToChannelQueue(parseInt(btn.getAttribute("data-shuffle-count"), 10));
  });

  els.adminChannelQueueList.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-channel-action]");
    if (!btn) return;
    var index = parseInt(btn.getAttribute("data-index"), 10);
    var action = btn.getAttribute("data-channel-action");
    if (action === "up") moveChannelItem(index, -1);
    else if (action === "down") moveChannelItem(index, 1);
    else if (action === "remove") removeChannelItem(index);
  });

  els.adminChannelModeOrdered.addEventListener("change", function () {
    if (!els.adminChannelModeOrdered.checked) return;
    adminChannelDraft.mode = "ordered";
    els.adminChannelReshuffleBtn.hidden = true;
    saveChannelDoc();
  });
  els.adminChannelModeShuffled.addEventListener("change", function () {
    if (!els.adminChannelModeShuffled.checked) return;
    adminChannelDraft.mode = "shuffled";
    if (!adminChannelDraft.shuffleSeed) adminChannelDraft.shuffleSeed = Math.floor(Math.random() * 1e9);
    els.adminChannelReshuffleBtn.hidden = false;
    saveChannelDoc();
  });
  els.adminChannelReshuffleBtn.addEventListener("click", function () {
    adminChannelDraft.shuffleSeed = Math.floor(Math.random() * 1e9);
    saveChannelDoc();
  });
  els.adminChannelRestartBtn.addEventListener("click", function () {
    if (!window.confirm("Restart the Channel from the top of the queue for everyone currently watching?")) return;
    adminChannelDraft.anchorAt = firebase.firestore.FieldValue.serverTimestamp();
    saveChannelDoc().then(function () { return channelDocRef().get(); }).then(function (doc) {
      adminChannelDraft.anchorAt = doc.data().anchorAt;
    });
  });

  // ---- WYSIWYG toolbar ---------------------------------------------------
  // document.execCommand is deprecated but still broadly functional for
  // this exact use case (basic rich text) across evergreen browsers -- the
  // pragmatic choice for a no-build-step vanilla-JS admin tool over pulling
  // in a whole editor library for four formatting commands.
  els.adminBlogToolbar.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-cmd]");
    if (!btn) return;
    els.adminBlogBodyInput.focus();
    document.execCommand(btn.getAttribute("data-cmd"), false, btn.getAttribute("data-arg") || null);
  });

  function uploadBlogInlineImage(file) {
    var postId = els.adminBlogPostId.value;
    return resizeImageFile(file, 1600).then(function (blob) {
      var path = "blog-images/" + postId + "/" + Date.now() + ".jpg";
      return firebase.storage().ref(path).put(blob, { contentType: "image/jpeg" });
    }).then(function (snap) { return snap.ref.getDownloadURL(); });
  }

  // Clicking ANYTHING outside the contenteditable body (a toolbar button,
  // the file input) collapses/moves the DOM selection before a click
  // handler's own code gets a chance to read it -- capturing "where was
  // the cursor" only at the moment of the click is already too late.
  // Tracking it continuously via selectionchange instead means the image
  // insert always has an accurate last-known caret position to restore,
  // regardless of what stole focus in between. Falls back to inserting at
  // the end of the body if nothing's been placed in it yet (e.g. the very
  // first click is straight on the Image button before ever focusing body).
  var lastBlogBodyRange = null;
  document.addEventListener("selectionchange", function () {
    if (els.blogEditorPage.hidden) return;
    var sel = window.getSelection();
    if (!sel.rangeCount) return;
    var range = sel.getRangeAt(0);
    if (els.adminBlogBodyInput.contains(range.commonAncestorContainer)) {
      lastBlogBodyRange = range.cloneRange();
    }
  });

  function restoreBlogBodySelection() {
    els.adminBlogBodyInput.focus();
    var sel = window.getSelection();
    sel.removeAllRanges();
    if (lastBlogBodyRange) {
      sel.addRange(lastBlogBodyRange);
    } else {
      var range = document.createRange();
      range.selectNodeContents(els.adminBlogBodyInput);
      range.collapse(false);
      sel.addRange(range);
    }
  }

  // execCommand("createLink") silently no-ops when the selection is a
  // single image (returns true, changes nothing -- confirmed empirically,
  // not just a hunch) instead of throwing or doing something visibly wrong,
  // which makes it an easy thing to ship broken without noticing. Detected
  // the same way a browser represents "you clicked an image inside a
  // contenteditable": a collapsed-length-1 range whose one selected child
  // is that img. Wrapping/unwrapping it in <a> by hand sidesteps
  // execCommand for that case entirely; plain text selections still go
  // through execCommand as before, since that half already works fine.
  function getSelectedImageNode() {
    var sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return null;
    var range = sel.getRangeAt(0);
    if (range.startContainer !== range.endContainer) return null;
    if (range.endOffset - range.startOffset !== 1) return null;
    var node = range.startContainer.childNodes[range.startOffset];
    return (node && node.nodeType === 1 && node.tagName === "IMG") ? node : null;
  }

  function wrapImageInLink(img, url) {
    var existingAnchor = img.closest("a");
    if (existingAnchor) {
      existingAnchor.setAttribute("href", url);
      return;
    }
    var a = document.createElement("a");
    a.href = url;
    img.parentNode.insertBefore(a, img);
    a.appendChild(img);
  }

  function unwrapImageLink(img) {
    var existingAnchor = img.closest("a");
    if (!existingAnchor || !existingAnchor.parentNode) return;
    existingAnchor.parentNode.insertBefore(img, existingAnchor);
    existingAnchor.parentNode.removeChild(existingAnchor);
  }

  els.adminBlogLinkBtn.addEventListener("click", function () {
    restoreBlogBodySelection();
    var img = getSelectedImageNode();
    var url = window.prompt("Link URL:", "https://");
    if (!url) return;
    if (img) wrapImageInLink(img, url); else document.execCommand("createLink", false, url);
  });

  els.adminBlogUnlinkBtn.addEventListener("click", function () {
    restoreBlogBodySelection();
    var img = getSelectedImageNode();
    if (img) { unwrapImageLink(img); return; }
    document.execCommand("unlink", false, null);
  });

  els.adminBlogImageBtn.addEventListener("click", function () {
    els.adminBlogInlineImageInput.click();
  });

  // contenteditable="false" on the wrapper makes it an atomic "island" --
  // selectable and deletable as one unit, same as how the browser already
  // treats an <img>, but you can't click inside and start typing into the
  // iframe. Reuses extractYouTubeId()/extractVimeoId() (see getRowVideoRef()
  // above), the same parsing the catalog's own video fields go through.
  els.adminBlogVideoBtn.addEventListener("click", function () {
    var url = window.prompt("YouTube or Vimeo video URL:", "https://");
    if (!url) return;
    var ytId = extractYouTubeId(url);
    var vimeoId = !ytId ? extractVimeoId(url) : null;
    var src = ytId
      ? "https://www.youtube.com/embed/" + ytId
      : vimeoId
        ? "https://player.vimeo.com/video/" + vimeoId
        : null;
    if (!src) {
      alert("Couldn't recognize that as a YouTube or Vimeo link.");
      return;
    }
    restoreBlogBodySelection();
    document.execCommand("insertHTML", false,
      '<div class="blog-video-embed" contenteditable="false"><iframe src="' + src + '" title="Embedded video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>');
  });

  els.adminBlogInlineImageInput.addEventListener("change", function () {
    var file = els.adminBlogInlineImageInput.files[0];
    els.adminBlogInlineImageInput.value = "";
    if (!file) return;
    els.adminBlogImageBtn.disabled = true;
    uploadBlogInlineImage(file).then(function (url) {
      restoreBlogBodySelection();
      document.execCommand("insertHTML", false, '<img src="' + url + '" alt="">');
    }).catch(function (err) {
      console.error("Inline image upload failed:", err);
      alert("Couldn't upload that image -- please try again.");
    }).finally(function () {
      els.adminBlogImageBtn.disabled = false;
    });
  });

  els.adminBlogCoverInput.addEventListener("change", function () {
    var file = els.adminBlogCoverInput.files[0];
    if (!file) return;
    resizeImageFile(file, 1600).then(function (blob) {
      pendingBlogCoverBlob = blob;
      els.adminBlogCoverPreview.src = URL.createObjectURL(blob);
      els.adminBlogCoverPreview.hidden = false;
    }).catch(function (err) {
      console.error("Cover image resize failed:", err);
      els.adminBlogFormStatus.textContent = "Couldn't read that image -- try a different file.";
      els.adminBlogFormStatus.className = "admin-status is-error";
      els.adminBlogFormStatus.hidden = false;
    });
  });

  // Plain text preview of the body, used only as the excerpt fallback when
  // the admin leaves that field blank -- strips tags via a detached
  // element rather than a regex (regex-stripping HTML is never reliable).
  function plainTextExcerpt(html, maxLen) {
    var div = document.createElement("div");
    div.innerHTML = html;
    var text = (div.textContent || "").replace(/\s+/g, " ").trim();
    return text.length > maxLen ? text.slice(0, maxLen).trim() + "…" : text;
  }

  els.adminBlogForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var status = (e.submitter && e.submitter.getAttribute("data-status")) || "draft";
    var title = els.adminBlogTitleInput.value.trim();
    var slug = slugify(els.adminBlogSlugInput.value);
    var bodyHtml = els.adminBlogBodyInput.innerHTML.trim();
    if (!title || !slug || !bodyHtml) {
      els.adminBlogFormStatus.textContent = "Title, slug, and body are all required.";
      els.adminBlogFormStatus.className = "admin-status is-error";
      els.adminBlogFormStatus.hidden = false;
      return;
    }
    els.adminBlogSlugInput.value = slug;

    var postId = els.adminBlogPostId.value;
    var isNew = !blogPostsCache.some(function (p) { return p.id === postId; });
    els.adminBlogSaveDraftBtn.disabled = true;
    els.adminBlogPublishBtn.disabled = true;
    els.adminBlogFormStatus.hidden = true;

    var coverUploadPromise = pendingBlogCoverBlob
      ? firebase.storage().ref("blog-images/" + postId + "/cover.jpg").put(pendingBlogCoverBlob, { contentType: "image/jpeg" })
          .then(function (snap) { return snap.ref.getDownloadURL(); })
      : Promise.resolve(els.adminBlogCoverPreview.hidden ? "" : els.adminBlogCoverPreview.src);

    coverUploadPromise.then(function (coverURL) {
      var patch = {
        title: title,
        slug: slug,
        body: bodyHtml,
        excerpt: els.adminBlogExcerptInput.value.trim() || plainTextExcerpt(bodyHtml, 200),
        coverImageURL: coverURL || "",
        authorName: els.adminBlogAuthorInput.value.trim() || currentUser.displayName || currentUser.email || "The Music Video Guy",
        // Editable date, not just "whenever Save happened" -- lets a post be
        // backdated/postdated (e.g. importing older writeups). Set on every
        // save regardless of draft/published, since it's "the date this
        // post is/will be dated," not specifically a publish-event log.
        publishedAt: parseDateInputValue(els.adminBlogDateInput.value),
        status: status,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (isNew) patch.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      return db.collection("blogPosts").doc(postId).set(patch, { merge: true });
    }).then(function () {
      pendingBlogCoverBlob = null;
      return loadBlogPostsAdmin();
    }).then(function () {
      closeBlogEditorPage();
      showAdminBlogList();
      els.adminBlogListStatus.textContent = status === "published" ? "Published." : "Draft saved.";
      els.adminBlogListStatus.className = "admin-status";
      els.adminBlogListStatus.hidden = false;
    }).catch(function (err) {
      console.error("Saving blog post failed:", err);
      els.adminBlogFormStatus.textContent = "Couldn't save: " + err.message;
      els.adminBlogFormStatus.className = "admin-status is-error";
      els.adminBlogFormStatus.hidden = false;
    }).finally(function () {
      els.adminBlogSaveDraftBtn.disabled = false;
      els.adminBlogPublishBtn.disabled = false;
    });
  });

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
    updateSubtitleStats(state.rows);
    state.recentSet = computeRecentSet(state.rows);
    renderLatestStrip(state.rows);
    renderFeaturedStrip(state.rows);
    renderRecentList(state.rows);
    renderFavoritesStrip(state.rows);
    renderSpotlightSidebar(state.rows);
    renderDiscoverSection(state.rows);
    render();
  }

  // Deletes straight from wherever a single entry is being viewed
  // (admin-only) -- single-doc delete, same cost profile as the Edit
  // button. Removing it from state.rows makes it disappear from the
  // current page immediately; clearing the URL hash stops a stale #row-N
  // link from trying to reopen it. Auto-publishes afterward (matches
  // add/edit/bulk import) -- lands on the admin landing screen with the
  // publish result shown, rather than silently leaving it unpublished.
  // closeModalFn closes whatever view the delete was triggered from (the
  // lightbox, or TV Mode) before showing the admin landing confirmation.
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
      els.adminLandingStatus.textContent = 'Deleted "' + label + '". Publishing…';
      els.adminLandingStatus.className = "admin-status";
      els.adminLandingStatus.hidden = false;
      return publishSnapshot().then(function (result) {
        els.adminLandingStatus.textContent = 'Deleted "' + label + '". Published ' + result.count + " entries to the live site.";
      }).catch(function (err) {
        console.error("Publish failed:", err);
        els.adminLandingStatus.textContent = 'Deleted "' + label + '". (Publish failed: ' + err.message + " -- use the Publish button to retry.)";
        els.adminLandingStatus.className = "admin-status is-error";
      });
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
    els.adminChannelView.hidden = true;
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
      category: fields.category, youtube: fields.youtube, vimeo: fields.vimeo, vimeoThumb: fields.vimeoThumb,
      mvg: fields.mvg, year: fields.year,
      releaseDate: fields.releaseDate, studio: fields.studio, producer: fields.producer,
      dp: fields.dp, editor: fields.editor, choreographer: fields.choreographer, country: fields.country,
      genres: fields.genres, description: fields.description, feature: fields.feature, spotlight: fields.spotlight,
      sponsored: fields.sponsored, backdoor: fields.backdoor
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
      ["artist", "song", "director", "category", "youtube", "vimeo", "mvg", "year", "releaseDate",
        "studio", "producer", "dp", "editor", "choreographer", "country", "description"].forEach(function (key) {
        if (f.elements[key]) f.elements[key].value = row[key] || "";
      });
      f.elements.genres.value = (row.genres || []).join(", ");
      f.elements.feature.checked = !!row.feature;
      f.elements.spotlight.checked = !!row.spotlight;
      f.elements.sponsored.checked = !!row.sponsored;
      f.elements.backdoor.checked = !!row.backdoor;
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
          vimeo: d.vimeo || "",
          vimeoThumb: d.vimeoThumb || "",
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
          backdoor: !!d.backdoor,
          // Epoch millis, when known -- powers the age-bucketed Latest
          // Submissions sampling (see ageBucketSample()). Only set via
          // FieldValue.serverTimestamp() on new-doc creation, so older/
          // imported entries may lack it; ageBucketSample() falls back to
          // treating those as residual/undated rather than failing.
          createdAt: d.createdAt ? d.createdAt.toMillis() : null,
          // The uploader's own YouTube description/tags, backfilled via
          // scripts/backfill-youtube-metadata.js -- published standalone
          // (not just folded into searchHaystack below) so Advanced
          // Search's list cards can show it as a fallback description for
          // entries with no curated description of our own.
          youtubeSearchText: d.youtubeSearchText || "",
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
    vimeo: ["vimeo link", "vimeo"],
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
    els.adminBulkBackdoorCheckbox.checked = false;
    els.adminBulkStatus.hidden = true;
    els.adminBulkPreview.innerHTML = "";
    els.adminBulkCommitRow.hidden = true;
    state.adminBulkParsed = [];
  }

  function isTruthyFlagText(raw) {
    return /^(true|yes|y|1|x)$/i.test(String(raw || "").trim());
  }

  function buildBulkDoc(norm, rowNum, isNew, existing, forceBackdoor) {
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
      vimeo: pickAlias(norm, BULK_FIELD_ALIASES.vimeo),
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
      backdoor: !!forceBackdoor,
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
  function parseBulkImportText(text, forceBackdoor) {
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
      var mapped = entries.map(function (e) {
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
        return { rowNum: rowNum, isNew: isNew, doc: buildBulkDoc(e.norm, rowNum, isNew, existing, forceBackdoor), valid: true };
      });

      // Vimeo has no predictable thumbnail URL (unlike YouTube's
      // i.ytimg.com) -- resolve it once per row via oEmbed here, at
      // admin-preview time, rather than per-visitor. youtube wins when a
      // row somehow has both, so no fetch needed there.
      var thumbFetches = mapped.map(function (r) {
        if (!r.valid || r.doc.youtube) return null;
        var vimeoId = extractVimeoId(r.doc.vimeo);
        if (!vimeoId) return null;
        // Merge write (see adminBulkCommitBtn) -- only set the key on
        // success, so a transient oEmbed failure doesn't null out a
        // thumbnail fetched on a previous save.
        return fetchVimeoThumbnail(vimeoId).then(function (thumb) { if (thumb) r.doc.vimeoThumb = thumb; });
      }).filter(Boolean);

      return Promise.all(thumbFetches).then(function () { return mapped; });
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
    parseBulkImportText(text, els.adminBulkBackdoorCheckbox.checked).then(function (rows) {
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
      // Auto-publish so new entries go live without a separate manual step
      // (add/edit/delete all do the same now -- see els.adminForm's submit
      // handler and deleteRowByAdmin()). The Publish button still exists as
      // a manual/retry option, e.g. if an auto-publish attempt failed.
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
    if (adminChannelScheduleTimer) { clearInterval(adminChannelScheduleTimer); adminChannelScheduleTimer = null; }
    stopAdminChannelPreview();
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
      if (r.backdoor) badges += '<span class="admin-badge admin-badge-backdoor">Backdoor</span>';
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
        setAdminStatus('Deleted "' + label + '". Publishing…');
        return publishSnapshot().then(function (result) {
          setAdminStatus('Deleted "' + label + '". Published ' + result.count + " entries to the live site.");
        }).catch(function (err) {
          console.error("Publish failed:", err);
          setAdminStatus('Deleted "' + label + '". (Publish failed: ' + err.message + " -- use the Publish button to retry.)", true);
        });
      }).catch(function (err) {
        console.error("Admin delete failed:", err);
        setAdminStatus("Delete failed: " + err.message, true);
      });
    }
  });

  els.adminGoManageBtn.addEventListener("click", goAdminManageEntries);
  els.adminBackBtn.addEventListener("click", showAdminLanding);

  function updateAdminBadge(el, count) {
    el.textContent = String(count);
    el.hidden = count === 0;
  }

  // Landing-view badge counts -- lightweight equality-only queries (no
  // orderBy, so no composite index needed), refreshed each time the admin
  // panel is opened rather than kept live, since this is an admin-only,
  // low-traffic panel.
  function refreshAdminLandingBadges() {
    db.collection("editSuggestions").where("status", "==", "pending").get().then(function (snap) {
      updateAdminBadge(els.adminSuggestionsBadge, snap.size);
    }).catch(function () {});
    db.collection("verificationRequests").where("status", "==", "pending").get().then(function (snap) {
      updateAdminBadge(els.adminVerificationsBadge, snap.size);
    }).catch(function () {});
  }

  els.adminGoSuggestionsBtn.addEventListener("click", goAdminSuggestions);
  els.adminSuggestionsBackBtn.addEventListener("click", showAdminLanding);
  els.adminGoVerificationsBtn.addEventListener("click", goAdminVerifications);
  els.adminVerificationsBackBtn.addEventListener("click", showAdminLanding);

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
      var backdoor = formData.get("backdoor") === "on";
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
        vimeo: field("vimeo"),
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
        backdoor: backdoor,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (isNew) doc.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      // Only touch *At when a flag actually flips -- leave an already-true
      // flag's original timestamp alone so cap-eviction ordering stays correct.
      if (feature !== wasFeature) doc.featureAt = feature ? firebase.firestore.FieldValue.serverTimestamp() : null;
      if (spotlight !== wasSpotlight) doc.spotlightAt = spotlight ? firebase.firestore.FieldValue.serverTimestamp() : null;

      // Vimeo has no predictable thumbnail URL like YouTube's i.ytimg.com --
      // resolved once here via oEmbed rather than per-visitor (see
      // getRowThumbUrl()). Merge write below, so only set the key on
      // success -- a transient fetch failure shouldn't null out a
      // thumbnail already stored from a previous save.
      var vimeoId = !doc.youtube ? extractVimeoId(doc.vimeo) : null;
      var thumbPromise = vimeoId
        ? fetchVimeoThumbnail(vimeoId).then(function (thumb) { if (thumb) doc.vimeoThumb = thumb; })
        : Promise.resolve();

      return thumbPromise.then(function () {
        return db.collection("videos").doc(rowNum).set(doc, { merge: true });
      }).then(function () {
        var evictions = [];
        if (feature && !wasFeature) evictions.push(enforceCap("feature", "featureAt", 30));
        if (spotlight && !wasSpotlight) evictions.push(enforceCap("spotlight", "spotlightAt", SPOTLIGHT_COUNT));
        return Promise.all(evictions);
      }).then(function () {
        var label = (isNew ? "Added " : "Updated ") + doc.artist + " — " + doc.song + ".";
        // Auto-publish here too now (matches bulk import) -- a save that
        // doesn't show up on the live site until a separate manual click was
        // the #1 point of confusion. Publish failure doesn't roll back the
        // save; it's reported alongside it and the Publish button still
        // works as a manual retry.
        var publishPromise = publishSnapshot().then(function (result) {
          return label + " Published " + result.count + " entries to the live site.";
        }).catch(function (err) {
          console.error("Publish failed:", err);
          return label + " (Publish failed: " + err.message + " -- use the Publish button to retry.)";
        });

        // A single edit opened straight from the lightbox never loaded the
        // full list -- just close instead of paying for a ~13k-doc read only
        // to show a list the admin didn't ask for. From the landing
        // shortcut, there's no list to refresh either -- go back to landing
        // with a confirmation. Only from Manage Entries itself is there a
        // loaded list worth patching in place.
        if (state.adminReturnView === "lightbox") {
          dismissTopModal();
          publishPromise.catch(function () {}); // fire-and-forget, no status UI left to show it on
        } else if (state.adminReturnView === "list") {
          upsertAdminRowLocal(rowNum, doc);
          showAdminList();
          renderAdminEntries();
          setAdminStatus(label + " Publishing…");
          publishPromise.then(setAdminStatus);
        } else {
          upsertAdminRowLocal(rowNum, doc);
          showAdminLanding();
          els.adminLandingStatus.textContent = label + " Publishing…";
          els.adminLandingStatus.className = "admin-status";
          els.adminLandingStatus.hidden = false;
          publishPromise.then(function (text) { els.adminLandingStatus.textContent = text; });
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

    // YouTube and Vimeo are both optional individually (see index.html) so
    // one field doesn't force a submitter with the other kind of link to
    // fill in something fake -- but the entry needs at least one.
    if (!String(formData.get("youtube") || "").trim() && !String(formData.get("vimeo") || "").trim()) {
      els.submitVideoLinkHint.hidden = false;
      return;
    }
    els.submitVideoLinkHint.hidden = true;

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

  // Visual-only crop -- YouTube embeds are still fed the real 16:9 video,
  // this just scales the iframe up and clips the left/right edges via the
  // frame's overflow:hidden (see .lightbox-video-frame.is-crop-4-3 in
  // styles.css), so nothing actually changes about the source video.
  function applyLightboxCrop() {
    var frame = document.getElementById("lightboxVideoFrame");
    var btn = els.lightboxContent.querySelector(".lightbox-crop-btn");
    if (!btn) return;
    var isCropped = !!state.lightboxCrop;
    if (frame) frame.classList.toggle("is-crop-4-3", isCropped);
    btn.classList.toggle("is-active", isCropped);
    btn.title = isCropped ? "Restore 16:9" : "Crop to 4:3";
  }

  function applyLightboxMirror() {
    var frame = document.getElementById("lightboxVideoFrame");
    var btn = els.lightboxContent.querySelector(".lightbox-mirror-btn");
    if (frame) frame.classList.toggle("is-mirrored", !!state.lightboxMirror);
    if (btn) btn.classList.toggle("is-active", !!state.lightboxMirror);
  }

  function applyLightboxInterlace() {
    setInterlaceHz("lightbox", state.lightboxInterlaceHz);
    var btn = els.lightboxContent.querySelector(".lightbox-interlace-btn");
    if (!btn) return;
    btn.classList.toggle("is-active", !!state.lightboxInterlaceHz);
    btn.textContent = state.lightboxInterlaceHz ? "Interlace " + state.lightboxInterlaceHz + "Hz" : "Interlace";
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
    if (e.target.closest(".lightbox-crop-btn")) {
      state.lightboxCrop = !state.lightboxCrop;
      saveLightboxCropPref(state.lightboxCrop);
      applyLightboxCrop();
      return;
    }
    if (e.target.closest(".lightbox-mirror-btn")) {
      state.lightboxMirror = !state.lightboxMirror;
      applyLightboxMirror();
      return;
    }
    if (e.target.closest(".lightbox-interlace-btn")) {
      state.lightboxInterlaceHz = nextInterlaceHz(state.lightboxInterlaceHz);
      applyLightboxInterlace();
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
    var playlistBtn = e.target.closest(".lightbox-playlist-btn");
    if (playlistBtn) {
      openAddToPlaylistPopover(playlistBtn.getAttribute("data-rownum"), playlistBtn);
      return;
    }
    var relBtn = e.target.closest(".related-btn");
    if (relBtn) {
      var row = findRowByNum(relBtn.getAttribute("data-row"));
      if (row) openLightbox(row);
    }
    var requestBtn = e.target.closest("#profileRequestBtn");
    if (requestBtn) {
      var requestedProfile = profilesCache.filter(function (p) { return p.uid === requestBtn.getAttribute("data-uid"); })[0];
      if (requestedProfile) sendCollabRequest(requestedProfile);
      return;
    }
    if (e.target.closest("#profileVerifyBtn")) {
      var ownProfile = profilesCache.filter(function (p) { return p.uid === currentUser.uid; })[0];
      if (ownProfile) sendVerificationRequest(ownProfile);
      return;
    }
    if (e.target.closest("#profileViewIncomingBtn")) {
      dismissTopModal();
      showProfileRequestsView();
      loadCollabRequests();
    }
    var messageBtn = e.target.closest("[data-message-uid]");
    if (messageBtn) {
      openDmThread(messageBtn.getAttribute("data-message-uid"), messageBtn.getAttribute("data-message-name"));
      return;
    }
    var rescindBtn = e.target.closest('[data-request-action="rescind"]');
    if (rescindBtn) {
      var rescindProfile = profilesCache.filter(function (p) { return p.uid === state.lightboxProfileUid; })[0];
      rescindCollabRequest(rescindBtn.getAttribute("data-id"), function () {
        if (rescindProfile) renderProfileRequestArea(rescindProfile, null);
      });
      return;
    }
    if (e.target.closest("#commentSignInBtn")) {
      auth.signInWithPopup(googleProvider).catch(function (err) {
        console.error("Sign-in failed:", err);
      });
      return;
    }
    var suggestEditBtn = e.target.closest(".suggest-edit-open-btn");
    if (suggestEditBtn) {
      openSuggestEditModal(suggestEditBtn.getAttribute("data-rownum"));
      return;
    }
    var commentDeleteBtn = e.target.closest(".comment-delete-btn");
    if (commentDeleteBtn) {
      if (!window.confirm("Delete this comment?")) return;
      db.collection("comments").doc(commentDeleteBtn.getAttribute("data-commentid")).delete().catch(function (err) {
        console.error("Deleting comment failed:", err);
        alert("Couldn't delete that comment -- please try again.");
      });
    }
  });

  els.lightbox.addEventListener("submit", function (e) {
    var form = e.target.closest("#commentForm");
    if (!form) return;
    e.preventDefault();
    if (!currentUser) return;
    var input = document.getElementById("commentInput");
    var text = input.value.trim();
    if (!text) return;
    var btn = form.querySelector("button");
    btn.disabled = true;
    db.collection("comments").add({
      rowNum: form.getAttribute("data-rownum"),
      text: text,
      authorUid: currentUser.uid,
      authorName: currentUser.displayName || currentUser.email || "Anonymous",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () {
      input.value = "";
    }).catch(function (err) {
      console.error("Posting comment failed:", err);
      alert("Couldn't post that comment -- please try again.");
    }).finally(function () {
      btn.disabled = false;
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var anyOpen = !els.lightbox.hidden || !els.tvModal.hidden || !els.submitModal.hidden || !els.submitThanksModal.hidden ||
      !els.profileThanksModal.hidden ||
      !els.settingsModal.hidden ||
      !els.dmModal.hidden ||
      !els.recentModal.hidden || !els.podcastModal.hidden ||
      !els.adminModal.hidden || !els.suggestEditModal.hidden || !els.blogEditorPage.hidden ||
      els.headerLinks.classList.contains("is-open");
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

  // Reddit-style thumb-left/description-right card (see resultCardHtml()
  // above) -- reused here for the Search view's own results instead of the
  // old compact entry-row list, plus the extras that view needs: a "New"
  // badge, the category tag, and the Instagram link.
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
    var thumbAlt = escapeHtml((row.song || "Untitled") + (row.artist ? " — " + row.artist : ""));
    var thumb = videoThumbImgHtml(row, thumbAlt);
    var desc = resultDescription(row);

    return (
      '<li class="result-card" data-row="' + escapeHtml(row.rowNum) + '" role="button" tabindex="0" aria-haspopup="dialog">' +
      '<div class="result-card-thumb">' + thumb + "</div>" +
      '<div class="result-card-info">' +
      '<div class="result-card-song">' + escapeHtml(row.song || "(untitled)") + newBadge + "</div>" +
      (sub.length ? '<div class="result-card-artist">' + sub.join(" &middot; ") + "</div>" : "") +
      (desc ? '<p class="result-card-desc">' + escapeHtml(desc) + "</p>" : "") +
      (row.category || links ? '<div class="result-card-meta">' +
        (row.category ? '<span class="tag ' + categoryTagClass(row.category) + '">' + escapeHtml(row.category) + "</span>" : "") +
        (links ? '<span class="entry-links">' + links + "</span>" : "") +
        "</div>" : "") +
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
      '<ul class="result-list">' + rows.map(renderEntry).join("") + "</ul>" +
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
    var li = rowEl.closest(".result-card");
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
    var row = e.target.closest(".result-card");
    if (row) handleEntryActivate(row);
  });

  els.results.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var row = e.target.closest(".result-card");
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
    updateProfilesAuthUI();
    refreshNotificationBadge();
  });

  fetchData();
  fetchTopAds();
  fetchBlogLatest();
})();
