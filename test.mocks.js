// Mock Google Services
const MockGmailApp = {
  search: () => [],
  getUserLabelByName: () => null,
  createLabel: () => ({ addToThread: () => {} }),
};

const MockSpreadsheetApp = {
  openById: () => ({
    getSheetByName: (name) => ({
      getLastRow: () => 1,
      getRange: (row, col, numRows, numCols) => ({
        setValues: (values) => {},
      }),
    }),
  }),
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
  },
};

// Mock test data
const mockUserConfig = {
  spreadsheetId: "123",
  locale: "el-GR",
  cards: [
    {
      lastFourDigits: "1234",
      name: "Test Card",
      sheetName: "Test Sheet",
    },
  ],
};

const mockEmailBody = `
Σύνολο Κινήσεων Κάρτας **1234
ΧΡΕΩΣΗ 50,00 Ημ/νία: 01/01/2024 Αιτιολογία: Test Purchase Έξοδα Συναλλάγματος: 0,00 Έξοδα Ανάληψης Μετρητών: 0,00
ΠΙΣΤΩΣΗ 1.600,00 Ημ/νία: 03/05/2025 Αιτιολογία: ΠΛ. ΚΑΡΤΑΣ WEB/EUROP Έξοδα Συναλλάγματος: 0,00 Έξοδα Ανάληψης Μετρητών: 0,00
`;

// Export for Node.js environment while maintaining Google Apps Script compatibility
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    MockGmailApp,
    MockSpreadsheetApp,
    MockServices,
    mockUserConfig,
    mockEmailBody,
  };
}
