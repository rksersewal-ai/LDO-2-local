#!/usr/bin/env python3
"""
Fix static element interactions by converting divs to buttons or adding proper roles
"""
import re
from pathlib import Path

def fix_clickable_divs(file_path):
    """Fix clickable divs by adding role and keyboard handlers"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        modified = False
        i = 0
        while i < len(lines):
            line = lines[i]

            # Look for div with onClick and cursor-pointer
            if '<div' in line and 'onClick=' in line and 'cursor-pointer' in line:
                # Check if role is already present
                if 'role=' not in line:
                    # Find the onClick handler
                    onclick_match = re.search(r'onClick=\{([^}]+)\}', line)
                    if onclick_match:
                        indent = len(line) - len(line.lstrip())
                        indent_str = ' ' * indent

                        # Add role, tabIndex, and onKeyDown before onClick
                        line = line.replace(
                            'onClick={',
                            f'role="button"\n{indent_str}        tabIndex={{0}}\n{indent_str}        onKeyDown={{(e) => e.key === "Enter" && ('
                        )
                        # Close the onKeyDown handler after onClick
                        line = line.replace(
                            ')}',
                            '))}}\n' + indent_str + '        onClick={'
                        )
                        lines[i] = line
                        modified = True

            i += 1

        if modified:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.writelines(lines)
            return True
    except Exception as e:
        print(f"Error: {file_path}: {e}")
    return False

def fix_with_regex(file_path):
    """Use regex to fix clickable divs"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original = content

        # Pattern 1: Simple onClick with cursor-pointer
        pattern1 = r'(<div[^>]*cursor-pointer[^>]*)\s+onClick=\{([^}]+)\}'
        replacement1 = r'\1\n                    role="button"\n                    tabIndex={0}\n                    onKeyDown={(e) => e.key === "Enter" && (\2)}\n                    onClick={\2}'
        content = re.sub(pattern1, replacement1, content)

        # Pattern 2: div with onClick but no role
        pattern2 = r'(<div[^>]*)\s+onClick=\{([^}]+)\}\s+className="([^"]*cursor-pointer[^"]*)"'
        if 'role=' not in content or content.count('role=') < content.count('cursor-pointer'):
            content = re.sub(
                r'(<div[^>]*)\s+onClick=\{([^}]+)\}\s+(className="[^"]*cursor-pointer[^"]*")',
                r'\1\n                    role="button"\n                    tabIndex={0}\n                    onKeyDown={(e) => e.key === "Enter" && (\2)}\n                    onClick={\2}\n                    \3',
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

    # Files with static element interaction issues
    files_to_fix = [
        'src/src/pages/PLKnowledgeHub.tsx',
        'src/src/pages/DocumentHub.tsx',
        'artifacts/edms/src/pages/AdminWorkspace.tsx',
        'artifacts/edms/src/pages/BOMProductView.tsx',
        'artifacts/edms/src/pages/Dashboard.tsx',
        'artifacts/edms/src/pages/DocumentHub.tsx',
        'artifacts/edms/src/pages/PLKnowledgeHub.tsx',
    ]

    for file in files_to_fix:
        path = base / file
        if path.exists():
            if fix_with_regex(path):
                print(f"✅ Fixed: {file}")
                fixed += 1

    print(f"\n✨ Fixed {fixed} files")

if __name__ == '__main__':
    main()
