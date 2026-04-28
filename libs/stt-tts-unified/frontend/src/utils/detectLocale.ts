import { franc } from 'franc-min'

// Maps franc ISO 639-3 codes to edge_tts BCP 47 locale prefixes
const FRANC_TO_LOCALE: Record<string, string> = {
  // Chinese
  cmn: 'zh', yue: 'zh', nan: 'zh', hak: 'zh',
  // Major languages
  eng: 'en',
  jpn: 'ja',
  kor: 'ko',
  spa: 'es',
  fra: 'fr',
  deu: 'de',
  por: 'pt',
  ara: 'ar',
  rus: 'ru',
  hin: 'hi',
  tha: 'th',
  vie: 'vi',
  ind: 'id',
  msa: 'ms',
  zlm: 'ms',
  tur: 'tr',
  pol: 'pl',
  nld: 'nl',
  ita: 'it',
  ukr: 'uk',
  ces: 'cs',
  swe: 'sv',
  dan: 'da',
  fin: 'fi',
  nob: 'nb',
  nor: 'nb',
  ell: 'el',
  heb: 'he',
  fas: 'fa',
  ben: 'bn',
  tam: 'ta',
  tel: 'te',
  kan: 'kn',
  mal: 'ml',
  guj: 'gu',
  mar: 'mr',
  ron: 'ro',
  hun: 'hu',
  bul: 'bg',
  hrv: 'hr',
  slk: 'sk',
  slv: 'sl',
  lit: 'lt',
  lav: 'lv',
  est: 'et',
  cat: 'ca',
  glg: 'gl',
  afr: 'af',
  amh: 'am',
  mya: 'my',
  khm: 'km',
  sin: 'si',
  mon: 'mn',
  nep: 'ne',
  som: 'so',
  swa: 'sw',
  zul: 'zu',
  srp: 'sr',
  mkd: 'mk',
  kat: 'ka',
  kaz: 'kk',
  uzb: 'uz',
  aze: 'az',
  cym: 'cy',
  gle: 'ga',
  mlt: 'mt',
  isl: 'is',
  fil: 'fil',
  jav: 'jv',
  sun: 'su',
}

const DEFAULT_LOCALE = 'zh'
const MIN_TEXT_LENGTH = 10

/**
 * Detects the language of the given text and returns the matching
 * edge_tts locale prefix (e.g. 'zh', 'en', 'ja').
 * Falls back to 'zh' when text is too short or language is undetermined.
 */
export function detectLocalePrefix(text: string): string {
  if (text.trim().length < MIN_TEXT_LENGTH) return DEFAULT_LOCALE

  const code = franc(text)
  if (code === 'und') return DEFAULT_LOCALE

  return FRANC_TO_LOCALE[code] ?? DEFAULT_LOCALE
}
