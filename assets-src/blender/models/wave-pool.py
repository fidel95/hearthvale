# Wave Pool (4×3): a sandy beach sloping into a turquoise pool, the wave
# machine house at the deep end, a lifeguard chair, palms and umbrellas.
# The waves and swimmers are the game's (attractionModels.ts).


def build(hv):
    hv.cbox(3.84, 0.06, 2.88, 0, 0, 0, 'sand', bevel=0.015)
    hv.cbox(3.36, 0.03, 2.2, 0, 0.04, -0.05, 'stone', bevel=0.01)  # pool edge
    hv.cbox(3.28, 0.05, 2.16, 0, 0.04, -0.05, 'water', bevel=0)
    hv.cbox(3.28, 0.03, 0.42, 0, 0.065, 0.92, 'sand', bevel=0.01)  # beach entry
    # Wave machine house.
    hv.cbox(3.12, 0.52, 0.42, 0, 0.06, -1.12, 'white', bevel=0.015)
    hv.cbox(3.28, 0.1, 0.48, 0, 0.58, -1.12, 'coral', bevel=0.012)
    for x in (-1.0, -0.35, 0.35, 1.0):
        hv.cbox(0.38, 0.26, 0.06, x, 0.08, -0.9, 'navy', bevel=0.006)
        for k in range(3):
            hv.cbox(0.34, 0.015, 0.07, x, 0.13 + k * 0.07, -0.9, 'steel', bevel=0)
    # Lifeguard chair.
    for dx in (-0.08, 0.08):
        hv.cstrut((-1.62 + dx, 0.06, 0.28), (-1.62 + dx, 0.42, 0.2), 0.015, 'white', seg=4)
        hv.cstrut((-1.62 + dx, 0.06, 0.12), (-1.62 + dx, 0.42, 0.2), 0.015, 'white', seg=4)
    hv.cbox(0.22, 0.04, 0.2, -1.62, 0.42, 0.2, 'white', bevel=0)
    hv.ccyl(0.2, 0.14, -1.62, 0.6, 0.2, 'roofred', seg=8, r_top=0.02)
    hv.ccyl(0.012, 0.16, -1.62, 0.46, 0.2, 'white', seg=4)
    # Umbrellas with loungers.
    for x, z, c in ((1.62, 0.45, 'rose'), (-1.58, 0.95, 'sunny'), (1.58, -0.35, 'kartblue')):
        hv.ccyl(0.02, 0.36, x, 0.06, z, 'white', seg=6)
        hv.ccyl(0.28, 0.12, x, 0.36, z, c, seg=10, r_top=0.02)
        hv.cbox(0.12, 0.03, 0.3, x + 0.18, 0.08, z, 'white', bevel=0)
    # Palm trees at the beach corners.
    for x, z in ((-1.7, 1.25), (1.7, 1.2)):
        hv.cstrut((x, 0.06, z), (x + 0.08, 0.9, z - 0.04), 0.035, 'wood', r_end=0.025, seg=6)
        for k in range(5):
            import math
            a = k / 5 * math.pi * 2
            hv.cstrut((x + 0.08, 0.9, z - 0.04), (x + 0.08 + math.cos(a) * 0.3, 0.8, z - 0.04 + math.sin(a) * 0.3), 0.04, 'leaf', r_end=0.01, seg=4)
