/* ─── WORK PAGE — FILTER LOGIC ──────────────────────────────────────────────── */

(function() {
  'use strict';

  var filters  = document.querySelectorAll('.work-filter');
  var cards    = document.querySelectorAll('.work-grid .work-card');
  var empty    = document.getElementById('work-empty');
  var grid     = document.getElementById('work-grid');

  if (!filters.length) return;

  function applyFilter(category) {
    var visible = 0;

    for (var i = 0; i < cards.length; i++) {
      var cardCats = (cards[i].getAttribute('data-category') || '').split(' ');
      var show = category === 'all';

      if (!show) {
        for (var j = 0; j < cardCats.length; j++) {
          if (cardCats[j] === category) { show = true; break; }
        }
      }

      if (show) {
        cards[i].classList.remove('work-card--hidden');
        visible++;
      } else {
        cards[i].classList.add('work-card--hidden');
      }
    }

    if (empty) {
      empty.style.display = visible === 0 ? 'block' : 'none';
    }

    /* Smooth scroll to the grid so the user sees the filtered results */
    if (grid && category !== 'all') {
      var top = grid.getBoundingClientRect().top + window.pageYOffset - 100;
      window.scrollTo({ top: top, behavior: 'smooth' });
    }
  }

  for (var k = 0; k < filters.length; k++) {
    filters[k].addEventListener('click', function() {
      /* Update active state */
      for (var m = 0; m < filters.length; m++) {
        filters[m].classList.remove('work-filter--active');
        filters[m].setAttribute('aria-selected', 'false');
      }
      this.classList.add('work-filter--active');
      this.setAttribute('aria-selected', 'true');

      applyFilter(this.getAttribute('data-filter'));
    });
  }

})();
