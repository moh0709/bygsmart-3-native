import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const outputPath = path.join(projectRoot, 'data/publicRegulationFullText.generated.ts');

const escapeHtml = (value) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const textToHtml = (text) => {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !['Linket er kopieret', 'Fold alle ud'].includes(line));

  return lines
    .map((line) => {
      if (/^(Kapitel|Afsnit)\s+\d+/i.test(line)) return `<h3>${escapeHtml(line)}</h3>`;
      if (/^§\s*\d+/.test(line)) return `<h4>${escapeHtml(line)}</h4>`;
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join('\n');
};

const normalizeText = (text) =>
  text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

async function fetchBr18ChapterLinks() {
  const html = await fetch('https://www.bygningsreglementet.dk/').then((response) =>
    response.text()
  );
  const dom = new JSDOM(html);
  const links = [...dom.window.document.querySelectorAll('a')]
    .map((anchor) => ({
      text: normalizeText(anchor.textContent || '').replace(/\s+/g, ' '),
      href: anchor.href,
    }))
    .filter(({ href, text }) => /bygningsreglementet\.dk\/.+\/krav\/$/i.test(href) && /^\d+/.test(text));

  const byChapter = new Map();
  for (const link of links) {
    const chapter = Number(link.text.match(/^(\d+)/)?.[1]);
    if (chapter >= 1 && chapter <= 35 && !byChapter.has(chapter)) {
      byChapter.set(chapter, link);
    }
  }

  return [...byChapter.entries()]
    .sort(([a], [b]) => a - b)
    .map(([chapter, link]) => ({ chapter, ...link }));
}

async function fetchBr18Entries() {
  const chapterLinks = await fetchBr18ChapterLinks();
  const entries = [];

  for (const link of chapterLinks) {
    const url = `${link.href}?Layout=ShowAsPdf`;
    const html = await fetch(url).then((response) => response.text());
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const title = normalizeText(doc.querySelector('h1')?.textContent || link.text);
    const sections = [...doc.querySelectorAll('section.anchor-reference')];
    const text = normalizeText(
      sections.length > 0
        ? sections.map((section) => section.textContent || '').join('\n\n')
        : doc.querySelector('main')?.textContent || ''
    );

    entries.push({
      id: `br18-kap${link.chapter}`,
      body_html: [
        `<p><strong>Fuld offentlig kravtekst hentet fra Bygningsreglementet.dk.</strong></p>`,
        textToHtml(text),
      ].join('\n'),
      source_url: link.href,
      version: 'BR18 offentlig kravtekst',
      fetched_from: url,
    });
  }

  return entries;
}

async function fetchRenderedText(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForTimeout(8_000);
  return normalizeText(await page.locator('body').innerText({ timeout: 10_000 }));
}

async function fetchRenderedEntries() {
  const sources = [
    {
      id: 'ab18-aftalegrundlag',
      title: 'AB 18: fuld offentlig tekst',
      url: 'https://www.retsinformation.dk/eli/retsinfo/2018/9632',
    },
    {
      id: 'ab18-sikkerhed',
      aliasOf: 'ab18-aftalegrundlag',
    },
    {
      id: 'ab18-tid',
      aliasOf: 'ab18-aftalegrundlag',
    },
    {
      id: 'ab18-aendringer',
      aliasOf: 'ab18-aftalegrundlag',
    },
    {
      id: 'ab18-betaling',
      aliasOf: 'ab18-aftalegrundlag',
    },
    {
      id: 'ab18-aflevering',
      aliasOf: 'ab18-aftalegrundlag',
    },
    {
      id: 'ab18-tvister',
      aliasOf: 'ab18-aftalegrundlag',
    },
    {
      id: 'at-arbejdsmiljoeloven',
      title: 'Arbejdsmiljøloven: fuld offentlig tekst',
      url: 'https://regler.at.dk/love-eu-forordninger/arbejdsmiljoe-2062-sam/',
    },
    {
      id: 'at-bygge-anlaeg',
      title: 'Bekendtgørelse om bygge- og anlægsarbejde: fuld offentlig tekst',
      url: 'https://regler.at.dk/bekendtgoerelser/bygge-anlaegsarbejde-2107/',
    },
    {
      id: 'at-velfaerd',
      aliasOf: 'at-bygge-anlaeg',
    },
    {
      id: 'at-arbejdets-udfoerelse',
      title: 'Bekendtgørelse om arbejdets udførelse: fuld offentlig tekst',
      url: 'https://regler.at.dk/bekendtgoerelser/arbejdets-udfoerelse-1839-sam/',
    },
    {
      id: 'at-bygherre-pligter',
      title: 'AT-vejledning: Bygherrens ansvar',
      url: 'https://regler.at.dk/at-vejledninger/bygherrens-ansvar-hvem-hvor-hvornaar-25-2/',
    },
    {
      id: 'at-stillads-hoejde',
      title: 'AT-vejledning: Arbejde i højden, stillads og faldsikring',
      url: 'https://regler.at.dk/at-vejledninger/anvendelse-en-flermastede-arbejdsplatforme-2-3-3/',
    },
  ];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const resolved = new Map();
  const entries = [];

  try {
    for (const source of sources) {
      if (source.aliasOf) {
        const original = resolved.get(source.aliasOf);
        if (original) {
          entries.push({ id: source.id, ...original });
        }
        continue;
      }

      const text = await fetchRenderedText(page, source.url);
      const entry = {
        body_html: [
          `<p><strong>${escapeHtml(source.title)} hentet fra officiel offentlig kilde.</strong></p>`,
          textToHtml(text),
        ].join('\n'),
        source_url: source.url,
        version: 'Offentlig tekst',
        fetched_from: source.url,
      };
      resolved.set(source.id, entry);
      entries.push({ id: source.id, ...entry });
    }
  } finally {
    await browser.close();
  }

  return entries;
}

const entries = [...(await fetchBr18Entries()), ...(await fetchRenderedEntries())];
const generatedAt = new Date().toISOString();

const content = `// Generated by scripts/fetch-public-regulations.mjs on ${generatedAt}
// Public legal/regulatory source text only. Do not add DS/SBi full text here unless licensed.

export interface PublicRegulationFullText {
  body_html: string;
  source_url: string;
  version: string;
  fetched_from: string;
}

export const PUBLIC_REGULATION_FULL_TEXT: Record<string, PublicRegulationFullText> = ${JSON.stringify(
  Object.fromEntries(entries.map(({ id, ...entry }) => [id, entry])),
  null,
  2
)};
`;

await fs.writeFile(outputPath, content, 'utf8');
console.log(`Wrote ${entries.length} public regulation text entries to ${outputPath}`);
