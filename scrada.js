const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const xml2js = require('xml2js');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const TurndownService = require('turndown');
const { Builder, By } = require('selenium-webdriver');

// Removed config.json dependency
// const config = require('./config.json');

// Removed API_KEY and BASE_URL from here

// Now headers and BASE_URL will be constructed within the functions

// Existing functions refactored...

async function createKnowledgeSource(src, headers, baseUrl) {
  console.log(`Creating source: ${src} at ${baseUrl}/knowledge/v1/sources`);
  const response = await axios.post(
    `${baseUrl}/knowledge/v1/sources`,
    {
      name: src,
    },
    { headers }
  );
  return response.data.data.id;
}

async function fetchSitemapUrls(sitemapUrl) {
  const visited = new Set();
  const allUrls = [];
  const parser = new xml2js.Parser();

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
        urlset.forEach((url) => urls.push(url.loc[0]));
      }

      const sitemapIndex = result.sitemapindex?.sitemap;
      if (sitemapIndex) {
        sitemapIndex.forEach((sitemap) => sitemaps.push(sitemap.loc[0]));
      }

      return { urls, sitemaps };
    } catch (error) {
      console.error(`Failed to parse XML: ${error}`);
      return { urls: [], sitemaps: [] };
    }
  }

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

  console.log(`Total URLs discovered: ${allUrls.length}`);
  return allUrls;
}

async function scrapeAndConvertToMarkdown(urls, mainWindow) {
  let driver;
  const results = [];

  try {
    // For headless mode (optional), uncomment the following lines:
    // const chrome = require('selenium-webdriver/chrome');
    // const options = new chrome.Options();
    // options.addArguments('--headless', '--disable-gpu');
    // driver = new Builder().forBrowser('chrome').setChromeOptions(options).build();

    driver = await new Builder().forBrowser('chrome').build();

    for (const [index, url] of urls.entries()) {
      try {
        await driver.get(url);
        await driver.wait(
          () =>
            driver
              .executeScript('return document.readyState')
              .then((state) => state === 'complete'),
          10000
        );

        const title = await driver.getTitle();
        const bodyHtml = await driver.findElement(By.css('body')).getAttribute('outerHTML');

        const dom = new JSDOM(bodyHtml);
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        const markdown = article
          ? new TurndownService().turndown(article.content)
          : 'Could not convert content to markdown.';

        results.push({
          url: url,
          title: title,
          markdown: markdown,
        });

        mainWindow.webContents.send('progress-update', {
          message: `Scraped ${index + 1} of ${urls.length} pages`,
        });
      } catch (pageError) {
        console.error(`Error processing URL ${url}:`, pageError);
        mainWindow.webContents.send('progress-update', {
          message: `Error scraping URL ${index + 1}/${urls.length}`,
        });
      }
    }
  } catch (error) {
    console.error('Error during scraping and conversion:', error);
  } finally {
    if (driver) {
      await driver.quit();
    }
  }

  return results;
}

// Updated createSourceAndUploadContent function
async function createSourceAndUploadContent(sitemapUrl, sourceName, apiKey, subdomain, mainWindow) {
  const baseUrl = `https://${subdomain}.ada.support/api`;
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'accept': 'application/json',
  };

  // Create a knowledge source
  mainWindow.webContents.send('progress-update', { message: 'Creating knowledge source...' });
  const sourceId = await createKnowledgeSource(sourceName, headers, baseUrl);

  // Fetch URLs from the sitemap
  mainWindow.webContents.send('progress-update', { message: 'Fetching URLs from sitemap...' });
  const urls = await fetchSitemapUrls(sitemapUrl);

  // Scrape and convert the pages to markdown
  mainWindow.webContents.send('progress-update', { message: 'Scraping pages and converting to markdown...' });
  const scrapedData = await scrapeAndConvertToMarkdown(urls, mainWindow);

  // Upload articles to Ada with progress updates
  mainWindow.webContents.send('progress-update', { message: 'Uploading articles...' });

  let uploadedCount = 0;
  for (const [index, article] of scrapedData.entries()) {
    try {
      await axios.post(
        `${baseUrl}/knowledge/v1/articles`,
        {
          articles: [
            {
              id: uuidv4(),
              name: article.title,
              content: article.markdown,
              url: article.url,
              knowledge_source_id: sourceId,
              external_created: new Date().toISOString(),
              external_updated: new Date().toISOString(),
            },
          ],
        },
        { headers }
      );
      uploadedCount++;
      mainWindow.webContents.send('progress-update', {
        message: `Uploaded ${uploadedCount} of ${scrapedData.length} articles`,
      });
    } catch (uploadError) {
      console.error(`Error uploading article "${article.title}":`, uploadError);
      uploadedCount++;
      mainWindow.webContents.send('progress-update', {
        message: `Error uploading article ${uploadedCount}/${scrapedData.length}`,
      });
    }
  }

  mainWindow.webContents.send('progress-update', { message: 'Upload completed.' });
}

module.exports = {
  createSourceAndUploadContent,
};
