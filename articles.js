/* ─── ARTICLES PAGE — FILTER LOGIC ─────────────────────────────────────────── */

(function() {
  'use strict';

  var filters = document.querySelectorAll('.art-filter');
  var cards   = document.querySelectorAll('.art-grid .art-card');
  var empty   = document.getElementById('art-empty');

  if (!filters.length) return;

  function applyFilter(category) {
    var visible = 0;

    for (var i = 0; i < cards.length; i++) {
      var cats = (cards[i].getAttribute('data-category') || '').split(' ');
      var show = category === 'all';
      if (!show) {
        for (var j = 0; j < cats.length; j++) {
          if (cats[j] === category) { show = true; break; }
        }
      }
      if (show) {
        cards[i].classList.remove('art-card--hidden');
        visible++;
      } else {
        cards[i].classList.add('art-card--hidden');
      }
    }

    if (empty) empty.style.display = visible === 0 ? 'block' : 'none';
  }

  for (var k = 0; k < filters.length; k++) {
    filters[k].addEventListener('click', function() {
      for (var m = 0; m < filters.length; m++) {
        filters[m].classList.remove('art-filter--active');
      }
      this.classList.add('art-filter--active');
      applyFilter(this.getAttribute('data-filter'));
    });
  }

})();
