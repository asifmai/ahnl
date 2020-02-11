const crawl = require('./crawl');

const run = () => new Promise(async (resolve, reject) => {
  try {
    await crawl();
    
    resolve();
  } catch (error) {
    console.log(`Bot Error: ${error.message}`);
    reject(error);
  }
})

run();
