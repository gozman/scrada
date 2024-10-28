const form = document.getElementById('scrape-form');
const output = document.getElementById('output');
const progressDiv = document.getElementById('progress');
const listSourcesBtn = document.getElementById('listSourcesBtn');
const knowledgeSourcesTable = document.getElementById('knowledgeSourcesTable').querySelector('tbody');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const sitemapUrl = document.getElementById('sitemapUrl').value;
  const knowledgeSourceName = document.getElementById('knowledgeSourceName').value;
  const apiKey = document.getElementById('apiKey').value;
  const subdomain = document.getElementById('subdomain').value;
  // Read the URL Filter value
  const urlFilter = document.getElementById('urlFilter').value;

  if (!apiKey || !subdomain) {
    alert('Please enter your Knowledge API Key and Ada Subdomain in the configuration.');
    return;
  }

  try {
    // Send data to the main process to start scraping
    const result = await electronAPI.startScraping({
      sitemapUrl,
      knowledgeSourceName,
      apiKey,
      subdomain,
      urlFilter, // Include the URL filter
    });

    // Provide feedback to the user
    progressDiv.innerText = result;
  } catch (error) {
    console.error('Scraping Error:', error);
    alert(error.message);
  }
});

// Handle Progress Updates from Main Process (if any)
electronAPI.onProgressUpdate((event, data) => {
  const { message } = data;
  progressDiv.textContent = message;
});

// **Event Listener to List Knowledge Sources**
listSourcesBtn.addEventListener('click', async () => {
  console.log('List Knowledge Sources button clicked'); // Add this line for debugging
  const apiKey = document.getElementById('apiKey').value;
  const subdomain = document.getElementById('subdomain').value;

  if (!apiKey || !subdomain) {
    alert('Please enter your Knowledge API Key and Ada Subdomain in the configuration.');
    return;
  }

  try {
    // Call the exposed listKnowledgeSources API
    const sources = await electronAPI.listKnowledgeSources(apiKey, subdomain);
    populateKnowledgeSourcesTable(sources);
  } catch (error) {
    console.error('List Sources Error:', error);
    alert(error.message);
  }
});

// **Function to Populate the Knowledge Sources Table**
function populateKnowledgeSourcesTable(sources) {
  knowledgeSourcesTable.innerHTML = ''; // Clear existing content

  if (sources.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="3" class="text-center">No knowledge sources found.</td>`;
    knowledgeSourcesTable.appendChild(tr);
    return;
  }

  sources.forEach((source) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${source.name}</td>
      <td>${source.id}</td>
      <td>
        <button class="btn btn-danger btn-sm delete-btn" data-id="${source.id}">Delete</button>
      </td>
    `;
    knowledgeSourcesTable.appendChild(tr);
  });

  // Add event listeners to delete buttons
  const deleteButtons = document.querySelectorAll('.delete-btn');
  deleteButtons.forEach((btn) => {
    btn.addEventListener('click', deleteKnowledgeSource);
  });
}

// **Function to Delete a Knowledge Source**
async function deleteKnowledgeSource(event) {
  const sourceId = event.target.getAttribute('data-id');
  const apiKey = document.getElementById('apiKey').value;
  const subdomain = document.getElementById('subdomain').value;

  if (!apiKey || !subdomain) {
    alert('Please enter your Knowledge API Key and Ada Subdomain in the configuration.');
    return;
  }

  if (confirm('Are you sure you want to delete this knowledge source?')) {
    try {
      // Call the exposed deleteKnowledgeSource API
      const result = await electronAPI.deleteKnowledgeSource(apiKey, subdomain, sourceId);
      alert(result.message);
      // Refresh the list
      listSourcesBtn.click();
    } catch (error) {
      console.error('Delete Source Error:', error);
      alert(error.message);
    }
  }
}
