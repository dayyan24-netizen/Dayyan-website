/* ─── CHICAGO ENERGY BURDEN MAP ──────────────────────────────────────────────
   Reads tract data published by the research pipeline on GitHub, so the map
   updates whenever the analysis reruns. Falls back to a local copy.
   Legacy-compatible JavaScript: var, function expressions, plain loops.
──────────────────────────────────────────────────────────────────────────── */

(function() {
  'use strict';

  var REMOTE = 'https://raw.githubusercontent.com/fundidayyan-afk/Chicago-Energy-Burden/main/output/web/';
  var LOCAL = 'assets/data/energy-burden/';

  var REDS = ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'];
  var BLUES = ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'];

  var CLUSTERS = [
    { key: 'High-High', label: 'High-burden cluster', color: '#C1121F' },
    { key: 'Low-Low', label: 'Low-burden cluster', color: '#3B82C4' },
    { key: 'High-Low', label: 'High tract, low neighbors', color: '#F4A582' },
    { key: 'Low-High', label: 'Low tract, high neighbors', color: '#9CC3E6' },
    { key: 'Not significant', label: 'Not significant', color: '#8A8A8A' }
  ];

  var LAYERS = {
    burden: {
      note: 'Total energy spending divided by total household income, by census tract.',
      title: 'Energy burden', format: 'pct', colors: REDS, breaks: 'quantile'
    },
    cluster: {
      note: 'Tracts whose burden is significantly like their neighbors’ (local Moran’s I, 5% false discovery rate).',
      title: 'Burden clusters', categorical: true
    },
    li_burden: {
      note: 'Energy burden for households earning below 80% of area median income. 6% is the usual "high burden" line.',
      title: 'Low-income burden', format: 'pct', colors: REDS, breaks: [4, 6, 8, 10]
    },
    share10: {
      note: 'Share of households in income groups whose average burden is above 10%. A lower bound.',
      title: 'Households above 10%', format: 'share', colors: REDS, breaks: 'quantile'
    },
    cost: {
      note: 'Average yearly electricity, gas, and other fuel spending per household.',
      title: 'Yearly energy cost', format: 'dollars', colors: REDS, breaks: 'quantile'
    },
    income: {
      note: 'Median household income (ACS 2018-2022). Compare with the burden map.',
      title: 'Median income', format: 'dollars', colors: BLUES, breaks: 'quantile'
    }
  };

  var map, tiles, geo, data, current = 'burden', pinned = null, cuts = {};

  /* ── formatting ───────────────────────────────────────────────── */
  function fmt(v, kind) {
    if (v === null || v === undefined || isNaN(v)) return 'n/a';
    if (kind === 'pct') return v.toFixed(1) + '%';
    if (kind === 'share') return Math.round(v * 100) + '%';
    if (kind === 'dollars') return '$' + Math.round(v).toLocaleString('en-US');
    if (kind === 'int') return Math.round(v).toLocaleString('en-US');
    return String(v);
  }

  function quantileBreaks(values, n) {
    var sorted = values.slice().sort(function(a, b) { return a - b; });
    var out = [];
    for (var i = 1; i < n; i++) {
      out.push(sorted[Math.floor(i * sorted.length / n)]);
    }
    return out;
  }

  function computeBreaks() {
    for (var key in LAYERS) {
      if (!LAYERS.hasOwnProperty(key) || LAYERS[key].categorical) continue;
      var layer = LAYERS[key];
      if (layer.breaks !== 'quantile') { cuts[key] = layer.breaks; continue; }
      var vals = [];
      for (var i = 0; i < data.features.length; i++) {
        var v = data.features[i].properties[key];
        if (v !== null && !isNaN(v)) vals.push(v);
      }
      cuts[key] = quantileBreaks(vals, layer.colors.length);
    }
  }

  function colorFor(props) {
    var layer = LAYERS[current];
    if (layer.categorical) {
      for (var c = 0; c < CLUSTERS.length; c++) {
        if (CLUSTERS[c].key === props.cluster) return CLUSTERS[c].color;
      }
      return '#8A8A8A';
    }
    var v = props[current];
    if (v === null || isNaN(v)) return 'transparent';
    var b = cuts[current];
    for (var i = 0; i < b.length; i++) {
      if (v < b[i]) return layer.colors[i];
    }
    return layer.colors[layer.colors.length - 1];
  }

  function isDark() {
    return document.documentElement.getAttribute('data-theme') !== 'light';
  }

  function styleFor(feature) {
    var ns = LAYERS[current].categorical && feature.properties.cluster === 'Not significant';
    return {
      fillColor: colorFor(feature.properties),
      fillOpacity: ns ? 0.12 : 0.78,
      color: isDark() ? 'rgba(8,8,8,0.6)' : 'rgba(255,255,255,0.8)',
      weight: 0.6
    };
  }

  /* ── legend ───────────────────────────────────────────────────── */
  function renderLegend() {
    var el = document.getElementById('eb-legend');
    var layer = LAYERS[current];
    var html = '<div class="eb-legend__title">' + layer.title + '</div><ul class="eb-legend__list">';
    if (layer.categorical) {
      for (var c = 0; c < CLUSTERS.length; c++) {
        html += '<li><span class="eb-swatch" style="background:' + CLUSTERS[c].color +
          (CLUSTERS[c].key === 'Not significant' ? ';opacity:0.35' : '') + '"></span>' + CLUSTERS[c].label + '</li>';
      }
    } else {
      var b = cuts[current];
      for (var i = 0; i < layer.colors.length; i++) {
        var label;
        if (i === 0) label = 'Under ' + fmt(b[0], layer.format);
        else if (i === layer.colors.length - 1) label = fmt(b[b.length - 1], layer.format) + ' and above';
        else label = fmt(b[i - 1], layer.format) + ' to ' + fmt(b[i], layer.format);
        html += '<li><span class="eb-swatch" style="background:' + layer.colors[i] + '"></span>' + label + '</li>';
      }
    }
    el.innerHTML = html + '</ul>';
  }

  /* ── readout panel ────────────────────────────────────────────── */
  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function showTract(p) {
    document.getElementById('eb-panel-empty').hidden = true;
    document.getElementById('eb-panel-body').hidden = false;
    var label = 'NOT IN A SIGNIFICANT CLUSTER';
    for (var c = 0; c < CLUSTERS.length; c++) {
      if (CLUSTERS[c].key === p.cluster && p.cluster !== 'Not significant') label = CLUSTERS[c].label.toUpperCase();
    }
    setText('eb-p-cluster', label);
    setText('eb-p-name', p.name);
    setText('eb-p-burden', fmt(p.burden, 'pct'));
    setText('eb-p-li', fmt(p.li_burden, 'pct') + ' burden');
    setText('eb-p-share10', fmt(p.share10, 'share') + ' (at least)');
    setText('eb-p-cost', fmt(p.cost, 'dollars'));
    setText('eb-p-income', fmt(p.income, 'dollars'));
    setText('eb-p-race', fmt(p.black, 'pct') + ' / ' + fmt(p.hispanic, 'pct'));
    setText('eb-p-pre1950', fmt(p.pre1950, 'pct'));
    setText('eb-p-renter', fmt(p.renter, 'pct'));
    setText('eb-p-hh', fmt(p.households, 'int'));
  }

  /* ── map ──────────────────────────────────────────────────────── */
  function tileUrl() {
    return isDark()
      ? 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png';
  }

  function labelUrl() {
    return isDark()
      ? 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png';
  }

  var labels;

  function buildMap() {
    /* On phones, one finger scrolls the page; pinch still zooms the map. */
    map = L.map('eb-map', { scrollWheelZoom: false, zoomSnap: 0.25, attributionControl: true,
      dragging: !L.Browser.mobile, tap: !L.Browser.mobile });
    var attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
    tiles = L.tileLayer(tileUrl(), { attribution: attribution, subdomains: 'abcd', maxZoom: 16 }).addTo(map);

    map.createPane('labels');
    map.getPane('labels').style.zIndex = 650;
    map.getPane('labels').style.pointerEvents = 'none';
    labels = L.tileLayer(labelUrl(), { subdomains: 'abcd', maxZoom: 16, pane: 'labels' }).addTo(map);

    geo = L.geoJSON(data, {
      style: styleFor,
      onEachFeature: function(feature, layer) {
        layer.on({
          mouseover: function(e) {
            if (pinned) return;
            highlight(e.target);
            showTract(feature.properties);
          },
          mouseout: function(e) {
            if (pinned) return;
            geo.resetStyle(e.target);
          },
          click: function(e) {
            if (pinned) geo.resetStyle(pinned);
            pinned = (pinned === e.target) ? null : e.target;
            if (pinned) { highlight(pinned); showTract(feature.properties); }
          }
        });
      }
    }).addTo(map);

    map.fitBounds(geo.getBounds(), { padding: [10, 10] });

    /* Enable scroll zoom only after the visitor clicks into the map */
    map.on('click', function() { map.scrollWheelZoom.enable(); });
    map.on('mouseout', function() { map.scrollWheelZoom.disable(); });
  }

  function highlight(layer) {
    layer.setStyle({ weight: 2.5, color: isDark() ? '#F5F5F5' : '#141414' });
    layer.bringToFront();
  }

  function switchLayer(key) {
    current = key;
    pinned = null;
    geo.setStyle(styleFor);
    renderLegend();
    setText('eb-layer-note', LAYERS[key].note);
    var buttons = document.querySelectorAll('.eb-layer');
    for (var i = 0; i < buttons.length; i++) {
      var on = buttons[i].getAttribute('data-layer') === key;
      buttons[i].className = 'eb-layer' + (on ? ' is-active' : '');
      buttons[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
  }

  function watchTheme() {
    if (!window.MutationObserver) return;
    var obs = new MutationObserver(function() {
      tiles.setUrl(tileUrl());
      labels.setUrl(labelUrl());
      geo.setStyle(styleFor);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  /* ── data loading (remote first, local copy as fallback) ──────── */
  function getJSON(urls, done, fail) {
    var i = 0;
    function next() {
      if (i >= urls.length) { if (fail) fail(); return; }
      var url = urls[i++];
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { done(JSON.parse(xhr.responseText)); return; } catch (e) { /* try next */ }
        }
        next();
      };
      xhr.onerror = next;
      xhr.send();
    }
    next();
  }

  function applySummary(s) {
    var els = document.querySelectorAll('[data-stat]');
    for (var i = 0; i < els.length; i++) {
      var key = els[i].getAttribute('data-stat');
      if (s[key] === undefined) continue;
      var suffix = els[i].getAttribute('data-suffix') || '';
      var decimals = els[i].getAttribute('data-decimals');
      var value = s[key];
      if (typeof value === 'number') {
        value = decimals !== null ? value.toFixed(parseInt(decimals, 10)) : value.toLocaleString('en-US');
      }
      els[i].textContent = value + suffix;
    }
    if (s.updated) setText('eb-updated', 'Data refreshed ' + s.updated + '.');
  }

  function showError() {
    var el = document.getElementById('eb-map');
    el.innerHTML = '<p class="eb-map__error">The map data could not be loaded right now. ' +
      'You can see the full results on <a href="https://github.com/fundidayyan-afk/Chicago-Energy-Burden/blob/main/output/RESULTS.md">GitHub</a>.</p>';
  }

  document.addEventListener('DOMContentLoaded', function() {
    var buttons = document.querySelectorAll('.eb-layer');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function() {
        switchLayer(this.getAttribute('data-layer'));
      });
    }

    getJSON([REMOTE + 'summary.json', LOCAL + 'summary.json'], applySummary);

    if (typeof L === 'undefined') { showError(); return; }
    getJSON([REMOTE + 'tracts.geojson', LOCAL + 'tracts.geojson'], function(json) {
      data = json;
      computeBreaks();
      buildMap();
      renderLegend();
      watchTheme();
    }, showError);
  });
})();
