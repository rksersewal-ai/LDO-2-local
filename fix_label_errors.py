#!/usr/bin/env python3
"""
Fix label without control errors by replacing display-only labels with spans.
"""
import re
from pathlib import Path

def fix_display_labels(content: str) -> tuple[str, int]:
    """
    Replace <label> tags used for display (not form controls) with <span>.
    Pattern: <label>text</label> followed by <div> (not an input)
    """
    fixes = 0

    # Pattern: <label ...>...</label> followed by <div> (display pattern)
    # This is a display label, not a form label
    pattern = r'<label\s+([^>]*)>(.*?)</label>\s*\n\s*<div'

    def replacer(match):
        nonlocal fixes
        attrs = match.group(1)
        content = match.group(2)
        fixes += 1
        return f'<span {attrs}>{content}</span>\n                <div'

    fixed = re.sub(pattern, replacer, content, flags=re.DOTALL)

    return fixed, fixes

def main():
    base_dir = Path("C:/Users/Ravi/Downloads/LDO-2-local")

    # Fix WorkLedger.tsx
    work_ledger = base_dir / "src/src/pages/WorkLedger.tsx"

    if work_ledger.exists():
        content = work_ledger.read_text(encoding='utf-8')
        original = content

        content, fixes = fix_display_labels(content)

        if content != original:
            work_ledger.write_text(content, encoding='utf-8')
            print(f"Fixed {fixes} display labels in WorkLedger.tsx")
        else:
            print("No display labels found to fix")
    else:
        print(f"File not found: {work_ledger}")

    print("\nNote: These were display-only labels (not form controls).")
    print("Changed to <span> for semantic correctness.")

if __name__ == "__main__":
    main()
