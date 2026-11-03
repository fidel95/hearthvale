# School (3×2): a cheerful butter-yellow schoolhouse with a red gable roof, a
# bell tower with a clock over the entrance, big classroom windows and a flag.


def build(hv):
    W, D, H = 2.5, 1.0, 0.72
    y0 = 0.15
    hv.ground(2.8, 1.85, 'concrete')
    hv.box(W + 0.04, D + 0.04, 0.07, 0, y0, 0.04, 'brickdark', bevel=0.012)
    hv.box(W, D, H, 0, y0, 0.04, 'butter', bevel=0.02)
    hv.trim(W, D, 0.04 + H - 0.03, 'white', h=0.05, out=0.02)
    hv.gable_roof(W, D, 0.38, 0, y0, 0.04 + H + 0.02, 'roofred', gable='butter', overhang=0.08, ridge='X')
    front = y0 - D / 2
    for u in (-1.0, -0.72, -0.44, 0.44, 0.72, 1.0):
        hv.window('-y', front, u, 0.22, w=0.2, h=0.34, frame='white', glass='glass')
    hv.windows('+y', y0 + D / 2, -1.0, 1.0, 0.22, 6, w=0.2, h=0.34, frame='white')
    for side in (-1, 1):
        hv.window('+x' if side > 0 else '-x', side * W / 2, y0, 0.22, w=0.2, h=0.34, frame='white')
    # Entrance block with the bell tower above it.
    ey = front - 0.12
    hv.box(0.6, 0.3, 0.86, 0, ey + 0.05, 0.04, 'butter', bevel=0.015)
    hv.door('-y', ey - 0.1, 0, w=0.26, h=0.38, color='roofred', frame='white', z=0.04)
    hv.box(0.66, 0.36, 0.05, 0, ey + 0.05, 0.9, 'white', bevel=0.01)
    hv.box(0.34, 0.3, 0.42, 0, ey + 0.05, 0.95, 'butter', bevel=0.012)
    hv.cyl(0.1, 0.025, 0, ey - 0.1, 1.17, 'white', seg=16, axis='Y', bevel=0)
    hv.cyl(0.065, 0.03, 0, ey - 0.105, 1.17, 'charcoal', seg=4, axis='Y', bevel=0) if False else hv.cyl(0.02, 0.03, 0, ey - 0.11, 1.17, 'charcoal', seg=6, axis='Y', bevel=0)
    hv.box(0.4, 0.36, 0.04, 0, ey + 0.05, 1.37, 'white', bevel=0.01)
    hv.cyl(0.22, 0.3, 0, ey + 0.05, 1.41, 'roofred', seg=4, r_top=0.0, bevel=0)
    hv.cyl(0.03, 0.06, 0, ey + 0.05, 1.32, 'gold', seg=8, bevel=0)  # the bell
    # Flagpole on the lawn.
    hv.cyl(0.015, 0.95, 1.1, front - 0.35, 0.04, 'white', seg=6, bevel=0)
    hv.box(0.2, 0.01, 0.13, 1.2, front - 0.35, 0.85, 'roofblue', bevel=0)
    hv.box(0.6, 0.35, 0.02, 0, front - 0.3, 0.04, 'stone', bevel=0.006)  # path
