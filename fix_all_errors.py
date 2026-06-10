#!/usr/bin/env python3
"""
Fix all remaining linting errors in the codebase
"""
import re
import os
from pathlib import Path

def fix_non_null_assertions(file_path):
    """Fix non-null assertion errors by adding proper null checks"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Fix DocumentChangeReviewCard.tsx - alert.previousDocumentId!
    if 'DocumentChangeReviewCard.tsx' in file_path:
        content = re.sub(
            r'resolveDocumentPreviewPath\(alert\.previousDocumentId!\)',
            r'alert.previousDocumentId ? resolveDocumentPreviewPath(alert.previousDocumentId) : "/"',
            content
        )

    # Fix Settings.tsx - settingGroups.find()!
    if 'Settings.tsx' in file_path and 'src\\src\\pages' in file_path:
        content = re.sub(
            r'const group = settingGroups\.find\(\(g\) => g\.label === activeGroup\)!;',
            r'const group = settingGroups.find((g) => g.label === activeGroup) ?? settingGroups[0];',
            content
        )

    if content != original:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def fix_explicit_any(file_path):
    """Fix explicit any types"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Fix CommandPalette.tsx - hasPermission(cmd.roles as any)
    if 'CommandPalette.tsx' in file_path:
        content = re.sub(
            r'hasPermission\(cmd\.roles as any\)',
            r'hasPermission(cmd.roles as string[])',
            content
        )

    # Fix RightClickPalette.tsx - hasPermission(action.roles as any)
    if 'RightClickPalette.tsx' in file_path:
        content = re.sub(
            r'hasPermission\(action\.roles as any\)',
            r'hasPermission(action.roles as string[])',
            content
        )

    # Fix Settings.tsx - Record<string, any>
    if 'Settings.tsx' in file_path and 'src\\src\\pages' in file_path:
        content = re.sub(
            r'Record<string, any>',
            r'Record<string, string | number | boolean>',
            content,
            count=2
        )

    if content != original:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def fix_unused_parameters(file_path):
    """Fix unused function parameters"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Fix SafeActionButton.tsx - remove unused parameters with underscore prefix
    if 'SafeActionButton.tsx' in file_path:
        content = re.sub(
            r'(\s+)successMessage = "Done",\n(\s+)errorMessage = "Error",',
            r'\1_successMessage = "Done",\n\2_errorMessage = "Error",',
            content
        )

    if content != original:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def fix_static_element_interactions(file_path):
    """Fix static element interactions by adding role attributes"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Fix CommandPalette.tsx - add role="dialog"
    if 'CommandPalette.tsx' in file_path:
        content = re.sub(
            r'(<div\s+className="relative w-full max-w-xl[^"]*")\s+onClick=',
            r'\1\n        role="dialog"\n        onClick=',
            content
        )

    # Fix RightClickPalette.tsx - add role="menu"
    if 'RightClickPalette.tsx' in file_path:
        content = re.sub(
            r'(<div\s+className="fixed z-\[100000\][^"]*")\s+style=',
            r'\1\n          role="menu"\n          style=',
            content
        )

    # Fix WorkLedger.tsx - add role="dialog"
    if 'WorkLedger.tsx' in file_path and 'src\\src\\pages' in file_path:
        content = re.sub(
            r'(<div\s+className="w-\[480px\][^"]*")\s+onClick=',
            r'\1\n            role="dialog"\n            onClick=',
            content
        )

    if content != original:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def fix_label_without_control(file_path):
    """Fix label without control by converting to span"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Fix DatePicker.tsx - convert label to span
    if 'DatePicker.tsx' in file_path:
        content = re.sub(
            r'<label className="text-xs font-medium text-muted-foreground mb-1\.5 block">',
            r'<span className="text-xs font-medium text-muted-foreground mb-1.5 block">',
            content
        )
        content = re.sub(
            r'</label>(\s+)\}\)',
            r'</span>\1})',
            content
        )

    # Fix Settings.tsx - convert label to span
    if 'Settings.tsx' in file_path and 'src\\src\\pages' in file_path:
        content = re.sub(
            r'<label className="text-sm text-slate-300 shrink-0"',
            r'<span className="text-sm text-slate-300 shrink-0"',
            content
        )
        content = re.sub(
            r'</label>(\s+)\{s\.type === "select"',
            r'</span>\1{s.type === "select"',
            content
        )

    if content != original:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def fix_iterable_callback_return(file_path):
    """Fix forEach callback return issues"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Fix Settings.tsx - use for...of instead of forEach
    if 'Settings.tsx' in file_path and 'src\\src\\pages' in file_path:
        pattern = r'settingGroups\.forEach\(\(g\) =>\s+g\.settings\.forEach\(\(s\) => \{\s+v\[s\.key\] = s\.value;\s+\}\),?\s+\);'
        replacement = '''for (const g of settingGroups) {
      for (const s of g.settings) {
        v[s.key] = s.value;
      }
    }'''
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)

    if content != original:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    base_path = Path('.')

    files_to_fix = [
        'artifacts/edms/src/components/documents/DocumentChangeReviewCard.tsx',
        'artifacts/edms/src/components/ui/CommandPalette.tsx',
        'artifacts/edms/src/components/ui/RightClickPalette.tsx',
        'artifacts/edms/src/components/ui/SafeActionButton.tsx',
        'artifacts/edms/src/components/ui/DatePicker.tsx',
        'src/src/pages/Settings.tsx',
        'src/src/pages/WorkLedger.tsx',
    ]

    fixed_count = 0

    for file_path in files_to_fix:
        full_path = base_path / file_path
        if not full_path.exists():
            print(f"⚠️  File not found: {file_path}")
            continue

        fixed = False
        fixed = fix_non_null_assertions(str(full_path)) or fixed
        fixed = fix_explicit_any(str(full_path)) or fixed
        fixed = fix_unused_parameters(str(full_path)) or fixed
        fixed = fix_static_element_interactions(str(full_path)) or fixed
        fixed = fix_label_without_control(str(full_path)) or fixed
        fixed = fix_iterable_callback_return(str(full_path)) or fixed

        if fixed:
            print(f"✅ Fixed: {file_path}")
            fixed_count += 1

    print(f"\n✨ Fixed {fixed_count} files")

if __name__ == '__main__':
    main()
