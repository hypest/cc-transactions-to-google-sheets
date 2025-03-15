// Mock Google Apps Script global objects and classes
global.Logger = {
  log: (...args) => console.log(...args)
};

// Mock Google Apps Script services
global.GmailApp = {
  search: () => [],
  getUserLabelByName: () => null,
  createLabel: () => ({ addToThread: () => {} })
};

global.SpreadsheetApp = {
  openById: () => ({
    getSheetByName: (name) => ({
      getLastRow: () => 1,
      getRange: (row, col, numRows, numCols) => ({
        setValues: (values) => {}
      })
    })
  })
};

debugger; // Break before loading dependencies

// Import the test configuration
const userConfig = require('./userConfig.test.gs');
global.userConfig = userConfig;

// Import the main code and make classes globally available
const code = require('./code.gs');
Object.assign(global, code);

// Import the tests and make test functions globally available
const tests = require('./tests.gs');
Object.assign(global, tests);

debugger; // Break before running tests

// Run the tests
(async () => {
  try {
    const results = await global.runTests();
    console.log(results.output);
    process.exit(results.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Error running tests:', error);
    process.exit(1);
  }
})(); 