const axios = require('axios');
const xml2js = require('xml2js');
const fs = require('fs');

const parser = new xml2js.Parser();
const builder = new xml2js.Builder();

async function fetchSitemap(url) {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch sitemap from ${url}: ${error}`);
    return null;
  }
}

async function parseSitemap(xml) {
  try {
    const result = await parser.parseStringPromise(xml);
    const urls = [];
    const sitemaps = [];

    const urlset = result.urlset?.url;
    if (urlset) {
      urlset.forEach(url => urls.push(url.loc[0]));
    }

    const sitemapIndex = result.sitemapindex?.sitemap;
    if (sitemapIndex) {
      sitemapIndex.forEach(sitemap => sitemaps.push(sitemap.loc[0]));
    }

    return { urls, sitemaps };
  } catch (error) {
    console.error(`Failed to parse XML: ${error}`);
    return { urls: [], sitemaps: [] };
  }
}

async function extractUrls(sitemapUrl) {
  const visited = new Set();
  const allUrls = [];

  async function traverseSitemap(url) {
    if (visited.has(url)) return;
    visited.add(url);

    const xml = await fetchSitemap(url);
    if (!xml) return;

    const { urls, sitemaps } = await parseSitemap(xml);

    allUrls.push(...urls);
    for (const subSitemapUrl of sitemaps) {
      await traverseSitemap(subSitemapUrl);
    }
  }

  await traverseSitemap(sitemapUrl);
  return allUrls;
}

async function createSitemap(urls) {
  const urlset = {
    urlset: {
      $: { xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9' },
      url: urls.map(url => ({ loc: url }))
    }
  };

  return builder.buildObject(urlset);
}

async function main() {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readline.question('Enter the URL of the sitemap.xml: ', async (url) => {
    const urls = await extractUrls(url);
    const sitemapXml = await createSitemap(urls);
    fs.writeFileSync('output-sitemap.xml', sitemapXml);
    console.log('Generated sitemap.xml with individual pages.');
    readline.close();
  });
}

main();