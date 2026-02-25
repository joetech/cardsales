import csv
import argparse
import re

def _to_float(value: str) -> float:
    if value is None:
        return 0.0
    s = str(value).strip()
    if not s:
        return 0.0
    s = re.sub(r"[^0-9,.\-]", "", s)
    s = s.replace(",", "")
    try:
        return float(s)
    except ValueError:
        return 0.0

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", required=True)
    parser.add_argument("--template", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    with open(args.batch, newline="", encoding="utf-8-sig") as f:
        batch_rows = list(csv.DictReader(f))

    if args.limit:
        batch_rows = batch_rows[:args.limit]

    with open(args.template, newline="", encoding="utf-8-sig") as f:
        template_reader = csv.DictReader(f)
        template_rows = list(template_reader)
        headers = template_reader.fieldnames or []

    base = template_rows[0] if template_rows else {h: "" for h in headers}
    output = []

    for row in batch_rows:
        out = base.copy()

        title = (row.get("title") or "").strip()
        team = (row.get("team") or "").strip()
        box = (row.get("box") or "").strip()
        sale_raw = row.get("sale_price", "")
        sale_price = _to_float(sale_raw)

        product_name = f"{title} - {team}"
        if "( )" in product_name and box:
            product_name = product_name.replace("( )", f"({box})")

        out["Product Name"] = product_name
        out["Variant Price"] = sale_raw
        out["Product Images"] = ",".join(
            filter(None, [
                (row.get("front_image") or "").strip(),
                (row.get("back_image") or "").strip()
            ])
        )

        out["US Shipping Fixed Cost"] = "4" if sale_price > 19.99 else "1"

        output.append(out)

    with open(args.out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(output)

if __name__ == "__main__":
    main()
