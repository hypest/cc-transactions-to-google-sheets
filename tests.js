// Import test utilities and mocks for Node.js environment
if (typeof require !== "undefined") {
  const {
    TestSuite,
    assertEquals,
    assertThrows,
    runTests,
  } = require("./test.utils.js");
  const {
    MockGmailApp,
    MockSpreadsheetApp,
    MockServices,
    mockUserConfig,
    mockEmailBody,
  } = require("./test.mocks.js");
  const {
    AppConfig,
    GmailService,
    ServiceError,
    validateUserConfig,
    TransactionProcessor,
    SheetsService,
    WorkflowOrchestrator,
  } = require("./credit_card_transactions_parsing.js");

  Object.assign(global, {
    TestSuite,
    assertEquals,
    assertThrows,
    runTests,
    MockGmailApp,
    MockSpreadsheetApp,
    MockServices,
    mockUserConfig,
    mockEmailBody,
    AppConfig,
    GmailService,
    ServiceError,
    validateUserConfig,
    TransactionProcessor,
    SheetsService,
    WorkflowOrchestrator,
  });
} else {
  // In Google Apps Script environment, these are already global
  // The mock services are defined below
}

// AppConfig Tests
const appConfigTests = new TestSuite("AppConfig Tests");

appConfigTests.test("should create valid app config", () => {
  const appConfig = new AppConfig();
  assertEquals(appConfig.labels.primary, "cc_transactions_report");
  assertEquals(appConfig.transactionTypes.credit, "ΧΡΕΩΣΗ");
});

// User Config Validation Tests
const validationTests = new TestSuite("User Config Validation Tests");

validationTests.test("should validate correct user config", () => {
  // Should not throw
  validateUserConfig(mockUserConfig);
});

validationTests.test("should throw on invalid user config", () => {
  assertThrows(
    () => validateUserConfig(null),
    ServiceError,
    "Config: userConfig.cards must be a non-empty array"
  );
});

// TransactionProcessor Tests
const transactionProcessorTests = new TestSuite("TransactionProcessor Tests");

transactionProcessorTests.beforeEach(() => {
  MockServices.install();
});

transactionProcessorTests.test("should identify card", () => {
  const appConfig = new AppConfig();
  const processor = new TransactionProcessor(appConfig);
  const card = processor.identifyCard(mockEmailBody, mockUserConfig);
  assertEquals(card.lastFourDigits, mockUserConfig.cards[0].lastFourDigits);
});

transactionProcessorTests.test("should extract transactions", () => {
  const appConfig = new AppConfig();
  const processor = new TransactionProcessor(appConfig);
  processor.initializeRegex(mockUserConfig);
  const transactions = processor.extractTransactions(
    mockEmailBody,
    "Test Card"
  );

  assertEquals(transactions.length, 2);
  assertEquals(transactions[0].amount, 50);
  assertEquals(transactions[1].amount, -1600); // Debit transaction should be negative
});

// SheetsService Tests
const sheetsServiceTests = new TestSuite("SheetsService Tests");

sheetsServiceTests.beforeEach(() => {
  MockServices.install();
});

sheetsServiceTests.test("should add transactions to sheet", () => {
  const appConfig = new AppConfig();
  const service = new SheetsService("123", appConfig);

  const transactions = [
    {
      date: "01/01/2024",
      description: "Test",
      amount: 100,
      transactionType: appConfig.transactionTypes.credit,
      forexFees: "0,00",
      cashWithdrawalFees: "0,00",
    },
  ];

  // Should not throw
  service.addTransactionsToSheet(transactions, "Test Sheet");
});

// WorkflowOrchestrator Tests
const workflowOrchestratorTests = new TestSuite("WorkflowOrchestrator Tests");

workflowOrchestratorTests.beforeEach(() => {
  MockServices.install();
});

workflowOrchestratorTests.test(
  "should not mark thread as processed if email processing fails",
  () => {
    const appConfig = new AppConfig();
    const gmailService = new GmailService(appConfig);
    const transactionProcessor = new TransactionProcessor(appConfig);
    const sheetsService = new SheetsService("123", appConfig);
    const orchestrator = new WorkflowOrchestrator(
      gmailService,
      transactionProcessor,
      sheetsService
    );

    const mockThread = {
      getMessages: () => [
        {
          getPlainBody: () => {
            throw new Error("Failed to get email body");
          },
        },
      ],
      addLabel: () => {
        throw new Error("Thread should not be marked as processed");
      },
    };

    try {
      orchestrator.processThread(mockThread, mockUserConfig);
    } catch (e) {
      assertEquals(e.message, "Failed to get email body");
    }
  }
);

// Run tests in Google Apps Script environment
function runAllTests() {
  const suites = [
    appConfigTests,
    validationTests,
    transactionProcessorTests,
    sheetsServiceTests,
    workflowOrchestratorTests, // Add the new test suite here
  ];

  return runTests(suites);
}

// Function to install mocks and run tests
function runTestsWithMocks() {
  try {
    // Install mocks
    MockServices.install();

    // Run tests
    return runAllTests().finally(() => {
      // Restore original services
      MockServices.restore();
    });
  } catch (e) {
    // Restore original services in case of error
    MockServices.restore();
    throw e;
  }
}

// Function to run tests and show results in the UI
function runTestsAndShowResults_Log() {
  console.log("Running tests...");

  runTestsWithMocks()
    .then((results) => {
      console.log(results.output);
    })
    .catch((e) => {
      // Restore original services
      MockServices.restore();
      console.error(`Failed to run tests: ${e.message}`);
    });
}

// Function to run tests and show results in the UI
function runTestsAndShowResults_UI() {
  const ui = SpreadsheetApp.getUi();

  // Show "Running tests" message
  ui.alert("Tests", "Running tests...", ui.ButtonSet.OK);

  runTestsWithMocks()
    .then((results) => {
      // Show results
      const title = `Test Results: ${results.passed} passed, ${results.failed} failed`;
      ui.alert(title, results.output, ui.ButtonSet.OK);
    })
    .catch((e) => {
      // Restore original services
      MockServices.restore();
      ui.alert("Error", `Failed to run tests: ${e.message}`, ui.ButtonSet.OK);
    });
}

// Google Apps Script UI functions
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("Tests")
    .addItem("Run All Tests", "runTestsAndShowResults_UI")
    .addToUi();
}

// Export for Node.js environment
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    runAllTests,
    runTestsWithMocks,
  };
}
