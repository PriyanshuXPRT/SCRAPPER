# SCRAPPER

A simpler web scrapper for image download.

Built on Playwright. Searches Google, Bing, or DuckDuckGo Images, downloads the
results, and writes a JSON metadata sidecar.

## Setup

```bash
npm install
npx playwright install chromium
```

## Usage

```bash
npm run build
npm start -- -q "sunset beach" -n 30 -o ./downloads/sunsets
```

### Options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--query` | `-q` | `cats` | Search terms |
| `--max-images` | `-n` | `20` | Maximum images to download |
| `--output` | `-o` | `./downloads` | Output directory |
| `--engine` | `-e` | `bing` | `bing`, `duckduckgo`, or `google` |
| `--headless` | | `true` | Pass `false` to watch the browser |
| `--delay` | | `2000` | Delay between downloads (ms) |
| `--size` | | `large` | `large`, `medium`, `icon`, `any` |
| `--type` | | `photo` | `photo`, `clipart`, `lineart`, `face`, `news` |
| `--color` | | `color` | `color`, `bw`, `red`, `blue`, etc. |

### Examples

```bash
# Bing, large photos
npm start -- -q "mountains" -n 10 -e bing --size large --type photo

# DuckDuckGo clipart
npm start -- -q "cat" -n 15 -e duckduckgo --type clipart

# Watch it work
npm start -- -q "dogs" --headless false
```

## Programmatic use

```ts
import { ImageScraper } from './src/image-scraper';
import { createConfig } from './src/config';

const scraper = new ImageScraper(
  createConfig({
    query: 'mountain landscape',
    maxImages: 50,
    outputDir: './mountains',
    searchEngine: 'bing',
  })
);

const { downloaded, failed, errors } = await scraper.scrape();
```

## Output

```
downloads/
├── 0001_beach_sunset.jpg
├── 0002_ocean_view.png
└── scrape-metadata.json
```

`scrape-metadata.json` records the query, engine, timestamp, resolved config, and the
source URL, alt text, and dimensions of every image found.

## Engine notes

**Bing** is the default and the most reliable. Its thumbnails live on
`th.bing.com/th/id/...`; the scraper strips the `w`/`h`/`c`/`r`/`o` query params to get
the full-size original. Filters are passed as a `+`-joined `qft` list, and safe search
uses the `adlt=strict` param.

**DuckDuckGo** serves images through an `external-content.duckduckgo.com/iu/?u=...`
proxy. The scraper unwraps the `u` parameter to recover the upstream Bing URL, so
downloads and dimensions come through normally.

**Google** is implemented but unreliable from a single IP. Google serves a reCAPTCHA
(`/sorry/`) interstitial for automated requests, and the scraper cannot solve it. Use
Bing or DuckDuckGo unless you have a proxy pool.

## Caveats

- Downloaded images are whatever the search engine indexed. Licensing and copyright are
  the caller's responsibility, and the built-in safe search defaults to on.
- Rate limits still apply. The default 2s inter-download delay is deliberate; lowering it
  will get you rate-limited or blocked.
- The stealth setup is minimal on purpose. An earlier version overrode `navigator.plugins`,
  `screen.*`, and forced document-scoped `Sec-Fetch-*` headers on every request, which
  silently suppressed DuckDuckGo's image grid. Only `navigator.webdriver` is masked now.

## Troubleshooting

**"Found 0 images"** — the page rendered but the grid did not. Run with
`--headless false` to watch. On Google this usually means a CAPTCHA page.

**Downloads fail with "Invalid URL"** — a protocol-relative `//host/...` URL reached
axios. The scraper absolutizes these; if you hit it, you are likely on an old build.

**Timeouts on `page.goto`** — `waitUntil: 'networkidle'` is deliberately not used; these
search pages keep long-lived connections open and never go idle.
