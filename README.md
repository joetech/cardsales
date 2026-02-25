# Card Scanning Scripts

This repository contains two main scripts for processing scanned card images and converting batch data.

## How to use this repository

If you are new to GitHub, think of this page as a shared folder of files.

### Download everything at once (easiest)

1. Open this repository page in your web browser.
2. Click the green **Code** button near the top of the file list.
3. Click **Download ZIP**.
4. Open your Downloads folder and find the ZIP file.
5. Double-click the ZIP file to unzip it.
6. Open the unzipped folder to access all scripts and docs.

### Download just one file

1. Click the file name you want (for example, `README.md`, `GenAI.md`, or a script in `tm/`).
2. In the file view, click the **Download raw file** button (or open the **Raw** view).
3. Save the file to your computer.

### If you are not sure where to start

- Read this file (`README.md`) first for the overall workflow.
- Read `GenAI.md` for simple AI-assisted automation guidance.
- Read `TemperMonkey.md` for browser script setup and usage.

## rotate.py

Automatically rotates and moves PNG card scan images to the correct orientation.

### Usage

```bash
python3 rotate.py batches/138-4
```

### Description

The `rotate.py` script processes PNG images in the current directory, automatically determines the correct rotation (either 90° clockwise or counter-clockwise), applies the rotation, and moves the processed files to the specified destination directory.

### Features

- **Auto-rotation detection**: Uses OCR (default) or simple edge detection to determine optimal orientation
- **Two detection modes**:
  - `--auto ocr` (default): Uses tesseract OCR to analyze text readability
  - `--auto simple`: Uses edge detection heuristics (requires numpy)
- **Dry run mode**: Use `--dry-run` to preview actions without modifying files

### Full Options

```bash
python3 rotate.py <destination_directory> [--auto {simple,ocr}] [--dry-run]
```

### Requirements

- PIL (Pillow): `pip install Pillow`
- For OCR mode: `tesseract-ocr` system package + `pip install pytesseract`
- For simple mode: `pip install numpy`

## convert.py

Converts batch CSV export data into a standardized district CSV format using a template.

### Usage

```bash
python3 convert.py --batch batches/138-1/cdp-138-4-export.csv --template "District CSV Product Template.csv" --out district-138-4.csv
```

### Description

The `convert.py` script takes a batch CSV file (exported card data) and transforms it into a standardized format using a template CSV. It processes card information including titles, teams, boxes, prices, and images.

### Arguments

- `--batch`: Path to the input batch CSV file (required)
- `--template`: Path to the template CSV file that defines the output structure (required)
- `--out`: Path for the output CSV file (required)
- `--limit`: Optional limit on the number of rows to process

### Data Processing

The script performs the following transformations:

1. **Product naming**: Combines `title` and `team` fields into "Title - Team" format
2. **Box information**: Replaces empty parentheses "( )" with box information if available
3. **Price handling**: Cleans and formats sale prices from the `sale_price` field
4. **Image processing**: Combines `front_image` and `back_image` URLs into a comma-separated list
5. **Shipping costs**: Automatically sets shipping to $4 for items over $19.99, $1 otherwise

### Input CSV Format

Expected columns in the batch CSV:

- `title`: Card title
- `team`: Team name
- `box`: Box information (optional)
- `sale_price`: Sale price (with or without currency symbols)
- `front_image`: URL to front image
- `back_image`: URL to back image

### Template CSV

The template CSV should contain the desired output column headers and a sample row with default values. The first row serves as the base template for all output rows.

Before you convert, you'll want to modify anything in the batch to set up defualts like a description and shipping values.

## Example Workflow
1. **Get the scanner ID:**

   ```bash
   . ./get_scanner.sh
   ```

2. **Scan cards:**

   Plase up to 20 or so cards in the scanner face down and on their side. Then run this:

   ```bash
   ./scan_cards.sh
   ```

   Repeat this step with all the cards you want to batch from this box.

   There's a scan_tl_cards.sh as well for scanning toploaded cards.

3. **Rotate scanned images**:

   The `batches/138-4` parameter tells it where to move the scanned images to after it rotates them. If these cards are the first batch from box 37, maybe use `37-1` here.

   ```bash
   python3 rotate.py batches/138-4
   ```

4. **Batch and list in CDP**
   Head to Card Dealer Pro and create a new batch, using the rotated images in your batch folder. Once they're all ready to list, export all data to a CSV (like `batch-37-1.csv`) and save it in the this folder.

5. **Convert batch data**:
   ```bash
   python3 convert.py --batch batch-37-1.csv --template "District CSV Product Template.csv" --out district-37-1.csv
   ```

6. **Import into District**
   Go to [https://district.net/dashboard/midwestboxbreaks/products](https://district.net/dashboard/midwestboxbreaks/products) and click the Import button on the right. Then drag your `district-37-1.csv` file into the page.

This workflow processes the physical scans and converts the associated metadata into the required format for distribution.

## TamperMonkey Automations

This repo also includes TamperMonkey scripts in `tm/` to speed up browser-side eBay/Gmail workflows (copying order data and opening quick District searches).

See [TemperMonkey.md](TemperMonkey.md) for installation instructions and usage details for each script.

## Automation Using Generative AI

You can also use generative AI tools to quickly create custom automations and small helper scripts, even if you are not a programmer.

See [GenAI.md](GenAI.md) for a simple guide on using ChatGPT or Claude to build helper scripts and TamperMonkey automations.
