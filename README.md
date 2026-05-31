# cc-transactions-to-google-sheets

Google Apps Script code to parse Eurobank's credit card transaction emails into a Google Sheet.

## Introduction

This project provides a Google Apps Script to automatically parse credit card transaction emails from Eurobank and log the transactions into a Google Sheet. This helps in keeping track of your expenses effortlessly.

## Using npm Scripts

To manage and run the scripts in this project, you can use the following npm commands:

- `npm run test`: Runs the test suite to ensure everything is working correctly.
- `npm run test:debug`: Runs the test suite in debug mode.

## Installing on Google Apps Script

### Method 1: Using Google Apps Script Editor

1. Open Google Drive and create a new Google Sheet.
2. Click on `Extensions` > `Apps Script` to open the Apps Script editor.
3. Delete any code in the script editor and replace it with the code from this repository.
4. Save the project and give it a name.
5. Click on the clock icon to create a trigger that runs the script periodically.

### Method 2: Using `clasp` (Command Line Apps Script)

1. Install `clasp` globally if you haven't already:
   ```sh
   npm install -g @google/clasp
   ```
2. Log in to your Google account:
   ```sh
   clasp login
   ```
3. Clone this repository and navigate to its directory:
   ```sh
   git clone <repository-url>
   cd cc-transactions-to-google-sheets
   ```
4. Link the local project to your existing Google Apps Script project:
   ```sh
   clasp link
   ```
   This creates a local `.clasp.json` file, which is ignored by git so that project-specific configuration is not committed.
5. Push the code to your Apps Script project:
   ```sh
   clasp push
   ```
6. Open the script project in the Apps Script editor:
   ```sh
   clasp open
   ```
7. Set up a trigger to run the script periodically by clicking on the clock icon in the Apps Script editor.

## Automated deployment with GitHub Actions

This repository includes a GitHub Actions workflow that deploys the script to Google Apps Script on every push to `main` and can also be run manually from the Actions tab.

### Manual setup steps

1. Create or open the target Google Apps Script project.
2. Copy its **Script ID** from the Apps Script project settings.
3. In a local clone, authenticate `clasp`:
   ```sh
   npm install -g @google/clasp
   clasp login
   ```
4. Copy the contents of your local `~/.clasprc.json` file.
5. In GitHub, add these repository secrets:
   - `GAS_SCRIPT_ID`: the target Apps Script project's Script ID
   - `GAS_CLASP_CREDENTIALS`: the full JSON contents of `~/.clasprc.json`
6. Merge or push changes to `main` to trigger deployment.

The workflow writes both configuration files at runtime. It keeps `rootDir` as an empty string, which is the `clasp` setting for deploying from the repository root instead of a subdirectory, and no deployment secrets need to be committed to the repository.

## Setting Up Gmail Filters

To ensure that the script processes only the relevant emails, set up a Gmail filter:

1. Open Gmail and click on the search bar dropdown.
2. In the `From` field, enter the email address that sends the transaction emails, eurobank@eurobank.gr in my case. Also add "Κινήσεις Καρτών" in the email subject field.
3. Click on `Create filter`.
4. Check `Apply the label` and create a new label, `cc_transactions_report` is the one set up in this project.
5. Save the filter.

The script will now process emails with this label and log the transactions into your Google Sheet.
