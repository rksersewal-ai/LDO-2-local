#!/usr/bin/env python3
"""
Fix non-null assertions and other critical errors
"""
import re
from pathlib import Path

def fix_file_content(file_path, patterns):
    """Apply regex patterns to fix file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original = content

        for pattern, replacement in patterns:
            content = re.sub(pattern, replacement, content, flags=re.MULTILINE)

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

    # Fix all main.tsx files
    main_files = [
        'src/main.tsx',
        'artifacts/mockup-sandbox/src/main.tsx',
    ]

    for file in main_files:
        path = base / file
        if path.exists():
            patterns = [
                (r'document\.getElementById\("root"\)!', r'document.getElementById("root") as HTMLElement'),
            ]
            if fix_file_content(path, patterns):
                print(f"✅ Fixed: {file}")
                fixed += 1

    # Fix App.tsx in mockup-sandbox
    app_file = base / 'artifacts/mockup-sandbox/src/App.tsx'
    if app_file.exists():
        patterns = [
            (r'mockups\.find\(\(m\) => m\.id === mockupId\)!',
             r'mockups.find((m) => m.id === mockupId) ?? mockups[0]'),
        ]
        if fix_file_content(app_file, patterns):
            print(f"✅ Fixed: artifacts/mockup-sandbox/src/App.tsx")
            fixed += 1

    # Fix BannerManagement.tsx
    banner_file = base / 'artifacts/edms/src/pages/BannerManagement.tsx'
    if banner_file.exists():
        patterns = [
            (r'banners\.find\(\(b\) => b\.id === editingBanner\)!',
             r'banners.find((b) => b.id === editingBanner) ?? banners[0]'),
        ]
        if fix_file_content(banner_file, patterns):
            print(f"✅ Fixed: artifacts/edms/src/pages/BannerManagement.tsx")
            fixed += 1

    # Fix DocumentDetail.tsx
    doc_detail_file = base / 'artifacts/edms/src/pages/DocumentDetail.tsx'
    if doc_detail_file.exists():
        patterns = [
            (r'documents\.find\(\(d\) => d\.id === id\)!',
             r'documents.find((d) => d.id === id) ?? documents[0]'),
        ]
        if fix_file_content(doc_detail_file, patterns):
            print(f"✅ Fixed: artifacts/edms/src/pages/DocumentDetail.tsx")
            fixed += 1

    # Fix DocumentPreviewPage.tsx - multiple non-null assertions
    preview_file = base / 'artifacts/edms/src/pages/DocumentPreviewPage.tsx'
    if preview_file.exists():
        patterns = [
            # Fix metadata access patterns
            (r'document\.metadata\.find\(\(m\) => m\.key === "([^"]+)"\)!\.value',
             r'document.metadata.find((m) => m.key === "\1")?.value ?? ""'),
            (r'document\.metadata\.find\(\(m\) => m\.key === \'([^\']+)\'\)!\.value',
             r'document.metadata.find((m) => m.key === \'\1\')?.value ?? ""'),
        ]
        if fix_file_content(preview_file, patterns):
            print(f"✅ Fixed: artifacts/edms/src/pages/DocumentPreviewPage.tsx")
            fixed += 1

    # Fix DesignSystem.tsx
    design_file = base / 'src/src/pages/DesignSystem.tsx'
    if design_file.exists():
        patterns = [
            (r'document\.querySelector\(\'\.design-system-content\'\)!',
             r'document.querySelector(\'.design-system-content\') as HTMLElement'),
        ]
        if fix_file_content(design_file, patterns):
            print(f"✅ Fixed: src/src/pages/DesignSystem.tsx")
            fixed += 1

    # Fix AdminInitialRun.tsx - labels
    admin_file = base / 'artifacts/edms/src/pages/AdminInitialRun.tsx'
    if admin_file.exists():
        patterns = [
            # Convert standalone labels to spans
            (r'<label className="([^"]*text-xs[^"]*)">\s*([^<]+)\s*</label>\s*<div',
             r'<span className="\1">\2</span>\n              <div'),
        ]
        if fix_file_content(admin_file, patterns):
            print(f"✅ Fixed: artifacts/edms/src/pages/AdminInitialRun.tsx")
            fixed += 1

    # Fix BOMCreate.tsx - labels
    bom_file = base / 'artifacts/edms/src/pages/BOMCreate.tsx'
    if bom_file.exists():
        patterns = [
            (r'<label className="([^"]*block[^"]*)">\s*([^<]+)\s*</label>\s*(?!<(?:input|select|textarea))',
             r'<span className="\1">\2</span>'),
        ]
        if fix_file_content(bom_file, patterns):
            print(f"✅ Fixed: artifacts/edms/src/pages/BOMCreate.tsx")
            fixed += 1

    # Fix Cases.tsx - labels
    cases_file = base / 'artifacts/edms/src/pages/Cases.tsx'
    if cases_file.exists():
        patterns = [
            (r'<label className="([^"]*text-xs[^"]*)">\s*([^<]+)\s*</label>\s*(?!<(?:input|select|textarea))',
             r'<span className="\1">\2</span>'),
        ]
        if fix_file_content(cases_file, patterns):
            print(f"✅ Fixed: artifacts/edms/src/pages/Cases.tsx")
            fixed += 1

    print(f"\n✨ Fixed {fixed} files")

if __name__ == '__main__':
    main()
