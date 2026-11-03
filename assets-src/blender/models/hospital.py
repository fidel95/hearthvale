# Hospital (3×3): a tall white block with rows of windows, red crosses, a
# covered ambulance entrance, a lower wing, and a helipad on the roof.


def build(hv):
    hv.ground(2.8, 2.8, 'concrete')
    # Main tower.
    W, D, H = 1.6, 1.2, 1.55
    x0, y0 = -0.3, 0.45
    top = hv.block(W, D, H, x0, y0, 0.04, wall='snow', base='slate', top='slate')
    front = y0 - D / 2
    for z in (0.2, 0.55, 0.9, 1.25):
        hv.windows('-y', front, x0 - 0.75, x0 + 0.75, z, 5, w=0.18, h=0.2, frame='slate', glass='glass')
        hv.windows('+x', x0 + W / 2, y0 - 0.5, y0 + 0.5, z, 3, w=0.18, h=0.2, frame='slate')
        hv.windows('-x', x0 - W / 2, y0 - 0.5, y0 + 0.5, z, 3, w=0.18, h=0.2, frame='slate')
    for z in (0.5, 0.85, 1.2):
        hv.trim(W, D, z, 'skyblue', h=0.025, out=0.006) if False else None
    # Red cross sign on the front, near the top.
    # (Standing out in front of the roof rim, not level with it.)
    hv._on_face('-y', front - 0.05, x0, 1.5, 0.3, 0.3, 0.03, 'white')
    hv._on_face('-y', front - 0.07, x0, 1.53, 0.08, 0.24, 0.02, 'firered', 0)
    hv._on_face('-y', front - 0.07, x0 - 0.0, 1.61, 0.24, 0.08, 0.02, 'firered', 0)
    # Helipad on the roof.
    # (Layers at least a centimetre apart, so they don't flicker.)
    hv.cyl(0.42, 0.04, x0, y0, top + 0.04, 'asphalt', seg=20, bevel=0)
    hv.ctorus(0.36, 0.018, x0, top + 0.085, -y0, 'gold', axis='y', seg=24, ring=4)
    hv.box(0.05, 0.26, 0.02, x0 - 0.1, y0, top + 0.08, 'white', bevel=0)
    hv.box(0.05, 0.26, 0.02, x0 + 0.1, y0, top + 0.08, 'white', bevel=0)
    hv.box(0.2, 0.05, 0.02, x0, y0, top + 0.081, 'white', bevel=0)
    # Lower wing to the right with the entrance.
    wx, wy, ww, wd, wh = 0.85, 0.15, 0.85, 1.1, 0.62
    wtop = hv.block(ww, wd, wh, wx, wy, 0.04, wall='snow', base='slate', top='firered')
    wfront = wy - wd / 2
    hv.windows('-y', wfront, wx - 0.35, wx + 0.35, 0.35, 3, w=0.16, h=0.18, frame='slate')
    hv.windows('+x', wx + ww / 2, wy - 0.4, wy + 0.4, 0.3, 3, w=0.16, h=0.2, frame='slate')
    # Ambulance bay: a canopy on posts over glass doors.
    hv._on_face('-y', wfront, wx, 0.05, 0.36, 0.26, 0.02, 'glass')
    hv.box(0.62, 0.42, 0.05, wx, wfront - 0.21, 0.36, 'firered', bevel=0.012)
    for u in (-0.27, 0.27):
        hv.cyl(0.02, 0.32, wx + u, wfront - 0.38, 0.04, 'white', seg=6)
    hv.box(0.9, 0.5, 0.01, wx, wfront - 0.35, 0.04, 'asphalt', bevel=0)
    # A small red cross on the canopy edge.
    hv._on_face('-y', wfront - 0.42, wx, 0.42, 0.14, 0.14, 0.02, 'white', 0)
