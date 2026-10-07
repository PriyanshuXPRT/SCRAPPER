import { SearchEngine } from './search-engines.js';

/**
 * Configuration for the image scraper
 */
export interface ScraperConfig {
  /** Search query for images */
  query: string;
  /** Maximum number of images to download */
  maxImages: number;
  /** Output directory for downloaded images */
  outputDir: string;
  /** Headless mode (true = no browser UI) */
  headless: boolean;
  /** Delay between requests in milliseconds */
  requestDelay: number;
  /** Timeout for page operations in milliseconds */
  timeout: number;
  /** User agent string */
  userAgent: string;
  /** Viewport size */
  viewport: { width: number; height: number };
  /** Retry attempts for failed operations */
  maxRetries: number;
  /** Minimum image dimensions to download */
  minImageSize: { width: number; height: number };
  /** Accepted image formats */
  acceptedFormats: string[];
  /** Search engine to use */
  searchEngine: SearchEngine;
  /** Search parameters */
  searchParams: {
    safeSearch: 'on' | 'off';
    imageType: 'photo' | 'clipart' | 'lineart' | 'face' | 'news';
    imageSize: 'large' | 'medium' | 'icon' | 'any';
    imageColor: 'color' | 'bw' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'purple' | 'pink' | 'white' | 'gray' | 'black' | 'brown';
  };
}

/**
 * Default configuration
 */
export const defaultConfig: ScraperConfig = {
  query: 'cats',
  maxImages: 20,
  outputDir: './downloads',
  headless: true,
  requestDelay: 2000,
  timeout: 60000,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  viewport: { width: 1920, height: 1080 },
  maxRetries: 3,
  minImageSize: { width: 100, height: 100 },
  acceptedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  searchEngine: 'bing',
  searchParams: {
    safeSearch: 'on',
    imageType: 'photo',
    imageSize: 'large',
    imageColor: 'color'
  }
};

/**
 * Creates a configuration with overrides
 */
export function createConfig(overrides: Partial<ScraperConfig>): ScraperConfig {
  return {
    ...defaultConfig,
    ...overrides,
    viewport: { ...defaultConfig.viewport, ...overrides.viewport },
    searchParams: { ...defaultConfig.searchParams, ...overrides.searchParams }
  };
}