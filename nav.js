/* nav.js — swipe + title-tap navigation between pages */
(function () {
  var pages = [
    { path: '/', title: 'Remote' },
    { path: '/channels.html', title: 'Channels' },
    { path: '/prototype.html', title: 'Prototype' }
  ];

  var cur = pages.findIndex(function (p) {
    return location.pathname === p.path ||
           (p.path === '/' && (location.pathname === '/index.html'));
  });
  if (cur === -1) cur = 0;

  function go(i) {
    window.location.href = pages[i].path;
  }

  // ── Title tap → next page (wraps) ──────────────────────────────
  var title = document.querySelector('.title');
  if (title) {
    title.style.cursor = 'pointer';
    // Use touchend to avoid 300ms mobile click delay
    var titleTapX, titleTapY;
    title.addEventListener('touchstart', function (e) {
      var t = e.touches[0];
      titleTapX = t.clientX;
      titleTapY = t.clientY;
    }, { passive: true });
    title.addEventListener('touchend', function (e) {
      var t = e.changedTouches[0];
      // Only fire if finger didn't move (not a swipe)
      if (Math.abs(t.clientX - titleTapX) < 10 && Math.abs(t.clientY - titleTapY) < 10) {
        e.preventDefault(); // prevent ghost click
        go((cur + 1) % pages.length);
      }
    });
    // Desktop fallback
    title.addEventListener('click', function () {
      go((cur + 1) % pages.length);
    });
  }

  // ── Swipe left/right ───────────────────────────────────────────
  var startX, startY;

  document.addEventListener('touchstart', function (e) {
    // Don't capture swipes that start on interactive controls
    var el = e.target;
    if (el.closest('canvas, input[type="range"], .knob-bar, .ruler-bar, .volume-bar')) {
      startX = null;
      return;
    }
    var t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    if (startX == null) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - startX;
    var dy = t.clientY - startY;
    startX = null;

    // Ignore if vertical component dominates (scrolling) or too short
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;

    if (dx < 0 && cur < pages.length - 1) go(cur + 1);   // swipe left → next
    if (dx > 0 && cur > 0)                go(cur - 1);   // swipe right → prev
  }, { passive: true });

  // ── Service worker registration (cache static assets) ──────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  }
})();
