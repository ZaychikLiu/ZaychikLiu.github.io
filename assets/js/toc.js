// 目录高亮：滚动时标出当前所在的一节。宽屏用左侧固定栏，窄屏用开头的折叠块。
(function () {
  var rails = Array.prototype.slice.call(document.querySelectorAll('.toc-side'));
  if (!rails.length) return;

  // 双语文章每种语言各有一份目录，只跟踪当前没有隐藏的那份
  function collect() {
    var rail = rails.filter(function (r) { return !r.hidden; })[0] || rails[0];
    var out = [];
    rail.querySelectorAll('a[href^="#"]').forEach(function (a) {
      var el = document.getElementById(a.getAttribute('href').slice(1));
      if (el) out.push({ el: el, link: a });
    });
    out.sort(function (x, y) {
      return x.el.compareDocumentPosition(y.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    return out;
  }

  function update() {
    var items = collect();
    if (!items.length) return;
    var cur = items[0];
    for (var i = 0; i < items.length; i++) {
      if (items[i].el.getBoundingClientRect().top < 130) cur = items[i]; else break;
    }
    // 页面已滚到底时，最后几节顶不到上沿，直接高亮最后一项
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) cur = items[items.length - 1];
    rails.forEach(function (r) {
      r.querySelectorAll('a.active').forEach(function (a) { a.classList.remove('active'); });
    });
    if (cur) cur.link.classList.add('active');
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
