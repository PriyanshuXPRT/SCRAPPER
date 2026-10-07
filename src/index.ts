#!/usr/bin/env node
import { ImageScraper } from './image-scraper.js';
import { createConfig, ScraperConfig, defaultConfig } from './config.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Parse command line arguments
 */
function parseArgs(): Partial<ScraperConfig> & { query?: string; help?: boolean } {
  const args = process.argv.slice(2);
  const config: Partial<ScraperConfig> & { query?: string; help?: boolean } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '-q':
      case '--query':
        config.query = nextArg;
        i++;
        break;
      case '-n':
      case '--max-images':
        config.maxImages = parseInt(nextArg, 10);
        i++;
        break;
      case '-o':
      case '--output':
        config.outputDir = nextArg;
        i++;
        break;
      case '-e':
      case '--engine':
        config.searchEngine = nextArg as any;
        i++;
        break;
      case '--headless':
        config.headless = nextArg !== 'false';
        i++;
        break;
      case '--delay':
        config.requestDelay = parseInt(nextArg, 10);
        i++;
        break;
      case '--size':
        config.searchParams = {
          ...defaultConfig.searchParams,
          ...config.searchParams,
          imageSize: nextArg as any
        };
        i++;
        break;
      case '--type':
        config.searchParams = {
          ...defaultConfig.searchParams,
          ...config.searchParams,
          imageType: nextArg as any
        };
        i++;
        break;
      case '--color':
        config.searchParams = {
          ...defaultConfig.searchParams,
          ...config.searchParams,
          imageColor: nextArg as any
        };
        i++;
        break;
      case '-h':
      case '--help':
        config.help = true;
        break;
    }
  }

  return config;
}

/**
 * Print usage information
 */
function printUsage(): void {
  console.log(`
Universal Image Scraper - Playwright-based image downloader

Usage:
  npm start -- [options]
  npx ts-node src/index.ts [options]

Options:
  -q, --query <query>          Search query (default: "cats")
  -n, --max-images <number>    Maximum images to download (default: 20)
  -o, --output <dir>           Output directory (default: "./downloads")
  -e, --engine <engine>        Search engine: google, bing, duckduckgo (default: bing)
  --headless <true|false>      Run in headless mode (default: true)
  --delay <ms>                 Delay between downloads in ms (default: 2000)
  --size <large|medium|icon>   Image size filter (default: large)
  --type <photo|clipart|...>   Image type filter (default: photo)
  --color <color|bw|red|...>   Image color filter (default: color)
  -h, --help                   Show this help message

Examples:
  npm start -- -q "sunset beach" -n 30 -o ./sunset_images
  npm start -- --query "cats" --max-images 50 --engine bing --size large
  npm start -- -q "landscape" --engine duckduckgo --headless false --delay 3000
  npm start -- -q "flowers" --engine google --max-images 20 --size large --type photo

Note: Google has aggressive anti-bot protection. Bing and DuckDuckGo are recommended for reliable scraping.
`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  const config = createConfig(args);
  
  console.log('='.repeat(50));
  console.log('Universal Image Scraper');
  console.log('='.repeat(50));
  console.log(`Query: ${config.query}`);
  console.log(`Engine: ${config.searchEngine}`);
  console.log(`Max Images: ${config.maxImages}`);
  console.log(`Output: ${config.outputDir}`);
  console.log(`Headless: ${config.headless}`);
  console.log(`Delay: ${config.requestDelay}ms`);
  console.log(`Size: ${config.searchParams.imageSize}`);
  console.log(`Type: ${config.searchParams.imageType}`);
  console.log(`Color: ${config.searchParams.imageColor}`);
  console.log('='.repeat(50));

  const scraper = new ImageScraper(config);
  const result = await scraper.scrape(config.query);

  console.log('\n' + '='.repeat(50));
  console.log('Scraping Complete');
  console.log('='.repeat(50));
  console.log(`Total found: ${result.images.length}`);
  console.log(`Downloaded: ${result.downloaded}`);
  console.log(`Failed: ${result.failed}`);

  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach(err => console.log(`  - ${err}`));
  }

  // Save metadata - ensure directory exists
  await fs.promises.mkdir(config.outputDir, { recursive: true });
  const metadataPath = path.join(config.outputDir, 'scrape-metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify({
    query: config.query,
    engine: config.searchEngine,
    timestamp: new Date().toISOString(),
    config,
    results: result.images.map(img => ({
      url: img.url,
      altText: img.altText,
      width: img.width,
      height: img.height,
      format: img.format,
      sourceUrl: img.sourceUrl
    }))
  }, null, 2));
  
  console.log(`\nMetadata saved to: ${metadataPath}`);
  
  process.exit(result.failed > 0 ? 1 : 0);
}

// Handle uncaught errors
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

main();