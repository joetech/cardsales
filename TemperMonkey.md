# TamperMonkey Automations

This project includes browser automation helpers in `tm/` for eBay and Gmail workflows.

## Install TamperMonkey

1. Visit the official site: https://www.tampermonkey.net/
2. Install the extension for your browser (Chrome, Edge, Firefox, Safari, or Opera).
3. Open the TamperMonkey dashboard in your browser.
4. Create a new userscript, paste one of the scripts from `tm/`, and save.

## Use a Script from ChatGPT or Claude

If you generated a script with ChatGPT or Claude, you can load and test it in a few quick steps:

1. In TamperMonkey, click **Create a new script**.
2. Delete the default starter code in the editor.
3. Paste the full script you got from ChatGPT or Claude.
4. Click **File → Save** (or press **Command + S**).
5. Make sure the script is **Enabled** in the TamperMonkey dashboard.
6. Open the website the script is meant for, then refresh the page.
7. Test the script action (for example, click its button if it adds one).

If nothing happens, check these basics:
- The script has the correct `@match` URL for the page you are on.
- The script is enabled in TamperMonkey.
- You refreshed the page after saving.

## Scripts in `tm/`

### `ebay-order-district-links.js`

- **Purpose**: Adds hoverable word-by-word links that open District product search.
- **Where it runs**:
  - `https://www.ebay.com/sh/ord/*`
  - `https://mail.google.com/mail/u/0/*`
- **What it does**:
  - On eBay orders pages, it scans order item titles and wraps words with a hover target.
  - On Gmail, it does the same for `strong` text in message content.
  - Hovering a word shows a small popup with a **District** link to:
    - `https://district.net/dashboard/midwestboxbreaks/products?q=<word>`

    ![Example usage](image.png)
    
- **How to use**:
  1. Enable the script in TamperMonkey.
  2. Open an eBay orders page or Gmail message.
  3. Hover a word in a supported text area.
  4. Click **District** in the popup to open a search in a new tab.

### `ebay-order-ids.js`

- **Purpose**: Adds a one-click copy button for eBay bulk shipping order data.
- **Where it runs**:
  - `https://www.ebay.com/ship/*`
- **What it does**:
  - Injects a fixed button in the top-right of the page.
  - Scrapes each visible order’s:
    - order number
    - item title
    - item price
  - Copies rows as tab-separated values for easy paste into Google Sheets.
  - Updates automatically as page content changes.
- **How to use**:
  1. Enable the script in TamperMonkey.
  2. Open eBay Bulk Shipping (`/ship/`) with orders loaded.
  3. Click the **COPY N ROW(S)** button.
  4. Paste into Sheets or CSV tooling; columns map to order number, title, and price.

## Notes

- If a script shows an error state, refresh the page and make sure matching page elements are loaded.
- TamperMonkey script matching is URL-based; scripts only run on the `@match` URLs declared at the top of each file.