#!/usr/bin/env python3
"""
Find remaining Biome errors by category.
"""
import subprocess
import json
from pathlib import Path

def main():
    base_dir = Path("C:/Users/Ravi/Downloads/LDO-2-local")

    try:
        result = subprocess.run(
            ["pnpm", "biome", "check", "--reporter=json"],
            capture_output=True,
            text=True,
            cwd=base_dir
        )

        data = json.loads(result.stdout)

        # Filter for specific error categories
        categories = {
            'useButtonType': [],
            'noRedundantRoles': [],
            'useAriaPropsForRole': [],
            'useSemanticElements': []
        }

        for diag in data.get('diagnostics', []):
            category = diag.get('category', '')
            for key in categories:
                if key in category:
                    path = diag['location']['path']
                    line = diag['location']['start']['line']
                    categories[key].append(f"{path}:{line}")

        print("Remaining Accessibility Errors:\n")
        for category, errors in categories.items():
            print(f"{category}: {len(errors)} errors")
            for error in errors[:5]:  # Show first 5
                print(f"  - {error}")
            if len(errors) > 5:
                print(f"  ... and {len(errors) - 5} more")
            print()

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
