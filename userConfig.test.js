/**
 * Test configuration file
 * This file is used by the test suite to verify the code functionality
 */

const userConfigSample = {
  cards: [
    {
      name: "Test Visa Card",
      lastFourDigits: "1111",
      sheetName: "Test Visa Card",
    },
    {
      name: "Test Mastercard",
      lastFourDigits: "2222",
      sheetName: "Test Mastercard",
    },
  ],
  spreadsheetId: "test_spreadsheet_id",
  locale: "el-GR",
};

// Export for Node.js environment
if (typeof module !== "undefined" && module.exports) {
  module.exports = userConfigSample;
}
