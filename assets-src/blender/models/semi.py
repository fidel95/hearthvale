# Semi trucks for the highway (TrafficView): tractors and trailers, each its
# own model, coupled and driven by the game. Both face +x with their wheels on
# the road (y = 0.03). A tractor's origin is its fifth wheel, where the
# trailer couples; a trailer's origin is the middle of its rear axles, and its
# kingpin is KINGPIN ahead of that (TrafficView puts it on the fifth wheel).

ROAD = 0.03
WHEEL = 0.035
KINGPIN = 0.5


def wheels(hv, xs):
    for x in xs:
        for z in (-1, 1):
            hv.cstrut((x, ROAD + WHEEL, z * 0.058), (x, ROAD + WHEEL, z * 0.092), WHEEL, 'tyre', seg=10)
            hv.cstrut((x, ROAD + WHEEL, z * 0.09), (x, ROAD + WHEEL, z * 0.096), WHEEL * 0.55, 'steel', seg=8)  # hub


def tractor(color, trim='steel'):
    def make(hv):
        y0 = ROAD + 0.04
        hv.cbox(0.42, 0.03, 0.12, 0.05, y0 - 0.005, 0, 'black', bevel=0)  # chassis rails
        wheels(hv, (-0.1, -0.02, 0.2))
        hv.ccyl(0.045, 0.012, 0, y0 + 0.025, 0, 'charcoal', seg=10)  # fifth wheel
        # Hood, grille, bumper, lights.
        hv.cbox(0.11, 0.075, 0.15, 0.205, y0 + 0.01, 0, color, bevel=0.018)
        hv.cbox(0.012, 0.06, 0.11, 0.264, y0 + 0.015, 0, trim, bevel=0)
        hv.cbox(0.024, 0.026, 0.18, 0.272, y0 - 0.01, 0, trim, bevel=0.006)
        for z in (-0.055, 0.055):
            hv.cbox(0.012, 0.018, 0.026, 0.273, y0 + 0.052, z, 'light', bevel=0)
        hv.cbox(0.05, 0.04, 0.034, 0.2, y0 - 0.005, 0.085, 'black', bevel=0)  # fenders
        hv.cbox(0.05, 0.04, 0.034, 0.2, y0 - 0.005, -0.085, 'black', bevel=0)
        # Cab with windscreen and side windows, and the sleeper behind.
        hv.cbox(0.1, 0.13, 0.17, 0.105, y0 + 0.01, 0, color, bevel=0.016)
        hv.cbox(0.012, 0.05, 0.14, 0.158, y0 + 0.08, 0, 'glassdark', bevel=0)
        hv.cbox(0.05, 0.045, 0.19, 0.118, y0 + 0.085, 0, 'glassdark', bevel=0)
        hv.cbox(0.075, 0.16, 0.165, 0.02, y0 + 0.01, 0, color, bevel=0.016)
        hv.cbox(0.06, 0.04, 0.15, 0.06, y0 + 0.17, 0, color, bevel=0.012)  # roof fairing
        hv.cbox(0.02, 0.012, 0.16, 0.16, y0 + 0.14, 0, 'light', bevel=0)  # cab lights
        # Exhaust stacks, fuel tanks, mud flaps.
        for z in (-0.092, 0.092):
            hv.cstrut((0.07, y0, z), (0.07, y0 + 0.27, z), 0.011, trim, seg=8)
            hv.cstrut((0.03, y0 + 0.01, z * 0.95), (0.1, y0 + 0.01, z * 0.95), 0.024, trim, seg=10)
            hv.cbox(0.006, 0.05, 0.03, -0.145, ROAD + 0.01, z * 0.85, 'black', bevel=0)
    return make


def trailer_frame(hv, length=0.68, deck=None):
    # The trailer's chassis, tandem rear axles, landing legs and bumper.
    y0 = ROAD + 0.06
    x0 = KINGPIN + 0.06 - length
    hv.cbox(length, 0.025, 0.12, (x0 + KINGPIN + 0.06) / 2, y0, 0, 'black', bevel=0)
    wheels(hv, (-0.045, 0.045))
    for z in (-0.05, 0.05):
        hv.cstrut((KINGPIN - 0.14, y0, z), (KINGPIN - 0.14, ROAD + 0.002, z), 0.008, 'charcoal', seg=4)
    hv.cbox(0.02, 0.02, 0.16, x0 - 0.005, ROAD + 0.04, 0, 'roofred', bevel=0)  # rear bumper
    if deck:
        hv.cbox(length, 0.02, 0.17, (x0 + KINGPIN + 0.06) / 2, y0 + 0.025, 0, deck, bevel=0.004)
    return x0, y0 + 0.045


def trailer_container(color):
    def make(hv):
        x0, y = trailer_frame(hv)
        L = KINGPIN + 0.04 - x0
        cx = (x0 + KINGPIN + 0.04) / 2
        hv.cbox(L, 0.16, 0.17, cx, y - 0.02, 0, color, bevel=0.008)
        for k in range(12):  # corrugations
            hv.cbox(0.008, 0.15, 0.182, x0 + 0.03 + k * (L - 0.06) / 11, y - 0.015, 0, color, bevel=0)
        hv.cbox(0.012, 0.15, 0.15, x0 - 0.004, y - 0.015, 0, 'steel', bevel=0)  # doors
        hv.cbox(0.014, 0.15, 0.006, x0 - 0.005, y - 0.015, 0, 'black', bevel=0)
    return make


def trailer_tanker(hv):
    x0, y = trailer_frame(hv, deck=None)
    hv.cstrut((x0 + 0.04, y + 0.06, 0), (KINGPIN - 0.02, y + 0.06, 0), 0.08, 'pipe', seg=14)
    hv.csphere(0.08, x0 + 0.04, y + 0.06, 0, 'pipe', seg=14, rings=8)
    hv.csphere(0.08, KINGPIN - 0.02, y + 0.06, 0, 'pipe', seg=14, rings=8)
    for x in (x0 + 0.12, 0.2, KINGPIN - 0.1):
        hv.ctorus(0.081, 0.006, x, y + 0.06, 0, 'steel', axis='x', seg=16, ring=3)
    hv.cbox(0.5, 0.012, 0.05, 0.22, y + 0.14, 0, 'steel', bevel=0)  # catwalk
    hv.cbox(0.06, 0.03, 0.012, 0.2, y + 0.05, 0.081, 'roofred', bevel=0)  # hazard placard
    hv.cbox(0.06, 0.03, 0.012, 0.2, y + 0.05, -0.081, 'roofred', bevel=0)


def trailer_logs(hv):
    x0, y = trailer_frame(hv, deck='wood')
    for x in (x0 + 0.04, 0.12, KINGPIN - 0.04):
        for z in (-0.08, 0.08):
            hv.cstrut((x, y, z), (x, y + 0.14, z), 0.007, 'charcoal', seg=4)  # stakes
    rows = [(-0.045, 0.03), (0.0, 0.03), (0.045, 0.03), (-0.022, 0.07), (0.022, 0.07), (0.0, 0.108)]
    for z, h in rows:
        hv.cstrut((x0 + 0.01, y + h, z), (KINGPIN + 0.02, y + h, z), 0.022, 'wood', seg=8)
        hv.cstrut((x0 + 0.005, y + h, z), (x0 + 0.012, y + h, z), 0.018, 'lightwood', seg=8)  # cut ends
    for x in (0.0, 0.3):
        hv.ctorus(0.075, 0.004, x, y + 0.06, 0, 'black', axis='x', seg=12, ring=3)  # straps


def trailer_pipes(hv):
    x0, y = trailer_frame(hv, deck='charcoal')
    for i, (z, h) in enumerate([(-0.05, 0.022), (0.0, 0.022), (0.05, 0.022), (-0.025, 0.062), (0.025, 0.062)]):
        hv.cstrut((x0 + 0.03, y + h, z), (KINGPIN - 0.02, y + h, z), 0.021, 'steel', seg=8)
        hv.cstrut((x0 + 0.026, y + h, z), (x0 + 0.032, y + h, z), 0.013, 'black', seg=8)  # bore
    for x in (0.02, 0.32):
        hv.cbox(0.02, 0.1, 0.16, x, y, 0, 'sunny', bevel=0)  # yellow bulkheads
    hv.cbox(0.03, 0.16, 0.17, KINGPIN - 0.0, y, 0, 'charcoal', bevel=0)  # headboard


def trailer_box(stripe):
    def make(hv):
        x0, y = trailer_frame(hv)
        L = KINGPIN + 0.04 - x0
        cx = (x0 + KINGPIN + 0.04) / 2
        hv.cbox(L, 0.17, 0.17, cx, y - 0.02, 0, 'snow', bevel=0.01)
        hv.cbox(L - 0.08, 0.035, 0.18, cx, y + 0.05, 0, stripe, bevel=0)
        hv.cbox(L - 0.02, 0.012, 0.172, cx, y + 0.15, 0, 'steel', bevel=0)  # roof rail
        hv.cbox(0.01, 0.15, 0.006, x0 - 0.002, y - 0.01, 0, 'black', bevel=0)  # door seam
    return make


TRACTORS = [('roofred', 'steel'), ('kartblue', 'steel'), ('snow', 'roofred'), ('sunny', 'black')]
PARTS = {
    **{f'tractor-{i}': tractor(c, t) for i, (c, t) in enumerate(TRACTORS)},
    'trailer-container-red': trailer_container('roofred'),
    'trailer-container-blue': trailer_container('kartblue'),
    'trailer-tanker': trailer_tanker,
    'trailer-logs': trailer_logs,
    'trailer-pipes': trailer_pipes,
    'trailer-box': trailer_box('leaf'),
}
