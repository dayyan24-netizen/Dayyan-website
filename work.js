/* ─── WORK PAGE — FILTER LOGIC ──────────────────────────────────────────────── */

(function() {
  'use strict';

  var filters = document.querySelectorAll('.work-filter');
  var cards   = document.querySelectorAll('.work-grid .work-card');
  var empty   = document.getElementById('work-empty');

  if (!filters.length) return;

  function applyFilter(category) {
    var visible = 0;

    for (var i = 0; i < cards.length; i++) {
      var cardCats = cards[i].getAttribute('data-category') || '';
      var show = category === 'all' || cardCats.indexOf(category) !== -1;
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
  }

  for (var j = 0; j < filters.length; j++) {
    filters[j].addEventListener('click', function() {
      /* Update active state */
      for (var k = 0; k < filters.length; k++) {
        filters[k].classList.remove('work-filter--active');
        filters[k].setAttribute('aria-selected', 'false');
      }
      this.classList.add('work-filter--active');
      this.setAttribute('aria-selected', 'true');

      /* Apply filter */
      applyFilter(this.getAttribute('data-filter'));
    });
  }

})();
