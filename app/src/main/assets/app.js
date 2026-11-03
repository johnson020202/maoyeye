(function () {
  'use strict';

  var cards = window.MAO_CARDS || [];
  var articles = window.MAO_ARTICLES || [];
  if (!cards.length || !articles.length) {
    document.body.innerHTML = '<p style="padding:40px;font-size:16px">数据文件缺失：cards.js 未加载。</p>';
    return;
  }

  var storage = null;
  try {
    window.localStorage.setItem('__maoyeye_probe__', '1');
    window.localStorage.removeItem('__maoyeye_probe__');
    storage = window.localStorage;
  } catch (e) {
    storage = null;
  }

  var engine = window.MaoDeck.createEngine({ total: cards.length, storage: storage });

  var cardEl = document.getElementById('card');
  var quoteEl = document.getElementById('quote');
  var attribTitleEl = document.getElementById('attribTitle');
  var attribDateEl = document.getElementById('attribDate');
  var noteEl = document.getElementById('note');
  var noteBlock = document.getElementById('noteBlock');
  var metaEl = document.getElementById('meta');
  var hintEl = document.getElementById('hint');
  var stageEl = document.getElementById('stage');
  var portraitEl = document.getElementById('portrait');
  var prevBtn = document.getElementById('prevBtn');
  var nextBtn = document.getElementById('nextBtn');

  var hintTimer = null;

  var versionMatch = /[?&]v=(\d+)/.exec(window.location.search || '');
  var webVersion = versionMatch ? parseInt(versionMatch[1], 10) : 0;

  if (window.document && document.fonts && document.fonts.load) {
    document.fonts.load('16px "Smiley Sans"').catch(function () {});
  }

  function defaultHint() {
    return '左右滑动 · 共 ' + cards.length.toLocaleString('en-US') + ' 条';
  }
  hintEl.textContent = defaultHint();

  // 编者注只保留第一句，过长时在标点处收口，避免整屏都是背景介绍
  var NOTE_LIMIT = 52;

  function shortNote(text) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    if (t.length <= NOTE_LIMIT) return t;
    var m = t.match(/^[^。！？]{1,90}[。！？]/);
    var first = m ? m[0] : t;
    if (first.length <= NOTE_LIMIT) return first;
    var cut = first.slice(0, NOTE_LIMIT - 1);
    var idx = Math.max(
      cut.lastIndexOf('，'),
      cut.lastIndexOf('、'),
      cut.lastIndexOf('；'),
      cut.lastIndexOf('：')
    );
    if (idx >= 20) cut = cut.slice(0, idx);
    return cut.replace(/[，、；：]$/, '') + '…';
  }

  function metaText() {
    return '已读 ' + engine.historyLength() + ' 条' + (webVersion > 0 ? ' · v' + webVersion : '');
  }

  function flashHint(text) {
    hintEl.textContent = text;
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(function () {
      hintEl.textContent = defaultHint();
    }, 1400);
  }

  function render(id, dir) {
    if (id < 0) return;
    var pair = cards[id];
    var article = articles[pair[1]] || { t: '', d: '', n: '' };

    quoteEl.textContent = pair[0];
    attribTitleEl.textContent = '——《' + article.t + '》';
    attribDateEl.textContent = article.d ? '（' + article.d + '）' : '';
    attribDateEl.style.display = article.d ? '' : 'none';

    var note = shortNote(article.n);
    if (note) {
      noteBlock.style.display = '';
      noteEl.textContent = note;
    } else {
      noteBlock.style.display = 'none';
    }

    metaEl.textContent = metaText();
    prevBtn.disabled = !engine.canPrev();
    cardEl.scrollTop = 0;

    if (dir && cardEl.animate) {
      var dx = dir === 'next' ? 34 : -34;
      cardEl.animate(
        [
          { opacity: 0, transform: 'translateX(' + dx + 'px)' },
          { opacity: 1, transform: 'translateX(0)' }
        ],
        { duration: 230, easing: 'cubic-bezier(.22,.61,.36,1)' }
      );
    }
  }

  function go(dir) {
    if (dir === 'next') {
      render(engine.next(), 'next');
    } else if (engine.canPrev()) {
      render(engine.prev(), 'prev');
    } else {
      flashHint('已经是最早一条了');
    }
  }

  // ---------- 跟手滑动 ----------

  var g = { active: false, sx: 0, sy: 0, dx: 0, axis: null, t0: 0 };
  var mouseDown = false;

  function setDrag(dx) {
    cardEl.style.transition = 'none';
    cardEl.style.transform = 'translateX(' + dx * 0.45 + 'px)';
    cardEl.style.opacity = String(1 - Math.min(Math.abs(dx) / 900, 0.18));
  }

  function snapBack() {
    cardEl.style.transition = 'transform .2s cubic-bezier(.22,.61,.36,1), opacity .2s';
    cardEl.style.transform = 'translateX(0)';
    cardEl.style.opacity = '1';
  }

  function clearDrag() {
    cardEl.style.transition = 'none';
    cardEl.style.transform = 'translateX(0)';
    cardEl.style.opacity = '1';
  }

  function start(x, y) {
    g.active = true;
    g.sx = x;
    g.sy = y;
    g.dx = 0;
    g.axis = null;
    g.t0 = Date.now();
  }

  // 返回 true 表示已判定为横向滑动（调用方应 preventDefault）
  function move(x, y, ev) {
    if (!g.active) return false;
    var dx = x - g.sx;
    var dy = y - g.sy;
    if (g.axis === null && (Math.abs(dx) > 9 || Math.abs(dy) > 9)) {
      g.axis = Math.abs(dx) > Math.abs(dy) * 1.15 ? 'h' : 'v';
    }
    if (g.axis === 'h') {
      g.dx = dx;
      if (ev && ev.cancelable) ev.preventDefault();
      setDrag(dx);
      return true;
    }
    return false;
  }

  function end() {
    if (!g.active) return;
    g.active = false;
    if (g.axis === 'h') {
      var dt = Math.max(1, Date.now() - g.t0);
      var speed = Math.abs(g.dx) / dt;
      if (Math.abs(g.dx) > 54 || speed > 0.5) {
        var dir = g.dx < 0 ? 'next' : 'prev';
        clearDrag();
        go(dir);
        return;
      }
    }
    snapBack();
  }

  stageEl.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    start(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  // 必须 passive:false，横向拖动时要阻止浏览器接管手势
  stageEl.addEventListener('touchmove', function (e) {
    if (e.touches.length !== 1) return;
    move(e.touches[0].clientX, e.touches[0].clientY, e);
  }, { passive: false });

  stageEl.addEventListener('touchend', end, { passive: true });

  stageEl.addEventListener('touchcancel', function () {
    g.active = false;
    snapBack();
  }, { passive: true });

  // 桌面端鼠标拖拽
  stageEl.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    if (e.target && e.target.closest && e.target.closest('button')) return;
    mouseDown = true;
    start(e.clientX, e.clientY);
  });

  window.addEventListener('mousemove', function (e) {
    if (!mouseDown) return;
    if (move(e.clientX, e.clientY, e)) e.preventDefault();
  });

  window.addEventListener('mouseup', function () {
    if (!mouseDown) return;
    mouseDown = false;
    end();
  });

  prevBtn.addEventListener('click', function () { go('prev'); });
  nextBtn.addEventListener('click', function () { go('next'); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') go('prev');
    else if (e.key === 'ArrowRight') go('next');
  });

  portraitEl.addEventListener('error', function () {
    portraitEl.style.display = 'none';
  });

  // 每次打开抽一张新的
  render(engine.open(), null);
})();
