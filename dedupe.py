#!/usr/bin/env python3

import argparse
import csv
import os
import shutil
import sys
import tempfile
from collections import Counter, defaultdict


REQUIRED_COLUMNS = [
    "Product Name",
    "Product Images",
    "Variant Images",
    "Variant Name",
]


def dedupe_csv(filename: str) -> int:
    if not os.path.isfile(filename):
        raise FileNotFoundError(f"File not found: {filename}")

    with open(filename, "r", newline="", encoding="utf-8-sig") as infile:
        reader = csv.DictReader(infile)
        if reader.fieldnames is None:
            raise ValueError("CSV file is empty or missing a header row.")

        missing = [col for col in REQUIRED_COLUMNS if col not in reader.fieldnames]
        if missing:
            raise ValueError(f"Missing required column(s): {', '.join(missing)}")

        fieldnames = reader.fieldnames
        rows = list(reader)

    product_counts = Counter(row["Product Name"] for row in rows)
    variant_numbers = defaultdict(int)
    updated_rows = 0

    for row in rows:
        product_name = row["Product Name"]

        if product_counts[product_name] > 1:
            variant_numbers[product_name] += 1
            row["Variant Images"] = row["Product Images"]
            row["Variant Name"] = f"Card {variant_numbers[product_name]}"
            updated_rows += 1

    directory = os.path.dirname(os.path.abspath(filename)) or "."
    fd, temp_path = tempfile.mkstemp(prefix=".dedupe_", suffix=".csv", dir=directory)

    try:
        with os.fdopen(fd, "w", newline="", encoding="utf-8") as outfile:
            writer = csv.DictWriter(outfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

        shutil.move(temp_path, filename)
    except Exception:
        try:
            os.remove(temp_path)
        except OSError:
            pass
        raise

    return updated_rows


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Update duplicate Product Name rows with Variant Images and Variant Name values."
    )
    parser.add_argument("csv_filename", help="CSV file to update in place")
    args = parser.parse_args()

    try:
        updated_rows = dedupe_csv(args.csv_filename)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print(f"Updated {updated_rows} duplicate row(s) in {args.csv_filename}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
