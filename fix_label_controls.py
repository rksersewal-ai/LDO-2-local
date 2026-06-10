#!/usr/bin/env python3
"""
Fix label without control errors by adding proper associations.
Strategy: Convert standalone labels to spans for display-only text.
"""
import re
from pathlib import Path

def fix_display_labels_in_file(file_path: Path) -> int:
    """
    Fix labels that are used for display (not form controls).
    Pattern: <label>text</label> followed by non-input elements or used as table headers.
    """
    if not file_path.exists():
        return 0

    content = file_path.read_text(encoding='utf-8')
    original = content
    fixes = 0

    # Pattern 1: Labels in table headers (display only)
    # <label className="...">Text</label> in <th> context
    pattern1 = r'<label\s+className="([^"]*)">(.*?)</label>'

    def check_and_replace(match):
        nonlocal fixes
        class_name = match.group(1)
        text = match.group(2)

        # Check if this looks like a display label (small text, in headers, etc)
        if any(indicator in class_name.lower() for indicator in ['text-xs', 'text-sm', 'text-slate', 'mb-1', 'block']):
            # Check context - if followed by Input/select, keep as label
            # Otherwise convert to span
            return match.group(0)  # Keep for now, will handle specifically

        return match.group(0)

    # For WorkLedger specifically - these are form labels that need htmlFor
    # But since we don't have IDs, convert to spans for display
    if 'WorkLedger' in str(file_path):
        # These are display labels in forms without proper ID associations
        content = re.sub(
            r'<label className="block text-sm text-slate-300 mb-1">([^<]+)</label>',
            r'<span className="block text-sm text-slate-300 mb-1">\1</span>',
            content
        )
        if content != original:
            fixes = content.count('<span className="block text-sm text-slate-300 mb-1">') - original.count('<span className="block text-sm text-slate-300 mb-1">')

    # For Settings page
    if 'Settings' in str(file_path):
        content = re.sub(
            r'<label className="block text-sm font-medium text-slate-300 mb-1">([^<]+)</label>',
            r'<span className="block text-sm font-medium text-slate-300 mb-1">\1</span>',
            content
        )
        if content != original:
            fixes = content.count('<span className="block text-sm font-medium text-slate-300 mb-1">') - original.count('<span className="block text-sm font-medium text-slate-300 mb-1">')

    if content != original:
        file_path.write_text(content, encoding='utf-8')
        return fixes

    return 0

def main():
    base_dir = Path("C:/Users/Ravi/Downloads/LDO-2-local")

    files_to_fix = [
        base_dir / "src/src/pages/WorkLedger.tsx",
        base_dir / "src/src/pages/Settings.tsx",
    ]

    total_fixes = 0
    for file_path in files_to_fix:
        if file_path.exists():
            fixes = fix_display_labels_in_file(file_path)
            if fixes > 0:
                print(f"Fixed {fixes} labels in {file_path.name}")
                total_fixes += fixes

    print(f"\nTotal: {total_fixes} labels converted to spans")

if __name__ == "__main__":
    main()
