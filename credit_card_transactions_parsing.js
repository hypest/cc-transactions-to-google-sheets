// Custom error class for all service errors
class ServiceError extends Error {
  constructor(service, message) {
    super(`${service}: ${message}`);
    this.name = "ServiceError";
    this.service = service;
  }
}

// Application-wide constants
class AppConfig {
  constructor() {
    this.labels = {
      primary: "cc_transactions_report",
      processed: "auto_cc_report_processed",
    };

    this.transactionTypes = {
      credit: "ΧΡΕΩΣΗ",
      debit: "ΠΙΣΤΩΣΗ",
    };
  }
}

// Service for handling Gmail operations
class GmailService {
  constructor(appConfig) {
    if (!(appConfig instanceof AppConfig)) {
      throw new ServiceError("Gmail", "Invalid app config");
    }
    this.appConfig = appConfig;
  }

  getUnprocessedThreads() {
    try {
      return GmailApp.search(
        "label:" +
          this.appConfig.labels.primary +
          " -label:" +
          this.appConfig.labels.processed
      );
    } catch (e) {
      throw new ServiceError(
        "Gmail",
        `Failed to fetch unprocessed threads: ${e.message}`
      );
    }
  }

  markThreadAsProcessed(thread) {
    try {
      let processedLabel = GmailApp.getUserLabelByName(
        this.appConfig.labels.processed
      );
      if (!processedLabel) {
        Logger.log(
          "Creating the processed label: " + this.appConfig.labels.processed
        );
        processedLabel = GmailApp.createLabel(this.appConfig.labels.processed);
      }
      thread.addLabel(processedLabel);
    } catch (e) {
      throw new ServiceError(
        "Gmail",
        `Failed to mark thread as processed: ${e.message}`
      );
    }
  }
}

// Service for handling transaction processing
class TransactionProcessor {
  constructor(appConfig) {
    if (!(appConfig instanceof AppConfig)) {
      throw new ServiceError("Processor", "Invalid app config");
    }
    this.appConfig = appConfig;
    this.cardIdentifiers = {};
    this.transactionRegex = null;
  }

  initializeRegex(userConfig) {
    const prefix = "Σύνολο Κινήσεων Κάρτας \\*\\*";

    // Initialize card identifier patterns
    userConfig.cards.forEach((card) => {
      this.cardIdentifiers[card.lastFourDigits] = new RegExp(
        `${prefix}${card.lastFourDigits}`
      );
    });

    // Define the transaction regex
    this.transactionRegex = new RegExp(
      `(?<transactionType>${this.appConfig.transactionTypes.credit}|${this.appConfig.transactionTypes.debit})\\s` +
        `(?<amount>[\\d,\.]+)\\sΗμ\\/νία:\\s(?<date>\\d{2}\\/\\d{2}\\/\\d{4})\\s` +
        `Αιτιολογία:\\s(?<description>.+?)\\sΈξοδα[\\s\\n]+?Συναλλάγματος:\\s` +
        `(?<forexFees>[\\d,\.]+)\\sΈξοδα\\sΑνάληψης\\sΜετρητών:\\s(?<cashWithdrawalFees>[\\d,\.]+)`,
      "g"
    );

    // Format a test number to detect the locale's group and decimal separators
    const example = 12345.6;
    const fmt = new Intl.NumberFormat(userConfig.locale);
    const parts = fmt.formatToParts(example);
    this.numberFormatGroup = parts.find(p => p.type === 'group')?.value || ',';
    this.numberFormatDecimal = parts.find(p => p.type === 'decimal')?.value || '.';
  }

  identifyCard(emailBody, userConfig) {
    if (!emailBody || !userConfig?.cards) {
      throw new ServiceError("Processor", "Invalid email body or user config");
    }

    if (!this.transactionRegex) {
      this.initializeRegex(userConfig);
    }

    try {
      return userConfig.cards.find((card) =>
        this.cardIdentifiers[card.lastFourDigits].test(emailBody)
      );
    } catch (e) {
      throw new ServiceError(
        "Processor",
        `Failed to identify card: ${e.message}`
      );
    }
  }

  extractTransactions(emailBody, cardName) {
    if (!emailBody || !cardName) {
      throw new ServiceError(
        "Processor",
        "Email body and card name are required"
      );
    }

    const transactions = [];
    let match;

    try {
      while ((match = this.transactionRegex.exec(emailBody)) !== null) {
        const amount = this.parseLocaleNumber(match.groups.amount);
        const transactionType = match.groups.transactionType;

        transactions.push({
          card: cardName,
          amount:
            transactionType === this.appConfig.transactionTypes.debit
              ? -amount
              : amount,
          transactionType,
          date: match.groups.date,
          description: match.groups.description,
          forexFees: match.groups.forexFees,
          cashWithdrawalFees: match.groups.cashWithdrawalFees,
        });
      }
      return transactions;
    } catch (e) {
      throw new ServiceError(
        "Processor",
        `Failed to extract transactions: ${e.message}`
      );
    }
  }

  parseLocaleNumber(numberString) {
    const normalized = numberString
      .replace(new RegExp('\\' + this.numberFormatGroup, 'g'), '')
      .replace(new RegExp('\\' + this.numberFormatDecimal), '.');

    return parseFloat(normalized);
  }
}

// Service for handling Google Sheets operations
class SheetsService {
  constructor(spreadsheetId, appConfig) {
    if (!spreadsheetId) {
      throw new ServiceError("Sheets", "Spreadsheet ID is required");
    }
    if (!(appConfig instanceof AppConfig)) {
      throw new ServiceError("Sheets", "Invalid app config");
    }
    this.spreadsheetId = spreadsheetId;
    this.appConfig = appConfig;
  }

  addTransactionsToSheet(transactions, sheetName) {
    if (!Array.isArray(transactions) || !sheetName) {
      throw new ServiceError("Sheets", "Invalid transactions or sheet name");
    }

    try {
      const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
      const sheet = spreadsheet.getSheetByName(sheetName);

      if (!sheet) {
        throw new ServiceError("Sheets", `Sheet "${sheetName}" not found`);
      }

      const rowsData = transactions.map((transaction) => [
        transaction.date,
        transaction.date,
        transaction.description,
        "",
        transaction.transactionType === this.appConfig.transactionTypes.credit
          ? "ΑΓΟΡΑ"
          : "ΠΛΗΡΩΜΗ",
        transaction.amount,
        transaction.forexFees,
        transaction.cashWithdrawalFees,
      ]);

      sheet
        .getRange(
          sheet.getLastRow() + 1,
          1,
          rowsData.length,
          rowsData[0].length
        )
        .setValues(rowsData);
    } catch (e) {
      throw new ServiceError(
        "Sheets",
        `Failed to add transactions: ${e.message}`
      );
    }
  }
}

// Main workflow orchestrator
class WorkflowOrchestrator {
  constructor(gmailService, transactionProcessor, sheetsService) {
    this.gmailService = gmailService;
    this.transactionProcessor = transactionProcessor;
    this.sheetsService = sheetsService;
  }

  processMessage(message, userConfig) {
    const emailBody = message.getPlainBody();
    const card = this.transactionProcessor.identifyCard(emailBody, userConfig);

    if (!card) {
      throw new ServiceError(
        "Workflow",
        "No valid card identified in this email"
      );
    }

    Logger.log("Card identified: " + card.name);
    const transactions = this.transactionProcessor.extractTransactions(
      emailBody,
      card.name
    );

    if (transactions.length === 0) {
      throw new ServiceError("Workflow", "No transactions found in this email");
    }

    Logger.log("Extracted " + transactions.length + " transactions");
    this.sheetsService.addTransactionsToSheet(transactions, card.sheetName);
  }

  processThread(thread, userConfig) {
    const messages = thread.getMessages();

    messages.forEach((message) => {
      this.processMessage(message, userConfig);
    });

    this.gmailService.markThreadAsProcessed(thread);
  }

  execute(userConfig) {
    try {
      Logger.log("Starting the email processing workflow...");
      const threads = this.gmailService.getUnprocessedThreads();
      Logger.log("Found " + threads.length + " email threads to process");

      threads.forEach((thread) => this.processThread(thread, userConfig));

      Logger.log("Workflow completed successfully");
    } catch (e) {
      Logger.log("Error in main execution: " + e.message);
      throw e;
    }
  }
}

// Main entry point
function find_and_process_card_transaction_emails() {
  try {
    validateUserConfig(userConfig);

    const appConfig = new AppConfig();
    const gmailService = new GmailService(appConfig);
    const transactionProcessor = new TransactionProcessor(appConfig);
    const sheetsService = new SheetsService(
      userConfig.spreadsheetId,
      appConfig
    );

    const orchestrator = new WorkflowOrchestrator(
      gmailService,
      transactionProcessor,
      sheetsService
    );

    // load user config from Script Properties service if not otherwise defined
    if (typeof userConfig !== "undefined") {
      const scriptProperties = PropertiesService.getScriptProperties();
      const userConfigString = scriptProperties.getProperty("userConfig");
      userConfig = JSON.parse(userConfigString);
    }

    orchestrator.execute(userConfig);
  } catch (e) {
    Logger.log(`Fatal error: ${e.name}: ${e.message}`);
    throw e;
  }
}

// Validate user configuration
function validateUserConfig(userConfig) {
  if (!userConfig?.cards?.length) {
    throw new ServiceError(
      "Config",
      "userConfig.cards must be a non-empty array"
    );
  }

  userConfig.cards.forEach((card, index) => {
    if (!card.lastFourDigits || !card.name || !card.sheetName) {
      throw new ServiceError(
        "Config",
        `Invalid card configuration at index ${index}`
      );
    }
  });
}

// Export for Node.js environment while maintaining Google Apps Script compatibility
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    AppConfig,
    GmailService,
    TransactionProcessor,
    SheetsService,
    WorkflowOrchestrator,
    ServiceError,
    validateUserConfig,
  };
}
