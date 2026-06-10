#!/usr/bin/env python3
"""
Final comprehensive fix for remaining errors
"""
import re
from pathlib import Path

def fix_keyboard_events(file_path):
    """Add keyboard event handlers to elements with onClick"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original = content

        # CommandPalette.tsx - add onKeyDown to dialog div
        if 'CommandPalette.tsx' in str(file_path):
            content = re.sub(
                r'(<div\s+className="relative w-full max-w-xl[^"]*")\s+role="dialog"\s+onClick=\{([^}]+)\}',
                r'\1\n        role="dialog"\n        onKeyDown={(e) => e.key === "Escape" && \2(e)}\n        onClick={\2}',
                content
            )

        # RightClickPalette.tsx - add onKeyDown to menu div
        if 'RightClickPalette.tsx' in str(file_path):
            content = re.sub(
                r'(<div\s+className="fixed z-\[100000\][^"]*")\s+role="menu"\s+style=',
                r'\1\n          role="menu"\n          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}\n          style=',
                content
            )

        # PLKnowledgeHub.tsx - add keyboard handlers to clickable divs
        if 'PLKnowledgeHub.tsx' in str(file_path):
            # Pattern for record cards
            content = re.sub(
                r'(<div\s+key=\{record\.id\}\s+onClick=\{[^}]+\}\s+className="[^"]*cursor-pointer[^"]*")',
                r'\1\n                    role="button"\n                    tabIndex={0}\n                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.click()}',
                content
            )

        # WorkLedger.tsx - add keyboard handler to dialog
        if 'WorkLedger.tsx' in str(file_path):
            content = re.sub(
                r'(<div\s+className="w-\[480px\][^"]*")\s+role="dialog"\s+onClick=',
                r'\1\n            role="dialog"\n            onKeyDown={(e) => e.key === "Escape" && e.stopPropagation()}\n            onClick=',
                content
            )

        # PLDetail.tsx - add keyboard handlers
        if 'PLDetail.tsx' in str(file_path):
            content = re.sub(
                r'(<div\s+onClick=\{[^}]+\}\s+className="[^"]*cursor-pointer[^"]*")',
                r'\1\n                      role="button"\n                      tabIndex={0}\n                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.click()}',
                content
            )

        if content != original:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
    except Exception as e:
        print(f"Error: {file_path}: {e}")
    return False

def fix_aria_props(file_path):
    """Fix unsupported ARIA props"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original = content

        # carousel.tsx - remove aria-roledescription from div
        if 'carousel.tsx' in str(file_path):
            content = re.sub(
                r'aria-roledescription="[^"]*"\s+',
                '',
                content
            )

        if content != original:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
    except Exception as e:
        print(f"Error: {file_path}: {e}")
    return False

def fix_semantic_elements(file_path):
    """Fix semantic element issues"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original = content

        # Convert div role="separator" to hr
        content = re.sub(
            r'<div\s+role="separator"\s+className="([^"]*)"\s*/?>',
            r'<hr className="\1" />',
            content
        )

        if content != original:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
    except Exception as e:
        print(f"Error: {file_path}: {e}")
    return False

def main():
    base = Path('.')
    fixed = 0

    # Fix keyboard events
    keyboard_files = [
        'artifacts/edms/src/components/ui/CommandPalette.tsx',
        'artifacts/edms/src/components/ui/RightClickPalette.tsx',
        'src/src/pages/PLKnowledgeHub.tsx',
        'src/src/pages/WorkLedger.tsx',
        'src/src/pages/PLDetail.tsx',
    ]

    for file in keyboard_files:
        path = base / file
        if path.exists() and fix_keyboard_events(path):
            print(f"✅ Fixed keyboard events: {file}")
            fixed += 1

    # Fix ARIA props
    aria_files = [
        'artifacts/edms/src/components/ui/carousel.tsx',
    ]

    for file in aria_files:
        path = base / file
        if path.exists() and fix_aria_props(path):
            print(f"✅ Fixed ARIA props: {file}")
            fixed += 1

    # Fix semantic elements
    semantic_files = [
        'artifacts/edms/src/components/ui/CommandPalette.tsx',
        'artifacts/edms/src/components/ui/RightClickPalette.tsx',
    ]

    for file in semantic_files:
        path = base / file
        if path.exists() and fix_semantic_elements(path):
            print(f"✅ Fixed semantic elements: {file}")
            fixed += 1

    print(f"\n✨ Fixed {fixed} files")

if __name__ == '__main__':
    main()
