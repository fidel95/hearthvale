# Police Station (2×2): a crisp white-and-navy station with a blue entrance
# canopy, a gold badge over the door, blue lamps, and a radio mast.


def build(hv):
    W, D, H = 1.5, 1.1, 0.88
    y0 = 0.15
    hv.ground(1.85, 1.85, 'concrete')
    top = hv.block(W, D, H, 0, y0, 0.04, wall='snow', base='navy', top='navy')
    hv.trim(W, D, 0.44, 'navy', h=0.04, out=0.012)
    front = y0 - D / 2
    for z in (0.15, 0.56):
        for u in (-0.55, -0.3, 0.3, 0.55):
            hv.window('-y', front, u, z, w=0.17, h=0.22)
        hv.windows('+x', W / 2, y0 - 0.35, y0 + 0.35, z, 3, w=0.17, h=0.22)
        hv.windows('-x', -W / 2, y0 - 0.35, y0 + 0.35, z, 3, w=0.17, h=0.22)
    # Entrance: a navy porch box with glass doors, a canopy and a gold badge.
    hv.box(0.42, 0.16, 0.52, 0, front - 0.08, 0.04, 'navy', bevel=0.012)
    hv._on_face('-y', front - 0.16, 0, 0.05, 0.3, 0.34, 0.02, 'glass')
    hv._on_face('-y', front - 0.18, 0, 0.05, 0.02, 0.34, 0.01, 'charcoal', 0)
    hv.box(0.6, 0.34, 0.04, 0, front - 0.16, 0.5, 'roofblue', bevel=0.01)
    hv.cyl(0.075, 0.025, 0, front - 0.17, 0.66, 'gold', seg=10, axis='Y', bevel=0)
    hv.cyl(0.045, 0.03, 0, front - 0.18, 0.66, 'navy', seg=5, axis='Y', bevel=0)
    for u in (-0.32, 0.32):
        hv.cyl(0.018, 0.42, u, front - 0.3, 0.04, 'charcoal', seg=6)
        hv.box(0.08, 0.08, 0.1, u, front - 0.3, 0.46, 'roofblue', bevel=0.01)
    hv.box(0.6, 0.25, 0.03, 0, front - 0.3, 0.04, 'stone', bevel=0.008)  # steps
    # Radio mast and a rooftop unit.
    hv.cyl(0.015, 0.7, -0.5, y0 + 0.3, top + 0.05, 'steel', seg=6)
    hv.box(0.12, 0.12, 0.04, -0.5, y0 + 0.3, top + 0.5, 'steel', bevel=0)
    hv.box(0.3, 0.22, 0.14, 0.35, y0 + 0.2, top + 0.05, 'steel', bevel=0.012)
