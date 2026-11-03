# Pirate Ship Ride (3×2): a timber pier with a ticket kiosk, and blue steel
# A-frames carrying the axle. The ship swings from the axle: the 'swing' part
# (attractionModels.ts, buildPirateShipRide).

APEX = 2.05


def build(hv):
    hv.cbox(2.76, 0.08, 1.76, 0, 0, 0, 'wooddark', bevel=0.015)
    hv.cbox(2.52, 0.06, 1.52, 0, 0.08, 0, 'wood', bevel=0.012)
    for x in (-1.0, -0.5, 0, 0.5, 1.0):  # deck planks
        hv.cbox(0.02, 0.005, 1.5, x + 0.25, 0.14, 0, 'wooddark', bevel=0)
    # Ticket kiosk with a striped awning.
    hv.cbox(0.42, 0.42, 0.38, -1.05, 0.14, 0.48, 'roofred', bevel=0.02)
    hv.cbox(0.3, 0.12, 0.02, -1.05, 0.32, 0.68, 'paleblue', bevel=0)
    hv.cbox(0.48, 0.04, 0.44, -1.05, 0.56, 0.48, 'sunny', bevel=0.008)
    hv.ccyl(0.32, 0.22, -1.05, 0.6, 0.48, 'sunny', seg=4, r_top=0)
    # Queue rails along the front.
    for x in (-0.6, -0.2, 0.2, 0.6):
        hv.ccyl(0.015, 0.2, x, 0.14, 0.72, 'steel', seg=6)
    hv.cstrut((-0.6, 0.32, 0.72), (0.6, 0.32, 0.72), 0.015, 'steel', seg=6)
    # A-frames: four blue legs meeting at the axle.
    for z in (-0.56, 0.56):
        for side in (-1, 1):
            hv.cstrut((side * 0.82, 0.14, z), (side * 0.12, APEX - 0.05, z), 0.065, 'navy', r_end=0.05)
        hv.cstrut((-0.55, 0.75, z), (0.55, 0.75, z), 0.035, 'navy')
        hv.cbox(0.24, 0.2, 0.14, 0, APEX - 0.16, z, 'navy', bevel=0.012)
        for side in (-1, 1):
            hv.cbox(0.18, 0.06, 0.2, side * 0.82, 0.14, z, 'charcoal', bevel=0.01)  # feet
    hv.cstrut((0, APEX - 0.06, -0.66), (0, APEX - 0.06, 0.66), 0.08, 'sunny', seg=12)


def swing(hv):
    # Hangs from the axle at the origin; the game rocks it about z.
    for z in (-0.24, 0.24):
        hv.cstrut((0, 0, z), (-0.32, -1.25, z), 0.03, 'sunny', seg=6)
        hv.cstrut((0, 0, z), (0.32, -1.25, z), 0.03, 'sunny', seg=6)
    hv.cbox(0.3, 0.1, 0.56, 0, -0.06, 0, 'sunny', bevel=0.01)
    # The galleon: hull drawn side-on, bow at +x.
    hull = [(-0.78, -1.22), (0.72, -1.22), (0.98, -1.12), (0.62, -1.62), (-0.6, -1.62), (-0.82, -1.36)]
    hv.chull(hull, 0.52, 0, 'hull')
    hv.chull([(-0.8, -1.22), (0.74, -1.22), (0.95, -1.13), (0.92, -1.19), (0.72, -1.26), (-0.8, -1.26)], 0.56, 0, 'gold', bevel=0)
    hv.cbox(1.5, 0.03, 0.46, 0, -1.24, 0, 'lightwood', bevel=0)  # deck
    # Stern and bow castles with rails.
    hv.cbox(0.32, 0.18, 0.52, -0.66, -1.24, 0, 'hull', bevel=0.012)
    hv.cbox(0.34, 0.03, 0.54, -0.66, -1.06, 0, 'gold', bevel=0)
    hv.cbox(0.26, 0.14, 0.48, 0.62, -1.24, 0, 'hull', bevel=0.012)
    hv.cstrut((0.8, -1.16, 0), (1.18, -1.0, 0), 0.025, 'darkwood', seg=6)  # bowsprit
    # Portholes along both sides.
    for x in (-0.35, 0, 0.35):
        for z in (-0.27, 0.27):
            hv.cstrut((x, -1.42, z - 0.01), (x, -1.42, z + 0.01), 0.045, 'gold', seg=10)
    # Benches for the riders.
    for x in (-0.3, 0.0, 0.3):
        hv.cbox(0.08, 0.06, 0.42, x, -1.24, 0, 'darkwood', bevel=0)
    # Mast, crow's nest, sail and a pirate flag.
    hv.cstrut((0, -1.24, 0), (0, -0.2, 0), 0.035, 'darkwood', seg=8)
    hv.cstrut((-0.03, -0.9, -0.3), (-0.03, -0.9, 0.3), 0.015, 'darkwood', seg=6)
    hv.cbox(0.04, 0.4, 0.56, 0.04, -0.88, 0, 'sail', bevel=0.01)
    hv.cbox(0.045, 0.08, 0.57, 0.045, -0.7, 0, 'roofred', bevel=0)
    hv.ccyl(0.1, 0.07, 0, -0.38, 0, 'darkwood', seg=10)
    hv.cbox(0.2, 0.12, 0.01, 0.1, -0.24, 0, 'black', bevel=0)


PARTS = {'swing': swing}
