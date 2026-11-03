# Town Hall (3×3): a stately civic hall with a columned porch and pediment,
# a blue hip roof, and a domed clock cupola with a flag on top.


def build(hv):
    W, D, H = 2.3, 1.6, 0.95
    y0 = 0.25  # the hall sits back, leaving room for the porch and steps
    hv.ground(2.8, 2.8, 'stone')
    # Main hall.
    hv.box(W + 0.06, D + 0.06, 0.1, 0, y0, 0.04, 'stonedark', bevel=0.015)
    hv.box(W, D, H, 0, y0, 0.14, 'butter', bevel=0.02)
    hv.trim(W, D, 0.14 + H - 0.02, 'white', h=0.08, out=0.03)  # cornice
    for i in range(2):
        hv.box(W + 0.02, D + 0.02, 0.03, 0, y0, 0.14 + 0.36 + i * 0.002, 'white', bevel=0.005)  # floor band
    front, back = y0 - D / 2, y0 + D / 2
    # Windows on two floors, front and sides (the porch covers the middle of the front).
    for z in (0.22, 0.6):
        for u in (-0.95, -0.7, 0.7, 0.95):
            hv.window('-y', front, u, z, w=0.16, h=0.26)
        hv.windows('+x', W / 2, y0 - 0.6, y0 + 0.6, z, 3, w=0.16, h=0.26)
        hv.windows('-x', -W / 2, y0 - 0.6, y0 + 0.6, z, 3, w=0.16, h=0.26)
        hv.windows('+y', back, -0.9, 0.9, z, 5, w=0.16, h=0.26)
    hv.hip_roof(W, D, 0.3, 0, y0, 0.14 + H + 0.06, 'roofblue', overhang=0.09)

    # Porch: steps, a floor, six columns and a pediment.
    pw, pd = 1.3, 0.42
    py = front - pd / 2
    for i, (sd, sh) in enumerate(((pd + 0.3, 0.05), (pd + 0.18, 0.1), (pd + 0.06, 0.14))):
        hv.box(pw + 0.3 - i * 0.08, sd, sh, 0, front - sd / 2, 0.04, 'stone', bevel=0.01)
    for i in range(6):
        u = -pw / 2 + 0.08 + i * (pw - 0.16) / 5
        hv.cyl(0.045, 0.7, u, py - 0.04, 0.18, 'white', seg=8)
        hv.box(0.11, 0.11, 0.04, u, py - 0.04, 0.18, 'white', bevel=0.008)
        hv.box(0.11, 0.11, 0.04, u, py - 0.04, 0.86, 'white', bevel=0.008)
    hv.box(pw + 0.06, pd + 0.06, 0.08, 0, py, 0.9, 'white', bevel=0.012)  # entablature
    hv.gable_roof(pw + 0.02, pd + 0.06, 0.22, 0, py, 0.98, 'roofblue', gable='white', overhang=0.05, ridge='Y')
    hv.door('-y', front, 0, w=0.26, h=0.42, color='navy', z=0.18)

    # Cupola: a drum with clock faces, a dome and a flag.
    cz = 0.14 + H + 0.06 + 0.2
    hv.box(0.42, 0.42, 0.3, 0, y0, cz, 'butter', bevel=0.015)
    hv.box(0.48, 0.48, 0.05, 0, y0, cz + 0.3, 'white', bevel=0.01)
    hv.cyl(0.11, 0.025, 0, y0 - 0.22, cz + 0.15, 'white', seg=16, axis='Y', bevel=0)
    hv.cyl(0.07, 0.03, 0, y0 - 0.23, cz + 0.15, 'navy', seg=16, axis='Y', bevel=0)
    hv.cyl(0.2, 0.2, 0, y0, cz + 0.35, 'roofblue', seg=16, r_top=0.02, bevel=0)
    hv.cyl(0.012, 0.36, 0, y0, cz + 0.5, 'white', seg=6, bevel=0)
    hv.box(0.16, 0.012, 0.1, 0.08, y0, cz + 0.74, 'red', bevel=0)
