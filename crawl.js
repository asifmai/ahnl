const pupHelper = require('./puppeteerhelper');
const fs = require('fs');
const pLimit = require('p-limit');
const {siteLink} = require('./keys');
let browser;
let products = [];
let categories = [];
categories = JSON.parse(fs.readFileSync('categories.json'));

module.exports = () => new Promise(async (resolve, reject) => {
  try {
    browser = await pupHelper.launchBrowser();
    // await fetchProducts();
    
    // await fetchProductsFromSegments();
    // fs.writeFileSync('categories.json', JSON.stringify(categories));

    await fetchProductsDetails();
    fs.writeFileSync('products.json', JSON.stringify(products));

    await browser.close();
    resolve();
  } catch (error) {
    await browser.close();
    console.log(`Crawl.js Error: ${error.message}`);
    reject(error);
  }
});

const fetchProductsDetails = () => new Promise(async (resolve, reject) => {
  try {
    const limit = pLimit(10);
    const promises = [];
    console.log(`Fetching Products Details...`);
    for (let i = 0; i < categories.length; i++) {
      // console.log(`${i + 1}/${categories.length} - Fetching Products Details For Category: ${categories[i].name}...`);
      for (let j = 0; j < categories[i].products.length; j++) {
        if (!categories[i].products[j].toLowerCase().includes('segment')) {
          promises.push(limit(() => getProduct(i, j)));
        }
      }
    }

    await Promise.all(promises);
    
    resolve();
  } catch (error) {
    console.log(`fetchProductsDetails Error: ${error.message}`);
    reject(error);
  }
});

const getProduct = (categoryIdx, productIdx) => new Promise(async (resolve, reject) => {
  let page;
  try {
    console.log(`${categoryIdx + 1}/${categories.length} - Fetching Product Details for [${categories[categoryIdx].products[productIdx]}]`);
    page = await pupHelper.launchPage(browser, true);
    await page.goto(categories[categoryIdx].products[productIdx], {timeout: 0, waitUntil: 'load'});
    
    const product = {};
    const script = JSON.parse(await pupHelper.getTxt('script[type="application/ld+json"]', page));
    product.category = categories[categoryIdx].name;
    product.title = script.name;
    product.link = categories[categoryIdx].products[productIdx];
    product.price = script.offers ? parseFloat(script.offers.price) : '';
    product.description = script.description;
    product.startDate = script.offers ? script.offers.validFrom : '';
    product.endDate = script.offers ? script.offers.priceValidUntil : '';

    products.push(product);
    await page.close();
    resolve();
  } catch (error) {
    await page.close();
    console.log(`getProduct [${categories[categoryIdx].products[productIdx]}] Error: ${error.message}`);
    resolve();
  }
})


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
