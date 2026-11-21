// 主题切换：默认深色（Obsidian Dark），支持 View Transitions 圆形扩散切屏并持久化到 localStorage
(function () {
  var root = document.documentElement;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function current() {
    var attr = root.getAttribute('data-theme');
    return attr === 'light' || attr === 'dark' ? attr : 'dark';
  }

  function applyButtonState(btn) {
    if (!btn) return;
    var theme = current();
    var dark = theme === 'dark';
    var nextLabel = dark ? 'Switch to light mode' : 'Switch to dark mode';

    btn.setAttribute('aria-pressed', String(dark));
    btn.setAttribute('data-theme-state', theme);

    if (btn.hasAttribute('data-icon-toggle')) {
      btn.setAttribute('aria-label', nextLabel);
      btn.setAttribute('title', nextLabel);
    } else {
      btn.textContent = dark ? 'Light mode' : 'Dark mode';
    }
  }

  function commitTheme(next) {
    root.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch (e) {}
    applyButtonState(document.getElementById('theme-toggle'));
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
  }

  function getOrigin(event) {
    if (event && typeof event.clientX === 'number' && (event.clientX > 0 || event.clientY > 0)) {
      return { x: event.clientX, y: event.clientY };
    }
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      var rect = btn.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }
    }
    return { x: window.innerWidth / 2, y: 0 };
  }

  function toggleTheme(event) {
    var next = current() === 'dark' ? 'light' : 'dark';
    document.dispatchEvent(new CustomEvent('sound:tick', { detail: { kind: 'theme' } }));

    if (typeof document.startViewTransition !== 'function' || reducedMotion.matches) {
      commitTheme(next);
      return;
    }

    var origin = getOrigin(event);
    var endRadius = Math.hypot(
      Math.max(origin.x, window.innerWidth - origin.x),
      Math.max(origin.y, window.innerHeight - origin.y)
    );
    root.style.setProperty('--vt-x', origin.x.toFixed(1) + 'px');
    root.style.setProperty('--vt-y', origin.y.toFixed(1) + 'px');
    root.style.setProperty('--vt-r', Math.ceil(endRadius) + 'px');

    var transition = document.startViewTransition(function () {
      root.classList.add('is-vt');
      commitTheme(next);
    });
    if (transition && transition.finished) {
      transition.finished.catch(function () {}).finally(function () {
        root.classList.remove('is-vt');
        root.style.removeProperty('--vt-x');
        root.style.removeProperty('--vt-y');
        root.style.removeProperty('--vt-r');
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('theme-toggle');
    applyButtonState(btn);
    if (btn) {
      btn.addEventListener('click', toggleTheme);
    }
  });

  document.addEventListener('theme:toggle', function () {
    toggleTheme(null);
  });
})();
