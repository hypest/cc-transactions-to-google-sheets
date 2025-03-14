// Global configuration object to hold all hardcoded variables
var config = {
  labels: {
    primary: 'cc_transactions_report', // Label for primary search
    processed: 'auto_cc_report_processed', // Label for processed emails
  },
  transactionTypes: {
    credit: 'ΧΡΕΩΣΗ', // Credit transaction type (in Greek)
    debit: 'ΠΙΣΤΩΣΗ', // Debit transaction type (in Greek)
  },
  cardIdentifierPattern: {
    prefix: 'Σύνολο Κινήσεων Κάρτας \\*\\*',
  },
  regex: {
    cardIdentifiers: {}, // Will hold the RegExp for each card
  },
};

// Initialize card identifier patterns
userConfig.cards.forEach(card => {
  config.regex.cardIdentifiers[card.lastFourDigits] = new RegExp(
    `${config.cardIdentifierPattern.prefix}${card.lastFourDigits}`
  );
});

// Define the transaction regex
config.regex.transaction = new RegExp(
  `(?<transactionType>${config.transactionTypes.credit}|${config.transactionTypes.debit})\\s` +
  `(?<amount>[\\d,]+)\\sΗμ\\/νία:\\s(?<date>\\d{2}\\/\\d{2}\\/\\d{4})\\s` +
  `Αιτιολογία:\\s(?<description>.+?)\\sΈξοδα\\sΣυναλλάγματος:\\s` +
  `(?<forexFees>[\\d,]+)\\sΈξοδα\\sΑνάληψης\\sΜετρητών:\\s(?<cashWithdrawalFees>[\\d,]+)`,
  'g'
);

/**
 * Main function to execute the workflow.
 */
function find_and_process_card_transaction_emails() {
  try {
    Logger.log('Starting the email processing workflow...');
    fetchEmails(); // Fetch and process emails
    Logger.log('Workflow completed successfully.');
  } catch (e) {
    Logger.log('Error in main execution: ' + e.message);
    throw e;
  }
}

/**
 * Fetches emails with the 'cc_transactions_report' label and processes them.
 */
function fetchEmails() {
  try {
    Logger.log('Fetching emails...');
    var threads = GmailApp.search('label:' + config.labels.primary + ' -label:' + config.labels.processed);
    Logger.log('Found ' + threads.length + ' email threads to process.');

    threads.forEach(function(thread) {
      processThread(thread);

      // Mark thread as processed
      markThreadAsProcessed(thread);
    });
  } catch (e) {
    Logger.log('Error while fetching emails: ' + e.message);
    throw e;
  }
}

/**
 * Processes each thread by fetching its messages and processing them.
 */
function processThread(thread) {
  try {
    // Logger.log('Processing thread: ' + thread.getId());
    var messages = thread.getMessages();
    messages.forEach(function(message) {
      processMessage(message);
    });
  } catch (e) {
    Logger.log('Error while processing thread ' + thread.getId() + ': ' + e.message);
    throw e;
  }
}

/**
 * Processes a single email message: identifies the card, extracts transactions, and inserts into the sheet.
 */
function processMessage(message) {
  try {
    // Logger.log('Processing message: ' + message.getId());
    var emailBody = message.getPlainBody();
    
    // Identify the card
    var card = identifyCard(emailBody);
    if (card) {
      Logger.log('Card identified: ' + card.name);

      // Extract the transactions from the email body
      var transactions = extractTransactions(emailBody, card.name);
      if (transactions.length > 0) {
        Logger.log('Extracted ' + transactions.length + ' transactions.');
        
        // Insert transactions into Google Sheets
        addTransactionsToSheet(transactions, card.sheetName);
      } else {
        // Logger.log('No transactions found in this email.');
        throw new Error('No transactions found in this email.');
      }
    } else {
      Logger.log('No valid card identified in this email.');
      throw new Error('No valid card identified in this email.');
    }
  } catch (e) {
    Logger.log('Error while processing message ' + message.getId() + ': ' + e.message);
    throw e;
  }
}

/**
 * Identifies the card based on the email content.
 */
function identifyCard(emailBody) {
  try {
    const card = userConfig.cards.find(card => 
      config.regex.cardIdentifiers[card.lastFourDigits].test(emailBody)
    );
    return card;
  } catch (e) {
    Logger.log('Error identifying card: ' + e.message);
    throw e;
  }
}

/**
 * Extracts individual credit card transactions from the email content.
 */
function extractTransactions(emailBody, cardName) {
  var transactions = [];
  try {
    var regex = config.regex.transaction; // Using global config regex
    var match;
    while ((match = regex.exec(emailBody)) !== null) {
      var amount = parseAmount(match.groups.amount); // Use the parseAmount function
      var transactionType = match.groups.transactionType; // Directly assign the transaction type

      if (transactionType === config.transactionTypes.debit) {
        amount = -amount; // Subtract for debit transactions (invert logic)
      }

      // Create transaction object
      var transaction = {
        card: cardName,
        amount: amount,
        transactionType: transactionType, // Store the type of transaction (credit/debit)
        date: parseDate(match.groups.date), // Parse the date
        description: match.groups.description,
        forexFees: match.groups.forexFees,
        cashWithdrawalFees: match.groups.cashWithdrawalFees,
      };

      // // Log the transaction object
      // Logger.log('Extracted transaction: ' + JSON.stringify(transaction));

      transactions.push(transaction);
    }
  } catch (e) {
    Logger.log('Error while extracting transactions: ' + e.message);
    throw e;
  }
  return transactions;
}

/**
 * Parses a locale-specific amount string (with comma or dot separator).
 */
function parseAmount(amountString) {
  try {
    return parseFloat(amountString.replace(',', '.')); // Replace comma with dot and convert to float
  } catch (e) {
    Logger.log('Error while parsing amount: ' + e.message);
    throw e;
    // return 0; // Return 0 in case of an error
  }
}

/**
 * Parses the date part (currently returns the string).
 */
function parseDate(dateString) {
  try {
    return dateString; // For now, return the date string itself
  } catch (e) {
    Logger.log('Error while parsing date: ' + e.message);
    throw e;
    // return ''; // Return an empty string in case of an error
  }
}

/**
 * Adds an array of transactions to the specified sheet in the configured spreadsheet.
 */
function addTransactionsToSheet(transactions, sheetName) {
  try {
    var spreadsheet = SpreadsheetApp.openById(userConfig.spreadsheetId); // Get the spreadsheet by ID
    var sheet = spreadsheet.getSheetByName(sheetName); // Get the sheet by name
    
    if (!sheet) {
      throw new Error('Sheet "' + sheetName + '" not found.');
    }

    // Prepare the row data for all transactions
    var rowsData = transactions.map(function(transaction) {
      return [
        transaction.date,
        transaction.date,
        transaction.description,
        "",
        transaction.transactionType == config.transactionTypes.credit ? "ΑΓΟΡΑ" : "ΠΛΗΡΩΜΗ",
        transaction.amount,
        transaction.forexFees,
        transaction.cashWithdrawalFees
      ];
    });

    // Append all rows at once
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsData.length, rowsData[0].length).setValues(rowsData);
    
    // Logger.log('Transactions added to sheet.');
  } catch (e) {
    Logger.log('Error while adding transactions to sheet: ' + e.message);
    throw e;
  }
}

/**
 * Marks the email as processed by adding the "processed" label.
 */
function markThreadAsProcessed(thread) {
  try {
    let processedLabel = GmailApp.getUserLabelByName(config.labels.processed);
    if (!processedLabel) {
      Logger.log('Creating the processed label: ' + config.labels.processed);
      processedLabel = GmailApp.createLabel(config.labels.processed); // Create the label if it doesn't exist
    }

    thread.addLabel(processedLabel);
    Logger.log('Thread marked as processed: ' + thread.getId());
  } catch (e) {
    Logger.log('Error while marking thread as processed: ' + e.message);
    throw e;
  }
}
