# Automation Using Generative AI

This page shows a simple way to use AI tools to build custom automations and helper scripts for your card-selling workflow.

## AI Tools You Can Use

- [ChatGPT](https://chatgpt.com)
- [Claude](https://claude.ai)

Both tools can help you:
- Write small helper scripts
- Create TamperMonkey scripts for browser tasks
- Improve and fix scripts when something is not working

## Simple Process (Non-Technical)

1. Describe what you want in plain language.
2. Give the AI enough context (the page content, your goal, and what output you want).
3. Ask for a first version of the script.
4. Test it.
5. Ask the AI to improve it based on what you see.

You do not need to know coding terms to get started. Clear instructions are usually enough.

## Example: Sports Card Market Data on eBay

### Goal

You want to quickly review sold-item market data for a sports card and avoid manually reading every listing.

### Decision

Use a TamperMonkey script that adds one button to the eBay sold listings page after the page loads.

When clicked, the button should:
- Read sold listings on the page
- Pull out sale price, shipping, and date sold
- Show a popup/modal with:
  - Low sold price
  - High sold price
  - Mean sold price
  - Average sold price

## How To Do This With Claude

1. Search your card on eBay and filter to **Sold items**.
2. Open the sold-items results page.
3. Copy the page source:
   - Right-click the page and choose **View Page Source**
   - Or press **Command + Option + U** on macOS
4. In the source tab, select all (**Command + A**) and copy (**Command + C**).
5. Open [Claude](https://claude.ai).
6. Paste the source, then ask Claude to:
   - Identify fields like price, shipping, and date sold
   - Write a TamperMonkey script that adds a single button after page load
   - Show a modal popup with low/high/mean/average sold prices

## Example Prompt for Claude

You can use this prompt and replace the card/search details as needed:

```text
I am on an eBay sold-items results page for a sports card. I pasted the full page source below.

Please do the following:
1) Find how to extract sold listing data from this page source, including:
   - sale price
   - shipping cost
   - date sold
2) Write a complete TamperMonkey userscript that runs on eBay sold listing pages.
3) Wait until the page is fully loaded, then place one button on the page called "Analyze Sold Data".
4) When I click the button, parse all visible sold listings and calculate:
   - low sold price
   - high sold price
   - mean sold price
   - average sold price
5) Show those results in a popup modal on the page.
6) Keep the script easy to edit, and add clear labels in the results.
7) If shipping exists, include a second set of stats for total price (sold price + shipping).

After the script, provide quick install steps for TamperMonkey and 3 troubleshooting tips.

Here is the page source:
[PASTE PAGE SOURCE HERE]
```

## Practical Tip

If the first script does not work perfectly, paste the error or describe what happened, then ask Claude or ChatGPT to revise it. A second or third prompt usually gets you to a solid result.
