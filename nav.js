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
    title.addEventListener('click', function () {
      go((cur + 1) % pages.length);
    });
  }

  // ── Swipe left/right ───────────────────────────────────────────
  var startX, startY;

  document.addEventListener('touchstart', function (e) {
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
})();
