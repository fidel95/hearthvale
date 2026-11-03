# Reverse Bungee (2×2): a launch pad between two red lattice towers. The pod
# and its cords are the game's moving parts (attractionModels.ts).

TOWER_H = 2.65


def build(hv):
    hv.cbox(1.84, 0.08, 1.84, 0, 0, 0, 'deck', bevel=0.015)
    hv.ccyl(0.62, 0.08, 0, 0.08, 0, 'sunny', seg=24, r_top=0.56)
    hv.ccyl(0.44, 0.09, 0, 0.09, 0, 'charcoal', seg=24)
    for i in range(8):  # hazard chevrons round the pad
        import math
        a = i / 8 * math.pi * 2
        hv.cbox(0.12, 0.01, 0.04, math.cos(a) * 0.52, 0.16, math.sin(a) * 0.52, 'black', bevel=0, ry=-a)
    for x in (-0.68, 0.68):
        # Four corner posts, cross bracing, yellow bands, a ball on top.
        for dx in (-0.08, 0.08):
            for dz in (-0.08, 0.08):
                hv.ccyl(0.025, TOWER_H, x + dx, 0.08, dz, 'roofred', seg=6)
        y = 0.35
        while y < TOWER_H:
            hv.cbox(0.24, 0.04, 0.24, x, y, 0, 'sunny', bevel=0)
            hv.cstrut((x - 0.08, y, -0.08), (x + 0.08, y + 0.36, -0.08), 0.012, 'roofred', seg=4)
            hv.cstrut((x - 0.08, y, 0.08), (x + 0.08, y + 0.36, 0.08), 0.012, 'roofred', seg=4)
            y += 0.38
        hv.cbox(0.28, 0.08, 0.28, x, TOWER_H + 0.04, 0, 'roofred', bevel=0.012)
        hv.csphere(0.12, x, TOWER_H + 0.24, 0, 'sunny', seg=12, rings=8)
        hv.cbox(0.3, 0.1, 0.3, x, 0.08, 0, 'charcoal', bevel=0.01)  # footing
    # Ticket booth and a queue rail.
    hv.cbox(0.3, 0.3, 0.26, 0.62, 0.08, 0.66, 'kartblue', bevel=0.015)
    hv.cbox(0.34, 0.05, 0.3, 0.62, 0.38, 0.66, 'sunny', bevel=0.008)
    hv.cstrut((-0.7, 0.3, 0.7), (0.3, 0.3, 0.7), 0.012, 'steel', seg=4)


def pod(hv):
    # Centered on the origin; the game launches and tumbles it.
    hv.csphere(0.21, 0, 0, 0, 'kartblue', seg=14, rings=10)
    hv.ctorus(0.25, 0.035, 0, 0, 0, 'sunny', axis='z', seg=20, ring=6)
    hv.ctorus(0.25, 0.035, 0, 0, 0, 'white', axis='x', seg=20, ring=6)
    hv.cbox(0.2, 0.06, 0.2, 0, -0.02, 0.12, 'paleblue', bevel=0)  # windows
    for side in (-1, 1):
        hv.csphere(0.05, side * 0.27, 0, 0, 'roofred', seg=8, rings=6)  # cord hooks


PARTS = {'pod': pod}
