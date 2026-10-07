import { Page, Browser, BrowserContext, ElementHandle } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { mkdirp } from 'mkdirp';
import axios, { AxiosResponse } from 'axios';
import { ScraperConfig, defaultConfig } from './config.js';
import { SearchEngine, buildSearchUrl, getImageSelectors, getNextPageSelectors, getConsentSelectors } from './search-engines.js';

export interface ImageResult {
  url: string;
  altText: string;
  width?: number;
  height?: number;
  format?: string;
  sourceUrl: string;
}

export interface ScrapeResult {
  images: ImageResult[];
  downloaded: number;
  failed: number;
  errors: string[];
}

/**
 * Universal Image Scraper using Playwright
 * Supports multiple search engines: Google, Bing, DuckDuckGo
 */
export class ImageScraper {
  private config: ScraperConfig;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  constructor(config: Partial<ScraperConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Initialize the browser and page with stealth configuration
   */
  async initialize(): Promise<void> {
    const { chromium } = await import('playwright');
    
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-site-isolation-trials',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-popup-blocking',
        '--disable-translate',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-device-discovery-notifications',
      ]
    });

    this.context = await this.browser.newContext({
      userAgent: this.config.userAgent,
      viewport: this.config.viewport,
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: [],
      // Only set headers here that are safe for every request. Do NOT
      // force Sec-Fetch-*, Accept or Cache-Control at the context level:
      // Chromium computes those per request, and overriding them with
      // document-scoped values prevents image grids from loading.
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9'
      },
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
      colorScheme: 'light'
    });

    // Add minimal stealth script. Overriding too many native properties
    // (plugins, permissions, screen) breaks lazy-loaded image grids on
    // some engines, so keep this to the one property that matters.
    await this.context.addInitScript(`
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
        configurable: true
      });
    `);

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(this.config.timeout);
  }

  /**
   * Build search URL for the configured engine
   */
  private buildSearchUrl(query: string): string {
    return buildSearchUrl(this.config.searchEngine, query, this.config);
  }

  /**
   * Scroll page to load more images - with better lazy loading trigger
   */
  private async scrollToLoadImages(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    // Initial wait for page to fully load
    await this.page.waitForTimeout(5000);

    // Simple fixed scroll loop - no early exit
    const totalScrolls = 30;
    for (let scrollNum = 1; scrollNum <= totalScrolls; scrollNum++) {
      // Check if we hit a CAPTCHA page
      const isCaptcha = await this.checkForCaptcha();
      if (isCaptcha) {
        console.log('CAPTCHA detected! Waiting for manual intervention...');
        await this.page.waitForTimeout(30000);
        continue;
      }

      // Scroll by one viewport height
      await this.page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      await this.page.waitForTimeout(500);
    }
    
    // Final scroll to bottom
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await this.page.waitForTimeout(2000);

    // Click "Show more results" button if present
    const nextPageSelectors = getNextPageSelectors(this.config.searchEngine);
    for (const selector of nextPageSelectors) {
      const showMoreBtn = await this.page.$(selector);
      if (showMoreBtn !== null) {
        await showMoreBtn.click();
        await this.page.waitForTimeout(3000);
        break;
      }
    }
  }

  /**
   * Check if CAPTCHA page is shown
   */
  private async checkForCaptcha(): Promise<boolean> {
    if (!this.page) return false;
    
    const title = await this.page.title();
    const url = this.page.url();
    
    return title.includes('sorry') || 
           url.includes('/sorry/') || 
           url.includes('recaptcha') ||
           (await this.page.$('#captcha-form')) !== null;
  }

  /**
   * Handle consent dialog
   */
  private async handleConsentDialog(): Promise<void> {
    if (!this.page) return;

    try {
      const consentSelectors = getConsentSelectors(this.config.searchEngine);
      
      for (const selector of consentSelectors) {
        const btn = await this.page.$(selector);
        if (btn) {
          await btn.click();
          await this.page.waitForTimeout(1000 + Math.random() * 1000);
          break;
        }
      }
    } catch {
      // Consent dialog not present or already handled
    }
  }

  /**
   * Extract image data from the page
   */
  private async extractImages(): Promise<ImageResult[]> {
    if (!this.page) throw new Error('Page not initialized');

    const selectors = getImageSelectors(this.config.searchEngine);
    const selectorString = selectors.join(', ');

    // Extract raw image data in browser context
    const rawImages = await this.page.evaluate((sel) => {
      const results: Array<{
        url: string;
        altText: string;
        sourceUrl: string;
        width?: number;
        height?: number;
      }> = [];
      const imageElements = document.querySelectorAll(sel);
      
      imageElements.forEach((img: Element, index: number) => {
        const imgEl = img as HTMLImageElement;
        const parent = imgEl.closest('a, div, figure, li');
        const link = parent?.querySelector('a[href]') as HTMLAnchorElement | null;
        
        let src = imgEl.getAttribute('src') || 
                  imgEl.getAttribute('data-src') || 
                  imgEl.getAttribute('data-iurl') || 
                  imgEl.getAttribute('data-original') ||
                  imgEl.getAttribute('data-lazy-src') || '';
        const alt = imgEl.getAttribute('alt') || 
                    imgEl.getAttribute('title') || 
                    imgEl.getAttribute('data-alt') || 
                    `image_${index}`;
        
        // Skip data URIs, tracking pixels, and very small images
        if (src.startsWith('data:') || 
            src.includes('google.com/images/branding') ||
            src.includes('doubleclick.net') ||
            src.includes('googlesyndication.com') ||
            src.length < 10) {
          return;
        }

        // Try to get higher resolution from parent link
        const href = link?.href || '';
        
        results.push({
          url: src,
          altText: alt,
          sourceUrl: href,
          width: imgEl.naturalWidth || imgEl.width,
          height: imgEl.naturalHeight || imgEl.height
        });
      });
      
      return results;
    }, selectorString);

    // Convert thumbnails to full-size URLs in Node.js context
    const images = rawImages.map(img => ({
      ...img,
      url: this.getFullSizeImageUrl(img.url)
    }));

    // Filter out non-image URLs (SVG icons, data URIs, etc.)
    const validImages = images.filter(img => {
      const url = img.url.toLowerCase();
      // Skip SVG icons and UI elements
      if (url.includes('.svg') || url.includes('/rp/') || url.startsWith('data:')) {
        return false;
      }
      // getImageFormat already recognises the extensionless CDN hosts
      // (bing / duckduckgo proxy / googleusercontent), so a recognised
      // format is sufficient here.
      const ext = this.getImageFormat(img.url);
      if (!this.config.acceptedFormats.includes(ext)) {
        return false;
      }
      // Check minimum size
      if (img.width && img.height) {
        if (img.width < this.config.minImageSize.width || img.height < this.config.minImageSize.height) {
          return false;
        }
      }
      return true;
    });

    // Filter and deduplicate
    const uniqueImages = new Map<string, ImageResult>();
    
    for (const img of validImages) {
      if (!img.url || uniqueImages.has(img.url)) continue;
      
      const ext = this.getImageFormat(img.url);
      
      uniqueImages.set(img.url, {
        url: img.url,
        altText: img.altText,
        width: img.width,
        height: img.height,
        format: ext,
        sourceUrl: img.sourceUrl
      });
    }

    return Array.from(uniqueImages.values()).slice(0, this.config.maxImages);
  }

  /**
   * Get image format from URL
   */
  private getImageFormat(url: string): string {
    try {
      const urlObj = new URL(this.absolutizeUrl(url));
      const hostname = urlObj.hostname.toLowerCase();
      const pathname = urlObj.pathname.toLowerCase();

      // Bing image CDN serves extensionless paths like /th/id/OIP.xxx and
      // /th?q=Some+Query. Treat any of those as an image (JPEG) rather than
      // falling through to the extension check, which would read the query
      // string as a bogus "extension".
      // Bing image CDN serves extensionless paths. Note both the public CDN
      // (th.bing.com) and the per-market hosts (tse4.mm.bing.net) that
      // DuckDuckGo's proxy unwraps to.
      const isBingThumb =
        (hostname.endsWith('bing.com') || hostname.endsWith('bing.net')) &&
        (pathname.startsWith('/th/') || pathname === '/th');
      if (isBingThumb) {
        return 'jpg';
      }

      if (hostname === 'external-content.duckduckgo.com' && pathname.startsWith('/iu/')) {
        return 'jpg';
      }

      // Google thumbnail hosts also serve extensionless paths.
      if (
        (hostname.endsWith('googleusercontent.com') || hostname.endsWith('gstatic.com')) &&
        !/\.[a-z0-9]{2,5}$/.test(pathname)
      ) {
        return 'jpg';
      }

      const ext = pathname.split('.').pop() || '';
      return /^[a-z0-9]{2,5}$/.test(ext) ? ext : '';
    } catch {
      return '';
    }
  }

  /**
   * Resolve a possibly protocol-relative URL (e.g. "//host/path") against
   * the page origin. DuckDuckGo serves image srcs in that form, and axios
   * cannot parse them as-is.
   */
  private absolutizeUrl(rawUrl: string): string {
    if (!rawUrl) return rawUrl;
    if (rawUrl.startsWith('//')) {
      return `https:${rawUrl}`;
    }
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      return rawUrl;
    }
    return rawUrl;
  }

  /**
   * Convert thumbnail URL to full-size image URL for various engines
   */
  private getFullSizeImageUrl(thumbUrl: string): string {
    try {
      const url = new URL(this.absolutizeUrl(thumbUrl));
      
      // Bing thumbnails: https://th.bing.com/th/id/OIP.{id}?w=xxx&h=xxx&c=7&r=0&o=7&pid=1.7&rm=3
      // Full size: https://th.bing.com/th/id/OIP.{id}?pid=1.7&rm=3 (remove w, h, c, r, o params)
      if (url.hostname === 'th.bing.com' && url.pathname.includes('/th/id/')) {
        url.searchParams.delete('w');
        url.searchParams.delete('h');
        url.searchParams.delete('c');
        url.searchParams.delete('r');
        url.searchParams.delete('o');
        // Keep pid and rm for tracking
        return url.toString();
      }
      
      // Google thumbnails often have similar patterns
      if (url.hostname.includes('googleusercontent.com') || url.hostname.includes('gstatic.com')) {
        url.searchParams.delete('w');
        url.searchParams.delete('h');
        url.searchParams.delete('sz');
        return url.toString();
      }
      
      // DuckDuckGo proxy URLs: //external-content.duckduckgo.com/iu/?u=<encoded_url>
      // Extract the actual image URL from the 'u' parameter
      if (url.hostname === 'external-content.duckduckgo.com' && url.pathname.includes('/iu/')) {
        const actualUrl = url.searchParams.get('u');
        if (actualUrl) {
          try {
            return decodeURIComponent(actualUrl);
          } catch {
            return actualUrl;
          }
        }
      }
      
      return thumbUrl;
    } catch {
      return thumbUrl;
    }
  }

  /**
   * Download a single image with retry logic
   */
  private async downloadImage(image: ImageResult, index: number): Promise<string | null> {
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response: AxiosResponse<ArrayBuffer> = await axios.get(this.absolutizeUrl(image.url), {
          responseType: 'arraybuffer',
          timeout: 15000,
          headers: {
            'User-Agent': this.config.userAgent,
            'Referer': this.getRefererForEngine(),
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
          },
          maxContentLength: 50 * 1024 * 1024 // 50MB limit
        });

        const contentType = String(response.headers['content-type'] || '');
        let ext = this.getImageFormat(image.url);
        
        // Determine extension from content type if URL doesn't have one
        if (!ext || !this.config.acceptedFormats.includes(ext)) {
          if (contentType.includes('jpeg')) ext = 'jpg';
          else if (contentType.includes('png')) ext = 'png';
          else if (contentType.includes('webp')) ext = 'webp';
          else if (contentType.includes('gif')) ext = 'gif';
          else ext = 'jpg';
        }

        const filename = `${index.toString().padStart(4, '0')}_${this.sanitizeFilename(image.altText)}.${ext}`;
        const filepath = path.join(this.config.outputDir, filename);

        await mkdirp(this.config.outputDir);
        fs.writeFileSync(filepath, Buffer.from(response.data));

        console.log(`Downloaded: ${filename} (${(response.data.byteLength / 1024).toFixed(1)} KB)`);
        return filepath;
      } catch (error) {
        if (attempt === this.config.maxRetries) {
          console.error(`Failed to download ${image.url} after ${this.config.maxRetries} attempts:`, error instanceof Error ? error.message : error);
          return null;
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    return null;
  }

  /**
   * Get referer header based on search engine
   */
  private getRefererForEngine(): string {
    switch (this.config.searchEngine) {
      case 'google':
        return 'https://www.google.com/';
      case 'bing':
        return 'https://www.bing.com/';
      case 'duckduckgo':
        return 'https://duckduckgo.com/';
      default:
        return 'https://www.google.com/';
    }
  }

  /**
   * Sanitize filename
   */
  private sanitizeFilename(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9\s_-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  }

  /**
   * Main scrape function
   */
  async scrape(query?: string): Promise<ScrapeResult> {
    const searchQuery = query || this.config.query;
    const errors: string[] = [];
    let downloaded = 0;
    let failed = 0;

    try {
      await this.initialize();
      
      if (!this.page) throw new Error('Page not initialized');

      console.log(`Searching ${this.config.searchEngine} for: "${searchQuery}"`);
      const searchUrl = this.buildSearchUrl(searchQuery);
      
      // Use domcontentloaded instead of networkidle for faster loading
      await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });
      await this.page.waitForTimeout(2000 + Math.random() * 2000);

      // Handle consent dialog if present
      await this.handleConsentDialog();

      console.log('Scrolling to load images...');
      await this.scrollToLoadImages();

      // Wait a bit more for images to fully load
      await this.page.waitForTimeout(3000);

      console.log('Extracting image data...');
      const images = await this.extractImages();
      console.log(`Found ${images.length} images`);

      // Download images with delay
      for (let i = 0; i < images.length; i++) {
        const result = await this.downloadImage(images[i], i + 1);
        if (result) {
          downloaded++;
        } else {
          failed++;
          errors.push(`Failed to download image ${i + 1}: ${images[i].url}`);
        }

        // Respectful delay between downloads
        if (i < images.length - 1) {
          await this.page.waitForTimeout(this.config.requestDelay + Math.random() * 1000);
        }
      }

      return { images, downloaded, failed, errors };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      return { images: [], downloaded, failed, errors };
    } finally {
      await this.close();
    }
  }

  /**
   * Close browser and cleanup
   */
  async close(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Export alias for backward compatibility
export { ImageScraper as GoogleImagesScraper };