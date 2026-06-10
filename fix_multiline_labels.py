#!/usr/bin/env python3
"""
Fix label without control errors - handle multi-line labels.
"""
import re
from pathlib import Path

def fix_multiline_labels(file_path: Path) -> int:
    """Fix multi-line labels by converting to spans."""
    if not file_path.exists():
        return 0

    content = file_path.read_text(encoding='utf-8')
    original = content

    # Multi-line label pattern
    # <label className="...">
    #   Text
    # </label>
    pattern = r'<label className="([^"]+)">\s*\n\s*([^\n<]+)\s*\n\s*</label>'
    replacement = r'<span className="\1">\n                  \2\n                </span>'

    content = re.sub(pattern, replacement, content)

    # Single line labels with various class patterns
    single_patterns = [
        (r'<label className="mb-1\.5 block text-xs font-medium uppercase tracking-\[0\.18em\] text-muted-foreground">([^<]+)</label>',
         r'<span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">\1</span>'),

        (r'<label className="mb-2 block text-sm font-medium text-foreground">([^<]+)</label>',
         r'<span className="mb-2 block text-sm font-medium text-foreground">\1</span>'),

        (r'<label className="mb-1\.5 block text-sm font-medium text-foreground">([^<]+)</label>',
         r'<span className="mb-1.5 block text-sm font-medium text-foreground">\1</span>'),

        (r'<label className="block text-sm font-medium mb-2">([^<]+)</label>',
         r'<span className="block text-sm font-medium mb-2">\1</span>'),

        (r'<label className="block text-sm font-medium mb-1">([^<]+)</label>',
         r'<span className="block text-sm font-medium mb-1">\1</span>'),
    ]

    for pat, repl in single_patterns:
        content = re.sub(pat, repl, content)

    if content != original:
        file_path.write_text(content, encoding='utf-8')
        return 1

    return 0

def main():
    base_dir = Path("C:/Users/Ravi/Downloads/LDO-2-local")

    # Get all page files
    files = []
    files += list((base_dir / "artifacts/edms/src/pages").glob("*.tsx"))
    files += list((base_dir / "src/src/pages").glob("*.tsx"))
    files += list((base_dir / "artifacts/edms/src/components/ui").glob("*.tsx"))

    total_fixed = 0
    for file_path in files:
        if fix_multiline_labels(file_path):
            print(f"Fixed: {file_path.name}")
            total_fixed += 1

    print(f"\nTotal: {total_fixed} files fixed")

if __name__ == "__main__":
    main()
