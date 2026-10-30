# Iván Brihuega's portfolio · Ivanchux

*[Versión en español: LEEME.md](LEEME.md)*

Personal portfolio website. The home page is a 90s desk with a CRT monitor where projects are loaded, and inside it lives IVANDEV OS, a fake operating system for the curious.

Plain HTML, CSS and JavaScript, no frameworks and no dependencies. A small Node tool generates the pages from data files.

## Requirements

- **Node 22.12 or later** (to build). Nothing else: no `npm install` needed.
- For the IVANDEV OS tests, Playwright with Chromium as well.

## Commands

| Command | What it does |
|---|---|
| `npm run build` | Generates the site in `dist/` |
| `npm start` | Builds and serves it at `http://localhost:8080` |
| `npm test` | Builds and checks that nothing pending, no prices, no third-party resources and no hidden cursor get published |
| `npm run test:os` | Tests IVANDEV OS in a real browser |

On Windows, if port 8080 is blocked, use another one: `set PUERTO=5500`, then `npm start`.

### Open the site by double-clicking, without a server

```bash
ARCHIVO=1 SALIDA=dist-archivo npm run build
```

On Windows (CMD): `set ARCHIVO=1` and `set SALIDA=dist-archivo`, then `npm run build`. Open `dist-archivo/index.html`. Everything works except IVANDEV OS, which needs a server: its HTML version is shown instead.

### IVANDEV OS tests

Two of them type the secret boot phrase, which is not in the repository. It is passed in the `OS_SECRETO` variable. Without it those two tests are skipped and the rest run.

## Where to change things

All content lives in data files. Pages do not need to be edited.

| File | Contents |
|---|---|
| `site.config.json` | Name, alias, domain, email, legal owner, GitHub and LinkedIn |
| `datos/proyectos.json` | Every project. Only those with `"publicar": true` are published |
| `datos/categorias.json` | Project categories, with their colour and text |
| `datos/habilidades.json` | Skills and the projects that prove them |
| `datos/sobre-mi.json` | "About me" texts |
| `datos/os-textos.json`, `datos/os-sistema.json` | IVANDEV OS phrases and fake files |
| `src/css/tokens.css` | Colours, fonts and spacing for the whole site |

**Any `POR_CONFIRMAR` value is never published.** The build lists the ones left.

### Adding a project

1. Copy an entry in `datos/proyectos.json` and change `slug`, `nombre`, `categoria`, `resumen` and `descripcion`.
2. Put its screenshots in `src/img/capturas/` (preferably `.webp`) with their `ancho`, `alto` and an `alt` text describing the image.
3. To load it live in the monitor: `"vista_previa": { "tipo": "iframe", "url": "…", "formato": "escritorio" }`, or `"movil"` for a mobile app.
4. Set `"publicar": true` and build.

### Once you have a domain

Write it in `site.config.json` (for example `"dominio": "ivanchux.dev"`). The build then generates `sitemap.xml`, canonical URLs and Open Graph URLs on its own.

## Publishing on GitHub Pages

The site is static: publishing the `dist/` folder is enough. A simple way, with no extra tools:

1. Build with `npm run build`.
2. Create a `gh-pages` branch containing only what is inside `dist/`:
   ```bash
   git checkout --orphan gh-pages
   git rm -rf .
   cp -r dist/* .
   git add . && git commit -m "Publish"
   git push origin gh-pages
   ```
   On Windows, copy the contents of `dist/` with File Explorer instead of `cp`.
3. On GitHub: *Settings → Pages → Source: Deploy from a branch → gh-pages / (root)*.
4. For your own domain: *Custom domain* on that same screen, and a `CNAME` record at your domain provider pointing to `ivanchux.github.io`.

All paths in the site are relative, so it works both at `ivanchux.github.io/portfolio/` and on a custom domain.

## Structure

```
datos/            content (projects, categories, texts)
herramientas/     build.mjs (build), servir.mjs (local server), iconos.mjs
src/paginas/      pages
src/plantillas/   header, footer, base layout and project page
src/css/          tokens, base, desk, pages and project pages
src/js/           monitor, colour modes, animations and contact
src/os/           IVANDEV OS (module and styles)
src/fuentes/      fonts with their licences
tests/            site and IVANDEV OS tests
referencia/       material from the previous portfolio
```

## Accessibility and privacy

- WCAG 2.1 AA: checked contrast, visible focus, fully keyboard usable and system cursor.
- With "reduce motion" on there are no animations or boot sequences.
- No cookies, no analytics and no third-party resources. Only the light or dark mode and the monitor's screen colour are stored in the browser.

## Licences

Fonts under the SIL Open Font License (see `src/fuentes/`). Each project shown has its own licence in its repository.
