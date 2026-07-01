const map = L.map('map', { zoomControl: true }).setView([23.2494, -106.4111], 11);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let dataBySection = new Map();
let geoLayer;
let currentMetric = 'participacion';

const metricLabels = {
  participacion: 'Participación',
  no_votantes: 'No votantes',
  lista_nominal: 'Lista nominal',
  indice_oportunidad_0_100: 'Índice de oportunidad',
  brecha_part_m_h: 'Brecha mujer - hombre'
};

const percentMetrics = new Set(['participacion', 'brecha_part_m_h']);

const palettes = {
  participacion: ['#f7fbff', '#c6dbef', '#6baed6', '#2171b5', '#08306b'],
  no_votantes: ['#fff5eb', '#fdd0a2', '#fd8d3c', '#e6550d', '#7f2704'],
  lista_nominal: ['#f7fcf5', '#c7e9c0', '#74c476', '#238b45', '#00441b'],
  indice_oportunidad_0_100: ['#ffffcc', '#c2e699', '#78c679', '#31a354', '#006837'],
  brecha_part_m_h: ['#b2182b', '#ef8a62', '#f7f7f7', '#67a9cf', '#2166ac']
};

function fmt(v, m = currentMetric) {
  v = Number(v);

  if (!Number.isFinite(v)) return 's/d';

  if (percentMetrics.has(m)) {
    const pct = Math.abs(v) <= 1 ? v * 100 : v;
    return `${pct.toFixed(1)}%`;
  }

  if (m === 'indice_oportunidad_0_100') {
    return v.toFixed(1);
  }

  return v.toLocaleString('es-MX');
}

function getSectionId(properties) {
  const keys = [
    'SECCION',
    'seccion',
    'Seccion',
    'SECCIÓN',
    'SECC',
    'secc',
    'CLAVE_SECCION',
    'clave_seccion'
  ];

  for (const key of keys) {
    if (properties && properties[key] !== undefined && properties[key] !== null) {
      return String(properties[key]).trim();
    }
  }

  return null;
}

function normalizeRow(row) {
  const section = row.SECCION ?? row.seccion ?? row.Seccion ?? row.SECCIÓN;

  return {
    SECCION: section,
    lista_nominal: Number(row.lista_nominal ?? row.LISTA_NOMINAL ?? row.Lista_Nominal ?? 0),
    votantes: Number(row.votantes ?? row.VOTANTES ?? row.SV ?? 0),
    no_votantes: Number(row.no_votantes ?? row.NO_VOTANTES ?? row.NV ?? 0),
    participacion: Number(row.participacion ?? row.PARTICIPACION ?? row.participacion_pct ?? row.PARTICIPACION_PCT ?? 0),
    indice_oportunidad_0_100: Number(row.indice_oportunidad_0_100 ?? row.INDICE_OPORTUNIDAD_0_100 ?? row.indice_oportunidad ?? 0),
    brecha_part_m_h: Number(row.brecha_part_m_h ?? row.BRECHA_PART_M_H ?? 0)
  };
}

function vals(metric) {
  return [...dataBySection.values()]
    .map(d => Number(d[metric]))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

function quantiles(arr) {
  if (!arr.length) return [0, 0, 0, 0];

  const q = p => arr[Math.min(arr.length - 1, Math.floor(p * (arr.length - 1)))];

  return [q(0.2), q(0.4), q(0.6), q(0.8)];
}

function colorFor(value, metric = currentMetric) {
  value = Number(value);

  if (!Number.isFinite(value)) return '#d1d5db';

  if (metric === 'brecha_part_m_h') {
    if (value < -0.08) return palettes[metric][0];
    if (value < -0.03) return palettes[metric][1];
    if (value <= 0.03) return palettes[metric][2];
    if (value <= 0.08) return palettes[metric][3];
    return palettes[metric][4];
  }

  const q = quantiles(vals(metric));
  const p = palettes[metric];

  if (value <= q[0]) return p[0];
  if (value <= q[1]) return p[1];
  if (value <= q[2]) return p[2];
  if (value <= q[3]) return p[3];

  return p[4];
}

function styleFeature(feature) {
  const sec = getSectionId(feature.properties);
  const data = dataBySection.get(sec);

  return {
    color: '#ffffff',
    weight: 1,
    opacity: 1,
    fillOpacity: 0.78,
    fillColor: data ? colorFor(data[currentMetric]) : '#d1d5db'
  };
}

function popupHtml(sec, data) {
  if (!data) {
    return `
      <div class="popup-title">Sección ${sec}</div>
      <p>Sin datos vinculados.</p>
    `;
  }

  return `
    <div class="popup-title">Sección ${sec}</div>
    <div class="popup-grid">
      <span>Lista nominal</span><span>${fmt(data.lista_nominal, 'lista_nominal')}</span>
      <span>Votantes</span><span>${fmt(data.votantes, 'lista_nominal')}</span>
      <span>No votantes</span><span>${fmt(data.no_votantes, 'lista_nominal')}</span>
      <span>Participación</span><span>${fmt(data.participacion, 'participacion')}</span>
      <span>Índice oportunidad</span><span>${fmt(data.indice_oportunidad_0_100, 'indice_oportunidad_0_100')}</span>
    </div>
  `;
}

function selectSection(sec, data) {
  const selected = document.getElementById('selected');

  if (!data) {
    selected.innerHTML = `
      <h3>Sección ${sec}</h3>
      <p>No se encontró en la base.</p>
    `;
    return;
  }

  selected.innerHTML = `
    <h3>Sección ${sec}</h3>
    <table>
      <tr><td>Lista nominal</td><td>${fmt(data.lista_nominal, 'lista_nominal')}</td></tr>
      <tr><td>Votantes</td><td>${fmt(data.votantes, 'lista_nominal')}</td></tr>
      <tr><td>No votantes</td><td>${fmt(data.no_votantes, 'lista_nominal')}</td></tr>
      <tr><td>Participación</td><td>${fmt(data.participacion, 'participacion')}</td></tr>
      <tr><td>Brecha mujer-hombre</td><td>${fmt(data.brecha_part_m_h, 'brecha_part_m_h')}</td></tr>
      <tr><td>Índice oportunidad</td><td>${fmt(data.indice_oportunidad_0_100, 'indice_oportunidad_0_100')}</td></tr>
    </table>
  `;
}

function onEachFeature(feature, layer) {
  const sec = getSectionId(feature.properties);
  const data = dataBySection.get(sec);

  layer.bindPopup(popupHtml(sec, data));

  layer.on('click', () => {
    selectSection(sec, data);
  });
}

function updateMap() {
  if (geoLayer) {
    geoLayer.setStyle(styleFeature);
  }

  updateLegend();
}

function updateLegend() {
  const oldLegend = document.querySelector('.legend');

  if (oldLegend) {
    oldLegend.remove();
  }

  const legend = L.control({ position: 'bottomright' });

  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'legend');
    const q = quantiles(vals(currentMetric));
    const colors = palettes[currentMetric];

    let labels;

    if (currentMetric === 'brecha_part_m_h') {
      labels = [
        'Mujer menor',
        'Mujer menor leve',
        'Equilibrada',
        'Mujer mayor leve',
        'Mujer mayor'
      ];
    } else {
      labels = [
        `≤ ${fmt(q[0])}`,
        `≤ ${fmt(q[1])}`,
        `≤ ${fmt(q[2])}`,
        `≤ ${fmt(q[3])}`,
        `> ${fmt(q[3])}`
      ];
    }

    div.innerHTML = `
      <div class="legend-title">${metricLabels[currentMetric]}</div>
      ${colors.map((color, i) => `
        <div class="legend-row">
          <span class="swatch" style="background:${color}"></span>
          <span>${labels[i]}</span>
        </div>
      `).join('')}
    `;

    return div;
  };

  legend.addTo(map);
}

function renderKpis(summary) {
  document.getElementById('kpis').innerHTML = `
    <div class="kpi">
      <div class="label">Secciones</div>
      <div class="value">${Number(summary.secciones ?? 0).toLocaleString('es-MX')}</div>
    </div>
    <div class="kpi">
      <div class="label">Lista nominal</div>
      <div class="value">${Number(summary.lista_nominal ?? summary.lista_nominal_total ?? 0).toLocaleString('es-MX')}</div>
    </div>
    <div class="kpi">
      <div class="label">Votantes</div>
      <div class="value">${Number(summary.votantes ?? summary.votos_totales ?? 0).toLocaleString('es-MX')}</div>
    </div>
    <div class="kpi">
      <div class="label">Participación</div>
      <div class="value">${fmt(summary.participacion ?? summary.participacion_ponderada_pct ?? 0, 'participacion')}</div>
    </div>
  `;
}

function showWarning(message) {
  const warning = document.getElementById('warning');

  if (!warning) return;

  warning.style.display = 'block';
  warning.innerHTML = message;
}

async function init() {
  try {
    const csvText = await fetch('mazatlan_2021_secciones.csv').then(response => {
      if (!response.ok) throw new Error('No se encontró mazatlan_2021_secciones.csv');
      return response.text();
    });

    const parsed = Papa.parse(csvText, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true
    });

    parsed.data.forEach(row => {
      const clean = normalizeRow(row);

      if (clean.SECCION !== undefined && clean.SECCION !== null && clean.SECCION !== '') {
        dataBySection.set(String(clean.SECCION).trim(), clean);
      }
    });
  } catch (error) {
    showWarning('No se pudo cargar mazatlan_2021_secciones.csv. Verifica que esté en la raíz del repositorio.');
    return;
  }

  try {
    const summary = await fetch('resumen_2021.json').then(response => {
      if (!response.ok) throw new Error('No se encontró resumen_2021.json');
      return response.json();
    });

    renderKpis(summary);
  } catch (error) {
    showWarning('No se pudo cargar resumen_2021.json. Verifica que esté en la raíz del repositorio.');
  }

  try {
    const geojson = await fetch('mazatlan_secciones.geojson').then(response => {
      if (!response.ok) throw new Error('No se encontró mazatlan_secciones.geojson');
      return response.json();
    });

    if (!geojson.features || geojson.features.length === 0) {
      showWarning('El archivo mazatlan_secciones.geojson está vacío. Debe contener polígonos reales en features.');
      return;
    }

    geoLayer = L.geoJSON(geojson, {
      style: styleFeature,
      onEachFeature: onEachFeature
    }).addTo(map);

    map.fitBounds(geoLayer.getBounds(), {
      padding: [20, 20]
    });

    updateLegend();

  } catch (error) {
    showWarning('No se pudo cargar mazatlan_secciones.geojson. Verifica que esté en la raíz del repositorio y que sea un GeoJSON válido.');
  }
}

document.getElementById('metric').addEventListener('change', event => {
  currentMetric = event.target.value;
  updateMap();
});

document.getElementById('btnSearch').addEventListener('click', () => {
  const sec = String(document.getElementById('search').value).trim();

  if (!sec) return;

  const data = dataBySection.get(sec);

  selectSection(sec, data);

  if (geoLayer) {
    geoLayer.eachLayer(layer => {
      if (getSectionId(layer.feature.properties) === sec) {
        map.fitBounds(layer.getBounds(), {
          padding: [40, 40]
        });

        layer.openPopup();
      }
    });
  }
});

init();
