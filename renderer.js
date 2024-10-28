const form = document.getElementById('scrape-form');
const output = document.getElementById('output');
const progressDiv = document.getElementById('progress');
const listSourcesBtn = document.getElementById('listSourcesBtn');
const knowledgeSourcesTable = document.getElementById('knowledgeSourcesTable').querySelector('tbody');

// Step elements
const steps = {
  1: document.getElementById('step-1'),
  2: document.getElementById('step-2'),
  3: document.getElementById('step-3'),
  4: document.getElementById('step-4'),
  5: document.getElementById('step-5'),
};

let currentStep = 1;

// Function to show a specific step and hide others
function showStep(stepNumber) {
  for (const step in steps) {
    steps[step].style.display = 'none';
  }
  steps[stepNumber].style.display = 'block';
  currentStep = stepNumber;
}

// Initial step
showStep(1);

// Step 1: Next button
document.getElementById('to-step-2').addEventListener('click', async () => {
  // Validate API Key and Subdomain
  const apiKey = document.getElementById('apiKey').value;
  const subdomain = document.getElementById('subdomain').value;

  if (!apiKey || !subdomain) {
    alert('Please enter your Knowledge API Key and Ada Subdomain.');
    return;
  }

  // Proceed to Step 2
  await refreshKnowledgeSources();
  showStep(2);
});

// Step 2: Back and Next buttons
document.getElementById('back-to-step-1').addEventListener('click', () => {
  showStep(1);
});

document.getElementById('to-step-3').addEventListener('click', () => {
  showStep(3);
});

// Step 3: Back and Next buttons
document.getElementById('back-to-step-2').addEventListener('click', () => {
  showStep(2);
});

document.getElementById('to-step-4').addEventListener('click', async () => {
  // Fetch the URLs from the sitemap and proceed to Step 4
  const sitemapUrl = document.getElementById('sitemapUrl').value;
  if (!sitemapUrl) {
    alert('Please enter the Sitemap URL.');
    return;
  }

  try {
    const urls = await electronAPI.fetchSitemapUrls(sitemapUrl);
    urlsToScrape = urls; // Store the fetched URLs
    populateUrlList(urlsToScrape);
    showStep(4);
  } catch (error) {
    alert('Failed to fetch URLs from the sitemap. Please check the URL and try again.');
  }
});

// Step 4: Back and Next buttons
document.getElementById('back-to-step-3').addEventListener('click', () => {
  showStep(3);
});

document.getElementById('to-step-5').addEventListener('click', () => {
  showStep(5);
});

// Step 5: Back and Scrape buttons
document.getElementById('back-to-step-4').addEventListener('click', () => {
  showStep(4);
});

// Start Scraping button
document.getElementById('startScrapingBtn').addEventListener('click', async () => {
  const knowledgeSourceName = document.getElementById('knowledgeSourceName').value;
  const apiKey = document.getElementById('apiKey').value;
  const subdomain = document.getElementById('subdomain').value;

  if (!knowledgeSourceName) {
    alert('Please enter the Knowledge Source name.');
    return;
  }

  // Get selected URLs
  const selectedUrls = getSelectedUrls();

  if (selectedUrls.length === 0) {
    alert('Please select at least one URL to scrape.');
    return;
  }

  try {
    // Send data to the main process to start scraping
    await electronAPI.startScraping({
      knowledgeSourceName,
      apiKey,
      subdomain,
      urls: selectedUrls, // Only include selected URLs
    });
  } catch (error) {
    console.error('Scraping Error:', error);
    alert(error.message);
  }
});

// Function to refresh knowledge sources
async function refreshKnowledgeSources() {
  const apiKey = document.getElementById('apiKey').value;
  const subdomain = document.getElementById('subdomain').value;

  try {
    const sources = await electronAPI.listKnowledgeSources(apiKey, subdomain);
    populateKnowledgeSourcesTable(sources);
  } catch (error) {
    console.error('List Sources Error:', error);
    alert(error.message);
  }
}

// Populate knowledge sources table
function populateKnowledgeSourcesTable(sources) {
  const knowledgeSourcesTable = document
    .getElementById('knowledgeSourcesTable')
    .querySelector('tbody');
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
  const deleteButtons = knowledgeSourcesTable.querySelectorAll('.delete-btn');
  deleteButtons.forEach((btn) => {
    btn.addEventListener('click', deleteKnowledgeSource);
  });
}

// Event listener for refresh knowledge sources button
document.getElementById('refreshSourcesBtn').addEventListener('click', async () => {
  await refreshKnowledgeSources();
});

// Function to delete a knowledge source
async function deleteKnowledgeSource(event) {
  const sourceId = event.target.getAttribute('data-id');
  const apiKey = document.getElementById('apiKey').value;
  const subdomain = document.getElementById('subdomain').value;

  if (confirm('Are you sure you want to delete this knowledge source?')) {
    try {
      const result = await electronAPI.deleteKnowledgeSource(apiKey, subdomain, sourceId);
      alert(result.message);
      // Refresh the list
      await refreshKnowledgeSources();
    } catch (error) {
      console.error('Delete Source Error:', error);
      alert(error.message);
    }
  }
}

// Variables to store URLs
let urlsToScrape = [];

// Function to populate URL list in Step 4
function populateUrlList(urls) {
  const urlList = document.getElementById('urlList');
  urlList.innerHTML = '';

  urls.forEach((url) => {
    const li = document.createElement('li');
    li.classList.add('list-group-item');

    li.innerHTML = `
      <input type="checkbox" class="url-checkbox" checked data-url="${url}" /> ${url}
    `;

    urlList.appendChild(li);
  });
}

// Event listeners for Check All / Uncheck All buttons
document.getElementById('checkAllBtn').addEventListener('click', () => {
  const checkboxes = document.querySelectorAll('.url-checkbox');
  checkboxes.forEach((cb) => {
    if (cb.parentElement.style.display !== 'none') {
      cb.checked = true;
    }
  });
});

document.getElementById('uncheckAllBtn').addEventListener('click', () => {
  const checkboxes = document.querySelectorAll('.url-checkbox');
  checkboxes.forEach((cb) => {
    if (cb.parentElement.style.display !== 'none') {
      cb.checked = false;
    }
  });
});

// Event listener for page filter
document.getElementById('pageFilter').addEventListener('input', () => {
  const filterText = document.getElementById('pageFilter').value.toLowerCase();
  const listItems = document.querySelectorAll('#urlList .list-group-item');

  listItems.forEach((item) => {
    const url = item.textContent.toLowerCase();
    if (url.includes(filterText)) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
});

// Function to get selected URLs
function getSelectedUrls() {
  const checkboxes = document.querySelectorAll('.url-checkbox');
  const selectedUrls = [];

  checkboxes.forEach((cb) => {
    if (cb.checked && cb.parentElement.style.display !== 'none') {
      selectedUrls.push(cb.getAttribute('data-url'));
    }
  });

  return selectedUrls;
}

// Handle Progress Updates
electronAPI.onProgressUpdate((event, data) => {
  const { message } = data;
  const progressDiv = document.getElementById('progress');
  progressDiv.textContent = message;
});
