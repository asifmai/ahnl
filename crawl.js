const pupHelper = require('./puppeteerhelper');
const fs = require('fs');
const {siteLink} = require('./keys');
let browser;
let categories = [];

module.exports = () => new Promise(async (resolve, reject) => {
  try {
    browser = await pupHelper.launchBrowser();
    await fetchProducts();
    
    await fetchProductsFromSegments();
    fs.writeFileSync('proeucts.json', JSON.stringify(categories));

    await browser.close();
    resolve();
  } catch (error) {
    await browser.close();
    console.log(`Crawl.js Error: ${error.message}`);
    reject(error);
  }
});

const fetchProductsFromSegments = () => new Promise(async (resolve, reject) => {
  try {
    console.log(`Fetching Products from Segments...`)
    for (let i = 0; i < categories.length; i++) {
      for (let j = 0; j < categories[i].products.length; j++) {
        if (categories[i].products[j].toLowerCase().includes('segment')) {
          console.log(`Fetching Products from Segment: ${categories[i].products[j]}...`);
          const products = await fetchProductsFromSegmentsSingle(categories[i].products[j]);
          categories[i].products.push(...products);
        }
      }
    }

    resolve();
  } catch (error) {
    console.log(`fetchProductsFromSegments Error: ${error.message}`);
    reject(error);
  }
});

const fetchProductsFromSegmentsSingle = (segmentUrl) => new Promise(async (resolve, reject) => {
  let page;
  try {
    page = await pupHelper.launchPage(browser, true);
    await page.goto(segmentUrl, {timeout:0, waitUntil: 'networkidle2'});
    await page.waitForSelector('.bonus-lane__wrapper > .grid .product-card > div > a');
    let products = await pupHelper.getAttrMultiple('.bonus-lane__wrapper > .grid .product-card > div > a', 'href', page);
    products = products.map(p => siteLink + p);

    await page.close();
    resolve(products);
  } catch (error) {
    await page.close();
    console.log(`fetchProductsFromSegmentsSingle Error: ${error.message}`);
    reject(error);
  }
});

const fetchProducts = () => new Promise(async (resolve, reject) => {
  let page;
  try {
    console.log(`Fetching Products From: ${siteLink}/bonus...`);
    page = await pupHelper.launchPage(browser);
    await page.goto(`${siteLink}/bonus`, {timeout: 0, waitUntil: 'networkidle2'});
    await page.waitForSelector('.bonus-lane.bonus-lane__lane[data-testid="bonus-lane--AH"]');
    const grids = await page.$$('.bonus-lane.bonus-lane__lane[data-testid="bonus-lane--AH"] > .grid');
    // console.log(`No of Grids: ${grids.length}`);

    for (let i = 0; i < grids.length; i++) {
      const gridChilds = await grids[i].$$('.legendcard,.wr-appie');
      let firstCat = true;
      let cat = {name: '', products: []};
      
      for (let j = 0; j < gridChilds.length; j++) {
        const isProduct = await gridChilds[j].$('.product-card  > div > a');
        if (isProduct) {
          const productUrl = await gridChilds[j].$eval('.product-card > div > a', (elm, siteLink) => siteLink + elm.getAttribute('href'), siteLink);
          cat.products.push(productUrl);
          // console.log(`${j+1}/${gridChilds.length} - ${cat.products}`);
        } else {
          if (firstCat) {
            firstCat = false;
          } else {
            categories.push(cat);
            cat = {name: '', products: []};
          }
          const catName = await gridChilds[j].$eval('h3', elm => elm.innerText.trim());
          cat.name = catName;
          // console.log(`${j+1}/${gridChilds.length} - ${cat.name}`);
        }
        if (j == (gridChilds.length - 1)) {
          categories.push(cat);
        }
      }

    }

    await page.close();
    resolve();
  } catch (error) {
    await page.close();
    console.log(`fetchProducts Error: ${error.message}`);
    reject(error);
  }
})
