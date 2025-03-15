// Mock Google Services
const MockGmailApp = {
  search: () => [],
  getUserLabelByName: () => null,
  createLabel: () => ({ addToThread: () => {} })
};

const MockSpreadsheetApp = {
  openById: () => ({
    getSheetByName: (name) => ({
      getLastRow: () => 1,
      getRange: (row, col, numRows, numCols) => ({
        setValues: (values) => {}
      })
    })
  })
};

// Mock service manager
const MockServices = {
  _originalServices: {},
  
  backup() {
    this._originalServices.GmailApp = GmailApp;
    this._originalServices.SpreadsheetApp = SpreadsheetApp;
  },

  install() {
    // Save originals first
    this.backup();
    
    // Install mocks
    GmailApp = MockGmailApp;
    SpreadsheetApp = MockSpreadsheetApp;
  },

  restore() {
    // Restore original services
    GmailApp = this._originalServices.GmailApp;
    SpreadsheetApp = this._originalServices.SpreadsheetApp;
  }
};

// Simple test framework
class TestSuite {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.beforeEachFn = null;
  }

  beforeEach(fn) {
    this.beforeEachFn = fn;
  }

  test(name, fn) {
    this.tests.push({ name, fn, passed: false, error: null });
  }

  async run() {
    console.log(`\nRunning ${this.name}:`);
    let passed = 0;
    let failed = 0;

    for (const test of this.tests) {
      if (this.beforeEachFn) {
        await this.beforeEachFn();
      }

      try {
        await test.fn();
        test.passed = true;
        console.log(`✓ ${test.name}`);
        passed++;
      } catch (e) {
        test.passed = false;
        test.error = e.message;
        console.log(`✗ ${test.name}`);
        console.log(`  Error: ${e.message}`);
        failed++;
      }
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    return { passed, failed };
  }
}

// Test helpers
function assertEquals(actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

function assertThrows(fn, errorType, message) {
  try {
    fn();
    throw new Error('Expected function to throw');
  } catch (e) {
    if (!(e instanceof errorType)) {
      throw new Error(`Expected error of type ${errorType.name} but got ${e.constructor.name}`);
    }
    if (message && e.message !== message) {
      throw new Error(`Expected error message "${message}" but got "${e.message}"`);
    }
  }
}

// Mock data
const mockUserConfig = {
  spreadsheetId: '123',
  cards: [
    {
      lastFourDigits: '1234',
      name: 'Test Card',
      sheetName: 'Test Sheet'
    }
  ]
};

const mockEmailBody = `
Σύνολο Κινήσεων Κάρτας **1234
ΧΡΕΩΣΗ 50,00 Ημ/νία: 01/01/2024 Αιτιολογία: Test Purchase Έξοδα Συναλλάγματος: 0,00 Έξοδα Ανάληψης Μετρητών: 0,00
ΠΙΣΤΩΣΗ 25,00 Ημ/νία: 02/01/2024 Αιτιολογία: Test Refund Έξοδα Συναλλάγματος: 0,00 Έξοδα Ανάληψης Μετρητών: 0,00
`;

// Config Tests
const configTests = new TestSuite('Config Tests');

configTests.test('should create valid config', () => {
  const config = new Config(mockUserConfig);
  assertEquals(config.labels.primary, 'cc_transactions_report');
  assertEquals(config.transactionTypes.credit, 'ΧΡΕΩΣΗ');
  assertEquals(Object.keys(config.regex.cardIdentifiers).length, 1);
});

configTests.test('should throw on invalid user config', () => {
  assertThrows(
    () => new Config(null),
    ConfigError,
    'userConfig is required'
  );
});

// SheetsConfig Tests
const sheetsConfigTests = new TestSuite('SheetsConfig Tests');

sheetsConfigTests.test('should create valid sheets config', () => {
  const config = new Config(mockUserConfig);
  const sheetsConfig = new SheetsConfig(config);
  assertEquals(sheetsConfig.transactionTypes, config.transactionTypes);
});

sheetsConfigTests.test('should throw on invalid config', () => {
  assertThrows(
    () => new SheetsConfig(null),
    ConfigError,
    'Invalid config parameter'
  );
});

// TransactionProcessor Tests
const transactionProcessorTests = new TestSuite('TransactionProcessor Tests');

transactionProcessorTests.beforeEach(() => {
  GmailApp = MockGmailApp;
});

transactionProcessorTests.test('should identify card', () => {
  const config = new Config(mockUserConfig);
  const processor = new TransactionProcessor(config);
  const card = processor.identifyCard(mockEmailBody, mockUserConfig);
  assertEquals(card.lastFourDigits, '1234');
});

transactionProcessorTests.test('should extract transactions', () => {
  const config = new Config(mockUserConfig);
  const processor = new TransactionProcessor(config);
  const transactions = processor.extractTransactions(mockEmailBody, 'Test Card');
  
  assertEquals(transactions.length, 2);
  assertEquals(transactions[0].amount, 50);
  assertEquals(transactions[1].amount, -25); // Debit transaction should be negative
});

// SheetsService Tests
const sheetsServiceTests = new TestSuite('SheetsService Tests');

sheetsServiceTests.beforeEach(() => {
  SpreadsheetApp = MockSpreadsheetApp;
});

sheetsServiceTests.test('should add transactions to sheet', () => {
  const config = new Config(mockUserConfig);
  const sheetsConfig = new SheetsConfig(config);
  const service = new SheetsService(mockUserConfig.spreadsheetId, sheetsConfig);
  
  const transactions = [{
    date: '01/01/2024',
    description: 'Test',
    amount: 100,
    transactionType: config.transactionTypes.credit,
    forexFees: '0,00',
    cashWithdrawalFees: '0,00'
  }];

  // Should not throw
  service.addTransactionsToSheet(transactions, 'Test Sheet');
});

// Run all tests
async function runTests() {
  const suites = [
    configTests,
    sheetsConfigTests,
    transactionProcessorTests,
    sheetsServiceTests
  ];

  let totalPassed = 0;
  let totalFailed = 0;
  let output = [];

  for (const suite of suites) {
    const results = await suite.run();
    totalPassed += results.passed;
    totalFailed += results.failed;
    
    // Collect output for display
    output.push(`${suite.name}:`);
    suite.tests.forEach(test => {
      output.push(`  ${test.passed ? '✓' : '✗'} ${test.name}`);
      if (test.error) {
        output.push(`    Error: ${test.error}`);
      }
    });
    output.push('');
  }

  output.push(`Total Results: ${totalPassed} passed, ${totalFailed} failed`);
  return {
    output: output.join('\n'),
    passed: totalPassed,
    failed: totalFailed
  };
}

// Export for Node.js environment while maintaining Google Apps Script compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runTests,
    TestSuite,
    assertEquals,
    assertThrows,
    MockGmailApp,
    MockSpreadsheetApp,
    MockServices
  };
}

/**
 * Creates a custom menu in Google Sheets for running tests
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Tests')
    .addItem('Run All Tests', 'showTestResults')
    .addToUi();
}

/**
 * Runs the tests and displays results in a modal dialog
 */
function showTestResults() {
  const ui = SpreadsheetApp.getUi();
  
  // Show "Running tests" message
  ui.alert('Tests', 'Running tests...', ui.ButtonSet.OK);
  
  try {
    // Install mocks
    MockServices.install();
    
    // Run tests
    runTests().then(results => {
      // Restore original services
      MockServices.restore();
      
      // Show results
      const title = `Test Results: ${results.passed} passed, ${results.failed} failed`;
      ui.alert(title, results.output, ui.ButtonSet.OK);
    }).catch(e => {
      // Restore original services
      MockServices.restore();
      ui.alert('Error', `Failed to run tests: ${e.message}`, ui.ButtonSet.OK);
    });
  } catch (e) {
    // Restore original services
    MockServices.restore();
    ui.alert('Error', `Failed to run tests: ${e.message}`, ui.ButtonSet.OK);
  }
} 