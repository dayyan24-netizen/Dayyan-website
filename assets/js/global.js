/* ─── DAYYAN FUNDI — GLOBAL JS ─────────────────────────────────────────────── */

(function() {
  'use strict';

  /* ── Nav scroll state ── */
  var nav = document.querySelector('.nav');
  if (nav) {
    window.addEventListener('scroll', function() {
      if (window.scrollY > 40) {
        nav.style.background = 'rgba(8,8,8,0.95)';
      } else {
        nav.style.background = 'rgba(8,8,8,0.75)';
      }
    });
  }

  /* ── Mobile menu ── */
  var toggle = document.querySelector('.nav__toggle');
  var mobileMenu = document.querySelector('.nav__mobile');
  if (toggle && mobileMenu) {
    toggle.addEventListener('click', function() {
      mobileMenu.classList.toggle('open');
      var spans = toggle.querySelectorAll('span');
      if (mobileMenu.classList.contains('open')) {
        spans[0].style.transform = 'translateY(6.5px) rotate(45deg)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'translateY(-6.5px) rotate(-45deg)';
      } else {
        spans[0].style.transform = '';
        spans[1].style.opacity = '';
        spans[2].style.transform = '';
      }
    });

    /* Close mobile menu on link click */
    var mobileLinks = mobileMenu.querySelectorAll('a');
    for (var i = 0; i < mobileLinks.length; i++) {
      mobileLinks[i].addEventListener('click', function() {
        mobileMenu.classList.remove('open');
        var spans = toggle.querySelectorAll('span');
        spans[0].style.transform = '';
        spans[1].style.opacity = '';
        spans[2].style.transform = '';
      });
    }
  }

  /* ── Active nav link based on current page ── */
  var currentPage = window.location.pathname.split('/').pop() || 'index.html';
  var navLinks = document.querySelectorAll('.nav__links a, .nav__mobile a');
  for (var j = 0; j < navLinks.length; j++) {
    var href = navLinks[j].getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      navLinks[j].classList.add('active');
    }
  }

  /* ── Scroll reveal ── */
  function initReveal() {
    var elements = document.querySelectorAll('.reveal');
    if (!elements.length) return;

    var observer = new IntersectionObserver(function(entries) {
      for (var k = 0; k < entries.length; k++) {
        if (entries[k].isIntersecting) {
          entries[k].target.classList.add('visible');
        }
      }
    }, { threshold: 0.12 });

    for (var l = 0; l < elements.length; l++) {
      observer.observe(elements[l]);
    }
  }

  /* ── Starfield canvas (hero only) ── */
  function initStarfield() {
    var canvas = document.getElementById('starfield');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var stars = [];
    var N = 120;

    function resize() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (var i = 0; i < N; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.2 + 0.2,
        dx: (Math.random() - 0.5) * 0.12,
        dy: (Math.random() - 0.5) * 0.12,
        opacity: Math.random() * 0.6 + 0.1
      });
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (var s = 0; s < stars.length; s++) {
        var star = stars[s];
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(245,245,245,' + star.opacity + ')';
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

  /* ── Typed cursor blink for hero ── */
  function initCursor() {
    var cursor = document.querySelector('.hero__cursor');
    if (!cursor) return;
    setInterval(function() {
      cursor.style.opacity = cursor.style.opacity === '0' ? '1' : '0';
    }, 530);
  }

  /* ── Init on DOM ready ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initReveal();
      initStarfield();
      initCursor();
    });
  } else {
    initReveal();
    initStarfield();
    initCursor();
  }

})();
