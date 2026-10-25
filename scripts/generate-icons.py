"""Render Madar launcher, adaptive, splash and favicon PNGs from the orbital logo SVG (headless Chromium)."""
from playwright.sync_api import sync_playwright

OUT = "/home/ubuntu/madarhq/assets/images"
FOREST = "#0F2E24"
LIGHT = "#8FD3B6"
PRIMARY = "#176B52"
AMBER = "#E0A443"


def mark(color, marker):
    return f"""<path d="M 34.3 11.7 A 16 16 0 1 1 13.7 11.7" stroke="{color}" stroke-width="4.2" stroke-linecap="round" fill="none"/>
<circle cx="24" cy="24" r="4.2" fill="{color}"/>
<rect x="20.2" y="4.2" width="7.6" height="7.6" rx="1.6" fill="{marker}" transform="rotate(45 24 8)"/>"""


def svg(size, scale, color, marker, bg=None, radius=0):
    # The mark spans roughly x 6..42, y 2..42 in its 48-unit box; centre it with a small vertical nudge.
    inner = size * scale
    offset = (size - inner) / 2
    background = f'<rect width="{size}" height="{size}" rx="{radius}" fill="{bg}"/>' if bg else ""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">
{background}<g transform="translate({offset} {offset + inner * 0.01}) scale({inner / 48})">{mark(color, marker)}</g></svg>"""


ICONS = [
    ("icon.png", 1024, svg(1024, 0.62, LIGHT, AMBER, FOREST)),
    ("android-icon-background.png", 1024, f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="{FOREST}"/></svg>'),
    ("android-icon-foreground.png", 1024, svg(1024, 0.46, LIGHT, AMBER)),
    ("android-icon-monochrome.png", 1024, svg(1024, 0.46, "#FFFFFF", "#FFFFFF")),
    ("splash-icon.png", 1024, svg(1024, 0.8, PRIMARY, AMBER)),
    ("favicon.png", 64, svg(64, 0.74, LIGHT, AMBER, FOREST, radius=14)),
]

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
    for name, size, content in ICONS:
        page = browser.new_page(viewport={"width": size, "height": size})
        page.set_content(f'<html><body style="margin:0;background:transparent">{content}</body></html>')
        page.screenshot(path=f"{OUT}/{name}", omit_background=True, clip={"x": 0, "y": 0, "width": size, "height": size})
        page.close()
        print("wrote", name)
    browser.close()
