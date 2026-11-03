# Magic Castle (4×4): a storybook castle on an island in a moat: curtain
# walls with battlements, four round corner towers, a gatehouse over a
# drawbridge, and the keep with its tall blue spire. The banner and fireworks
# are the game's (attractionModels.ts).
import math


def battlements(hv, x0, x1, z0, z1, y, color):
    # Little merlons along a wall top, from (x0, z0) to (x1, z1).
    n = max(2, int(math.hypot(x1 - x0, z1 - z0) / 0.16))
    for i in range(n):
        t = (i + 0.5) / n
        hv.cbox(0.07, 0.07, 0.07, x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t, color, bevel=0)


def tower(hv, x, z, r, h, y, roof, tip='gold'):
    hv.ccyl(r * 1.08, 0.06, x, y, z, 'stonedark', seg=14)
    hv.ccyl(r, h, x, y, z, 'castle', seg=14)
    hv.ccyl(r * 1.12, 0.1, x, y + h, z, 'stone', seg=14)
    for i in range(8):
        a = i / 8 * math.pi * 2
        hv.cbox(0.06, 0.07, 0.06, x + math.cos(a) * r * 1.05, y + h + 0.1, z + math.sin(a) * r * 1.05, 'stone', bevel=0)
    hv.ccyl(r * 1.15, r * 2.1, x, y + h + 0.1, z, roof, seg=14, r_top=0.0)
    hv.csphere(0.05, x, y + h + 0.12 + r * 2.1, z, tip, seg=8, rings=6)
    for k in range(2):  # windows
        a = math.pi / 4 + k * math.pi / 2
        hv.cbox(0.06, 0.12, 0.03, x + math.cos(a) * r, y + h * 0.55, z + math.sin(a) * r, 'navy', bevel=0, ry=-a + math.pi / 2)


def build(hv):
    hv.cbox(3.84, 0.05, 3.84, 0, 0, 0, 'water', bevel=0.012)
    hv.cbox(3.12, 0.12, 3.12, 0, 0.04, 0, 'stone', bevel=0.02)
    hv.cbox(3.2, 0.03, 3.2, 0, 0.04, 0, 'turf', bevel=0)
    # Drawbridge with chains.
    hv.cbox(0.62, 0.06, 0.6, 0, 0.07, 1.6, 'wood', bevel=0.01)
    for x in (-0.28, 0.28):
        hv.cstrut((x, 0.13, 1.85), (x, 0.7, 1.32), 0.01, 'charcoal', seg=4)
    # Curtain walls with battlements.
    hv.cbox(2.35, 0.78, 2.35, 0, 0.16, 0, 'castle', bevel=0.02)
    hv.cbox(2.42, 0.06, 2.42, 0, 0.94, 0, 'stone', bevel=0.01)
    for s in (-1, 1):
        battlements(hv, -1.15, 1.15, s * 1.18, s * 1.18, 1.0, 'stone')
        battlements(hv, s * 1.18, s * 1.18, -1.15, 1.15, 1.0, 'stone')
    # Corner towers.
    for x, z in ((-1.12, -1.12), (1.12, -1.12), (-1.12, 1.12), (1.12, 1.12)):
        tower(hv, x, z, 0.33, 1.28, 0.16, 'roofblue')
    # Gatehouse with an arched door and a pointed roof.
    hv.cbox(0.82, 0.98, 0.42, 0, 0.16, 1.15, 'castle', bevel=0.02)
    hv.cbox(0.4, 0.5, 0.05, 0, 0.16, 1.37, 'darkwood', bevel=0.008)
    hv.ccyl(0.2, 0.05, 0, 0.66, 1.37, 'darkwood', seg=12) if False else hv.cstrut((0, 0.66, 1.35), (0, 0.66, 1.4), 0.2, 'darkwood', seg=12)
    hv.cbox(0.88, 0.06, 0.48, 0, 1.14, 1.15, 'gold', bevel=0.008)
    hv.ccyl(0.56, 0.55, 0, 1.2, 1.15, 'roofblue', seg=4, r_top=0)
    # The keep, its drum tower and the great spire.
    hv.cbox(1.28, 1.55, 1.28, 0, 0.16, -0.08, 'castle', bevel=0.02)
    for x in (-0.35, 0.35):
        for y in (0.6, 1.15):
            hv.cbox(0.14, 0.24, 0.03, x, y, 0.57, 'navy', bevel=0)
            hv.cbox(0.18, 0.03, 0.04, x, y - 0.02, 0.58, 'gold', bevel=0)
    hv.cbox(1.36, 0.12, 1.36, 0, 1.71, -0.08, 'gold', bevel=0.012)
    battlements(hv, -0.62, 0.62, 0.6, 0.6, 1.83, 'castle')
    tower(hv, 0, -0.08, 0.48, 1.0, 1.83, 'roofblue')
    for x in (-0.58, 0.58):
        tower(hv, x, -0.08, 0.2, 0.85, 1.83, 'rose')
    # Hedges and flowers in the courtyard.
    for x, z in ((-0.75, 1.3), (0.75, 1.3)):
        hv.csphere(0.12, x, 0.28, z, 'hedge', seg=8, rings=6)
        hv.csphere(0.04, x + 0.05, 0.4, z + 0.05, 'rose', seg=6, rings=4)
