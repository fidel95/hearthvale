# Go Karts (3×2): an oval track with red-and-white curbs, a start gantry,
# grandstand and pit booth. The karts are moving parts (attractionModels.ts).
import math

KARTS = [('roofred', 'white'), ('kartblue', 'sunny'), ('sunny', 'aqua')]


def build(hv):
    hv.cbox(2.88, 0.04, 1.92, 0, 0, 0, 'turf', bevel=0.012)
    hv.ccyl(0.82, 0.025, 0, 0.04, 0.08, 'asphalt', seg=32, sx=1.55, sz=0.98)
    hv.ccyl(0.46, 0.03, 0, 0.045, 0.08, 'grass', seg=28, sx=1.55, sz=0.92)
    # Curbs round the inside of the track.
    for i in range(20):
        a = i / 20 * math.pi * 2
        x, z = math.cos(a) * 0.74, 0.08 + math.sin(a) * 0.44
        hv.cbox(0.11, 0.025, 0.06, x, 0.06, z, 'roofred' if i % 2 == 0 else 'white', bevel=0, ry=-a + math.pi / 2)
    # Start line (chequered) and gantry.
    for k in range(4):
        hv.cbox(0.06, 0.006, 0.08, -0.03 + (k % 2) * 0.06, 0.066, 0.6 + k * 0.08, 'black' if k % 2 else 'white', bevel=0)
    for z in (0.5, 0.94):
        hv.ccyl(0.03, 0.52, 0, 0.06, z, 'steel', seg=8)
    hv.cbox(0.08, 0.1, 0.48, 0, 0.52, 0.72, 'roofred', bevel=0.012)
    hv.cbox(0.09, 0.05, 0.36, 0, 0.55, 0.72, 'sunny', bevel=0)
    # Grandstand: three blue rows under a canopy, along the back.
    for k in range(3):
        hv.cbox(1.3, 0.06 + k * 0.06, 0.1, -0.35, 0.04, -0.66 - k * 0.09, 'kartblue' if k % 2 == 0 else 'paleblue', bevel=0.006)
    hv.cbox(1.3, 0.04, 0.34, -0.35, 0.04, -0.75, 'concrete', bevel=0.006)
    for x in (-0.95, 0.25):
        hv.ccyl(0.02, 0.5, x, 0.04, -0.88, 'steel', seg=6)
    hv.cbox(1.36, 0.04, 0.36, -0.35, 0.54, -0.76, 'roofred', bevel=0.01)
    # Pit booth with a red roof and a window.
    hv.cbox(0.55, 0.34, 0.32, 0.88, 0.04, -0.72, 'cream', bevel=0.015)
    hv.cbox(0.36, 0.1, 0.02, 0.88, 0.2, -0.55, 'paleblue', bevel=0)
    hv.cbox(0.62, 0.06, 0.38, 0.88, 0.38, -0.72, 'roofred', bevel=0.01)
    # Tyre stacks at the corners.
    for x, z in ((-1.28, -0.45), (1.28, -0.45), (-1.28, 0.65), (1.28, 0.65)):
        for k, c in enumerate(('tyre', 'roofred', 'tyre')):
            hv.ctorus(0.065, 0.03, x, 0.07 + k * 0.055, z, c, axis='y', seg=12, ring=5)


def kart(color, helmet):
    def make(hv):
        # Faces +x; wheels touch the ground at y = 0.
        hv.cbox(0.26, 0.04, 0.15, 0, 0.025, 0, 'charcoal', bevel=0.008)
        hv.cbox(0.2, 0.05, 0.13, 0.02, 0.045, 0, color, bevel=0.015)
        hv.cbox(0.07, 0.05, 0.16, 0.13, 0.03, 0, color, bevel=0.012)  # nose
        hv.cbox(0.06, 0.08, 0.12, -0.08, 0.06, 0, 'black', bevel=0.01)  # seat
        hv.cbox(0.03, 0.03, 0.18, -0.13, 0.12, 0, color, bevel=0)  # spoiler
        hv.csphere(0.045, -0.04, 0.15, 0, helmet, seg=10, rings=6)
        hv.cbox(0.02, 0.025, 0.07, -0.0, 0.14, 0, 'black', bevel=0)  # visor
        for x in (-0.08, 0.08):
            for z in (-0.085, 0.085):
                hv.cstrut((x, 0.032, z - 0.015), (x, 0.032, z + 0.015), 0.032, 'tyre', seg=10)
    return make


PARTS = {f'kart-{i}': kart(c, h) for i, (c, h) in enumerate(KARTS)}
