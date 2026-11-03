# Fire Station (2×2): a red-brick station with two big garage doors onto the
# street, a hose tower at the back, a siren, and a paved apron out front.


def build(hv):
    W, D, H = 1.55, 1.15, 0.78
    y0 = 0.18
    hv.ground(1.85, 1.85, 'concrete')
    hv.box(1.2, 0.5, 0.01, -0.12, y0 - D / 2 - 0.25, 0.04, 'asphalt', bevel=0)  # apron
    top = hv.block(W, D, H, 0, y0, 0.04, wall='brick', base='charcoal', top='white')
    front = y0 - D / 2
    # Two garage doors with ribbed roll-up shutters, and a white band above.
    for u in (-0.45, 0.2):
        hv._on_face('-y', front, u, 0.04, 0.52, 0.52, 0.04, 'white')
        hv._on_face('-y', front - 0.02, u, 0.07, 0.44, 0.46, 0.03, 'firered')
        for k in range(5):
            hv._on_face('-y', front - 0.045, u, 0.12 + k * 0.08, 0.44, 0.015, 0.01, 'brickdark', 0)
    hv._on_face('-y', front, -0.12, 0.62, 1.3, 0.1, 0.03, 'white')  # name board
    hv._on_face('-y', front - 0.02, -0.12, 0.645, 0.9, 0.05, 0.02, 'firered', 0)
    hv.door('-y', front, 0.62, w=0.18, h=0.32, color='navy')
    hv.window('-y', front, 0.62, 0.44, w=0.16, h=0.14)
    hv.windows('+x', W / 2, y0 - 0.4, y0 + 0.4, 0.36, 3, w=0.16, h=0.24)
    hv.windows('-x', -W / 2, y0 - 0.4, y0 + 0.4, 0.36, 3, w=0.16, h=0.24)
    # Hose tower at the back left, with louvres and a little roof.
    tx, ty = -0.5, y0 + 0.32
    hv.box(0.36, 0.36, 1.45, tx, ty, 0.04, 'brick', bevel=0.015)
    for k in range(3):
        hv.window('-y', ty - 0.18, tx, 0.95 + k * 0.0, w=0.14, h=0.3, glass='glassdark', sill=False) if k == 0 else None
    hv.box(0.42, 0.42, 0.05, tx, ty, 1.49, 'white', bevel=0.01)
    hv.hip_roof(0.36, 0.36, 0.2, tx, ty, 1.54, 'roofgray', overhang=0.04)
    # Siren and a red beacon on the roof.
    hv.cyl(0.05, 0.08, 0.35, y0 + 0.1, top + 0.05, 'charcoal', seg=8)
    hv.cyl(0.07, 0.05, 0.35, y0 + 0.1, top + 0.13, 'firered', seg=10, r_top=0.03, bevel=0)
    hv.cyl(0.03, 0.18, 0.62, front + 0.1, top + 0.05, 'white', seg=6)
    hv.cyl(0.05, 0.06, 0.62, front + 0.1, top + 0.23, 'firered', seg=8)
