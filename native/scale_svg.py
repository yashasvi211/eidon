import re

svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <!-- Bar color gradients (updated coordinates) -->
    <linearGradient id="bar1c" x1="134" y1="0" x2="423" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#2dd4bf"/><stop offset="100%" stop-color="#818cf8"/>
    </linearGradient>
    <linearGradient id="bar2c" x1="134" y1="0" x2="348" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#2dd4bf" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#818cf8" stop-opacity="0.4"/>
    </linearGradient>
    <linearGradient id="bar3c" x1="134" y1="0" x2="273" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#2dd4bf" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#818cf8" stop-opacity="0.15"/>
    </linearGradient>

    <!-- 3D top highlight overlay -->
    <linearGradient id="hi" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.28"/>
      <stop offset="40%" stop-color="#fff" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.18"/>
    </linearGradient>

    <!-- Circle specular highlight -->
    <radialGradient id="cspec" cx="0.32" cy="0.32" r="0.68">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>

    <!-- Drop shadow for bars -->
    <filter id="bdrop" x="-8%" y="-10%" width="116%" height="135%">
      <feDropShadow dx="0" dy="7" stdDeviation="10" flood-color="#000" flood-opacity="0.45"/>
    </filter>

    <!-- Glow behind first bar -->
    <filter id="bglow" x="-12%" y="-22%" width="124%" height="160%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="13" result="b"/>
      <feColorMatrix in="b" type="matrix"
        values="0 0 0 0 0.18  0 0 0 0 0.48  0 0 0 0 0.82  0 0 0 0.28 0" result="cb"/>
      <feMerge><feMergeNode in="cb"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>

    <!-- Circle shadow -->
    <filter id="cdrop" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.55"/>
    </filter>

    <!-- Clip paths for 3D overlays -->
    <clipPath id="c1"><rect x="134" y="112" width="289" height="62" rx="31"/></clipPath>
    <clipPath id="c2"><rect x="134" y="225" width="214" height="62" rx="31"/></clipPath>
    <clipPath id="c3"><rect x="134" y="339" width="139" height="62" rx="31"/></clipPath>
  </defs>

  <!-- ===== BAR 1 — full length, glowing ===== -->
  <g filter="url(#bglow)">
    <rect x="134" y="112" width="289" height="62" rx="31" fill="url(#bar1c)"/>
    <rect x="134" y="112" width="289" height="62" rx="31" fill="url(#hi)" clip-path="url(#c1)"/>
    <rect x="150" y="113.5" width="257" height="2.5" rx="1.25" fill="#fff" opacity="0.18" clip-path="url(#c1)"/>
    <rect x="150" y="171" width="257" height="2.2" rx="1.1" fill="#000" opacity="0.12" clip-path="url(#c1)"/>
  </g>

  <!-- ===== BAR 2 — medium ===== -->
  <g filter="url(#bdrop)">
    <rect x="134" y="225" width="214" height="62" rx="31" fill="url(#bar2c)"/>
    <rect x="134" y="225" width="214" height="62" rx="31" fill="url(#hi)" clip-path="url(#c2)"/>
    <rect x="150" y="226.5" width="182" height="2" rx="1" fill="#fff" opacity="0.1" clip-path="url(#c2)"/>
    <rect x="150" y="284" width="182" height="1.8" rx="0.9" fill="#000" opacity="0.08" clip-path="url(#c2)"/>
  </g>

  <!-- ===== BAR 3 — short ===== -->
  <g filter="url(#bdrop)">
    <rect x="134" y="339" width="139" height="62" rx="31" fill="url(#bar3c)"/>
    <rect x="134" y="339" width="139" height="62" rx="31" fill="url(#hi)" clip-path="url(#c3)"/>
    <rect x="150" y="340.5" width="107" height="1.8" rx="0.9" fill="#fff" opacity="0.05" clip-path="url(#c3)"/>
    <rect x="150" y="398" width="107" height="1.4" rx="0.7" fill="#000" opacity="0.05" clip-path="url(#c3)"/>
  </g>

  <!-- ===== CIRCLE 1 — active (teal stroke) ===== -->
  <g filter="url(#cdrop)">
    <circle cx="106" cy="143" r="16" fill="#0d1120"/>
    <circle cx="106" cy="143" r="16" fill="none" stroke="#4de8d0" stroke-opacity="0.7" stroke-width="2.8"/>
    <circle cx="106" cy="143" r="13" fill="none" stroke="#4de8d0" stroke-opacity="0.08" stroke-width="1"/>
    <circle cx="106" cy="143" r="16" fill="url(#cspec)"/>
    <circle cx="102" cy="139" r="3.2" fill="#fff" opacity="0.1"/>
  </g>

  <!-- ===== CIRCLE 2 — dim ===== -->
  <g filter="url(#cdrop)">
    <circle cx="106" cy="256" r="16" fill="#0d1120"/>
    <circle cx="106" cy="256" r="16" fill="none" stroke="#fff" stroke-opacity="0.14" stroke-width="2.2"/>
    <circle cx="106" cy="256" r="13" fill="none" stroke="#fff" stroke-opacity="0.04" stroke-width="0.8"/>
    <circle cx="106" cy="256" r="16" fill="url(#cspec)"/>
    <circle cx="102" cy="252" r="3.2" fill="#fff" opacity="0.06"/>
  </g>

  <!-- ===== CIRCLE 3 — faintest ===== -->
  <g filter="url(#cdrop)">
    <circle cx="106" cy="369" r="16" fill="#0d1120"/>
    <circle cx="106" cy="369" r="16" fill="none" stroke="#fff" stroke-opacity="0.07" stroke-width="2"/>
    <circle cx="106" cy="369" r="32" fill="url(#cspec)"/>
    <circle cx="102" cy="365" r="3.2" fill="#fff" opacity="0.03"/>
  </g>
</svg>"""

SCALE = 1.3
OFFSET = (1024 - (512 * SCALE)) / 2

# Actually, wait. Let's do scale 1.3. 
# Original width = 333. 333 * 1.3 = 432.9. 
# 433 / 1024 = 42% of the canvas. This is perfectly safe.
# Let's write the transform logic.

def scale_match(m):
    attr = m.group(1)
    val = float(m.group(2))
    
    # Don't scale percentages or special 0-1 values
    if attr in ['x', 'y', 'width', 'height'] and 'filter' in m.string[max(0, m.start()-50):m.start()]:
        # it's a filter percentage? wait, we don't scale percentages since regex won't match if it has %.
        pass

    if attr in ['x1', 'y1', 'x2', 'y2'] and val <= 1.0 and val >= 0.0:
        if attr == 'y2' and val == 1.0: return m.group(0) # 'hi' gradient
        if attr == 'x1' and val == 0.0: return m.group(0) # 'hi' gradient

    if attr in ['cx', 'cy', 'r'] and val < 1.0:
        return m.group(0) # radialGradient

    if attr in ['x', 'x1', 'x2', 'cx']:
        new_val = val * SCALE + OFFSET
    elif attr in ['y', 'y1', 'y2', 'cy']:
        new_val = val * SCALE + OFFSET
    else:
        new_val = val * SCALE
        
    # round to 2 decimals
    new_val = round(new_val, 2)
    # remove .0 if it's an integer
    if new_val == int(new_val): new_val = int(new_val)
        
    return f'{attr}="{new_val}"'

# We replace the attributes
def replace_attrs(svg):
    svg = re.sub(r'\b(x|y|x1|y1|x2|y2|width|height|cx|cy|r|rx|stroke-width|dx|dy|stdDeviation)="([0-9.]+)"', scale_match, svg)
    return svg

new_svg = replace_attrs(svg_content)
new_svg = new_svg.replace('viewBox="0 0 512 512"', 'viewBox="0 0 1024 1024"')

# add bounding box rect
new_svg = new_svg.replace('<defs>', '<defs>\n    <rect id="bg" width="1024" height="1024" fill="none" pointer-events="all"/>')
new_svg = new_svg.replace('<!-- ===== BAR 1', '<use href="#bg"/>\n\n  <!-- ===== BAR 1')

print(new_svg)
