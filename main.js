const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { createSourceAndUploadContent } = require('./scrada.js');
const fetch = require('node-fetch'); // Import node-fetch for HTTP requests

// Function to create the main application window
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1024,   // Updated width
    height: 800,   // Updated height
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Use a preload script
      contextIsolation: true, // Enable context isolation for security
      nodeIntegration: false, // Disable Node.js integration in renderer
    },
  });

  mainWindow.loadFile('index.html');
}

// App lifecycle events
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // On macOS, it's common for applications to stay open until the user explicitly quits
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  // On macOS, re-create a window when the dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Existing IPC Handler to start scraping
ipcMain.handle('start-scraping', async (event, data) => {
  const { sitemapUrl, knowledgeSourceName, apiKey, subdomain } = data;
  const mainWindow = BrowserWindow.getFocusedWindow();

  try {
    await createSourceAndUploadContent(
      sitemapUrl,
      knowledgeSourceName,
      apiKey,
      subdomain,
      mainWindow
    );
    return 'Scraping and upload completed successfully.';
  } catch (error) {
    console.error('Error:', error);
    throw new Error('An error occurred during the scraping process.');
  }
});

// **IPC Handler to list knowledge sources**
ipcMain.handle('list-knowledge-sources', async (event, data) => {
  const { apiKey, subdomain } = data;
  const url = `https://${subdomain}.ada.support/api/knowledge/v1/sources`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Failed to fetch knowledge sources: ${errorData.message || response.statusText}`
      );
    }

    const sources = await response.json();
    return sources.data;
  } catch (error) {
    console.error('Error listing knowledge sources:', error);
    throw new Error('Failed to list knowledge sources.');
  }
});

// **IPC Handler to delete a knowledge source**
ipcMain.handle('delete-knowledge-source', async (event, data) => {
  const { apiKey, subdomain, sourceId } = data;
  const url = `https://${subdomain}.ada.support/api/knowledge/v1/sources/${sourceId}`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Failed to delete knowledge source: ${errorData.message || response.statusText}`
      );
    }

    return { success: true, message: 'Knowledge source deleted successfully.' };
  } catch (error) {
    console.error('Error deleting knowledge source:', error);
    throw new Error('Failed to delete knowledge source.');
  }
});
