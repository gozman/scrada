const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startScraping: (data) => ipcRenderer.invoke('start-scraping', data),
  onProgressUpdate: (callback) => ipcRenderer.on('progress-update', callback),
  listKnowledgeSources: (apiKey, subdomain) =>
    ipcRenderer.invoke('list-knowledge-sources', { apiKey, subdomain }),
  deleteKnowledgeSource: (apiKey, subdomain, sourceId) =>
    ipcRenderer.invoke('delete-knowledge-source', { apiKey, subdomain, sourceId }),

  // Expose method to fetch sitemap URLs
  fetchSitemapUrls: (sitemapUrl) => ipcRenderer.invoke('fetch-sitemap-urls', sitemapUrl),
});
