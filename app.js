const map = L.map('map', { zoomControl: true }).setView([23.2494, -106.4111], 11);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let dataBySection = new Map();
let demoBySection = new Map();
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
  if (percentMetrics.has(m) || m === 'pct' || m === 'participacion') {
    const pct = Math.abs(v) <= 1 ? v * 100 : v;
    return `${pct.toFixed(1)}%`;
  }
  if (m === 'indice_oportunidad_0_100') return v.toFixed(1);
  return v.toLocaleString('es-MX');
}

function getSectionId(properties) {
  const keys = ['SECCION', 'seccion', 'Seccion', 'SECCIÓN', 'SECC', 'secc', 'CLAVE_SECCION', 'clave_seccion'];
  for (const key of keys) {
    if (properties && properties[key] !== undefined && properties[key] !== null) {
      return String(properties[key]).trim();
    }
  }
  return null;
}

function getRowValue(row, names, fallback = 0) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== '') return row[name];
  }
  return fallback;
}

function normalizeRow(row) {
  const section = getRowValue(row, ['SECCION', 'seccion', 'Seccion', 'SECCIÓN', '\ufeffSECCION'], null);
  return {
    SECCION: section,
    lista_nominal: Number(getRowValue(row, ['lista_nominal', 'Lista_Nominal', 'LISTA_NOMINAL'], 0)),
    votantes: Number(getRowValue(row, ['votantes', 'Votantes', 'VOTANTES'], 0)),
    no_votantes: Number(getRowValue(row, ['no_votantes', 'No_Votantes', 'NO_VOTANTES'], 0)),
    no_sabe: Number(getRowValue(row, ['no_sabe', 'No_Sabe', 'NO_SABE'], 0)),
    participacion: Number(getRowValue(row, ['participacion', 'Participacion', 'PARTICIPACION'], 0)),
    indice_oportunidad_0_100: Number(getRowValue(row, ['indice_oportunidad_0_100', 'Indice_Oportunidad_0_100', 'INDICE_OPORTUNIDAD_0_100'], 0)),
    brecha_part_m_h: Number(getRowValue(row, ['brecha_part_m_h', 'Brecha_Part_M_H', 'BRECHA_PART_M_H'], 0))
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

function sexoMiniHtml(demo) {
  if (!demo || !demo.sexo) return '<p>Sin datos demográficos.</p>';
  const mujer = demo.sexo.Mujer || {};
  const hombre = demo.sexo.Hombre || {};
  return `
    <table>
      <tr><td>Mujeres LN</td><td>${fmt(mujer.lista_nominal, 'lista_nominal')}</td></tr>
      <tr><td>Mujeres participación</td><td>${fmt(mujer.participacion, 'pct')}</td></tr>
      <tr><td>Hombres LN</td><td>${fmt(hombre.lista_nominal, 'lista_nominal')}</td></tr>
      <tr><td>Hombres participación</td><td>${fmt(hombre.participacion, 'pct')}</td></tr>
    </table>
  `;
}

function rangoEdadHtml(demo) {
  if (!demo || !demo.rangos_edad || !demo.rangos_edad.length) return '<p>Sin rangos de edad.</p>';
  return `
    <table>
      <tr><td><strong>Rango</strong></td><td><strong>LN</strong></td><td><strong>Vot.</strong></td><td><strong>Part.</strong></td></tr>
      ${demo.rangos_edad.map(r => `
        <tr>
          <td>${r.rango}</td>
          <td>${fmt(r.lista_nominal, 'lista_nominal')}</td>
          <td>${fmt(r.votantes, 'lista_nominal')}</td>
          <td>${fmt(r.participacion, 'pct')}</td>
        </tr>
      `).join('')}
    </table>
  `;
}

function rangoSexoHtml(demo) {
  if (!demo || !demo.rango_sexo || !demo.rango_sexo.length) return '<p>Sin cruce edad-sexo.</p>';
  return `
    <table>
      <tr><td><strong>Grupo</strong></td><td><strong>Sexo</strong></td><td><strong>LN</strong></td><td><strong>Part.</strong></td></tr>
      ${demo.rango_sexo.map(r => `
        <tr>
          <td>${r.rango}</td>
          <td>${r.sexo}</td>
          <td>${fmt(r.lista_nominal, 'lista_nominal')}</td>
          <td>${fmt(r.participacion, 'pct')}</td>
        </tr>
      `).join('')}
    </table>
  `;
}

function popupHtml(sec, data) {
  const demo = demoBySection.get(sec);
  if (!data) return `<div class="popup-title">Sección ${sec}</div><p>Sin datos vinculados.</p>`;

  const rangoMayor = demo?.rango_mayor_lista || 's/d';
  const mujer = demo?.sexo?.Mujer?.lista_nominal ?? null;
  const hombre = demo?.sexo?.Hombre?.lista_nominal ?? null;

  return `
    <div class="popup-title">Sección ${sec}</div>
    <div class="popup-grid">
      <span>Lista nominal</span><span>${fmt(data.lista_nominal, 'lista_nominal')}</span>
      <span>Votantes</span><span>${fmt(data.votantes, 'lista_nominal')}</span>
      <span>No votantes</span><span>${fmt(data.no_votantes, 'lista_nominal')}</span>
      <span>Participación</span><span>${fmt(data.participacion, 'pct')}</span>
      <span>Rango mayor</span><span>${rangoMayor}</span>
      <span>Mujeres LN</span><span>${fmt(mujer, 'lista_nominal')}</span>
      <span>Hombres LN</span><span>${fmt(hombre, 'lista_nominal')}</span>
    </div>
  `;
}

function selectSection(sec, data) {
  const selected = document.getElementById('selected');
  const demo = demoBySection.get(sec);

  if (!data) {
    selected.innerHTML = `<h3>Sección ${sec}</h3><p>No se encontró en la base.</p>`;
    return;
  }

  selected.innerHTML = `
    <h3>Sección ${sec}</h3>
    <table>
      <tr><td>Lista nominal</td><td>${fmt(data.lista_nominal, 'lista_nominal')}</td></tr>
      <tr><td>Votantes</td><td>${fmt(data.votantes, 'lista_nominal')}</td></tr>
      <tr><td>No votantes</td><td>${fmt(data.no_votantes, 'lista_nominal')}</td></tr>
      <tr><td>Participación</td><td>${fmt(data.participacion, 'pct')}</td></tr>
      <tr><td>Brecha mujer-hombre</td><td>${fmt(data.brecha_part_m_h, 'pct')}</td></tr>
      <tr><td>Índice oportunidad</td><td>${fmt(data.indice_oportunidad_0_100, 'indice_oportunidad_0_100')}</td></tr>
      <tr><td>Rango con más lista nominal</td><td>${demo?.rango_mayor_lista || 's/d'}</td></tr>
      <tr><td>Rango con más participación</td><td>${demo?.rango_mayor_participacion || 's/d'}</td></tr>
    </table>

    <h3 style="margin-top:16px;">Demografía por sexo</h3>
    ${sexoMiniHtml(demo)}

    <h3 style="margin-top:16px;">Rango de edad</h3>
    ${rangoEdadHtml(demo)}

    <h3 style="margin-top:16px;">Edad + sexo</h3>
    ${rangoSexoHtml(demo)}
  `;
}

function onEachFeature(feature, layer) {
  const sec = getSectionId(feature.properties);
  const data = dataBySection.get(sec);
  layer.bindPopup(popupHtml(sec, data));
  layer.on('click', () => selectSection(sec, data));
}

function updateMap() {
  if (geoLayer) geoLayer.setStyle(styleFeature);
  updateLegend();
}

function updateLegend() {
  const oldLegend = document.querySelector('.legend');
  if (oldLegend) oldLegend.remove();

  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'legend');
    const q = quantiles(vals(currentMetric));
    const colors = palettes[currentMetric];
    const labels = currentMetric === 'brecha_part_m_h'
      ? ['Mujer menor', 'Mujer menor leve', 'Equilibrada', 'Mujer mayor leve', 'Mujer mayor']
      : [`≤ ${fmt(q[0])}`, `≤ ${fmt(q[1])}`, `≤ ${fmt(q[2])}`, `≤ ${fmt(q[3])}`, `> ${fmt(q[3])}`];

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
    <div class="kpi"><div class="label">Secciones</div><div class="value">${Number(summary.secciones || 0).toLocaleString('es-MX')}</div></div>
    <div class="kpi"><div class="label">Lista nominal</div><div class="value">${Number(summary.lista_nominal || 0).toLocaleString('es-MX')}</div></div>
    <div class="kpi"><div class="label">Votantes</div><div class="value">${Number(summary.votantes || 0).toLocaleString('es-MX')}</div></div>
    <div class="kpi"><div class="label">Participación</div><div class="value">${fmt(summary.participacion || 0, 'pct')}</div></div>
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

    const parsed = Papa.parse(csvText, { header: true, dynamicTyping: true, skipEmptyLines: true });
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
    const demo = await fetch('demografia_2021_por_seccion.json').then(response => {
      if (!response.ok) throw new Error('No se encontró demografia_2021_por_seccion.json');
      return response.json();
    });
    Object.entries(demo.secciones || {}).forEach(([sec, value]) => demoBySection.set(String(sec), value));
  } catch (error) {
    showWarning('No se pudo cargar demografia_2021_por_seccion.json. El mapa funcionará, pero sin edad y sexo detallados.');
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

    geoLayer = L.geoJSON(geojson, { style: styleFeature, onEachFeature: onEachFeature }).addTo(map);
    map.fitBounds(geoLayer.getBounds(), { padding: [20, 20] });
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
        map.fitBounds(layer.getBounds(), { padding: [40, 40] });
        layer.openPopup();
      }
    });
  }
});

init();
