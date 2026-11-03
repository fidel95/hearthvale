# Driving Range (3×3): a two-tier tee pavilion along the back, golfers at the
# tee mats, nets, and target greens with flags. The flying balls are the game's.


def build(hv):
    hv.cbox(2.88, 0.04, 2.88, 0, 0, 0, 'turf', bevel=0.012)
    for k in range(5):  # mown stripes
        hv.cbox(2.8, 0.012, 0.25, 0, 0.04, 1.2 - k * 0.5, 'grass', bevel=0)
    # Net poles and top wires along both sides.
    for x in (-1.35, 1.35):
        for z in (-1.1, -0.3, 0.5, 1.25):
            hv.ccyl(0.025, 1.35, x, 0.04, z, 'steel', seg=6, r_top=0.02)
        hv.cstrut((x, 1.38, -1.1), (x, 1.38, 1.25), 0.012, 'steel', seg=4)
        hv.cstrut((x, 0.7, -1.1), (x, 0.7, 1.25), 0.008, 'steel', seg=4)
    # Two-tier pavilion: cream bays, green roofs.
    hv.cbox(2.5, 0.48, 0.68, 0, 0.04, -1.02, 'cream', bevel=0.015)
    hv.cbox(2.54, 0.07, 0.76, 0, 0.52, -1.0, 'roofgreen', bevel=0.012)
    hv.cbox(2.5, 0.44, 0.62, 0, 0.59, -1.05, 'cream', bevel=0.015)
    hv.cbox(2.6, 0.09, 0.82, 0, 1.03, -0.98, 'roofgreen', bevel=0.015)
    for x in (-1.2, -0.6, 0, 0.6, 1.2):
        hv.cbox(0.05, 0.44, 0.05, x, 0.59, -0.69, 'white', bevel=0)  # upper posts
        hv.cbox(0.05, 0.48, 0.05, x, 0.04, -0.66, 'white', bevel=0)
    hv.cbox(1.0, 0.14, 0.03, 0, 1.12, -0.6, 'white', bevel=0)  # sign
    hv.cbox(0.8, 0.07, 0.035, 0, 1.15, -0.59, 'roofgreen', bevel=0)
    # Tee mats and golfers.
    for x in (-0.9, -0.3, 0.3, 0.9):
        hv.cbox(0.36, 0.02, 0.34, x, 0.05, -0.62, 'leaf', bevel=0)
        gx = x - 0.08
        hv.ccyl(0.05, 0.16, gx, 0.07, -0.64, 'kartblue', seg=8, r_top=0.045)
        hv.csphere(0.045, gx, 0.27, -0.64, 'skin', seg=8, rings=6)
        hv.cbox(0.1, 0.02, 0.1, gx, 0.31, -0.64, 'white', bevel=0)  # cap
        hv.cstrut((gx + 0.04, 0.2, -0.62), (gx + 0.14, 0.06, -0.58), 0.008, 'steel', seg=4)
    # Target greens with sand traps and flags.
    for x, z, flag in ((-0.65, 0.15, 'sunny'), (0.55, 0.35, 'roofred'), (-0.15, 0.98, 'kartblue')):
        hv.ccyl(0.35, 0.025, x, 0.04, z, 'lime', seg=20)
        hv.ccyl(0.12, 0.03, x + 0.22, 0.04, z + 0.12, 'sand', seg=12)
        hv.ccyl(0.012, 0.41, x, 0.06, z, 'white', seg=6)
        hv.cbox(0.14, 0.08, 0.015, x + 0.07, 0.36, z, flag, bevel=0)
        for k, r in enumerate((0.28, 0.2)):
            hv.ctorus(r, 0.008, x, 0.068 + k * 0.002, z, 'white', axis='y', seg=20, ring=3)
