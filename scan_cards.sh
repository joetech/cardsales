#!/bin/bash

# Get scanner device from environment variable
if [ -z "$SCANNER_ID" ]; then
    echo "SCANNER_ID environment variable not set. Please run: source ./get_scanner.sh"
    exit 1
fi

echo "Using scanner: $SCANNER_ID"

# Output directory
OUTPUT_DIR="$HOME/Pictures/cardscans/scanned"
mkdir -p "$OUTPUT_DIR"

# Find next available number
COUNTER=1
while [ -f "$OUTPUT_DIR/card_$(printf "%04d" $COUNTER)_front.png" ]; do
    ((COUNTER++))
done

echo "Starting with card number: $COUNTER"
echo "Press Ctrl+C to stop scanning"

# Scan loop
while true; do
    FRONT_FILE="$OUTPUT_DIR/card_$(printf "%04d" $COUNTER)_front.png"
    BACK_FILE="$OUTPUT_DIR/card_$(printf "%04d" $COUNTER)_back.png"
    
    echo "Scanning card $COUNTER..."
    
    # Count existing png files to determine batch start number
    existing_files=$(find "$OUTPUT_DIR" -name "*.png" | wc -l)
    batch_start=$((existing_files + 1))
    
    # Scan both sides (ADF duplex handles front and back automatically)
        scan_output=$(scanimage -d "$SCANNER_ID" \
        --source Adf-duplex \
        --mode Color \
        --resolution 200 \
        --brightness 15 \
        --paper-size Custom \
        --page-width 80 \
        --page-height 50 \
        --page-auto=no \
        --cropping Overscan \
        -t 3 \
        --format=png \
        --batch="$OUTPUT_DIR/card_$(printf "%04d" $COUNTER)_%04d.png" \
        --batch-start=$batch_start \
        --batch-increment=1 2>&1)
    
    echo "Scanned card $COUNTER"
    
    # Small delay to allow for next card
    sleep 1
    
    ((COUNTER++))
    
    # Check if document feeder is out of documents (moved to end)
    if echo "$scan_output" | grep -q "Document feeder out of documents"; then
        echo "No more documents in feeder. Stopping."
        break
    fi
done