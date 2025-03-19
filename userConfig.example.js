/**
 * EXAMPLE USER CONFIGURATION FILE
 *
 * To use this script:
 * 1. Make a copy of this file and rename it to 'userConfig.js'
 * 2. Replace the example values with your own settings
 * 3. Make sure not to commit your actual userConfig.js to the repository
 */

var userConfig = {
  // Array of credit cards to process. Add one entry for each card you want to track.
  cards: [
    {
      name: "Example Visa Card", // A descriptive name for the card
      lastFourDigits: "1234", // The last 4 digits of your card number
      sheetName: "Example Visa Card", // The name of the sheet where transactions will be stored
      // Create this sheet in your spreadsheet before running
    },
    // You can add more cards following the same format:
    {
      name: "Example Mastercard",
      lastFourDigits: "5678",
      sheetName: "Example Mastercard",
    },
  ],

  // The ID of your Google Spreadsheet where transactions will be stored
  // You can find this in the URL of your spreadsheet:
  // https://docs.google.com/spreadsheets/d/[THIS_IS_YOUR_SPREADSHEET_ID]/edit
  spreadsheetId: "your_spreadsheet_id_here",
};
