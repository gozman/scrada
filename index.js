const fs = require('fs');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const xml2js = require('xml2js');
const { Builder, By } = require('selenium-webdriver');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

require('dotenv').config();

const TurndownService = require('turndown');

const figlet = require("figlet");
const cliProgress = require('cli-progress');

const API_KEY = process.env.API_KEY;
const BASE_URL = `https://${process.env.SUBDOMAIN}.ada.support/api`;

let inquirer;

const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    'accept': 'application/json'
};

async function createKnowledgeSource(src) {
    console.log("Creating source: " + src + " at " + `${BASE_URL}/knowledge/v1/sources`);
    const response = await axios.post(`${BASE_URL}/knowledge/v1/sources`, {
      name: src
    }, { headers });
    return response.data.data.id;
  }

async function getUserInputs() {
    const questions = [
        {
            type: 'input',
            name: 'sitemapUrl',
            message: 'Please enter the URL to the sitemap you want to scrape:',
            validate: function(value) {
                var pass = value.match(
                    /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/
                );
                if (pass) {
                    return true;
                }
                return 'Please enter a valid URL!';
            }
        },
        {
            type: 'input',
            name: 'knowledgeSourceName',
            message: 'Please enter the name of the knowledge source to create:',
            validate: function(value) {
                if (value.length) {
                    return true;
                }
                return 'Please enter a valid name!';
            }
        }
    ];

    return inquirer.prompt(questions);
}

async function fetchSitemapUrls(sitemapUrl) {
    try {
        const response = await axios.get(sitemapUrl);
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(response.data);
        const urls = result.urlset.url.map(urlEntry => urlEntry.loc[0]);
        return urls;
    } catch (error) {
        console.error('Error fetching or parsing sitemap:', error);
        return [];
    }
}

async function scrapeAndConvertToMarkdown(sitemapUrl) {
    let driver;
    let results = [];

    try {
        const urls = await fetchSitemapUrls(sitemapUrl);
        driver = new Builder().forBrowser('chrome').build();

        const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
        progressBar.start(urls.length, 0);

        for (const [index, url] of urls.entries()) {
            try {
                let driver = await new Builder().forBrowser('chrome').build();
                await driver.get(url);
                await driver.wait(() => driver.executeScript('return document.readyState').then(state => state === 'complete'), 10000);
                const title = await driver.findElement(By.css('title')).getAttribute('innerText');
                const bodyHtml = await driver.findElement(By.css('body')).getAttribute('outerHTML');
                await driver.quit();
            
                const dom = new JSDOM(bodyHtml);
                const reader = new Readability(dom.window.document);
                const article = reader.parse();
                const markdown = article ? new TurndownService().turndown(article.content) : "Could not convert content to markdown.";

                results.push({
                    url: url,
                    title: title,
                    markdown: markdown
                });

                progressBar.update(index + 1);
            } catch (pageError) {
                console.error(`Error processing URL ${url}:`, pageError);
                progressBar.update(index + 1); // Ensure progress bar updates even on error
            }
        }

       progressBar.stop();
    } catch (error) {
        console.error('Error during scraping and conversion:', error);
    } finally {
        if (driver) {
            await driver.quit();
        }
    }

    return results;
}

async function createSourceAndUploadContent(sitemapUrl, sourceName) {
    // Create a knowledge source with a dynamic name using predefined function
    const sourceId = await createKnowledgeSource(sourceName);

    // Scrape URLs and convert to Markdown
    const scrapedData = await scrapeAndConvertToMarkdown(sitemapUrl);
    console.log("Uploading " + scrapedData.length + " articles to kb source " +sourceId);

    // Upload articles to Ada with progress display
    const uploadProgressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    uploadProgressBar.start(scrapedData.length, 0);
    let uploadedCount = 0;

    for (const article of scrapedData) {
        await axios.post(`${BASE_URL}/knowledge/v1/articles`, {
            articles: [{
              id: uuidv4(),
              name: article.title,
              content: article.markdown,
              url: article.url,
              knowledge_source_id: sourceId,
              external_created: new Date().toISOString(),
              external_updated: new Date().toISOString()
            }]
          }, { headers });
        uploadedCount++;
        uploadProgressBar.update(uploadedCount);
    }

    uploadProgressBar.stop();
}

async function main() {
    inquirer = (await import('inquirer')).default;

    // Generate ASCII art for the project name "Scrada"
    figlet('Scrada', function(err, data) {
        if (err) {
            console.log('Something went wrong...');
            console.dir(err);
            return;
        }
        console.log(data);

        // After displaying the ASCII art, proceed to capture user inputs
        getUserInputs().then(inputs => {
            const { sitemapUrl, knowledgeSourceName } = inputs;

            // Create a knowledge source and upload content
            createSourceAndUploadContent(sitemapUrl, knowledgeSourceName)
                .then(() => {
                    console.log('Knowledge base source created and content uploaded successfully.');
                })
                .catch(error => {
                    console.error('Failed to create source and upload content:', error);
                });
        }).catch(error => {
            console.error('Failed to get user inputs:', error);
        });
    });
}

main()


