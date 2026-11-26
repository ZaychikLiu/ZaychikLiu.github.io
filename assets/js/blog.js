// 博客阅读增强：顶部阅读进度细线、中英阅读时长估算、配图灯箱放大、文末上下篇导读
(function () {
  /* 1. 顶部 1px 阅读进度条 */
  var progressBar = document.createElement('div');
  progressBar.className = 'blog-progress';
  progressBar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(progressBar);

  function updateProgress() {
    var y = window.scrollY || window.pageYOffset;
    var max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    var ratio = Math.min(Math.max(y / max, 0), 1);
    progressBar.style.transform = 'scaleX(' + ratio.toFixed(4) + ')';
  }

  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress, { passive: true });
  updateProgress();

  /* 2. 中英双语阅读时长估算 */
  var metaEl = document.querySelector('.post-meta');
  var readingSpan = null;
  if (metaEl) {
    readingSpan = document.createElement('span');
    readingSpan.id = 'reading-time';
    metaEl.appendChild(readingSpan);
  }

  function currentLang() {
    return document.documentElement.lang === 'en' ? 'en' : 'zh';
  }

  function updateReadingTime() {
    if (!readingSpan) return;
    var lang = currentLang();
    var activeBody = document.querySelector('.post-body[data-lang-content="' + lang + '"]');
    if (!activeBody) activeBody = document.querySelector('.post-body:not([hidden])');
    if (!activeBody) return;

    var text = (activeBody.textContent || '').trim();
    if (lang === 'zh') {
      var cjkCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
      var latinWords = text.replace(/[\u4e00-\u9fff]/g, ' ').trim().split(/\s+/).filter(Boolean).length;
      var minsZh = Math.max(1, Math.round((cjkCount + latinWords * 1.5) / 360));
      readingSpan.textContent = ' · 约 ' + minsZh + ' 分钟阅读';
    } else {
      var words = text.split(/\s+/).filter(Boolean).length;
      var minsEn = Math.max(1, Math.round(words / 220));
      readingSpan.textContent = ' · ~' + minsEn + ' min read';
    }
  }

  /* 3. 文章配图灯箱 */
  var lightbox = document.createElement('dialog');
  lightbox.className = 'lightbox-modal';
  lightbox.setAttribute('aria-label', 'Figure inspection');
  lightbox.innerHTML =
    '<div class="lightbox-head">' +
    '<span id="blog-lightbox-title" class="lightbox-title"></span>' +
    '<button type="button" class="qr-close" data-blog-lightbox-close aria-label="Close">×</button>' +
    '</div>' +
    '<div class="lightbox-body">' +
    '<img id="blog-lightbox-img" src="" alt="">' +
    '</div>';
  document.body.appendChild(lightbox);

  var lbImg = document.getElementById('blog-lightbox-img');
  var lbTitle = document.getElementById('blog-lightbox-title');
  var lbClose = lightbox.querySelector('[data-blog-lightbox-close]');

  if (lbClose) {
    lbClose.addEventListener('click', function () {
      lightbox.close();
    });
  }
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) lightbox.close();
  });

  if (typeof lightbox.showModal === 'function') {
    document.querySelectorAll('.post-body img').forEach(function (img) {
      img.addEventListener('click', function () {
        if (!lbImg || !lbTitle) return;
        lbImg.src = img.currentSrc || img.src;
        lbImg.alt = img.alt || 'Article figure';
        lbTitle.textContent = img.alt || 'Figure preview';
        if (!lightbox.open) lightbox.showModal();
      });
    });
  }

  /* 4. 按专栏/类别分流的上/下一篇导读卡片 */
  var posts = [
    {
      slug: 'beyond-vision',
      series: 'essays',
      zh: 'Vision之外',
      en: 'Beyond Vision'
    },
    {
      slug: 'rethinking-vision-centric',
      series: 'essays',
      zh: '警惕 Vision Centric',
      en: 'Rethinking Vision-Centricity'
    },
    {
      slug: '3d-as-interface',
      series: 'essays',
      zh: '3D更应该定位为交互手段而非通用智能',
      en: '3D as an Interaction Interface Rather Than General Intelligence'
    },
    {
      slug: 'millennium-prize',
      series: 'essays',
      zh: '0.6B模型能解决千禧年难题吗？',
      en: 'Can a 0.6B Model Solve the Millennium Prize?'
    },
    {
      slug: 'llm-architecture-01',
      series: 'llm-architecture',
      zh: 'LLM 架构笔记（01）：Transformer 基础、现代组件与位置编码演进',
      en: 'LLM 架构笔记（01）：Transformer 基础、现代组件与位置编码演进'
    }
  ];

  var path = location.pathname || '';
  var curPost = null;
  for (var i = 0; i < posts.length; i++) {
    if (path.indexOf(posts[i].slug) !== -1) {
      curPost = posts[i];
      break;
    }
  }

  var seriesPosts = curPost
    ? posts.filter(function (p) { return p.series === curPost.series; })
    : [];
  var curIdx = curPost ? seriesPosts.indexOf(curPost) : -1;

  var foot = document.querySelector('footer.foot');
  var navEl = null;
  if (curIdx !== -1 && foot && foot.parentNode) {
    navEl = document.createElement('nav');
    navEl.className = 'post-nav';
    navEl.setAttribute('aria-label', 'Essay navigation');
    foot.parentNode.insertBefore(navEl, foot);
  }

  function renderPostNav() {
    if (!navEl || curIdx === -1) return;
    var lang = currentLang();
    var suffix = lang === 'en' ? '?lang=en' : '';
    var prev = curIdx > 0 ? seriesPosts[curIdx - 1] : null;
    var next = curIdx < seriesPosts.length - 1 ? seriesPosts[curIdx + 1] : null;

    var html = '';
    if (prev) {
      html +=
        '<a class="post-nav-card is-prev" href="../' + prev.slug + '/' + suffix + '">' +
        '<span class="post-nav-dir">' + (lang === 'zh' ? '← 上一篇' : '← Previous') + '</span>' +
        '<span class="post-nav-title">' + prev[lang] + '</span>' +
        '</a>';
    } else if (curPost && curPost.series === 'llm-architecture') {
      html +=
        '<a class="post-nav-card is-prev" href="../../?cat=llm-architecture">' +
        '<span class="post-nav-dir">← 专栏目录</span>' +
        '<span class="post-nav-title">LLM 架构专栏 · LLM Architecture Notes</span>' +
        '</a>';
    } else {
      html += '<span class="post-nav-spacer" aria-hidden="true"></span>';
    }

    if (next) {
      html +=
        '<a class="post-nav-card is-next" href="../' + next.slug + '/' + suffix + '">' +
        '<span class="post-nav-dir">' + (lang === 'zh' ? '下一篇 →' : 'Next →') + '</span>' +
        '<span class="post-nav-title">' + next[lang] + '</span>' +
        '</a>';
    } else {
      html += '<span class="post-nav-spacer" aria-hidden="true"></span>';
    }

    navEl.innerHTML = html;
  }

  /* 5. 代码块自动添加一键复制按钮 */
  document.querySelectorAll('.post-body pre').forEach(function (pre) {
    var code = pre.querySelector('code');
    if (!code) return;
    pre.classList.add('has-copy');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-copy-btn';
    btn.textContent = 'Copy';
    btn.setAttribute('aria-label', 'Copy code');
    btn.addEventListener('click', function () {
      var text = code.textContent || '';
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = 'Copied ✓';
          btn.classList.add('is-copied');
          setTimeout(function () {
            btn.textContent = 'Copy';
            btn.classList.remove('is-copied');
          }, 1600);
        }).catch(function () {});
      }
    });
    pre.appendChild(btn);
  });

  function syncAll() {
    updateReadingTime();
    renderPostNav();
    updateProgress();
  }

  document.querySelectorAll('[data-lang]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      requestAnimationFrame(syncAll);
    });
  });

  syncAll();
})();
