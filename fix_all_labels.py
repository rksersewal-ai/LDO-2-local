#!/usr/bin/env python3
"""
Fix label without control errors across all files.
Convert display-only labels to spans.
"""
import re
from pathlib import Path

def fix_labels_in_file(file_path: Path) -> int:
    """Fix labels by converting display-only labels to spans."""
    if not file_path.exists():
        return 0

    content = file_path.read_text(encoding='utf-8')
    original = content

    # Common patterns for display-only labels (not associated with inputs)
    patterns = [
        # Block labels with margin bottom (form field labels without htmlFor)
        (r'<label className="block text-sm text-slate-300 mb-1">([^<]+)</label>',
         r'<span className="block text-sm text-slate-300 mb-1">\1</span>'),

        (r'<label className="block text-sm font-medium text-slate-300 mb-1">([^<]+)</label>',
         r'<span className="block text-sm font-medium text-slate-300 mb-1">\1</span>'),

        (r'<label className="block text-sm font-medium text-foreground mb-1\.5">([^<]+)</label>',
         r'<span className="block text-sm font-medium text-foreground mb-1.5">\1</span>'),

        (r'<label className="block text-sm font-medium text-foreground mb-2">([^<]+)</label>',
         r'<span className="block text-sm font-medium text-foreground mb-2">\1</span>'),

        (r'<label className="text-sm font-medium text-foreground">([^<]+)</label>',
         r'<span className="text-sm font-medium text-foreground">\1</span>'),

        (r'<label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">([^<]+)</label>',
         r'<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">\1</span>'),

        (r'<label className="block text-xs font-medium text-muted-foreground mb-1\.5">([^<]+)</label>',
         r'<span className="block text-xs font-medium text-muted-foreground mb-1.5">\1</span>'),

        (r'<label className="block text-xs font-medium text-muted-foreground mb-2">([^<]+)</label>',
         r'<span className="block text-xs font-medium text-muted-foreground mb-2">\1</span>'),
    ]

    for pattern, replacement in patterns:
        content = re.sub(pattern, replacement, content)

    if content != original:
        file_path.write_text(content, encoding='utf-8')
        # Count replacements
        fixes = sum(content.count(repl.split('>')[0]) - original.count(repl.split('>')[0])
                   for _, repl in patterns)
        return fixes

    return 0

def main():
    base_dir = Path("C:/Users/Ravi/Downloads/LDO-2-local")

    # Find all TypeScript/TSX files in pages
    page_files = list((base_dir / "artifacts/edms/src/pages").glob("*.tsx"))
    page_files += list((base_dir / "src/src/pages").glob("*.tsx"))
    page_files += list((base_dir / "artifacts/edms/src/components/ui").glob("*.tsx"))

    total_fixes = 0
    fixed_files = []

    for file_path in page_files:
        fixes = fix_labels_in_file(file_path)
        if fixes > 0:
            fixed_files.append(file_path.name)
            total_fixes += 1

    print(f"Fixed labels in {total_fixes} files:")
    for fname in fixed_files[:10]:
        print(f"  - {fname}")
    if len(fixed_files) > 10:
        print(f"  ... and {len(fixed_files) - 10} more")

    print(f"\nTotal: {total_fixes} files updated")

if __name__ == "__main__":
    main()
