document.getElementById('main-page').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('public/index.html') });
});
