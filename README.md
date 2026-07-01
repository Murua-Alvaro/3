# Mapa electoral de Mazatlán 2021 — GitHub Pages

Este paquete contiene una página estática para publicar un mapa electoral de Mazatlán en GitHub Pages.

## Qué incluye

- `index.html`: página principal.
- `styles.css`: diseño visual.
- `app.js`: lógica del mapa, filtros y lectura de datos.
- `data/mazatlan_2021_secciones.csv`: base agregada por sección electoral.
- `data/resumen_2021.json`: KPIs generales.
- `geodata/mazatlan_secciones.geojson`: archivo placeholder que debe reemplazarse por la capa geográfica real.

## Paso pendiente

El Excel contiene datos por sección, pero no trae polígonos ni coordenadas. Para que el mapa se dibuje, reemplaza `geodata/mazatlan_secciones.geojson` por un GeoJSON real de secciones electorales de Mazatlán. Cada polígono debe tener una propiedad llamada `SECCION`, `seccion`, `Seccion`, `SECCIÓN`, `SECC`, `secc`, `CLAVE_SECCION` o `clave_seccion`.

## Cómo publicar en GitHub Pages

1. Crea un repositorio en GitHub.
2. Sube todos estos archivos conservando la estructura de carpetas.
3. Entra a `Settings` → `Pages`.
4. En `Build and deployment`, selecciona `Deploy from a branch`.
5. Selecciona la rama `main` y carpeta `/root`.
6. Guarda los cambios.

GitHub generará una URL similar a `https://TU_USUARIO.github.io/NOMBRE_DEL_REPOSITORIO/`.

## Variables disponibles

Participación, no votantes, lista nominal, índice de oportunidad y brecha de participación mujer-hombre.

## Índice de oportunidad

El índice incluido es exploratorio y va de 0 a 100. Combina 50% volumen absoluto de no votantes, 30% baja participación relativa y 20% tamaño de lista nominal.
