const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startScraping: (data) => ipcRenderer.invoke('start-scraping', data),
  onProgressUpdate: (callback) => ipcRenderer.on('progress-update', callback),

  // Expose methods for listing and deleting knowledge sources
  listKnowledgeSources: (apiKey, subdomain) =>
    ipcRenderer.invoke('list-knowledge-sources', { apiKey, subdomain }),
  deleteKnowledgeSource: (apiKey, subdomain, sourceId) =>
    ipcRenderer.invoke('delete-knowledge-source', { apiKey, subdomain, sourceId }),
});
