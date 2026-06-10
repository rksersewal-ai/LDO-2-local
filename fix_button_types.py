#!/usr/bin/env python3
"""
Fix button type attributes in React TSX files.
Adds type="button" to <button> elements that don't have an explicit type.
"""
import re
import sys
from pathlib import Path

def fix_button_types(content: str) -> tuple[str, int]:
    """
    Fix button elements missing type attribute.
    Returns (fixed_content, count_of_fixes)
    """
    fixes = 0

    # Pattern to match <button without type attribute
    # Negative lookahead to avoid buttons that already have type
    pattern = r'<button\s+(?![^>]*\btype=)'

    def replacer(match):
        nonlocal fixes
        fixes += 1
        return '<button type="button" '

    fixed = re.sub(pattern, replacer, content)

    # Also handle <button> with no attributes
    if '<button>' in fixed:
        fixed = fixed.replace('<button>', '<button type="button">')
        fixes += fixed.count('<button type="button">') - content.count('<button type="button">')

    return fixed, fixes

def main():
    base_dir = Path("C:/Users/Ravi/Downloads/LDO-2-local/artifacts/edms/src")

    if not base_dir.exists():
        print(f"Error: {base_dir} does not exist")
        return 1

    total_files = 0
    total_fixes = 0

    for tsx_file in base_dir.rglob("*.tsx"):
        try:
            content = tsx_file.read_text(encoding='utf-8')

            # Skip if no buttons
            if '<button' not in content:
                continue

            # Skip if all buttons already have type
            if '<button' in content and 'type="button"' in content:
                # Check if there are buttons without type
                if not re.search(r'<button\s+(?![^>]*\btype=)', content) and '<button>' not in content:
                    continue

            fixed_content, fixes = fix_button_types(content)

            if fixes > 0:
                tsx_file.write_text(fixed_content, encoding='utf-8')
                print(f"Fixed {fixes} buttons in {tsx_file.relative_to(base_dir)}")
                total_files += 1
                total_fixes += fixes

        except Exception as e:
            print(f"Error processing {tsx_file}: {e}", file=sys.stderr)

    print(f"\nTotal: Fixed {total_fixes} buttons in {total_files} files")
    return 0

if __name__ == "__main__":
    sys.exit(main())
