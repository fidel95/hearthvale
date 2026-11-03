# Roller Coaster (4×4): a boarding station, a vertical loop and the circuit
# of track with its lift hill and camelback, on supports. The cars are moving
# parts (attractionModels.ts, buildRollerCoaster, which shares trackPoint).
import math

CARS = ['sunny', 'kartblue', 'rose']


def track_point(t):
    # The same curve as trackPoint in attractionModels.ts.
    a = t * math.pi * 2
    x = math.cos(a) * 1.48
    z = math.sin(a) * 1.38
    hill1 = math.exp(-(((a - 3.6 + math.pi * 3) % (math.pi * 2)) - math.pi) ** 2 * 1.4) * 1.75
    hill2 = math.exp(-(((a - 5.2 + math.pi * 3) % (math.pi * 2)) - math.pi) ** 2 * 2.2) * 1.05
    return (x, 0.28 + hill1 + hill2, z)


def build(hv):
    hv.cbox(3.76, 0.06, 3.76, 0, 0, 0, 'turf', bevel=0.015)
    # Boarding station at the front left: a platform under a striped roof.
    hv.cbox(1.25, 0.18, 0.68, -0.95, 0.06, 1.18, 'stone', bevel=0.015)
    for x in (-1.5, -0.95, -0.4):
        for z in (0.9, 1.46):
            hv.ccyl(0.025, 0.28, x, 0.24, z, 'white', seg=6)
    hv.cbox(1.35, 0.06, 0.76, -0.95, 0.52, 1.18, 'white', bevel=0.01)
    hv.cbox(1.38, 0.06, 0.8, -0.95, 0.58, 1.18, 'roofred', bevel=0.012)
    hv.cbox(0.5, 0.1, 0.03, -0.95, 0.66, 1.58, 'sunny', bevel=0)  # sign
    # The vertical loop on two supports.
    hv.ctorus(0.88, 0.055, 0.15, 1.18, -0.1, 'roofred', axis='z', seg=32, ring=6)
    hv.ctorus(0.78, 0.03, 0.15, 1.18, -0.1, 'sunny', axis='z', seg=28, ring=5)
    for x in (-0.55, 0.85):
        hv.ccyl(0.05, 1.25, x, 0.06, -0.1, 'steel', seg=8, r_top=0.04)
    # The circuit: two rails with ties, on wooden supports.
    steps = 64
    pts = [track_point(i / steps) for i in range(steps)]
    for i in range(steps):
        p, q = pts[i], pts[(i + 1) % steps]
        # Rails either side of the center line.
        dx, dz = q[0] - p[0], q[2] - p[2]
        n = math.hypot(dx, dz) or 1
        ox, oz = -dz / n * 0.07, dx / n * 0.07
        for s in (-1, 1):
            hv.cstrut((p[0] + s * ox, p[1] + 0.04, p[2] + s * oz), (q[0] + s * ox, q[1] + 0.04, q[2] + s * oz), 0.018, 'roofred', seg=6)
        if i % 2 == 0:
            hv.cstrut((p[0] - ox * 1.3, p[1], p[2] - oz * 1.3), (p[0] + ox * 1.3, p[1], p[2] + oz * 1.3), 0.02, 'charcoal', seg=4)
        if i % 4 == 0 and p[1] > 0.3:
            hv.ccyl(0.035, p[1] - 0.06, p[0], 0.06, p[2], 'lightwood', seg=6)
            hv.cbox(0.12, 0.04, 0.12, p[0], 0.06, p[2], 'stonedark', bevel=0)
    # Flowers and benches round the park.
    for x, z, c in ((1.5, 1.5, 'rose'), (-1.6, -1.55, 'sunny'), (1.55, -1.6, 'violet')):
        hv.csphere(0.12, x, 0.12, z, 'hedge', seg=8, rings=6)
        hv.csphere(0.04, x, 0.22, z + 0.06, c, seg=6, rings=4)


def car(color):
    def make(hv):
        # Faces +z (the game points it along the track).
        hv.cbox(0.24, 0.1, 0.32, 0, 0.0, 0, color, bevel=0.025)
        hv.cbox(0.25, 0.03, 0.33, 0, 0.0, 0, 'charcoal', bevel=0)
        hv.cbox(0.2, 0.1, 0.06, 0, 0.08, -0.12, color, bevel=0.015)  # seat back
        hv.cbox(0.22, 0.03, 0.04, 0, 0.1, 0.14, 'white', bevel=0)  # lap bar
        hv.csphere(0.055, -0.05, 0.16, -0.02, 'skin', seg=8, rings=6)
        hv.csphere(0.055, 0.05, 0.16, -0.02, 'skin', seg=8, rings=6)
        for x in (-0.13, 0.13):
            for z in (-0.1, 0.1):
                hv.cstrut((x - 0.02, 0.0, z), (x + 0.02, 0.0, z), 0.03, 'charcoal', seg=8)
    return make


PARTS = {f'car-{i}': car(c) for i, c in enumerate(CARS)}
