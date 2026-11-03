# Sky Ride (4×2): two terminal stations on a garden path, a center pylon and
# the haul cables. The bullwheels and cabins move (attractionModels.ts).

CABLE_Y = 1.68
CABINS = ['roofred', 'sunny', 'kartblue', 'leaf']


def build(hv):
    hv.cbox(3.76, 0.05, 1.76, 0, 0, 0, 'turf', bevel=0.012)
    hv.cbox(3.52, 0.02, 0.52, 0, 0.05, 0, 'stone', bevel=0)
    for x in (-1.45, 1.45):
        hv.cbox(0.76, 0.48, 1.1, x, 0.05, 0, 'cream', bevel=0.02)
        hv.cbox(0.6, 0.3, 0.03, x, 0.05, 0.55, 'wooddark', bevel=0)
        hv.cbox(0.84, 0.12, 1.18, x, 0.53, 0, 'kartblue', bevel=0.015)
        hv.cbox(0.6, 0.12, 0.9, x, 0.65, 0, 'white', bevel=0.012)
        hv.ccyl(0.09, CABLE_Y - 0.6, x, 0.77, 0, 'steel', seg=10, r_top=0.07)
        hv.cbox(0.2, 0.08, 0.8, x, CABLE_Y - 0.2, 0, 'kartblue', bevel=0.01)
    hv.ccyl(0.11, CABLE_Y, 0, 0.05, 0, 'steel', seg=10, r_top=0.07)
    hv.cbox(0.14, 0.08, 0.86, 0, CABLE_Y - 0.04, 0, 'roofred', bevel=0.01)
    for z in (-0.32, 0.32):
        hv.cstrut((-1.45, CABLE_Y + 0.04, z), (1.45, CABLE_Y + 0.04, z), 0.012, 'black', seg=4)
    # Flower beds along the path.
    for x in (-0.7, 0.7):
        for z in (-0.45, 0.45):
            hv.cbox(0.4, 0.06, 0.14, x, 0.05, z, 'hedge', bevel=0.01)


def cabin(color):
    def make(hv):
        # Hangs from its grip on the cable at the origin.
        hv.cbox(0.03, 0.28, 0.03, 0, -0.28, 0, 'charcoal', bevel=0)
        hv.cbox(0.1, 0.03, 0.05, 0, -0.03, 0, 'charcoal', bevel=0)
        hv.cbox(0.28, 0.2, 0.22, 0, -0.62, 0, color, bevel=0.025)
        hv.cbox(0.29, 0.08, 0.23, 0, -0.48, 0, 'paleblue', bevel=0.01)
        hv.cbox(0.3, 0.04, 0.24, 0, -0.4, 0, color, bevel=0.012)
    return make


PARTS = {f'cabin-{i}': cabin(c) for i, c in enumerate(CABINS)}
