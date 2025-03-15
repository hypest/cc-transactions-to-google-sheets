// Interfaces
/**
 * @interface IConfig
 */
class IConfig {
  /** @returns {Object} */
  get labels() { throw new Error('Not implemented'); }
  /** @returns {Object} */
  get transactionTypes() { throw new Error('Not implemented'); }
  /** @returns {Object} */
  get regex() { throw new Error('Not implemented'); }
}

/**
 * @interface IGmailService
 */
class IGmailService {
  /** @returns {GmailThread[]} */
  getUnprocessedThreads() { throw new Error('Not implemented'); }
  /** @param {GmailThread} thread */
  markThreadAsProcessed(thread) { throw new Error('Not implemented'); }
}

/**
 * @interface ITransactionProcessor
 */
class ITransactionProcessor {
  /**
   * @param {string} emailBody
   * @param {Object} userConfig
   * @returns {Object|null}
   */
  identifyCard(emailBody, userConfig) { throw new Error('Not implemented'); }
  /**
   * @param {string} emailBody
   * @param {string} cardName
   * @returns {Transaction[]}
   */
  extractTransactions(emailBody, cardName) { throw new Error('Not implemented'); }
}

/**
 * @interface ISheetsService
 */
class ISheetsService {
  /**
   * @param {Transaction[]} transactions
   * @param {string} sheetName
   */
  addTransactionsToSheet(transactions, sheetName) { throw new Error('Not implemented'); }
}

/**
 * @interface ISheetsConfig
 */
class ISheetsConfig {
  /** @returns {{credit: string, debit: string}} */
  get transactionTypes() { throw new Error('Not implemented'); }
}

// Custom error classes
class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

class GmailServiceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GmailServiceError';
  }
}

class TransactionProcessorError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TransactionProcessorError';
  }
}

class SheetsServiceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SheetsServiceError';
  }
}

// Type definitions
/**
 * @typedef {Object} Transaction
 * @property {string} card - Card name
 * @property {number} amount - Transaction amount
 * @property {string} transactionType - Type of transaction
 * @property {string} date - Transaction date
 * @property {string} description - Transaction description
 * @property {string} forexFees - Foreign exchange fees
 * @property {string} cashWithdrawalFees - Cash withdrawal fees
 */

// Configuration class to handle all config-related operations
class Config extends IConfig {
  /**
   * @param {Object} userConfig
   * @throws {ConfigError}
   */
  constructor(userConfig) {
    super();
    this.validateUserConfig(userConfig);

    this._labels = {
      primary: 'cc_transactions_report',
      processed: 'auto_cc_report_processed',
    };
    this._transactionTypes = {
      credit: 'ΧΡΕΩΣΗ',
      debit: 'ΠΙΣΤΩΣΗ',
    };
    this._cardIdentifierPattern = {
      prefix: 'Σύνολο Κινήσεων Κάρτας \\*\\*',
    };
    this._regex = {
      cardIdentifiers: {},
      transaction: null
    };
    
    this.initializeRegex(userConfig);
  }

  /**
   * @param {Object} userConfig
   * @throws {ConfigError}
   */
  validateUserConfig(userConfig) {
    if (!userConfig) {
      throw new ConfigError('userConfig is required');
    }
    if (!Array.isArray(userConfig.cards)) {
      throw new ConfigError('userConfig.cards must be an array');
    }
    if (!userConfig.cards.length) {
      throw new ConfigError('userConfig.cards array cannot be empty');
    }
    userConfig.cards.forEach((card, index) => {
      if (!card.lastFourDigits || !card.name || !card.sheetName) {
        throw new ConfigError(`Invalid card configuration at index ${index}`);
      }
    });
  }

  get labels() { return this._labels; }
  get transactionTypes() { return this._transactionTypes; }
  get regex() { return this._regex; }

  /**
   * @private
   * @param {Object} userConfig
   */
  initializeRegex(userConfig) {
    // Initialize card identifier patterns
    userConfig.cards.forEach(card => {
      this._regex.cardIdentifiers[card.lastFourDigits] = new RegExp(
        `${this._cardIdentifierPattern.prefix}${card.lastFourDigits}`
      );
    });

    // Define the transaction regex
    this._regex.transaction = new RegExp(
      `(?<transactionType>${this._transactionTypes.credit}|${this._transactionTypes.debit})\\s` +
      `(?<amount>[\\d,]+)\\sΗμ\\/νία:\\s(?<date>\\d{2}\\/\\d{2}\\/\\d{4})\\s` +
      `Αιτιολογία:\\s(?<description>.+?)\\sΈξοδα\\sΣυναλλάγματος:\\s` +
      `(?<forexFees>[\\d,]+)\\sΈξοδα\\sΑνάληψης\\sΜετρητών:\\s(?<cashWithdrawalFees>[\\d,]+)`,
      'g'
    );
  }
}

// Service for handling Gmail operations
class GmailService extends IGmailService {
  /**
   * @param {IConfig} config
   * @throws {GmailServiceError}
   */
  constructor(config) {
    super();
    if (!(config instanceof IConfig)) {
      throw new GmailServiceError('Invalid config parameter');
    }
    this.config = config;
  }

  /**
   * @returns {GmailThread[]}
   * @throws {GmailServiceError}
   */
  getUnprocessedThreads() {
    try {
      return GmailApp.search('label:' + this.config.labels.primary + ' -label:' + this.config.labels.processed);
    } catch (e) {
      throw new GmailServiceError(`Failed to fetch unprocessed threads: ${e.message}`);
    }
  }

  /**
   * @param {GmailThread} thread
   * @throws {GmailServiceError}
   */
  markThreadAsProcessed(thread) {
    try {
      let processedLabel = GmailApp.getUserLabelByName(this.config.labels.processed);
      if (!processedLabel) {
        Logger.log('Creating the processed label: ' + this.config.labels.processed);
        processedLabel = GmailApp.createLabel(this.config.labels.processed);
      }
      thread.addLabel(processedLabel);
    } catch (e) {
      throw new GmailServiceError(`Failed to mark thread as processed: ${e.message}`);
    }
  }
}

// Service for handling transaction processing
class TransactionProcessor extends ITransactionProcessor {
  /**
   * @param {IConfig} config
   * @throws {TransactionProcessorError}
   */
  constructor(config) {
    super();
    if (!(config instanceof IConfig)) {
      throw new TransactionProcessorError('Invalid config parameter');
    }
    this.config = config;
  }

  /**
   * @param {string} emailBody
   * @param {Object} userConfig
   * @returns {Object|null}
   * @throws {TransactionProcessorError}
   */
  identifyCard(emailBody, userConfig) {
    if (!emailBody) {
      throw new TransactionProcessorError('Email body cannot be empty');
    }
    if (!userConfig || !userConfig.cards) {
      throw new TransactionProcessorError('Invalid userConfig');
    }

    try {
      return userConfig.cards.find(card => 
        this.config.regex.cardIdentifiers[card.lastFourDigits].test(emailBody)
      );
    } catch (e) {
      throw new TransactionProcessorError(`Failed to identify card: ${e.message}`);
    }
  }

  /**
   * @param {string} emailBody
   * @param {string} cardName
   * @returns {Transaction[]}
   * @throws {TransactionProcessorError}
   */
  extractTransactions(emailBody, cardName) {
    if (!emailBody) {
      throw new TransactionProcessorError('Email body cannot be empty');
    }
    if (!cardName) {
      throw new TransactionProcessorError('Card name cannot be empty');
    }

    const transactions = [];
    let match;
    
    try {
      while ((match = this.config.regex.transaction.exec(emailBody)) !== null) {
        const amount = this.parseAmount(match.groups.amount);
        const transactionType = match.groups.transactionType;

        transactions.push({
          card: cardName,
          amount: transactionType === this.config.transactionTypes.debit ? -amount : amount,
          transactionType: transactionType,
          date: this.parseDate(match.groups.date),
          description: match.groups.description,
          forexFees: match.groups.forexFees,
          cashWithdrawalFees: match.groups.cashWithdrawalFees,
        });
      }
      return transactions;
    } catch (e) {
      throw new TransactionProcessorError(`Failed to extract transactions: ${e.message}`);
    }
  }

  /**
   * @private
   * @param {string} amountString
   * @returns {number}
   * @throws {TransactionProcessorError}
   */
  parseAmount(amountString) {
    if (!amountString) {
      throw new TransactionProcessorError('Amount string cannot be empty');
    }
    const amount = parseFloat(amountString.replace(',', '.'));
    if (isNaN(amount)) {
      throw new TransactionProcessorError('Invalid amount format');
    }
    return amount;
  }

  /**
   * @private
   * @param {string} dateString
   * @returns {string}
   * @throws {TransactionProcessorError}
   */
  parseDate(dateString) {
    if (!dateString) {
      throw new TransactionProcessorError('Date string cannot be empty');
    }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
      throw new TransactionProcessorError('Invalid date format');
    }
    return dateString;
  }
}

// Configuration adapter for SheetsService
class SheetsConfig extends ISheetsConfig {
  /**
   * @param {IConfig} config
   */
  constructor(config) {
    super();
    if (!(config instanceof IConfig)) {
      throw new ConfigError('Invalid config parameter');
    }
    this._transactionTypes = config.transactionTypes;
  }

  get transactionTypes() { return this._transactionTypes; }
}

// Service for handling Google Sheets operations
class SheetsService extends ISheetsService {
  /**
   * @param {string} spreadsheetId
   * @param {ISheetsConfig} config
   * @throws {SheetsServiceError}
   */
  constructor(spreadsheetId, config) {
    super();
    if (!spreadsheetId) {
      throw new SheetsServiceError('Spreadsheet ID cannot be empty');
    }
    if (!(config instanceof ISheetsConfig)) {
      throw new SheetsServiceError('Invalid config parameter');
    }
    this.spreadsheetId = spreadsheetId;
    this.config = config;
  }

  /**
   * @param {Transaction[]} transactions
   * @param {string} sheetName
   * @throws {SheetsServiceError}
   */
  addTransactionsToSheet(transactions, sheetName) {
    if (!Array.isArray(transactions)) {
      throw new SheetsServiceError('Transactions must be an array');
    }
    if (!sheetName) {
      throw new SheetsServiceError('Sheet name cannot be empty');
    }

    try {
      const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
      const sheet = spreadsheet.getSheetByName(sheetName);
      
      if (!sheet) {
        throw new SheetsServiceError(`Sheet "${sheetName}" not found`);
      }

      const rowsData = transactions.map(transaction => [
        transaction.date,
        transaction.date,
        transaction.description,
        "",
        transaction.transactionType === this.config.transactionTypes.credit ? "ΑΓΟΡΑ" : "ΠΛΗΡΩΜΗ",
        transaction.amount,
        transaction.forexFees,
        transaction.cashWithdrawalFees
      ]);

      sheet.getRange(sheet.getLastRow() + 1, 1, rowsData.length, rowsData[0].length)
        .setValues(rowsData);
    } catch (e) {
      throw new SheetsServiceError(`Failed to add transactions to sheet: ${e.message}`);
    }
  }
}

// Main workflow orchestrator
class WorkflowOrchestrator {
  /**
   * @param {IConfig} config
   * @param {IGmailService} gmailService
   * @param {ITransactionProcessor} transactionProcessor
   * @param {ISheetsService} sheetsService
   */
  constructor(config, gmailService, transactionProcessor, sheetsService) {
    // Validate dependencies
    if (!(config instanceof IConfig)) {
      throw new Error('Invalid config parameter');
    }
    if (!(gmailService instanceof IGmailService)) {
      throw new Error('Invalid gmailService parameter');
    }
    if (!(transactionProcessor instanceof ITransactionProcessor)) {
      throw new Error('Invalid transactionProcessor parameter');
    }
    if (!(sheetsService instanceof ISheetsService)) {
      throw new Error('Invalid sheetsService parameter');
    }

    this.config = config;
    this.gmailService = gmailService;
    this.transactionProcessor = transactionProcessor;
    this.sheetsService = sheetsService;
  }

  /**
   * @param {GmailMessage} message
   * @param {Object} userConfig
   * @private
   */
  processMessage(message, userConfig) {
    const emailBody = message.getPlainBody();
    const card = this.transactionProcessor.identifyCard(emailBody, userConfig);
    
    if (!card) {
      throw new Error('No valid card identified in this email.');
    }

    Logger.log('Card identified: ' + card.name);
    const transactions = this.transactionProcessor.extractTransactions(emailBody, card.name);
    
    if (transactions.length === 0) {
      throw new Error('No transactions found in this email.');
    }

    Logger.log('Extracted ' + transactions.length + ' transactions.');
    this.sheetsService.addTransactionsToSheet(transactions, card.sheetName);
  }

  /**
   * @param {GmailThread} thread
   * @param {Object} userConfig
   * @private
   */
  processThread(thread, userConfig) {
    const messages = thread.getMessages();
    messages.forEach(message => {
      try {
        this.processMessage(message, userConfig);
      } catch (e) {
        Logger.log('Error processing message: ' + e.message);
      }
    });
    this.gmailService.markThreadAsProcessed(thread);
  }

  /**
   * @param {Object} userConfig
   */
  execute(userConfig) {
    try {
      Logger.log('Starting the email processing workflow...');
      const threads = this.gmailService.getUnprocessedThreads();
      Logger.log('Found ' + threads.length + ' email threads to process.');

      threads.forEach(thread => this.processThread(thread, userConfig));
      
      Logger.log('Workflow completed successfully.');
    } catch (e) {
      Logger.log('Error in main execution: ' + e.message);
      throw e;
    }
  }
}

// Main entry point
function find_and_process_card_transaction_emails() {
  try {
    const config = new Config(userConfig);
    const gmailService = new GmailService(config);
    const transactionProcessor = new TransactionProcessor(config);
    const sheetsConfig = new SheetsConfig(config);
    const sheetsService = new SheetsService(userConfig.spreadsheetId, sheetsConfig);
    
    const orchestrator = new WorkflowOrchestrator(
      config,
      gmailService,
      transactionProcessor,
      sheetsService
    );

    orchestrator.execute(userConfig);
  } catch (e) {
    Logger.log(`Fatal error: ${e.name}: ${e.message}`);
    throw e;
  }
}
