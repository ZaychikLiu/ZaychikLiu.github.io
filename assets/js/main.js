// 主页交互：生成式高斯椭圆场、磁吸边框光、头像 3D 反光、符号视觉实时交互实验、灯箱、可选触感音效与 ⌘K 面板
(function () {
  var reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reducedMotion = reducedMotionQuery.matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;

  /* 0. 可选 Web Audio 触感微音效（默认关闭） */
  var playTick = (function () {
    var btn = document.getElementById('sound-toggle');
    var enabled = false;
    try {
      enabled = localStorage.getItem('sound') === 'on';
    } catch (e) {}

    var ctx = null;
    function ensureCtx() {
      if (!ctx && (window.AudioContext || window.webkitAudioContext)) {
        var AudioCtor = window.AudioContext || window.webkitAudioContext;
        ctx = new AudioCtor();
      }
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(function () {});
      }
      return ctx;
    }

    function syncBtn() {
      if (!btn) return;
      btn.setAttribute('aria-pressed', String(enabled));
      var label = enabled ? 'Mute tactile sound' : 'Enable tactile sound';
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    }

    function tick(kind) {
      if (!enabled) return;
      var audio = ensureCtx();
      if (!audio) return;

      var now = audio.currentTime;
      var osc = audio.createOscillator();
      var gain = audio.createGain();

      var freq = 580;
      var dur = 0.018;
      var vol = 0.035;
      if (kind === 'theme') {
        freq = 440;
        dur = 0.032;
        vol = 0.045;
      } else if (kind === 'pixel') {
        freq = 720;
        dur = 0.012;
        vol = 0.025;
      } else if (kind === 'open') {
        freq = 640;
        dur = 0.024;
        vol = 0.035;
      }

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.65, now + dur);

      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(now);
      osc.stop(now + dur + 0.004);
    }

    syncBtn();
    if (btn) {
      btn.addEventListener('click', function () {
        enabled = !enabled;
        try {
          localStorage.setItem('sound', enabled ? 'on' : 'off');
        } catch (e) {}
        syncBtn();
        if (enabled) tick('open');
      });
    }

    document.addEventListener('sound:tick', function (e) {
      tick(e && e.detail ? e.detail.kind : 'click');
    });

    return tick;
  })();

  /* 1. 顶部生成式高斯椭圆画布（取色自 avatar.jpg，呼应 3DGS 与椭圆画母题） */
  (function () {
    var ambient = document.querySelector('.ambient-field');
    var canvas = document.getElementById('gaussian-canvas');
    if (!ambient || !canvas || reducedMotion) return;

    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    ambient.classList.add('has-canvas');

    var palette = [
      [201, 165, 74],
      [142, 154, 75],
      [167, 139, 250],
      [142, 90, 110],
      [76, 91, 122],
      [216, 178, 99]
    ];

    var splats = [];
    for (var i = 0; i < 14; i++) {
      var col = palette[i % palette.length];
      splats.push({
        bx: 0.08 + ((i * 0.17) % 0.84),
        by: 0.12 + ((i * 0.23) % 0.68),
        rx: 75 + (i % 4) * 34,
        ry: 40 + ((i + 1) % 3) * 26,
        rot: (i * 0.45) % Math.PI,
        phase: i * 0.9,
        speed: 0.00028 + (i % 5) * 0.00008,
        rgb: col,
        ox: 0,
        oy: 0,
        vx: 0,
        vy: 0
      });
    }

    var width = 0;
    var height = 0;
    var dpr = 1;
    var mouseX = -9999;
    var mouseY = -9999;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var rect = ambient.getBoundingClientRect();
      width = Math.max(rect.width, 320);
      height = Math.max(rect.height, 360);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });

    if (finePointer) {
      window.addEventListener(
        'pointermove',
        function (e) {
          var rect = ambient.getBoundingClientRect();
          mouseX = e.clientX - rect.left;
          mouseY = e.clientY - rect.top;
        },
        { passive: true }
      );
    }

    document.addEventListener('gaussian:perturb', function () {
      splats.forEach(function (s, idx) {
        var angle = idx * 0.72 + Math.random() * 0.6;
        s.vx += Math.cos(angle) * 6.5;
        s.vy += Math.sin(angle) * 4.5;
      });
    });

    var rafId = 0;
    var startTs = performance.now();

    function frame(now) {
      rafId = requestAnimationFrame(frame);
      if (document.hidden) return;

      var t = now - startTs;
      var isLight = document.documentElement.getAttribute('data-theme') === 'light';
      var alphaBase = isLight ? 0.065 : 0.115;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      for (var i = 0; i < splats.length; i++) {
        var s = splats[i];
        var cx = s.bx * width + Math.sin(t * s.speed + s.phase) * 34;
        var cy = s.by * height + Math.cos(t * s.speed * 1.15 + s.phase) * 22;

        // 指针排斥与弹性阻尼回弹
        var dx = cx + s.ox - mouseX;
        var dy = cy + s.oy - mouseY;
        var dist = Math.hypot(dx, dy);
        if (dist > 1 && dist < 210) {
          var push = ((210 - dist) / 210) * 0.9;
          s.vx += (dx / dist) * push;
          s.vy += (dy / dist) * push;
        }

        s.vx += -s.ox * 0.028;
        s.vy += -s.oy * 0.028;
        s.vx *= 0.88;
        s.vy *= 0.88;
        s.ox += s.vx;
        s.oy += s.vy;

        var x = cx + s.ox;
        var y = cy + s.oy;
        var radius = Math.max(s.rx, s.ry);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(s.rot + Math.sin(t * 0.00015 + s.phase) * 0.14);
        ctx.scale(s.rx / radius, s.ry / radius);

        var grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        grad.addColorStop(0, 'rgba(' + s.rgb[0] + ',' + s.rgb[1] + ',' + s.rgb[2] + ',' + alphaBase + ')');
        grad.addColorStop(0.58, 'rgba(' + s.rgb[0] + ',' + s.rgb[1] + ',' + s.rgb[2] + ',' + (alphaBase * 0.42).toFixed(4) + ')');
        grad.addColorStop(1, 'rgba(' + s.rgb[0] + ',' + s.rgb[1] + ',' + s.rgb[2] + ',0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    rafId = requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && !rafId) {
        rafId = requestAnimationFrame(frame);
      }
    });
  })();

  /* 2. 双层磁吸边框追踪光（Grid 级跨卡片邻近感知 + 单卡内光斑） */
  if (!reducedMotion && finePointer) {
    var grids = Array.prototype.slice.call(document.querySelectorAll('.spotlight-grid'));
    grids.forEach(function (grid) {
      var gridCards = Array.prototype.slice.call(grid.querySelectorAll('.spotlight-card'));
      var raf = 0;
      var lastX = 0;
      var lastY = 0;

      grid.addEventListener(
        'pointermove',
        function (e) {
          lastX = e.clientX;
          lastY = e.clientY;
          if (!raf) {
            raf = requestAnimationFrame(function () {
              gridCards.forEach(function (card) {
                var rect = card.getBoundingClientRect();
                card.style.setProperty('--mx', (lastX - rect.left).toFixed(1) + 'px');
                card.style.setProperty('--my', (lastY - rect.top).toFixed(1) + 'px');
              });
              raf = 0;
            });
          }
        },
        { passive: true }
      );
    });

    var standaloneCards = Array.prototype.slice
      .call(document.querySelectorAll('.spotlight-card'))
      .filter(function (c) {
        return !c.closest('.spotlight-grid');
      });

    standaloneCards.forEach(function (card) {
      var cardRaf = 0;
      var cx = 0;
      var cy = 0;
      card.addEventListener(
        'pointermove',
        function (e) {
          var rect = card.getBoundingClientRect();
          cx = e.clientX - rect.left;
          cy = e.clientY - rect.top;
          if (!cardRaf) {
            cardRaf = requestAnimationFrame(function () {
              card.style.setProperty('--mx', cx.toFixed(1) + 'px');
              card.style.setProperty('--my', cy.toFixed(1) + 'px');
              cardRaf = 0;
            });
          }
        },
        { passive: true }
      );
    });
  }

  /* 3. 头像 3D 透视微倾、高光与实时椭圆拟合重建 */
  var replayAvatarFit = function () {};
  (function () {
    var frameEl = document.querySelector('[data-avatar-tilt]');
    if (!frameEl) return;

    if (!reducedMotion && finePointer) {
      frameEl.addEventListener(
        'pointermove',
        function (e) {
          var rect = frameEl.getBoundingClientRect();
          var nx = (e.clientX - rect.left) / Math.max(rect.width, 1);
          var ny = (e.clientY - rect.top) / Math.max(rect.height, 1);
          var rx = (0.5 - ny) * 12;
          var ry = (nx - 0.5) * 12;
          frameEl.style.setProperty('--rx', rx.toFixed(2) + 'deg');
          frameEl.style.setProperty('--ry', ry.toFixed(2) + 'deg');
          frameEl.style.setProperty('--gx', (nx * 100).toFixed(1) + '%');
          frameEl.style.setProperty('--gy', (ny * 100).toFixed(1) + '%');
        },
        { passive: true }
      );

      frameEl.addEventListener('pointerleave', function () {
        frameEl.style.setProperty('--rx', '0deg');
        frameEl.style.setProperty('--ry', '0deg');
      });
    }

    var canvas = document.getElementById('avatar-fit-canvas');
    var statusEl = document.getElementById('avatar-fit-status');
    var replayBtn = document.getElementById('avatar-fit-replay');
    var rangeEl = document.getElementById('avatar-fit-range');
    var sparkEl = document.getElementById('avatar-fit-spark');
    var data = window.AVATAR_ELLIPSES;

    if (canvas && data && Array.isArray(data.ellipses) && data.ellipses.length) {
      var ctx = canvas.getContext('2d');
      var total = data.ellipses.length;
      var animTimer = 0;
      var fadeTimer = 0;

      // 构建 L2 RMSE 下降折线图坐标
      var sparkPts = [];
      var sparkAreaPath = null;
      var sparkFillPath = null;
      var sparkDot = null;

      if (sparkEl) {
        var rmseVals = [Number(data.initRmse)];
        for (var rIdx = 0; rIdx < total; rIdx++) {
          rmseVals.push(Number(data.ellipses[rIdx][9]));
        }
        var maxRmse = rmseVals[0];
        var minRmse = rmseVals[rmseVals.length - 1];
        var span = Math.max(maxRmse - minRmse, 1e-5);

        for (var pIdx = 0; pIdx < rmseVals.length; pIdx++) {
          var sx = 2 + (pIdx / total) * 148;
          var sy = 17.5 - ((rmseVals[pIdx] - minRmse) / span) * 14.5;
          sparkPts.push([sx.toFixed(1), sy.toFixed(1)]);
        }

        var trackD = 'M' + sparkPts.map(function (pt) { return pt[0] + ',' + pt[1]; }).join(' L');
        sparkEl.innerHTML =
          '<defs><linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#d8b263" stop-opacity="0.34"/>' +
          '<stop offset="100%" stop-color="#d8b263" stop-opacity="0"/>' +
          '</linearGradient></defs>' +
          '<path class="spark-track" d="' + trackD + '"/>' +
          '<path class="spark-area" d=""/>' +
          '<path class="spark-fill" d=""/>' +
          '<circle class="spark-dot" cx="2" cy="' + sparkPts[0][1] + '" r="2.5"/>';

        sparkAreaPath = sparkEl.querySelector('.spark-area');
        sparkFillPath = sparkEl.querySelector('.spark-fill');
        sparkDot = sparkEl.querySelector('.spark-dot');
      }

      if (rangeEl) {
        rangeEl.max = String(total);
        rangeEl.value = String(total);
      }

      function renderStep(count, showWireframe) {
        if (!ctx) return;
        var w = canvas.width;
        var h = canvas.height;
        var bg = data.bg || [32, 26, 36];

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgb(' + bg[0] + ',' + bg[1] + ',' + bg[2] + ')';
        ctx.fillRect(0, 0, w, h);

        var limit = Math.max(0, Math.min(count, total));
        for (var i = 0; i < limit; i++) {
          var e = data.ellipses[i];
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(e[0] * w, e[1] * h, e[2] * w, e[3] * h, e[4], 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(' + e[5] + ',' + e[6] + ',' + e[7] + ',' + e[8] + ')';
          ctx.fill();
          ctx.restore();
        }

        if (showWireframe && limit < total) {
          var cand = data.ellipses[limit];
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(cand[0] * w, cand[1] * h, cand[2] * w, cand[3] * h, cand[4], 0, Math.PI * 2);
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
          ctx.stroke();
          ctx.restore();
        }

        if (sparkPts.length) {
          var sub = sparkPts.slice(0, limit + 1);
          var fillD = 'M' + sub.map(function (pt) { return pt[0] + ',' + pt[1]; }).join(' L');
          var lastPt = sub[sub.length - 1];
          if (sparkFillPath) sparkFillPath.setAttribute('d', fillD);
          if (sparkAreaPath) {
            sparkAreaPath.setAttribute('d', fillD + ' L' + lastPt[0] + ',20 L' + sub[0][0] + ',20 Z');
          }
          if (sparkDot) {
            sparkDot.setAttribute('cx', lastPt[0]);
            sparkDot.setAttribute('cy', lastPt[1]);
          }
        }

        if (statusEl) {
          var rmse = limit === 0 ? data.initRmse : data.ellipses[limit - 1][9];
          statusEl.textContent = 'N=' + limit + ' · L2 ' + Number(rmse).toFixed(3);
        }
        if (rangeEl) {
          rangeEl.value = String(limit);
        }
      }

      function stopTimers() {
        clearTimeout(animTimer);
        clearTimeout(fadeTimer);
      }

      function playFit() {
        stopTimers();
        canvas.classList.remove('is-original');
        var step = 0;
        var proposePhase = true;

        function tick() {
          if (step >= total) {
            renderStep(total, false);
            fadeTimer = setTimeout(function () {
              canvas.classList.add('is-original');
              if (statusEl) statusEl.textContent = total + ' ellipses';
            }, 420);
            return;
          }

          if (proposePhase) {
            renderStep(step, true);
            proposePhase = false;
            animTimer = setTimeout(tick, 14);
          } else {
            step++;
            renderStep(step, false);
            proposePhase = true;
            animTimer = setTimeout(tick, 22);
          }
        }

        renderStep(0, false);
        animTimer = setTimeout(tick, 60);
      }

      replayAvatarFit = playFit;

      if (replayBtn) {
        replayBtn.addEventListener('click', function () {
          playTick('open');
          document.dispatchEvent(new CustomEvent('gaussian:perturb'));
          playFit();
        });
      }

      if (rangeEl) {
        rangeEl.addEventListener('input', function () {
          stopTimers();
          var val = parseInt(rangeEl.value, 10) || 0;
          canvas.classList.remove('is-original');
          renderStep(val, false);
        });
      }

      if (reducedMotion) {
        renderStep(total, false);
        canvas.classList.add('is-original');
        if (statusEl) statusEl.textContent = total + ' ellipses';
      } else {
        renderStep(0, false);
        setTimeout(playFit, 320);
      }
    }

    frameEl.addEventListener('click', function () {
      document.dispatchEvent(new CustomEvent('gaussian:perturb'));
      playTick('open');
      replayAvatarFit();
    });
  })();

  /* 4. 交互式 Symbolic Vision 小实验（10x10 像素画布 -> 实时纯文本 Token 序列） */
  (function () {
    var gridEl = document.getElementById('sv-canvas');
    var tokensEl = document.getElementById('sv-tokens');
    var metaEl = document.getElementById('sv-meta');
    if (!gridEl || !tokensEl) return;

    var colorMap = {
      A: '#d8b263',
      B: '#8fb369',
      C: '#c4b5fd',
      D: '#d4829c',
      '.': ''
    };

    var presets = {
      tree: [
        '....BB....',
        '...BBBB...',
        '..BBBBBB..',
        '..BBABBB..',
        '...BBBB...',
        '..BBBBBB..',
        '....AA....',
        '....AA....',
        '..BBBBBB..',
        '..........'
      ],
      avatar: [
        'BBDAAADBBB',
        'BBDDBA.BBB',
        'BBBBAA.BBB',
        'BBDBBBADDA',
        'BADBBBBDBB',
        'DADDBB..CD',
        'CDD......D',
        'CDD......C',
        '.DDBB.....',
        '..DADA....'
      ],
      gaussian: [
        '..CC......',
        '.CCCC..AA.',
        '.CCCC.AAAA',
        '..CC..AAA.',
        '....BBBB..',
        '...BBBBBB.',
        '..DD.BBBB.',
        '.DDDD.....',
        '..DD..CC..',
        '..........'
      ],
      wave: [
        '..........',
        '..CC......',
        '.C..C.....',
        'C....C..BB',
        '......BB..',
        '..AA......',
        '.A..A....D',
        'A....A..D.',
        '......DD..',
        '..........'
      ],
      clear: [
        '..........',
        '..........',
        '..........',
        '..........',
        '..........',
        '..........',
        '..........',
        '..........',
        '..........',
        '..........'
      ]
    };

    var cellsData = [];
    var cellButtons = [];
    var activeSymbol = 'A';
    var dragSymbol = 'A';
    var isPainting = false;

    for (var i = 0; i < 100; i++) {
      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'sv-cell';
      cell.dataset.svIdx = String(i);
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', 'Pixel ' + (Math.floor(i / 10) + 1) + ',' + ((i % 10) + 1));
      cellButtons.push(cell);
      gridEl.appendChild(cell);
    }

    function renderGrid() {
      var activeCount = 0;
      for (var i = 0; i < 100; i++) {
        var sym = cellsData[i] || '.';
        var btn = cellButtons[i];
        btn.style.background = colorMap[sym] || '';
        if (sym !== '.') activeCount++;
      }

      var header = '<span class="tok-tag">&lt;palette&gt;</span> A:#d8b263 B:#8fb369 C:#c4b5fd D:#d4829c <span class="tok-tag">&lt;/palette&gt;</span>\n';
      var rows = '';
      for (var r = 0; r < 10; r++) {
        var rowHtml = '';
        for (var c = 0; c < 10; c++) {
          var ch = cellsData[r * 10 + c] || '.';
          if (ch === '.') rowHtml += '.';
          else rowHtml += '<span class="tok-' + ch + '">' + ch + '</span>';
        }
        rows += rowHtml + (r < 9 ? '\n' : '');
      }
      tokensEl.innerHTML = header + rows;
      if (metaEl) {
        metaEl.textContent = activeCount + ' / 100 active';
      }
    }

    function loadPreset(name) {
      var lines = presets[name] || presets.tree;
      cellsData = lines.join('').split('');
      renderGrid();
      document.querySelectorAll('[data-sv-preset]').forEach(function (btn) {
        btn.setAttribute('aria-pressed', String(btn.getAttribute('data-sv-preset') === name));
      });
    }

    function popCell(btn) {
      if (!btn || reducedMotion) return;
      btn.classList.remove('is-pop');
      void btn.offsetWidth;
      btn.classList.add('is-pop');
    }

    function paintIndex(idx, symbol) {
      var next = symbol !== undefined ? symbol : activeSymbol;
      if (cellsData[idx] === next) return;
      cellsData[idx] = next;
      renderGrid();
      popCell(cellButtons[idx]);
      playTick('pixel');
      document.querySelectorAll('[data-sv-preset]').forEach(function (btn) {
        btn.setAttribute('aria-pressed', 'false');
      });
    }

    cellButtons.forEach(function (btn, idx) {
      btn.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        isPainting = true;
        dragSymbol = cellsData[idx] === activeSymbol ? '.' : activeSymbol;
        paintIndex(idx, dragSymbol);
      });
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          var next = cellsData[idx] === activeSymbol ? '.' : activeSymbol;
          paintIndex(idx, next);
        }
      });
    });

    gridEl.addEventListener('pointermove', function (e) {
      if (!isPainting) return;
      var el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && el.dataset && el.dataset.svIdx !== undefined) {
        paintIndex(parseInt(el.dataset.svIdx, 10), dragSymbol);
      }
    });

    function stopPainting() {
      isPainting = false;
    }

    window.addEventListener('pointerup', stopPainting);
    window.addEventListener('pointercancel', stopPainting);
    window.addEventListener('blur', stopPainting);

    document.querySelectorAll('[data-sv-symbol]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeSymbol = btn.getAttribute('data-sv-symbol') || 'A';
        document.querySelectorAll('[data-sv-symbol]').forEach(function (s) {
          s.setAttribute('aria-pressed', String(s === btn));
        });
        playTick('click');
      });
    });

    document.querySelectorAll('[data-sv-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        loadPreset(btn.getAttribute('data-sv-preset'));
        playTick('click');
      });
    });

    var copyPromptBtn = document.getElementById('sv-copy-prompt');
    var promptTimer = 0;
    if (copyPromptBtn) {
      copyPromptBtn.addEventListener('click', function () {
        var rowLines = [];
        for (var r = 0; r < 10; r++) {
          rowLines.push(cellsData.slice(r * 10, (r + 1) * 10).join(''));
        }
        var promptText =
          'Interpret the following 10x10 palette-indexed symbolic visual primitive grid as an image and describe what it depicts:\n\n' +
          '<palette> A:#d8b263 B:#8fb369 C:#c4b5fd D:#d4829c </palette>\n' +
          rowLines.join('\n');

        copyPlainText(promptText, function () {
          showToast('Symbolic prompt copied');
        });
        playTick('open');
        clearTimeout(promptTimer);
        copyPromptBtn.classList.add('is-copied');
        copyPromptBtn.textContent = 'Copied ✓';
        promptTimer = setTimeout(function () {
          copyPromptBtn.classList.remove('is-copied');
          copyPromptBtn.textContent = 'Copy Prompt';
        }, 1600);
      });
    }

    loadPreset('tree');
  })();

  /* 5. 出版物：滑动分段开关 Selected (2) / All (3) & 一键复制 BibTeX & 悬停预览 */
  var showAllPubs = function () {};
  var isAllPubsShown = function () { return false; };
  (function () {
    var switcher = document.querySelector('.pub-switch');
    var thumb = switcher ? switcher.querySelector('.pub-switch-thumb') : null;
    var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-pub-mode]'));
    var extra = document.getElementById('pub-extra');
    if (!tabs.length) return;

    function positionThumb(activeTab) {
      if (!switcher || !thumb || !activeTab) return;
      var left = activeTab.offsetLeft;
      var width = activeTab.offsetWidth;
      thumb.style.width = width + 'px';
      thumb.style.transform = 'translateX(' + left + 'px)';
      switcher.classList.add('is-ready');
    }

    function show(full, updateUrl) {
      if (extra) extra.hidden = !full;
      var activeTab = null;
      tabs.forEach(function (tab) {
        var isAll = tab.getAttribute('data-pub-mode') === 'all';
        var pressed = full ? isAll : !isAll;
        tab.setAttribute('aria-pressed', String(pressed));
        if (pressed) activeTab = tab;
      });
      requestAnimationFrame(function () {
        positionThumb(activeTab);
      });
      if (updateUrl) {
        history.replaceState(null, '', full ? '?pubs=all' : location.pathname + location.hash);
      }
    }

    showAllPubs = function (full) {
      show(full, true);
    };
    isAllPubsShown = function () {
      return extra ? !extra.hidden : false;
    };

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        show(tab.getAttribute('data-pub-mode') === 'all', true);
        playTick('click');
      });
    });

    var initialFull = new URLSearchParams(location.search).get('pubs') === 'all';
    show(initialFull, false);

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        var current = tabs.filter(function (t) {
          return t.getAttribute('aria-pressed') === 'true';
        })[0];
        positionThumb(current);
      });
    }
    window.addEventListener('resize', function () {
      var current = tabs.filter(function (t) {
        return t.getAttribute('aria-pressed') === 'true';
      })[0];
      positionThumb(current);
    });

    // 一键复制 BibTeX
    var bibtex = {
      pixelbench:
        '@article{zhang2026pixelbench,\n' +
        '  title={PixelBench: Can LLMs Understand and Generate Images Pixel by Pixel?},\n' +
        '  author={Zhang, Haoquan and Liu, Feiyang and Tian, Juanxi and Li, Wanhua and Duan, Haodong and Liu, Weiyang},\n' +
        '  year={2026}\n' +
        '}',
      cags:
        '@inproceedings{zhou2026cags,\n' +
        '  title={Confidence-Guided Multi-Scale Aggregation for Sparse-View High-Resolution 3D Gaussian Splatting},\n' +
        '  author={Zhou, Qinzheng and Liu, Feiyang and Lu, Lijing and Li, Zhihang},\n' +
        '  booktitle={Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR)},\n' +
        '  year={2026}\n' +
        '}',
      counterfactual3dgs:
        '@article{zhou2027counterfactual,\n' +
        '  title={Commit Only When Justified: Counterfactual Topology Selection for Sparse-View 3DGS},\n' +
        '  author={Zhou, Qinzheng and Liu, Feiyang and Lu, Lijing and Li, Zhihang},\n' +
        '  note={Under review, AAAI 2027},\n' +
        '  year={2026}\n' +
        '}'
    };

    document.querySelectorAll('[data-cite-key]').forEach(function (btn) {
      var timer = 0;
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-cite-key');
        var bib = bibtex[key];
        if (!bib) return;
        copyPlainText(bib, function () {
          showToast('BibTeX copied');
        });
        playTick('open');
        clearTimeout(timer);
        btn.classList.add('is-copied');
        btn.textContent = 'Copied ✓';
        timer = setTimeout(function () {
          btn.classList.remove('is-copied');
          btn.textContent = 'Cite';
        }, 1600);
      });
    });

    // 悬停论文链接迷你预览卡
    var previewEl = document.getElementById('link-preview');
    if (previewEl && finePointer) {
      var previews = {
        pixelbench: {
          img: 'assets/img/pub/pixelbench.jpg',
          meta: '2026 · Symbolic Vision',
          title: 'PixelBench: Pixel-by-Pixel LLMs',
          desc: 'Plain-text symbolic visual primitives & Pixel Reconstruction Tuning without diffusion modules.'
        },
        cags: {
          img: 'assets/img/pub/cags.jpg',
          meta: 'CVPR 2026 · Highlight',
          title: 'Confidence-Guided Multi-Scale 3DGS',
          desc: 'Coarse-to-fine resolution aggregation preserving global geometry and crisp sparse-view detail.'
        }
      };

      var hideTimer = 0;

      function hidePreview() {
        previewEl.classList.remove('is-visible');
        hideTimer = setTimeout(function () {
          if (!previewEl.classList.contains('is-visible')) {
            previewEl.hidden = true;
          }
        }, 180);
      }

      function showPreview(trigger, key) {
        var item = previews[key];
        if (!item) return;
        clearTimeout(hideTimer);

        previewEl.innerHTML =
          '<img class="link-preview-img" src="' + item.img + '" alt="">' +
          '<div class="link-preview-meta">' + item.meta + '</div>' +
          '<div class="link-preview-title">' + item.title + '</div>' +
          '<div class="link-preview-desc">' + item.desc + '</div>';

        previewEl.hidden = false;
        var rect = trigger.getBoundingClientRect();
        var cardW = 264;
        var cardH = previewEl.offsetHeight || 220;
        var left = Math.min(Math.max(12, rect.left + rect.width / 2 - cardW / 2), window.innerWidth - cardW - 12);
        var top = rect.top - cardH - 10;
        if (top < 64) top = rect.bottom + 10;

        previewEl.style.left = Math.round(left) + 'px';
        previewEl.style.top = Math.round(top) + 'px';

        requestAnimationFrame(function () {
          previewEl.classList.add('is-visible');
        });
      }

      document.querySelectorAll('[data-preview]').forEach(function (link) {
        link.addEventListener('pointerenter', function () {
          showPreview(link, link.getAttribute('data-preview'));
        });
        link.addEventListener('focus', function () {
          showPreview(link, link.getAttribute('data-preview'));
        });
        link.addEventListener('pointerleave', hidePreview);
        link.addEventListener('blur', hidePreview);
      });

      window.addEventListener('scroll', hidePreview, { passive: true });
    }
  })();

  /* 6. 论文配图灯箱预览 */
  (function () {
    var modal = document.getElementById('lightbox-modal');
    var imgEl = document.getElementById('lightbox-img');
    var titleEl = document.getElementById('lightbox-title');
    if (!modal || !imgEl || !titleEl || typeof modal.showModal !== 'function') return;

    function openLightbox(src, title) {
      if (!src) return;
      imgEl.src = src;
      imgEl.alt = title || 'Publication figure';
      titleEl.textContent = title || 'Figure preview';
      if (!modal.open) modal.showModal();
      playTick('open');
    }

    document.querySelectorAll('[data-lightbox-src]').forEach(function (trigger) {
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openLightbox(trigger.getAttribute('data-lightbox-src'), trigger.getAttribute('data-lightbox-title'));
      });
    });

    document.querySelectorAll('[data-lightbox-close]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        modal.close();
      });
    });

    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.close();
    });
  })();

  /* 7. Ongoing Projects：收起/展开与锚点自动展开 */
  var expandOngoing = function () {};
  (function () {
    var btn = document.getElementById('ongoing-toggle');
    var list = document.getElementById('ongoing-list');
    var label = btn ? btn.querySelector('[data-ongoing-label]') : null;
    if (!btn || !list) return;

    function setExpanded(expanded) {
      list.hidden = !expanded;
      btn.setAttribute('aria-expanded', String(expanded));
      if (label) label.textContent = expanded ? 'Collapse' : 'Expand';
    }

    expandOngoing = function () {
      setExpanded(true);
    };

    btn.addEventListener('click', function () {
      setExpanded(btn.getAttribute('aria-expanded') !== 'true');
      playTick('click');
    });

    document.querySelectorAll('a[href^="#ongoing"]').forEach(function (link) {
      link.addEventListener('click', function () {
        setExpanded(true);
      });
    });

    if (location.hash && location.hash.indexOf('#ongoing') === 0) {
      setExpanded(true);
    }
  })();

  /* 8. Sonner 风格悬浮 Toast & 复制邮箱行内反馈 */
  var showToast = (function () {
    var region = document.getElementById('toast-region');
    var hideTimer = 0;
    return function (message) {
      if (!region) return;
      clearTimeout(hideTimer);
      region.innerHTML = '';

      var toast = document.createElement('div');
      toast.className = 'toast';
      toast.setAttribute('role', 'status');

      var dot = document.createElement('span');
      dot.className = 'toast-dot';
      dot.setAttribute('aria-hidden', 'true');

      var text = document.createElement('span');
      text.textContent = message;

      toast.appendChild(dot);
      toast.appendChild(text);
      region.appendChild(toast);

      requestAnimationFrame(function () {
        toast.classList.add('is-visible');
      });

      hideTimer = setTimeout(function () {
        toast.classList.remove('is-visible');
        setTimeout(function () {
          if (toast.parentNode === region) region.removeChild(toast);
        }, 260);
      }, 2600);
    };
  })();

  var copyButtons = Array.prototype.slice.call(document.querySelectorAll('[data-copy-email]'));
  var copyFeedbackTimer = 0;

  function setCopiedVisual() {
    clearTimeout(copyFeedbackTimer);
    copyButtons.forEach(function (btn) {
      btn.classList.add('is-copied');
      var label = btn.querySelector('[data-copy-label]');
      if (label) label.textContent = 'Copied';
    });
    copyFeedbackTimer = setTimeout(function () {
      copyButtons.forEach(function (btn) {
        btn.classList.remove('is-copied');
        var label = btn.querySelector('[data-copy-label]');
        if (label) label.textContent = 'Copy Email';
      });
    }, 1600);
  }

  function copyPlainText(text, onDone) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          if (onDone) onDone();
        },
        function () {
          fallbackCopyText(text, onDone);
        }
      );
    } else {
      fallbackCopyText(text, onDone);
    }
  }

  function fallbackCopyText(text, onDone) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch (e) {}
    document.body.removeChild(ta);
    if (onDone) onDone();
  }

  function copyEmail(email) {
    var addr = email || 'a160130k@gmail.com';
    playTick('open');
    setCopiedVisual();
    copyPlainText(addr, function () {
      showToast('Email copied · ' + addr);
    });
  }

  copyButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      copyEmail(btn.getAttribute('data-email'));
    });
  });

  /* 9. 微信二维码弹窗 */
  var openWechatModal = function () {};
  (function () {
    var modal = document.getElementById('wechat-modal');
    if (!modal || typeof modal.showModal !== 'function') return;

    openWechatModal = function () {
      if (!modal.open) modal.showModal();
      playTick('open');
    };

    document.querySelectorAll('[data-wechat-open]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        openWechatModal();
      });
    });

    document.querySelectorAll('[data-wechat-close]').forEach(function (el) {
      el.addEventListener('click', function () {
        modal.close();
      });
    });

    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.close();
    });
  })();

  /* 10. ⌘K 命令面板 */
  (function () {
    var modal = document.getElementById('cmdk-modal');
    var input = document.getElementById('cmdk-input');
    var list = document.getElementById('cmdk-list');
    if (!modal || !input || !list || typeof modal.showModal !== 'function') return;

    var isMac = /Mac|iPod|iPhone|iPad/i.test(navigator.platform || '');
    document.querySelectorAll('[data-cmdk-kbd]').forEach(function (kbd) {
      kbd.textContent = isMac ? '⌘K' : 'Ctrl K';
    });

    function themeLabel() {
      var t = document.documentElement.getAttribute('data-theme');
      return t === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode';
    }

    function soundLabel() {
      var sBtn = document.getElementById('sound-toggle');
      return sBtn && sBtn.getAttribute('aria-pressed') === 'true'
        ? 'Mute Tactile Sound'
        : 'Enable Tactile Sound';
    }

    function pubsLabel() {
      return isAllPubsShown() ? 'Show Selected Publications (2)' : 'Show All Publications (3)';
    }

    var commands = [
      {
        group: 'Actions',
        title: 'Copy Email Address',
        hint: 'a160130k@gmail.com',
        shortcut: 'E',
        keywords: 'email mail contact copy',
        run: function () {
          copyEmail('a160130k@gmail.com');
        }
      },
      {
        group: 'Actions',
        title: 'Open Curriculum Vitae (PDF)',
        hint: 'assets/Feiyang_Liu_CV.pdf',
        shortcut: '↗',
        keywords: 'cv resume pdf',
        run: function () {
          window.open('assets/Feiyang_Liu_CV.pdf', '_blank', 'noopener');
        }
      },
      {
        group: 'Actions',
        title: 'Replay Avatar Ellipse Fitting',
        hint: '0 → 72 ellipses',
        keywords: 'avatar ellipse fit replay primitive l2',
        run: function () {
          jumpTo('#about');
          document.dispatchEvent(new CustomEvent('gaussian:perturb'));
          replayAvatarFit();
        }
      },
      {
        group: 'Actions',
        id: 'cmd-pubs',
        title: pubsLabel(),
        hint: '#publications',
        keywords: 'publications filter all selected papers',
        run: function () {
          showAllPubs(!isAllPubsShown());
          jumpTo('#publications');
        }
      },
      {
        group: 'Actions',
        id: 'cmd-sound',
        title: soundLabel(),
        hint: 'Web Audio feedback',
        keywords: 'sound audio mute tick tactile',
        run: function () {
          var sBtn = document.getElementById('sound-toggle');
          if (sBtn) sBtn.click();
        }
      },
      {
        group: 'Actions',
        id: 'cmd-theme',
        title: themeLabel(),
        hint: 'Obsidian Dark / Alabaster Light',
        shortcut: 'T',
        keywords: 'theme dark light appearance mode',
        run: function () {
          document.dispatchEvent(new CustomEvent('theme:toggle'));
        }
      },
      {
        group: 'Actions',
        title: 'Show WeChat QR Code',
        hint: 'ID: ZaychikLiu',
        shortcut: 'W',
        keywords: 'wechat qr contact',
        run: function () {
          openWechatModal();
        }
      },
      {
        group: 'Navigate',
        title: 'About & Research Focus',
        hint: '#about',
        keywords: 'about bio research focus craft lab',
        run: function () {
          jumpTo('#about');
        }
      },
      {
        group: 'Navigate',
        title: 'News',
        hint: '#news',
        keywords: 'news updates pixelbench cags',
        run: function () {
          jumpTo('#news');
        }
      },
      {
        group: 'Navigate',
        title: 'Publications',
        hint: '#publications',
        keywords: 'papers publications pixelbench cags counterfactual 3dgs',
        run: function () {
          jumpTo('#publications');
        }
      },
      {
        group: 'Navigate',
        title: 'Experience',
        hint: '#experience',
        keywords: 'experience ucsc gemini cuhk seed hust',
        run: function () {
          jumpTo('#experience');
        }
      },
      {
        group: 'Navigate',
        title: 'Ongoing Projects',
        hint: '#ongoing',
        keywords: 'ongoing projects umm tpu perception video',
        run: function () {
          expandOngoing();
          jumpTo('#ongoing');
        }
      },
      {
        group: 'Navigate',
        title: 'Education',
        hint: '#education',
        keywords: 'education scut berkeley',
        run: function () {
          jumpTo('#education');
        }
      },
      {
        group: 'Navigate',
        title: 'Writing & Essays',
        hint: '#blog',
        keywords: 'blog essays writing articles',
        run: function () {
          jumpTo('#blog');
        }
      },
      {
        group: 'Navigate',
        title: 'People',
        hint: '#people',
        keywords: 'people inspirations mentors',
        run: function () {
          jumpTo('#people');
        }
      },
      {
        group: 'Writing',
        title: '0.6B模型能解决千禧年难题吗？',
        hint: 'Oct 2026 · Essay',
        keywords: 'millennium prize symbolic vision pixelbench',
        run: function () {
          location.href = 'blog/2026/millennium-prize/';
        }
      },
      {
        group: 'Writing',
        title: '3D更应该定位为交互手段而非通用智能',
        hint: 'Aug 2026 · Essay',
        keywords: '3d interface world model',
        run: function () {
          location.href = 'blog/2026/3d-as-interface/';
        }
      },
      {
        group: 'Writing',
        title: '警惕 Vision Centric',
        hint: 'Jul 2026 · Essay',
        keywords: 'rethinking vision centric multimodal',
        run: function () {
          location.href = 'blog/2026/rethinking-vision-centric/';
        }
      },
      {
        group: 'Writing',
        title: 'Vision之外 / Beyond Vision',
        hint: 'Jul 2026 · Essay',
        keywords: 'beyond vision ego taste academia industry',
        run: function () {
          location.href = 'blog/2026/beyond-vision/';
        }
      },
      {
        group: 'Profiles',
        title: 'Google Scholar',
        hint: 'scholar.google.com',
        shortcut: '↗',
        keywords: 'scholar citations papers',
        run: function () {
          window.open('https://scholar.google.com/citations?user=md3YPrAAAAAJ', '_blank', 'noopener');
        }
      },
      {
        group: 'Profiles',
        title: 'GitHub',
        hint: '@ZaychikLiu',
        shortcut: '↗',
        keywords: 'github code repos',
        run: function () {
          window.open('https://github.com/ZaychikLiu', '_blank', 'noopener');
        }
      },
      {
        group: 'Profiles',
        title: 'X (Twitter)',
        hint: '@ZaychikLFY',
        shortcut: '↗',
        keywords: 'twitter x social',
        run: function () {
          window.open('https://x.com/ZaychikLFY', '_blank', 'noopener');
        }
      },
      {
        group: 'Profiles',
        title: 'Xiaohongshu',
        hint: 'Profile',
        shortcut: '↗',
        keywords: 'xiaohongshu rednote',
        run: function () {
          window.open('https://www.xiaohongshu.com/user/profile/62a32fde000000001b02936e', '_blank', 'noopener');
        }
      }
    ];

    function jumpTo(hash) {
      var target = document.querySelector(hash);
      if (target) {
        target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
        history.replaceState(null, '', hash);
      }
    }

    var filtered = commands.slice();
    var activeIndex = 0;

    function render(query) {
      var q = (query || '').trim().toLowerCase();
      var themeCmd = commands.filter(function (c) {
        return c.id === 'cmd-theme';
      })[0];
      if (themeCmd) themeCmd.title = themeLabel();

      var soundCmd = commands.filter(function (c) {
        return c.id === 'cmd-sound';
      })[0];
      if (soundCmd) soundCmd.title = soundLabel();

      var pubsCmd = commands.filter(function (c) {
        return c.id === 'cmd-pubs';
      })[0];
      if (pubsCmd) pubsCmd.title = pubsLabel();

      filtered = !q
        ? commands.slice()
        : commands.filter(function (c) {
            var hay = (c.title + ' ' + c.hint + ' ' + c.group + ' ' + (c.keywords || '')).toLowerCase();
            return hay.indexOf(q) !== -1;
          });

      activeIndex = 0;
      list.innerHTML = '';

      if (!filtered.length) {
        var empty = document.createElement('div');
        empty.className = 'cmdk-empty';
        empty.textContent = 'No matching commands.';
        list.appendChild(empty);
        return;
      }

      var lastGroup = '';
      filtered.forEach(function (cmd, idx) {
        if (cmd.group !== lastGroup) {
          var groupEl = document.createElement('div');
          groupEl.className = 'cmdk-group';
          groupEl.textContent = cmd.group;
          list.appendChild(groupEl);
          lastGroup = cmd.group;
        }

        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'cmdk-item' + (idx === activeIndex ? ' is-active' : '');
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', String(idx === activeIndex));
        item.dataset.idx = String(idx);

        var title = document.createElement('span');
        title.className = 'cmdk-item-title';
        title.textContent = cmd.title;

        var right = document.createElement('span');
        right.className = 'cmdk-item-meta';

        var hint = document.createElement('span');
        hint.className = 'cmdk-item-hint';
        hint.textContent = cmd.hint;
        right.appendChild(hint);

        if (cmd.shortcut) {
          var kbd = document.createElement('kbd');
          kbd.className = 'cmdk-item-kbd';
          kbd.textContent = cmd.shortcut;
          right.appendChild(kbd);
        }

        item.appendChild(title);
        item.appendChild(right);

        item.addEventListener('mouseenter', function () {
          setActive(idx);
        });
        item.addEventListener('click', function () {
          execute(idx);
        });

        list.appendChild(item);
      });
    }

    function setActive(idx) {
      if (!filtered.length) return;
      activeIndex = (idx + filtered.length) % filtered.length;
      var items = list.querySelectorAll('.cmdk-item');
      items.forEach(function (el, i) {
        var active = i === activeIndex;
        el.classList.toggle('is-active', active);
        el.setAttribute('aria-selected', String(active));
        if (active) el.scrollIntoView({ block: 'nearest' });
      });
    }

    function execute(idx) {
      var cmd = filtered[idx];
      if (!cmd) return;
      modal.close();
      cmd.run();
    }

    function openCmdk() {
      input.value = '';
      render('');
      if (!modal.open) modal.showModal();
      input.focus();
      playTick('open');
    }

    document.querySelectorAll('[data-cmdk-open]').forEach(function (btn) {
      btn.addEventListener('click', openCmdk);
    });

    document.querySelectorAll('[data-cmdk-close]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        modal.close();
      });
    });

    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.close();
    });

    input.addEventListener('input', function () {
      render(input.value);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(activeIndex + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(activeIndex - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        execute(activeIndex);
      }
    });

    document.addEventListener('themechange', function () {
      if (modal.open) render(input.value);
    });

    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (modal.open) modal.close();
        else openCmdk();
        return;
      }

      var target = e.target;
      var isInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isInput || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('dialog[open]')) return;

      var key = e.key.toLowerCase();
      if (key === 'e') {
        e.preventDefault();
        copyEmail('a160130k@gmail.com');
      } else if (key === 't') {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('theme:toggle'));
      }
    });
  })();

  /* 11. 顶栏磁吸滑动胶囊、滚动进度细线 & 导航高亮 */
  (function () {
    var header = document.querySelector('.site-header');
    var progressBar = document.getElementById('scroll-progress');
    var nav = document.querySelector('.header-nav');
    var pill = nav ? nav.querySelector('.header-nav-pill') : null;
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('.header-nav a[href^="#"]'));
    var sections = navLinks
      .map(function (link) {
        var el = document.getElementById(link.getAttribute('href').slice(1));
        return el ? { link: link, el: el } : null;
      })
      .filter(Boolean);

    var hoveredLink = null;
    var activeLink = navLinks[0] || null;

    function movePillTo(target) {
      if (!nav || !pill || !target || !target.offsetWidth) return;
      pill.style.width = target.offsetWidth + 'px';
      pill.style.transform = 'translateX(' + target.offsetLeft + 'px)';
      nav.classList.add('has-pill');
    }

    navLinks.forEach(function (link) {
      link.addEventListener('pointerenter', function () {
        hoveredLink = link;
        movePillTo(link);
      });
    });

    if (nav) {
      nav.addEventListener('pointerleave', function () {
        hoveredLink = null;
        if (activeLink) movePillTo(activeLink);
      });
    }

    function onScroll() {
      var y = window.scrollY || window.pageYOffset;
      if (header) header.classList.toggle('is-scrolled', y > 12);

      if (progressBar) {
        var maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
        var ratio = Math.min(Math.max(y / maxScroll, 0), 1);
        progressBar.style.transform = 'scaleX(' + ratio.toFixed(4) + ')';
      }

      if (!sections.length) return;
      var active = sections[0];
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].el.getBoundingClientRect().top <= 140) {
          active = sections[i];
        } else {
          break;
        }
      }
      if (window.innerHeight + y >= document.documentElement.scrollHeight - 4) {
        active = sections[sections.length - 1];
      }

      activeLink = active ? active.link : null;
      navLinks.forEach(function (link) {
        link.classList.toggle('is-active', link === activeLink);
      });
      if (!hoveredLink && activeLink) {
        movePillTo(activeLink);
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener(
      'resize',
      function () {
        onScroll();
        if (hoveredLink || activeLink) movePillTo(hoveredLink || activeLink);
      },
      { passive: true }
    );
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (activeLink) movePillTo(hoveredLink || activeLink);
      });
    }
    onScroll();
  })();

  /* 12. 广州实时时钟 & 页脚微像素彩蛋 */
  (function () {
    var clockEl = document.getElementById('live-clock');
    if (clockEl) {
      function updateClock() {
        try {
          var fmt = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Shanghai',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
          clockEl.textContent = 'Guangzhou · ' + fmt.format(new Date()) + ' CST';
        } catch (e) {
          clockEl.textContent = 'Guangzhou · CST';
        }
      }
      updateClock();
      setInterval(updateClock, 30000);
    }

    var grid = document.getElementById('pixel-artifact');
    if (grid) {
      var palette = [
        'rgba(201, 165, 74, 0.72)',
        'rgba(142, 154, 75, 0.72)',
        'rgba(180, 167, 238, 0.72)',
        'rgba(216, 178, 99, 0.68)',
        'rgba(143, 179, 105, 0.68)',
        'rgba(142, 90, 110, 0.72)'
      ];
      var initialPattern = [
        1, 0, 2, 0, 1, 3, 0, 4, 2, 0,
        0, 3, 4, 1, 0, 2, 5, 1, 0, 3,
        2, 0, 1, 5, 3, 0, 4, 0, 2, 1
      ];
      var cellStates = [];
      for (var i = 0; i < 30; i++) {
        var cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'pixel-cell';
        cell.setAttribute('aria-label', 'Symbolic pixel cell ' + (i + 1));
        var initVal = initialPattern[i] > 0 ? initialPattern[i] % palette.length : -1;
        cellStates.push(initVal);

        (function (c, idx) {
          function applyState(state) {
            cellStates[idx] = state;
            if (state >= 0) {
              c.style.setProperty('--cell-color', palette[state]);
              c.classList.add('is-lit');
            } else {
              c.classList.remove('is-lit');
              c.style.removeProperty('--cell-color');
            }
          }

          applyState(cellStates[idx]);

          c.addEventListener('pointerenter', function () {
            if (cellStates[idx] >= 0) {
              applyState((cellStates[idx] + 1) % palette.length);
            }
          });

          c.addEventListener('click', function () {
            if (cellStates[idx] >= 0) {
              applyState(-1);
            } else {
              applyState(idx % palette.length);
            }
            playTick('pixel');
          });
        })(cell, i);
        grid.appendChild(cell);
      }
    }
  })();

  /* 13. 滚动渐显（仅首屏下方章节，低开销） */
  (function () {
    var reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if (!reveals.length) return;

    if (reducedMotion || typeof IntersectionObserver !== 'function') {
      reveals.forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -24px 0px' }
    );

    reveals.forEach(function (el) {
      io.observe(el);
    });
  })();
})();
