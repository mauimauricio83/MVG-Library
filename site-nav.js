// Shared header + sidebar for pages that live outside the main app.js SPA
// (news.html, support.html, and any other lightweight static page) -- so
// they get the same navigation chrome as index.html without pulling in the
// whole app (13k-video fetch, Firebase auth, TV Mode, etc.), which would be
// a lot of dead weight for a page that's just an article or a thank-you
// note. Internal nav items that need real app state (TV Mode, Favorites,
// Playlists, Profiles, Recently Viewed, Podcast, Settings, Sign in) just
// link back to index.html rather than trying to half-replicate that state
// here -- Submit is the one exception, since index.html already has a
// #submit hash listener (applySubmitHash()) that opens the modal directly.
//
// Usage: place the script tag INSIDE the page's own .shell wrapper, right
// before .app -- <body><div class="shell"><script src="site-nav.js">
// </script><div class="app">...page content...</div></div></body>. It
// inserts .header-links right after itself (so it lands as .shell's other
// flex child, alongside .app, matching index.html's real DOM shape) and
// prepends .top-bar to <body> separately, since that element deliberately
// lives OUTSIDE .shell in index.html too. Getting this nesting wrong
// silently breaks the whole layout: .header-links carries an explicit
// height (calc(100vh - topbar-h)) and isn't removed from flow, so stray
// outside of .shell it just pushes everything below it down by ~that much
// instead of sitting side-by-side with the content.
(function () {
  "use strict";

  var TOP_BAR_HTML =
    '<header class="top-bar">' +
      '<button type="button" class="header-icon-btn" id="headerMenuBtn" aria-label="Menu" aria-expanded="false" aria-controls="headerLinks">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>' +
      '</button>' +
      '<a class="top-bar-home-link" href="/index.html" aria-label="MVG Library home">' +
        '<img class="app-header-logo" src="/icons/icon-192.png" alt="" width="32" height="32">' +
        '<h1 class="top-bar-title">MUSIC VIDEO LIBRARY</h1>' +
      '</a>' +
      '<div class="top-bar-actions">' +
        '<a class="header-icon-btn" href="/index.html?settings=1" aria-label="Settings" title="Settings">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 0 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 0 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z"/></svg>' +
        '</a>' +
        '<a class="header-icon-btn" href="/index.html" aria-label="Sign in" title="Sign in">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>' +
        '</a>' +
      '</div>' +
    '</header>';

  var HEADER_LINKS_HTML =
    '<nav class="header-links" id="headerLinks" aria-label="Site links">' +
      '<button type="button" class="header-menu-close" id="headerMenuClose" aria-label="Close menu">&times;</button>' +
      '<div class="nav-mode-switch" id="navModeSwitch">' +
        '<button type="button" class="nav-mode-btn is-active" id="navModeWatchBtn" data-mode="watch" aria-pressed="true">Watch</button>' +
        '<button type="button" class="nav-mode-btn" id="navModeConnectBtn" data-mode="connect" aria-pressed="false">Connect</button>' +
      '</div>' +
      '<a class="submit-link" href="/index.html" data-nav-mode="watch">' +
        '<span class="header-links-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9"/></svg></span>' +
        '<span class="header-links-label">Home</span>' +
      '</a>' +
      '<a class="submit-link" href="/index.html" data-nav-mode="watch">' +
        '<span class="header-links-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M8 21h8M12 19v2M7 3l5 3 5-3"/></svg></span>' +
        '<span class="header-links-label">TV Mode</span>' +
      '</a>' +
      '<a class="submit-link" href="/index.html" data-nav-mode="watch">' +
        '<span class="header-links-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z"/></svg></span>' +
        '<span class="header-links-label">Favorites</span>' +
      '</a>' +
      '<a class="submit-link" href="/index.html" data-nav-mode="watch">' +
        '<span class="header-links-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></span>' +
        '<span class="header-links-label">Playlists</span>' +
      '</a>' +
      '<a class="submit-link" href="/index.html" data-nav-mode="connect">' +
        '<span class="header-links-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.5a3 3 0 0 1 0 5.9"/><path d="M18.5 14a5.5 5.5 0 0 1 3.5 5.9"/></svg></span>' +
        '<span class="header-links-label">Profiles</span>' +
      '</a>' +
      '<span class="header-links-sep">&middot;</span>' +
      '<a class="submit-link" href="/index.html#submit">' +
        '<span class="header-links-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg></span>' +
        '<span class="header-links-label">Submit music video</span>' +
      '</a>' +
      '<span class="header-links-sep">&middot;</span>' +
      '<a class="submit-link" href="/index.html">' +
        '<span class="header-links-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg></span>' +
        '<span class="header-links-label">Recently Viewed</span>' +
      '</a>' +
      '<span class="header-links-sep">&middot;</span>' +
      '<a class="submit-link" href="https://discord.gg/3UCVQzXuf5" target="_blank" rel="noopener noreferrer">' +
        '<span class="header-links-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4.5c-2.5.6-4.2 1.8-4.2 1.8-1.4 2.7-1.8 6.5-1.5 10.2 0 0 1.6 1.4 4.2 2.2l.7-1.4"/><path d="M16 4.5c2.5.6 4.2 1.8 4.2 1.8 1.4 2.7 1.8 6.5 1.5 10.2 0 0-1.6 1.4-4.2 2.2l-.7-1.4"/><path d="M6.5 15.8c3.6 1.6 7.4 1.6 11 0"/><circle cx="9" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.1" fill="currentColor" stroke="none"/></svg></span>' +
        '<span class="header-links-label">Discord</span>' +
      '</a>' +
      '<span class="header-links-sep">&middot;</span>' +
      '<a class="submit-link" href="/news.html">' +
        '<span class="header-links-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3v5a2 2 0 0 0 2 2h5"/><path d="M6 3h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M9 13h6M9 17h6"/></svg></span>' +
        '<span class="header-links-label">News</span>' +
      '</a>' +
      '<span class="header-links-sep">&middot;</span>' +
      '<a class="submit-link" href="/index.html">' +
        '<span class="header-links-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M6.5 15.5c3.5-1.2 7.5-.9 10.5 1"/><path d="M6 12c4-1.3 9-1 12.5 1.2"/><path d="M5.5 8.5c4.5-1.4 10-1 14 1.5"/></svg></span>' +
        '<span class="header-links-label">Podcast</span>' +
      '</a>' +
      '<span class="header-links-sep">&middot;</span>' +
      '<a class="submit-link" href="/support.html">' +
        '<span class="header-links-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 8.6c0 4.5-8.8 10.2-8.8 10.2S3.2 13.1 3.2 8.6a4.6 4.6 0 0 1 8.8-1.8 4.6 4.6 0 0 1 8.8 1.8Z"/></svg></span>' +
        '<span class="header-links-label">Support!</span>' +
      '</a>' +
      '<div class="header-account-area">' +
        '<a class="submit-link" href="/index.html?settings=1">' +
          '<span class="header-links-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 0 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 0 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z"/></svg></span>' +
          '<span class="header-links-label">Settings</span>' +
        '</a>' +
        '<span class="header-links-sep">&middot;</span>' +
        '<a class="submit-link" href="/index.html?admin=menu" id="siteNavAdminLink" hidden>' +
          '<span class="header-links-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2 3 6v6c0 5 3.8 8.7 9 10 5.2-1.3 9-5 9-10V6l-9-4Z"/><path d="m9 12 2 2 4-4"/></svg></span>' +
          '<span class="header-links-label">Admin</span>' +
        '</a>' +
        '<span class="header-links-sep" id="siteNavAdminSep" hidden>&middot;</span>' +
        '<a class="submit-link" href="/index.html">' +
          '<span class="header-links-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6"/></svg></span>' +
          '<span class="header-links-label">Sign in</span>' +
        '</a>' +
      '</div>' +
      '<div class="header-social-area">' +
        '<a class="submit-link" href="https://www.instagram.com/themusicvideoguy/" target="_blank" rel="noopener noreferrer">' +
          '<span class="header-links-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg></span>' +
          '<span class="header-links-label">Instagram</span>' +
        '</a>' +
        '<a class="submit-link" href="https://www.instagram.com/themusicvideoguy.ph/" target="_blank" rel="noopener noreferrer">' +
          '<span class="header-links-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg></span>' +
          '<span class="header-links-label">Instagram (PH)</span>' +
        '</a>' +
        '<a class="submit-link" href="https://www.facebook.com/themusicvideoguy" target="_blank" rel="noopener noreferrer">' +
          '<span class="header-links-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h-2a4 4 0 0 0-4 4v3H6v4h3v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h3Z"/></svg></span>' +
          '<span class="header-links-label">Facebook</span>' +
        '</a>' +
      '</div>' +
    '</nav>';

  // Same footer index.html gets (app.js builds this dynamically into
  // #appFooter there) -- these pages don't load app.js, so it's just
  // reproduced statically here. SITE_VERSION isn't read from app.js (no
  // shared module system, no build step), so bump it by hand alongside
  // APP_VERSION in app.js when that changes.
  var SITE_VERSION = "6.35.5";
  var FOOTER_HTML =
    '<footer class="app-footer">' +
      '<a href="/land.html" class="cloud-link land-link" aria-label="Land"><span>l</span><span>a</span><span>n</span><span>d</span></a>' +
      '<span class="app-footer-text">v' + SITE_VERSION + ' &middot; Created by MnC &middot; 2026</span>' +
      '<a href="/cloud.html" class="cloud-link" aria-label="Word Cloud"><span>c</span><span>l</span><span>o</span><span>u</span><span>d</span></a>' +
    "</footer>";

  function appendFooter() {
    var app = document.querySelector(".app");
    // Appended at load time, as the last child of .app -- safe even on
    // pages like news.html whose #blogMain content is filled in later by
    // an async Firestore fetch, since the footer is a sibling, not nested
    // inside the part that gets rewritten.
    if (app) app.insertAdjacentHTML("beforeend", FOOTER_HTML);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", appendFooter);
  } else {
    appendFooter();
  }

  var thisScript = document.currentScript;
  thisScript.insertAdjacentHTML("afterend", HEADER_LINKS_HTML);
  document.body.insertAdjacentHTML("afterbegin", TOP_BAR_HTML);

  var headerLinks = document.getElementById("headerLinks");
  var menuBtn = document.getElementById("headerMenuBtn");
  var closeBtn = document.getElementById("headerMenuClose");
  var watchBtn = document.getElementById("navModeWatchBtn");
  var connectBtn = document.getElementById("navModeConnectBtn");

  function isMobileHeaderMenu() {
    return window.matchMedia("(max-width: 640px)").matches;
  }

  var scrollLockY = 0;
  function lockBodyScroll() {
    scrollLockY = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = "fixed";
    document.body.style.top = "-" + scrollLockY + "px";
    document.body.style.left = "0";
    document.body.style.right = "0";
  }

  function unlockBodyScroll() {
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    window.scrollTo(0, scrollLockY);
  }

  function openMenu() {
    headerLinks.classList.add("is-open");
    menuBtn.setAttribute("aria-expanded", "true");
    if (isMobileHeaderMenu()) lockBodyScroll();
  }

  function closeMenu() {
    if (!headerLinks.classList.contains("is-open")) return;
    headerLinks.classList.remove("is-open");
    menuBtn.setAttribute("aria-expanded", "false");
    if (isMobileHeaderMenu()) unlockBodyScroll();
  }

  menuBtn.addEventListener("click", function () {
    if (headerLinks.classList.contains("is-open")) closeMenu(); else openMenu();
  });
  closeBtn.addEventListener("click", closeMenu);

  document.addEventListener("click", function (e) {
    if (!isMobileHeaderMenu()) return;
    if (!headerLinks.classList.contains("is-open")) return;
    if (e.target.closest("#headerLinks") || e.target.closest("#headerMenuBtn")) return;
    closeMenu();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenu();
  });

  // Desktop's sidebar starts expanded (labels visible), same as index.html
  // -- mobile must NOT get this, or the fullscreen overlay would open on
  // every load.
  if (!isMobileHeaderMenu()) openMenu();

  window.addEventListener("resize", function () {
    // Crossing the mobile breakpoint while open would otherwise leave the
    // menu stuck in the wrong mode's styling until toggled again.
    if (!isMobileHeaderMenu() && !headerLinks.classList.contains("is-open")) openMenu();
  });

  // Same display-filter mechanism as index.html's applyNavMode() --
  // #headerLinks.nav-mode-connect [data-nav-mode="watch"] { display:none }
  // etc. are already in styles.css, this just flips the class.
  function setNavMode(mode) {
    headerLinks.classList.toggle("nav-mode-connect", mode === "connect");
    watchBtn.classList.toggle("is-active", mode === "watch");
    watchBtn.setAttribute("aria-pressed", mode === "watch" ? "true" : "false");
    connectBtn.classList.toggle("is-active", mode === "connect");
    connectBtn.setAttribute("aria-pressed", mode === "connect" ? "true" : "false");
  }
  watchBtn.addEventListener("click", function () { setNavMode("watch"); });
  connectBtn.addEventListener("click", function () { setNavMode("connect"); });

  // This script deliberately never touches Firebase (see the file header
  // comment), so it has no way to know if the current visitor is an admin
  // -- the Admin menu item starts hidden and stays that way unless a host
  // page that DOES already run its own admin check (news.html, currently)
  // calls this once that check resolves true.
  window.mvgSiteNav = {
    showAdmin: function () {
      var link = document.getElementById("siteNavAdminLink");
      var sep = document.getElementById("siteNavAdminSep");
      if (link) link.hidden = false;
      if (sep) sep.hidden = false;
    }
  };
})();
