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
    },
    mgwr: {
      note: '', title: 'Local effect on burden', diverging: true
    },
    type: {
      note: 'Tracts grouped by k-means clustering on burden, energy costs, income, demographics, and housing. ' +
        'Three types emerged, ordered here from highest to lowest burden.',
      title: 'Neighborhood types', types: true
    }
  };

  var TYPES = [
    { key: 1, label: 'Type 1: high burden, lower income, mostly Black neighborhoods', color: '#a50f15' },
    { key: 2, label: 'Type 2: moderate burden, higher income, more Hispanic residents', color: '#fb6a4a' },
    { key: 3, label: 'Type 3: low burden, large buildings, low bills', color: '#fee5d9' }
  ];

  function mgKey() { return 'mg_' + mgVar; }

  function mgNote() {
    var bw = summary.mgwr_bandwidths ? summary.mgwr_bandwidths[mgVar] : null;
    var scale = bw ? ' It is estimated from each tract\u2019s ' + Math.round(bw) + ' nearest tracts' +
      (bw > 700 ? ', so it is effectively the same citywide.' : (bw < 60 ? ', so it changes from one neighborhood to the next.' : '.')) : '';
    return 'Multiscale geographically weighted regression: how strongly ' + MG_NAMES[mgVar] +
      ' is linked to energy burden in each tract, holding the other factors constant. Red = higher burden, ' +
      'blue = lower; grey = not statistically significant there.' + scale;
  }

  function computeMgCut() {
    var vals = [];
    for (var i = 0; i < data.features.length; i++) {
      var v = data.features[i].properties[mgKey()];
      if (v !== null && v !== undefined && !isNaN(v)) vals.push(Math.abs(v));
    }
    vals.sort(function(a, b) { return a - b; });
    mgCut = vals.length ? vals[Math.floor(vals.length / 2)] : 0;
  }

  var DIVERGING = ['#2166ac', '#92c5de', '#f4a582', '#b2182b'];
  var MG_NAMES = {
    ln_income: 'median income', pct_black: '% Black residents', pct_hispanic: '% Hispanic residents',
    pct_pre1950: '% homes built before 1950', pct_renter: '% renter-occupied',
    pct_multifam5: '% units in large apartment buildings'
  };
  var mgVar = 'ln_income', mgCut = 0, summary = {};

  var map, geo, data, current = 'burden', pinned = null, cuts = {};

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
    if (layer.types) {
      for (var ty = 0; ty < TYPES.length; ty++) {
        if (TYPES[ty].key === props.type) return TYPES[ty].color;
      }
      return '#8A8A8A';
    }
    if (layer.diverging) {
      var m = props[mgKey()];
      if (m === null || m === undefined || isNaN(m)) return '#8A8A8A';
      if (m <= -mgCut) return DIVERGING[0];
      if (m < 0) return DIVERGING[1];
      if (m < mgCut) return DIVERGING[2];
      return DIVERGING[3];
    }
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
    var mv = feature.properties[mgKey()];
    var ns = (LAYERS[current].categorical && feature.properties.cluster === 'Not significant') ||
      (LAYERS[current].diverging && (mv === null || mv === undefined || isNaN(mv)));
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
    if (layer.types) {
      for (var ty = 0; ty < TYPES.length; ty++) {
        html += '<li><span class="eb-swatch" style="background:' + TYPES[ty].color + '"></span>' + TYPES[ty].label + '</li>';
      }
    } else if (layer.diverging) {
      var lab = ['Strongly lowers burden', 'Lowers burden', 'Raises burden', 'Strongly raises burden'];
      for (var d = DIVERGING.length - 1; d >= 0; d--) {
        html += '<li><span class="eb-swatch" style="background:' + DIVERGING[d] + '"></span>' + lab[d] + '</li>';
      }
      html += '<li><span class="eb-swatch" style="background:#8A8A8A;opacity:0.35"></span>Not significant</li>';
    } else if (layer.categorical) {
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
    setText('eb-p-area', p.area ? p.area + ', Chicago' : 'Chicago');
    setText('eb-p-burden', fmt(p.burden, 'pct'));
    setText('eb-p-li', fmt(p.li_burden, 'pct') + ' burden');
    setText('eb-p-share10', fmt(p.share10, 'share') + ' (at least)');
    setText('eb-p-cost', fmt(p.cost, 'dollars'));
    setText('eb-p-income', fmt(p.income, 'dollars'));
    setText('eb-p-race', fmt(p.black, 'pct') + ' / ' + fmt(p.hispanic, 'pct'));
    setText('eb-p-pre1950', fmt(p.pre1950, 'pct'));
    setText('eb-p-renter', fmt(p.renter, 'pct'));
    setText('eb-p-hh', fmt(p.households, 'int'));
    setText('eb-p-type', p.type ? 'Type ' + p.type : 'n/a');
    var row = document.getElementById('eb-p-mg-row');
    if (current === 'mgwr') {
      var mv = p[mgKey()];
      row.hidden = false;
      setText('eb-p-mg-label', 'Local effect of ' + MG_NAMES[mgVar]);
      setText('eb-p-mg', (mv === null || mv === undefined || isNaN(mv)) ? 'not significant' :
        (mv > 0 ? '+' : '') + mv.toFixed(2) + ' SD');
    } else {
      row.hidden = true;
    }
  }

  /* ── map ──────────────────────────────────────────────────────
     No third-party tiles: the background is drawn from public
     boundary files (Lake Michigan, city limits, community areas). */
  var water, city, areas, areaLabels = [], sideLabels = [];

  var SIDES = [
    { name: 'North Side', lat: 41.952, lng: -87.705 },
    { name: 'Northwest Side', lat: 41.958, lng: -87.80, minor: true },
    { name: 'West Side', lat: 41.872, lng: -87.735 },
    { name: 'Downtown', lat: 41.884, lng: -87.628 },
    { name: 'Southwest Side', lat: 41.790, lng: -87.725, minor: true },
    { name: 'South Side', lat: 41.790, lng: -87.615 },
    { name: 'Far South Side', lat: 41.690, lng: -87.630 },
    { name: "O'Hare", lat: 41.979, lng: -87.905 }
  ];

  function palette() {
    return isDark()
      ? { water: '#0e2233', waterLine: '#1d3a52', lakeText: '#4f7da3', area: 'rgba(245,245,245,0.28)', city: '#F5F5F5' }
      : { water: '#c9dcea', waterLine: '#9fbfd6', lakeText: '#4b7598', area: 'rgba(20,20,20,0.30)', city: '#141414' };
  }

  function label(text, lat, lng, cls) {
    return L.marker([lat, lng], {
      interactive: false, keyboard: false,
      icon: L.divIcon({ className: 'eb-label ' + cls, html: '<span>' + text + '</span>', iconSize: null })
    });
  }

  function addCornerControls() {
    var Title = L.Control.extend({
      options: { position: 'topleft' },
      onAdd: function() {
        var div = L.DomUtil.create('div', 'eb-map-title');
        div.innerHTML = '<span class="eb-map-title__city">Chicago, Illinois</span>' +
          '<span class="eb-map-title__sub">Energy burden by census tract &middot; 768 tracts</span>';
        return div;
      }
    });
    map.addControl(new Title());

    var North = L.Control.extend({
      options: { position: 'topright' },
      onAdd: function() {
        var div = L.DomUtil.create('div', 'eb-north');
        div.innerHTML = '<svg width="22" height="30" viewBox="0 0 22 30" aria-hidden="true"><path d="M11 2 L18 22 L11 17 L4 22 Z" fill="currentColor"/></svg><span>N</span>';
        div.setAttribute('title', 'North');
        return div;
      }
    });
    map.addControl(new North());
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.control.scale({ position: 'bottomleft', imperial: true, metric: false, maxWidth: 120 }).addTo(map);
  }

  function updateLabels() {
    var z = map.getZoom();
    var showAreas = z >= 12;
    for (var i = 0; i < areaLabels.length; i++) {
      if (showAreas) areaLabels[i].addTo(map); else map.removeLayer(areaLabels[i]);
    }
    for (var j = 0; j < sideLabels.length; j++) {
      if (!showAreas) sideLabels[j].addTo(map); else map.removeLayer(sideLabels[j]);
    }
  }

  function styleBase() {
    var c = palette();
    if (water) water.setStyle(function(f) {
      return { fillColor: c.water, fillOpacity: 1, color: c.waterLine, weight: f.properties.kind === 'lake' ? 1 : 0.5 };
    });
    if (areas) areas.setStyle({ fill: false, color: c.area, weight: 1, dashArray: '3 3' });
    if (city) city.setStyle({ fill: false, color: c.city, weight: 1.8, opacity: 0.85 });
  }

  function buildMap(extra) {
    map = L.map('eb-map', {
      scrollWheelZoom: false, zoomSnap: 0.25, zoomControl: false,
      attributionControl: true, minZoom: 9.5, maxZoom: 15,
      /* On phones, one finger scrolls the page; pinch still zooms the map. */
      dragging: !L.Browser.mobile, tap: !L.Browser.mobile
    });
    map.attributionControl.setPrefix(false);
    map.attributionControl.addAttribution('Boundaries: U.S. Census Bureau TIGER/Line; City of Chicago');

    map.createPane('water');  map.getPane('water').style.zIndex = 350;
    map.createPane('lines');  map.getPane('lines').style.zIndex = 450;
    map.getPane('lines').style.pointerEvents = 'none';

    if (extra.water) water = L.geoJSON(extra.water, { pane: 'water', interactive: false }).addTo(map);

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

    if (extra.areas) {
      areas = L.geoJSON(extra.areas, { pane: 'lines', interactive: false }).addTo(map);
      for (var i = 0; i < extra.areas.features.length; i++) {
        var p = extra.areas.features[i].properties;
        if (p.lat && p.lng) areaLabels.push(label(p.name, p.lat, p.lng, 'eb-label--area'));
      }
    }
    if (extra.city) city = L.geoJSON(extra.city, { pane: 'lines', interactive: false }).addTo(map);

    for (var k = 0; k < SIDES.length; k++) {
      sideLabels.push(label(SIDES[k].name, SIDES[k].lat, SIDES[k].lng, 'eb-label--side' + (SIDES[k].minor ? ' eb-label--minor' : '')));
    }
    label('Lake Michigan', 41.90, -87.575, 'eb-label--lake').addTo(map);

    styleBase();
    addCornerControls();
    map.fitBounds(geo.getBounds(), { padding: [12, 12] });
    map.setMaxBounds(geo.getBounds().pad(0.6));
    map.on('zoomend', updateLabels);
    updateLabels();

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
    setText('eb-layer-note', key === 'mgwr' ? mgNote() : LAYERS[key].note);
    document.getElementById('eb-mgwr-pick').hidden = key !== 'mgwr';
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
      styleBase();
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
    summary = s;
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

    var picker = document.getElementById('eb-mgwr-var');
    picker.addEventListener('change', function() {
      mgVar = this.value;
      computeMgCut();
      switchLayer('mgwr');
    });

    if (typeof L === 'undefined') { showError(); return; }
    getJSON([REMOTE + 'tracts.geojson', LOCAL + 'tracts.geojson'], function(json) {
      data = json;
      computeBreaks();
      computeMgCut();
      var extra = {}, pending = 3;
      function loaded() {
        pending -= 1;
        if (pending > 0) return;
        buildMap(extra);
        renderLegend();
        watchTheme();
      }
      getJSON([REMOTE + 'water.geojson', LOCAL + 'water.geojson'], function(j) { extra.water = j; loaded(); }, loaded);
      getJSON([REMOTE + 'city.geojson', LOCAL + 'city.geojson'], function(j) { extra.city = j; loaded(); }, loaded);
      getJSON([REMOTE + 'community_areas.geojson', LOCAL + 'community_areas.geojson'], function(j) { extra.areas = j; loaded(); }, loaded);
    }, showError);
  });
})();
