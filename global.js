/* ─── DAYYAN FUNDI — GLOBAL JS v2 ──────────────────────────────────────────── */

(function() {
  'use strict';

  /* ══════════════════════════════════════════════
     THEME SYSTEM
  ══════════════════════════════════════════════ */
  var THEME_KEY = 'df-theme';
  var root = document.documentElement;

  function getTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);

    /* Update toggle button aria-label */
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');

    /* Update starfield opacity for light mode */
    var canvas = document.getElementById('starfield');
    if (canvas) canvas.style.opacity = theme === 'light' ? '0.2' : '0.55';
  }

  function toggleTheme() {
    var current = root.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  /* Apply on load */
  applyTheme(getTheme());

  /* Wire toggle button */
  document.addEventListener('DOMContentLoaded', function() {
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.addEventListener('click', toggleTheme);
  });

  /* ══════════════════════════════════════════════
     NAV SCROLL STATE
  ══════════════════════════════════════════════ */
  var nav = document.querySelector('.nav');
  if (nav) {
    window.addEventListener('scroll', function() {
      var theme = root.getAttribute('data-theme');
      if (window.scrollY > 40) {
        nav.style.background = theme === 'light'
          ? 'rgba(240,237,232,0.96)'
          : 'rgba(8,8,8,0.95)';
      } else {
        nav.style.background = '';
      }
    }, { passive: true });
  }

  /* ══════════════════════════════════════════════
     MOBILE MENU
  ══════════════════════════════════════════════ */
  var toggle = document.querySelector('.nav__toggle');
  var mobileMenu = document.querySelector('.nav__mobile');

  if (toggle && mobileMenu) {
    toggle.addEventListener('click', function() {
      var open = mobileMenu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
      var spans = toggle.querySelectorAll('span');
      if (open) {
        spans[0].style.transform = 'translateY(6.5px) rotate(45deg)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'translateY(-6.5px) rotate(-45deg)';
      } else {
        spans[0].style.transform = '';
        spans[1].style.opacity = '';
        spans[2].style.transform = '';
      }
    });

    var mobileLinks = mobileMenu.querySelectorAll('a');
    for (var i = 0; i < mobileLinks.length; i++) {
      mobileLinks[i].addEventListener('click', function() {
        mobileMenu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        var spans = toggle.querySelectorAll('span');
        spans[0].style.transform = '';
        spans[1].style.opacity = '';
        spans[2].style.transform = '';
      });
    }
  }

  /* ══════════════════════════════════════════════
     ACTIVE NAV LINK
  ══════════════════════════════════════════════ */
  var currentPage = window.location.pathname.split('/').pop() || 'index.html';
  var navLinks = document.querySelectorAll('.nav__links a, .nav__mobile a');
  for (var j = 0; j < navLinks.length; j++) {
    var href = navLinks[j].getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      navLinks[j].classList.add('active');
    }
  }

  /* ══════════════════════════════════════════════
     SCROLL REVEAL
  ══════════════════════════════════════════════ */
  function initReveal() {
    var elements = document.querySelectorAll('.reveal');
    if (!elements.length) return;

    var observer = new IntersectionObserver(function(entries) {
      for (var k = 0; k < entries.length; k++) {
        if (entries[k].isIntersecting) {
          entries[k].target.classList.add('visible');
        }
      }
    }, { threshold: 0.1 });

    for (var l = 0; l < elements.length; l++) {
      observer.observe(elements[l]);
    }
  }

  /* ══════════════════════════════════════════════
     STARFIELD CANVAS
  ══════════════════════════════════════════════ */
  function initStarfield() {
    var canvas = document.getElementById('starfield');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var stars = [];
    var N = 140;

    function resize() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    for (var i = 0; i < N; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.4 + 0.2,
        dx: (Math.random() - 0.5) * 0.1,
        dy: (Math.random() - 0.5) * 0.1,
        opacity: Math.random() * 0.7 + 0.1,
        twinkle: Math.random() * Math.PI * 2
      });
    }

    var frame = 0;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;
      for (var s = 0; s < stars.length; s++) {
        var star = stars[s];
        /* Gentle twinkle */
        var tw = star.opacity * (0.7 + 0.3 * Math.sin(frame * 0.015 + star.twinkle));
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(245,245,245,' + tw + ')';
        ctx.fill();
        star.x += star.dx;
        star.y += star.dy;
        if (star.x < 0) star.x = canvas.width;
        if (star.x > canvas.width) star.x = 0;
        if (star.y < 0) star.y = canvas.height;
        if (star.y > canvas.height) star.y = 0;
      }
      requestAnimationFrame(draw);
    }
    draw();
  }

  /* ══════════════════════════════════════════════
     CURSOR BLINK (hero)
  ══════════════════════════════════════════════ */
  function initCursor() {
    var cursor = document.querySelector('.hero__cursor');
    if (!cursor) return;
    setInterval(function() {
      cursor.style.opacity = cursor.style.opacity === '0' ? '1' : '0';
    }, 530);
  }

  /* ══════════════════════════════════════════════
     ANIMATED METRIC BARS
     Triggers when .metric-cell__bar-fill enters viewport
  ══════════════════════════════════════════════ */
  function initMetricBars() {
    var bars = document.querySelectorAll('.metric-cell__bar-fill');
    if (!bars.length) return;

    var obs = new IntersectionObserver(function(entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          entries[i].target.style.animation = 'bar-grow 1.4s ease forwards';
          obs.unobserve(entries[i].target);
        }
      }
    }, { threshold: 0.5 });

    for (var i = 0; i < bars.length; i++) {
      bars[i].style.animation = 'none';
      obs.observe(bars[i]);
    }
  }

  /* ══════════════════════════════════════════════
     HUD CORNER BRACKET HOVER ENHANCEMENT
     Already handled in CSS — JS adds data-hud
     attribute to all .card elements automatically
  ══════════════════════════════════════════════ */
  function initHudBrackets() {
    var cards = document.querySelectorAll('.card, .case-study, .proj-entry');
    for (var i = 0; i < cards.length; i++) {
      if (!cards[i].hasAttribute('data-hud')) {
        cards[i].setAttribute('data-hud', '');
      }
    }
  }

  /* ══════════════════════════════════════════════
     INIT ON DOM READY
  ══════════════════════════════════════════════ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initReveal();
      initStarfield();
      initCursor();
      initMetricBars();
      initHudBrackets();
    });
  } else {
    initReveal();
    initStarfield();
    initCursor();
    initMetricBars();
    initHudBrackets();
  }

})();
