#!/bin/bash

# Get scanner device and export as environment variable
SCANNER_ID=$(scanimage -L | grep "fi-7160" | sed -n "s/^device \`\([^']*\).*/\1/p")

if [ -z "$SCANNER_ID" ]; then
    echo "Error: fi-7160 scanner not found"
    return 1 2>/dev/null || exit 1
fi

export SCANNER_ID
echo "Scanner ID exported: $SCANNER_ID"