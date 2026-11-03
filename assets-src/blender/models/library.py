# Library (2×2): a red-brick reading hall with tall windows, stone trim, a
# green gable roof, a round window in the gable, and a sign of open books.


def build(hv):
    W, D, H = 1.45, 1.2, 0.8
    y0 = 0.12
    hv.ground(1.85, 1.85, 'stone')
    hv.box(W + 0.05, D + 0.05, 0.09, 0, y0, 0.04, 'stonedark', bevel=0.012)
    hv.box(W, D, H, 0, y0, 0.12, 'brick', bevel=0.02)
    hv.trim(W, D, 0.12 + H - 0.04, 'stone', h=0.06, out=0.02)
    hv.gable_roof(W, D, 0.42, 0, y0, 0.12 + H + 0.02, 'roofgreen', gable='brick', overhang=0.07, ridge='Y')
    front = y0 - D / 2
    for u in (-0.48, 0.48):
        hv.window('-y', front, u, 0.24, w=0.2, h=0.5, frame='stone', glass='glass')
    hv.windows('+x', W / 2, y0 - 0.4, y0 + 0.4, 0.24, 3, w=0.18, h=0.5, frame='stone')
    hv.windows('-x', -W / 2, y0 - 0.4, y0 + 0.4, 0.24, 3, w=0.18, h=0.5, frame='stone')
    # Round window up in the front gable.
    hv.cyl(0.11, 0.03, 0, front - 0.005, 1.05, 'stone', seg=16, axis='Y', bevel=0)
    hv.cyl(0.075, 0.035, 0, front - 0.01, 1.05, 'glass', seg=16, axis='Y', bevel=0)
    # Entrance: steps, a stone surround, double doors, and a sign of open books.
    hv.box(0.7, 0.3, 0.05, 0, front - 0.15, 0.04, 'stone', bevel=0.008)
    hv.box(0.6, 0.2, 0.09, 0, front - 0.1, 0.04, 'stone', bevel=0.008)
    hv._on_face('-y', front, 0, 0.12, 0.42, 0.56, 0.04, 'stone')
    hv._on_face('-y', front - 0.025, 0, 0.13, 0.3, 0.44, 0.03, 'wooddark', 0.005)
    hv._on_face('-y', front - 0.05, 0, 0.13, 0.015, 0.44, 0.01, 'gold', 0)
    hv._on_face('-y', front - 0.03, 0, 0.72, 0.5, 0.12, 0.03, 'navy')
    for u, c in ((-0.09, 'white'), (0.09, 'cream')):
        hv._on_face('-y', front - 0.05, u, 0.745, 0.15, 0.07, 0.015, c, 0)
    # A bench out front.
    hv.box(0.34, 0.08, 0.025, 0.6, front - 0.3, 0.12, 'wood', bevel=0)
    for u in (0.47, 0.73):
        hv.box(0.03, 0.08, 0.08, u, front - 0.3, 0.04, 'charcoal', bevel=0)
