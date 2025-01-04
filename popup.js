if (typeof browser === "undefined") {
  var browser = chrome;
}

document.getElementById('main-page').addEventListener('click', () => {
  browser.tabs.create({ url: 'http://localhost:3000' })
})
