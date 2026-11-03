# Ferris Wheel (3×3): a carnival plaza with a ticket booth and twin A-frame
# towers holding the axle. The wheel and its gondolas are moving parts (the
# game turns them): see attractionModels.ts, buildFerrisWheel.
import math

HUB_Y = 1.95
RADIUS = 1.32
GONDOLAS = ['rose', 'kartblue', 'sunny', 'leaf']


def build(hv):
    hv.cbox(2.7, 0.08, 2.7, 0, 0, 0, 'stone', bevel=0.015)
    # A raised red platform under the wheel, with steps at the front.
    hv.cbox(1.6, 0.12, 0.9, 0, 0.08, 0, 'roofred', bevel=0.02)
    hv.cbox(0.7, 0.06, 0.2, 0, 0.08, 0.53, 'stone', bevel=0.01)
    hv.cbox(1.64, 0.03, 0.94, 0, 0.2, 0, 'white', bevel=0.008)
    # Ticket booth at the front right: striped walls, a window, a peaked roof.
    hv.cbox(0.48, 0.44, 0.48, 0.95, 0.08, 0.85, 'kartblue', bevel=0.02)
    hv.cbox(0.5, 0.06, 0.5, 0.95, 0.3, 0.85, 'white', bevel=0.008)
    hv.cbox(0.28, 0.14, 0.03, 0.95, 0.32, 1.1, 'paleblue', bevel=0)
    hv.cbox(0.56, 0.04, 0.56, 0.95, 0.52, 0.85, 'sunny', bevel=0.01)
    hv.ccyl(0.4, 0.26, 0.95, 0.56, 0.85, 'sunny', seg=6, r_top=0.0)
    hv.csphere(0.04, 0.95, 0.84, 0.85, 'rose')
    # Twin A-frames: white lattice legs from the platform up to the hub.
    for z in (-0.36, 0.36):
        for side in (-1, 1):
            hv.cstrut((side * 0.82, 0.2, z), (side * 0.06, HUB_Y, z), 0.05, 'white', r_end=0.04)
            hv.cstrut((side * 0.56, 0.9, z), (side * 0.08, 0.9, z), 0.025, 'white')  # brace
        hv.cbox(0.22, 0.22, 0.1, 0, HUB_Y - 0.11, z, 'white', bevel=0.01)
    hv.ccyl(0.1, 0.0001, 0, 0, 0, 'white', seg=4) if False else None
    hv.cstrut((0, HUB_Y, -0.48), (0, HUB_Y, 0.48), 0.1, 'sunny', seg=12)  # the axle
    # Fairground lights round the platform edge.
    for i in range(10):
        x = -0.75 + i * (1.5 / 9)
        hv.csphere(0.03, x, 0.23, 0.46, 'light', seg=6, rings=4)


def wheel(hv):
    # Centered on the hub, in the x–y plane; the game spins it about z.
    for z in (-0.22, 0.22):
        hv.ctorus(RADIUS, 0.045, 0, 0, z, 'rose', axis='z', seg=32, ring=6)
        hv.ctorus(RADIUS * 0.62, 0.025, 0, 0, z, 'sunny', axis='z', seg=24, ring=5)
        for i in range(8):
            a = i / 8 * math.pi * 2
            hv.cstrut((0, 0, z), (math.cos(a) * RADIUS, math.sin(a) * RADIUS, z), 0.018, 'white', seg=6)
        # Lights on the rim between the gondolas.
        for i in range(16):
            a = (i + 0.5) / 16 * math.pi * 2
            hv.csphere(0.03, math.cos(a) * (RADIUS + 0.05), math.sin(a) * (RADIUS + 0.05), z, 'light', seg=6, rings=4)
    # Cross bars joining the two rims at each gondola.
    for i in range(8):
        a = i / 8 * math.pi * 2
        hv.cstrut((math.cos(a) * RADIUS, math.sin(a) * RADIUS, -0.24), (math.cos(a) * RADIUS, math.sin(a) * RADIUS, 0.24), 0.02, 'white', seg=6)
    hv.cstrut((0, 0, -0.27), (0, 0, 0.27), 0.22, 'sunny', seg=16)
    for z in (-0.28, 0.28):
        hv.cstrut((0, 0, z - 0.01), (0, 0, z + 0.01), 0.12, 'rose', seg=12)


def gondola(color):
    def make(hv):
        # Hangs from its pin at the origin; the game keeps it upright.
        hv.cstrut((0, 0, -0.24), (0, 0, 0.24), 0.02, 'steel', seg=6)
        for z in (-0.1, 0.1):
            hv.cstrut((0, 0, z), (0, -0.1, z), 0.012, 'steel', seg=4)
        hv.cbox(0.26, 0.17, 0.28, 0, -0.27, 0, color, bevel=0.02)
        hv.cbox(0.27, 0.03, 0.29, 0, -0.27, 0, 'white', bevel=0)
        hv.cbox(0.2, 0.05, 0.29, 0, -0.2, 0, 'paleblue', bevel=0)  # windows round the top
        hv.cbox(0.27, 0.05, 0.3, 0, -0.13, 0, 'white', bevel=0.012)
        hv.ccyl(0.17, 0.06, 0, -0.08, 0, color, seg=8, r_top=0.03)
    return make


PARTS = {'wheel': wheel, **{f'gondola-{i}': gondola(c) for i, c in enumerate(GONDOLAS)}}
