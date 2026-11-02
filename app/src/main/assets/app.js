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
    var probe = '__maoyeye_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    storage = window.localStorage;
  } catch (e) {
    storage = null;
  }

  var engine = window.MaoDeck.createEngine({ total: cards.length, storage: storage });

  var cardEl = document.getElementById('card');
  var quoteEl = document.getElementById('quote');
  var attribEl = document.getElementById('attrib');
  var noteEl = document.getElementById('note');
  var noteWrap = document.getElementById('noteWrap');
  var counterEl = document.getElementById('counter');
  var hintEl = document.getElementById('hint');
  var stageEl = document.getElementById('stage');
  var portraitEl = document.getElementById('portrait');

  var hintShown = false;

  function render(id, dir) {
    if (id < 0) return;
    var pair = cards[id];
    var quote = pair[0];
    var article = articles[pair[1]] || { t: '', d: '', n: '' };

    quoteEl.textContent = quote;
    attribEl.textContent = '——《' + article.t + '》' + (article.d ? '（' + article.d + '）' : '');

    if (article.n) {
      noteWrap.style.display = '';
      noteEl.textContent = article.n;
    } else {
      noteWrap.style.display = 'none';
      noteEl.textContent = '';
    }

    counterEl.textContent = (engine.pos() + 1) + ' / ' + engine.historyLength();
    cardEl.scrollTop = 0;

    if (dir && cardEl.animate) {
      var dx = dir === 'next' ? 36 : -36;
      cardEl.animate(
        [
          { opacity: 0, transform: 'translateX(' + dx + 'px)' },
          { opacity: 1, transform: 'translateX(0)' }
        ],
        { duration: 220, easing: 'cubic-bezier(.22,.61,.36,1)' }
      );
    }
  }

  function go(dir) {
    if (dir === 'next') render(engine.next(), 'next');
    else if (engine.canPrev()) render(engine.prev(), 'prev');
    else {
      hintEl.textContent = '已经是最早一条了';
      setTimeout(function () { hintEl.textContent = '左滑下一条 · 右滑上一条'; }, 1200);
    }
  }

  // 每次打开都抽一张新的
  render(engine.open(), null);

  // 滑动手势：左滑下一条，右滑上一条
  var startX = null, startY = null, tracking = false;
  stageEl.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startX = e.clientX;
    startY = e.clientY;
    tracking = true;
    if (!hintShown) {
      hintShown = true;
      hintEl.textContent = '左滑下一条 · 右滑上一条';
    }
  }, { passive: true });

  stageEl.addEventListener('pointerup', function (e) {
    if (!tracking) return;
    tracking = false;
    var dx = e.clientX - startX;
    var dy = e.clientY - startY;
    if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      go(dx < 0 ? 'next' : 'prev');
    }
  }, { passive: true });

  stageEl.addEventListener('pointercancel', function () { tracking = false; }, { passive: true });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') go('prev');
    else if (e.key === 'ArrowRight') go('next');
  });

  // 头像加载失败时留一个占位，不阻塞阅读
  portraitEl.addEventListener('error', function () {
    portraitEl.style.display = 'none';
  });
})();
