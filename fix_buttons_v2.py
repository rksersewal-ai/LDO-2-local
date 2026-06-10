#!/usr/bin/env python3
"""
Fix button type attributes in React TSX files - handles multi-line buttons.
"""
import re
from pathlib import Path

def fix_button_types_multiline(content: str) -> tuple[str, int]:
    """Fix button elements missing type attribute, including multi-line."""
    fixes = 0

    # Pattern to match <button...> including multi-line, without type attribute
    # This uses DOTALL to match across newlines
    pattern = r'<button\s+(?![^>]*\btype\s*=)([^>]*)>'

    def replacer(match):
        nonlocal fixes
        attrs = match.group(1).strip()
        fixes += 1
        if attrs:
            return f'<button type="button" {attrs}>'
        else:
            return '<button type="button">'

    fixed = re.sub(pattern, replacer, content, flags=re.DOTALL)

    # Handle standalone <button> tags
    standalone_pattern = r'<button\s*>'
    if re.search(standalone_pattern, fixed):
        fixed = re.sub(standalone_pattern, '<button type="button">', fixed)
        fixes += len(re.findall(standalone_pattern, content))

    return fixed, fixes

def fix_autofocus(content: str) -> tuple[str, int]:
    """Remove autoFocus attributes."""
    fixes = 0

    # Remove autoFocus prop
    pattern = r'\s*autoFocus(?:\s*=\s*\{true\})?'
    matches = re.findall(pattern, content)
    fixes = len(matches)

    fixed = re.sub(pattern, '', content)

    return fixed, fixes

def main():
    base_dir = Path("C:/Users/Ravi/Downloads/LDO-2-local/artifacts/edms/src")

    total_button_fixes = 0
    total_autofocus_fixes = 0
    total_files = 0

    for tsx_file in base_dir.rglob("*.tsx"):
        try:
            content = tsx_file.read_text(encoding='utf-8')
            original = content

            # Fix buttons
            content, button_fixes = fix_button_types_multiline(content)

            # Fix autofocus
            content, autofocus_fixes = fix_autofocus(content)

            if content != original:
                tsx_file.write_text(content, encoding='utf-8')
                if button_fixes > 0:
                    print(f"Fixed {button_fixes} buttons in {tsx_file.relative_to(base_dir)}")
                if autofocus_fixes > 0:
                    print(f"Removed {autofocus_fixes} autoFocus in {tsx_file.relative_to(base_dir)}")
                total_files += 1
                total_button_fixes += button_fixes
                total_autofocus_fixes += autofocus_fixes

        except Exception as e:
            print(f"Error processing {tsx_file}: {e}")

    print(f"\nTotal: Fixed {total_button_fixes} buttons and removed {total_autofocus_fixes} autoFocus in {total_files} files")

if __name__ == "__main__":
    main()
