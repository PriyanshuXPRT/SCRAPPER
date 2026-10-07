import { ScraperConfig } from './config.js';

export type SearchEngine = 'google' | 'bing' | 'duckduckgo';

export interface SearchEngineConfig {
  name: string;
  baseUrl: string;
  searchPath: string;
  params: Record<string, string>;
  imageSelectors: string[];
  nextPageSelectors: string[];
  consentSelectors: string[];
}

/**
 * Search engine configurations
 */
export const searchEngines: Record<SearchEngine, SearchEngineConfig> = {
  google: {
    name: 'Google Images',
    baseUrl: 'https://www.google.com',
    searchPath: '/search',
    params: { tbm: 'isch' },
    imageSelectors: [
      'div[data-q] img',
      'div[jscontroller] img', 
      '.rg_i',
      '[data-iid] img',
      '.isv-r img',
      '.islrg img'
    ],
    nextPageSelectors: [
      'input[value="Show more results"]',
      'button:has-text("Show more results")',
      '[jsname="Q5Txwe"]'
    ],
    consentSelectors: [
      'button:has-text("Accept all")',
      'button:has-text("I agree")',
      'button:has-text("Accept")',
      '[aria-label="Accept all"]',
      'button.L3eUgb'
    ]
  },
  bing: {
    name: 'Bing Images',
    baseUrl: 'https://www.bing.com',
    searchPath: '/images/search',
    params: { form: 'HDRSC2' },
    imageSelectors: [
      '.mimg',
      '.img_cont img',
      '.iusc img',
      '[data-src]',
      '.mmg img'
    ],
    nextPageSelectors: [
      '.btn_seemore',
      'a:has-text("See more")',
      '#smb',
      'button:has-text("See more images")',
      '.btn_see_more'
    ],
    consentSelectors: [
      'button:has-text("Accept")',
      '#bnp_btn_accept',
      '.bnp_btn_accept'
    ]
  },
  duckduckgo: {
    name: 'DuckDuckGo Images',
    baseUrl: 'https://duckduckgo.com',
    searchPath: '/',
    params: { iax: 'images', ia: 'images' },
    imageSelectors: [
      'img[src*="external-content.duckduckgo.com/iu/"]',
      '.tile--img__img',
      '.result__image img',
      '[data-src]',
      '.image__img'
    ],
    nextPageSelectors: [
      '.result--more__btn',
      'a:has-text("More Images")'
    ],
    consentSelectors: []
  }
};

/**
 * Build search URL for a given engine
 */
export function buildSearchUrl(engine: SearchEngine, query: string, config: ScraperConfig): string {
  const engineConfig = searchEngines[engine];
  const params = new URLSearchParams({
    ...engineConfig.params,
    q: query
  });

  // Bing expresses filters as a "+"-joined qft list. Build the whole list
  // rather than overwriting qft, otherwise the last filter wins and the
  // earlier ones are silently dropped.
  if (engine === 'bing') {
    const qft: string[] = [];

    const sizeMap: Record<string, string> = {
      large: 'large',
      medium: 'medium',
      icon: 'icon',
      any: ''
    };
    const sizeFilter = sizeMap[config.searchParams.imageSize];
    if (sizeFilter) {
      qft.push(`filterui:imagesize-${sizeFilter}`);
    }

    if (config.searchParams.imageType !== 'photo') {
      qft.push(`filterui:photo-${config.searchParams.imageType}`);
    }

    if (config.searchParams.imageColor !== 'color') {
      qft.push(`filterui:color-${config.searchParams.imageColor}`);
    }

    if (qft.length > 0) {
      params.set('qft', qft.join('+'));
    }

    // Safe search is the `adlt` param. Note that guessing a
    // `filterui:photo-strict` qft value here collapses results to ~6
    // tiles, so use the supported param instead.
    if (config.searchParams.safeSearch === 'on') {
      params.set('adlt', 'strict');
    }
  }

  return `${engineConfig.baseUrl}${engineConfig.searchPath}?${params.toString()}`;
}

/**
 * Get image selectors for an engine
 */
export function getImageSelectors(engine: SearchEngine): string[] {
  return searchEngines[engine].imageSelectors;
}

/**
 * Get next page selectors for an engine
 */
export function getNextPageSelectors(engine: SearchEngine): string[] {
  return searchEngines[engine].nextPageSelectors;
}

/**
 * Get consent selectors for an engine
 */
export function getConsentSelectors(engine: SearchEngine): string[] {
  return searchEngines[engine].consentSelectors;
}