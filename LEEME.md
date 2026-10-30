# Portfolio de Iván Brihuega · Ivanchux

*[English version: README.md](README.md)*

Web personal con portfolio de proyectos. La portada es un escritorio de los 90 con un monitor CRT donde se cargan los proyectos, y dentro vive IVANDEV OS, un sistema operativo de mentira para curiosos.

HTML, CSS y JavaScript planos, sin frameworks ni dependencias. Una pequeña herramienta en Node genera las páginas a partir de archivos de datos.

## Requisitos

- **Node 22.12 o superior** (para compilar). Nada más: no hace falta `npm install`.
- Para los tests de IVANDEV OS, además, Playwright con Chromium.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run build` | Genera la web en `dist/` |
| `npm start` | Compila y la sirve en `http://localhost:8080` |
| `npm test` | Compila y comprueba que no se publica nada pendiente, ni precios, ni recursos de terceros, ni cursor oculto |
| `npm run test:os` | Prueba IVANDEV OS en un navegador real |

En Windows, si el puerto 8080 está bloqueado, usa otro: `set PUERTO=5500` y después `npm start`.

### Abrir la web con doble clic, sin servidor

```bash
ARCHIVO=1 SALIDA=dist-archivo npm run build
```

En Windows (CMD): `set ARCHIVO=1` y `set SALIDA=dist-archivo`, y después `npm run build`. Abre `dist-archivo/index.html`. Funciona todo salvo IVANDEV OS, que necesita servidor: en ese caso se muestra su versión en HTML.

### Tests de IVANDEV OS

Dos de ellos escriben la frase del arranque secreto, que no está en el repositorio. Se pasa en la variable `OS_SECRETO` (está en tus notas internas). Sin ella esos dos tests se saltan y el resto se ejecuta.

## Dónde se cambia cada cosa

Todo el contenido vive en archivos de datos. No hay que tocar las páginas.

| Archivo | Qué contiene |
|---|---|
| `site.config.json` | Nombre, alias, dominio, correo, titular legal, GitHub y LinkedIn |
| `datos/proyectos.json` | Todos los proyectos. Solo se publican los que tienen `"publicar": true` |
| `datos/categorias.json` | Categorías de proyecto, con su color y su texto |
| `datos/habilidades.json` | «Qué sé hacer» y los proyectos que lo demuestran |
| `datos/sobre-mi.json` | Textos de «Sobre mí» |
| `datos/os-textos.json`, `datos/os-sistema.json` | Frases y archivos falsos de IVANDEV OS |
| `src/css/tokens.css` | Colores, tipografías y espacios de toda la web |

**Cualquier valor `POR_CONFIRMAR` no se publica.** Al compilar se listan los que quedan.

### Añadir un proyecto

1. Copia una entrada de `datos/proyectos.json` y cambia `slug`, `nombre`, `categoria`, `resumen` y `descripcion`.
2. Pon sus capturas en `src/img/capturas/` (mejor en `.webp`) con su `ancho`, `alto` y un `alt` que describa la imagen.
3. Para que el monitor la cargue en vivo: `"vista_previa": { "tipo": "iframe", "url": "…", "formato": "escritorio" }`, o `"movil"` si es una app de móvil.
4. Pon `"publicar": true` y compila.

### Cuando tengas dominio

Escríbelo en `site.config.json` (por ejemplo `"dominio": "ivanchux.dev"`). Al compilar se generan solos `sitemap.xml`, las direcciones canónicas y las de Open Graph.

## Publicar en GitHub Pages

La web es estática: basta con publicar la carpeta `dist/`. Una forma sencilla, sin herramientas extra:

1. Compila con `npm run build`.
2. Crea una rama `gh-pages` que contenga solo lo que hay dentro de `dist/`:
   ```bash
   git checkout --orphan gh-pages
   git rm -rf .
   cp -r dist/* .
   git add . && git commit -m "Publicación"
   git push origin gh-pages
   ```
   En Windows, usa el Explorador para copiar el contenido de `dist/` en lugar de `cp`.
3. En GitHub: *Settings → Pages → Source: Deploy from a branch → gh-pages / (root)*.
4. Para tu dominio: en esa misma pantalla, *Custom domain*, y en tu proveedor de dominio un registro `CNAME` apuntando a `ivanchux.github.io`.

Las rutas de la web son relativas, así que funciona tanto en `ivanchux.github.io/portfolio/` como en un dominio propio.

## Estructura

```
datos/            contenido (proyectos, categorías, textos)
herramientas/     build.mjs (compilación), servir.mjs (servidor local), iconos.mjs
src/paginas/      páginas
src/plantillas/   cabecera, pie, base y ficha de proyecto
src/css/          tokens, base, escritorio, páginas y fichas
src/js/           monitor, modos de color, animaciones y contacto
src/os/           IVANDEV OS (módulo y estilos)
src/fuentes/      tipografías con sus licencias
tests/            tests de la web y de IVANDEV OS
referencia/       material del portfolio anterior
```

## Accesibilidad y privacidad

- WCAG 2.1 AA: contraste comprobado, foco visible, todo usable con teclado y cursor del sistema.
- Con «reducir movimiento» activado no hay animaciones ni arranques.
- Sin cookies, sin analítica y sin recursos de terceros. Solo se guardan en el navegador el modo claro u oscuro y el color de la pantalla del monitor.

## Licencias

Tipografías bajo SIL Open Font License (ver `src/fuentes/`). Cada proyecto mostrado tiene su propia licencia en su repositorio.
