# Offshore Oil Refinery (4×4): a tall steel platform in the sea. Braced legs
# carry a cellar deck and the main deck; on it, the process area (storage and
# pressure tanks, distillation columns, pipe racks), the drilling derrick, a
# control building with the radar, the accommodation block with the helideck
# on its roof, generator modules, a container laydown by the crane, lifeboats,
# and a flare boom reaching out over the sea.
#
# Everything that moves is the game's (quarryModels.ts, buildOilRefinery):
# the flame and smoke, drill, hoist, pumpjack beam, crane, radar, helicopter,
# tanker and gulls. This mirrors its numbers (deck height, where each stands).
# The crane, pumpjack beam, radar, tanker and helicopter are PARTS below.
import math

W = D = 4
DECK_Y = 0.62
HW = W / 2 - 0.18
HD = D / 2 - 0.18
TOP_Y = DECK_Y + 0.07
PROC_Y = TOP_Y + 0.05
LEG = HW - 0.14  # legs stand at (±LEG, ±LEG)
CELLAR_Y = 0.3

# Where the game's moving parts are (quarryModels.ts).
QX, QZ = 1.05, -0.45  # control building; radar on its mast at TOP_Y + 0.92
HX, HZ = 1.2, 1.1  # helideck
HELI_Y = TOP_Y + 0.74
FX, FZ = -2.05, -2.05  # flare tip
FLARE_TOP = PROC_Y + 1.3 + 0.08
DX, DZ, DERRICK_H = 0.22, -1.05, 1.55
PX, PZ = 0.22, -0.05  # pumpjack
CRX, CRZ = -0.18, 1.38  # crane pedestal
BOOM_LEN, BOOM_ANGLE = 1.05, 0.65


def rail(hv, a, b, posts=True):
    # A handrail between two points at deck level (game coordinates, y = deck).
    hv.cstrut((a[0], a[1] + 0.09, a[2]), (b[0], b[1] + 0.09, b[2]), 0.008, 'steel', seg=4)
    hv.cstrut((a[0], a[1] + 0.05, a[2]), (b[0], b[1] + 0.05, b[2]), 0.006, 'steel', seg=4)
    if posts:
        n = max(1, int(math.dist(a, b) / 0.3))
        for i in range(n + 1):
            t = i / n
            p = [a[k] + (b[k] - a[k]) * t for k in range(3)]
            hv.cstrut((p[0], p[1], p[2]), (p[0], p[1] + 0.09, p[2]), 0.007, 'steel', seg=4)


def ladder(hv, x, z, y0, y1, facing=0.0):
    # Two rails and rungs up the side of something.
    dx, dz = math.cos(facing) * 0.04, math.sin(facing) * 0.04
    hv.cstrut((x - dx, y0, z - dz), (x - dx, y1, z - dz), 0.006, 'charcoal', seg=4)
    hv.cstrut((x + dx, y0, z + dz), (x + dx, y1, z + dz), 0.006, 'charcoal', seg=4)
    y = y0 + 0.05
    while y < y1:
        hv.cstrut((x - dx, y, z - dz), (x + dx, y, z + dz), 0.004, 'charcoal', seg=3)
        y += 0.06


def structure(hv):
    # Legs from below the sea up to the main deck, with splash-zone collars.
    for sx in (-1, 1):
        for sz in (-1, 1):
            x, z = sx * LEG, sz * LEG
            hv.ccyl(0.17, DECK_Y + 0.27, x, -0.25, z, 'deck', seg=14, gradient=False)
            hv.ccyl(0.2, 0.14, x, -0.02, z, 'hazard', seg=14)
            hv.ccyl(0.19, 0.03, x, 0.14, z, 'black', seg=14)
            hv.ccyl(0.2, 0.06, x, DECK_Y - 0.06, z, 'charcoal', seg=14)  # leg cap under the deck
    # Cross bracing between the legs on every side, in two bays.
    for s in (-1, 1):
        for y0, y1 in ((0.12, CELLAR_Y), (CELLAR_Y + 0.03, DECK_Y - 0.04)):
            hv.cstrut((-LEG, y0, s * LEG), (LEG, y1, s * LEG), 0.03, 'slate', seg=6)
            hv.cstrut((LEG, y0, s * LEG), (-LEG, y1, s * LEG), 0.03, 'slate', seg=6)
            hv.cstrut((s * LEG, y0, -LEG), (s * LEG, y1, LEG), 0.03, 'slate', seg=6)
            hv.cstrut((s * LEG, y0, LEG), (s * LEG, y1, -LEG), 0.03, 'slate', seg=6)
        hv.cstrut((-LEG, 0.12, s * LEG), (LEG, 0.12, s * LEG), 0.035, 'slate', seg=6)
        hv.cstrut((s * LEG, 0.12, -LEG), (s * LEG, 0.12, LEG), 0.035, 'slate', seg=6)
    # Cellar deck: a grating floor on a frame, with pumps and a few tanks.
    hv.cbox(2 * LEG + 0.1, 0.03, 2 * LEG + 0.1, 0, CELLAR_Y, 0, 'slate2', bevel=0)
    for s in (-1, 1):
        hv.cbox(2 * LEG + 0.2, 0.06, 0.06, 0, CELLAR_Y - 0.05, s * LEG, 'charcoal', bevel=0)
        hv.cbox(0.06, 0.06, 2 * LEG + 0.2, s * LEG, CELLAR_Y - 0.05, 0, 'charcoal', bevel=0)
    for x, z, c in ((-0.6, 0.9, 'snow'), (0.3, 0.95, 'hazard'), (0.9, -0.2, 'snow'), (-0.9, -0.5, 'roofred')):
        hv.cstrut((x - 0.22, CELLAR_Y + 0.1, z), (x + 0.22, CELLAR_Y + 0.1, z), 0.08, c, seg=10)
        hv.cbox(0.06, 0.05, 0.14, x - 0.15, CELLAR_Y + 0.03, z, 'charcoal', bevel=0)
        hv.cbox(0.06, 0.05, 0.14, x + 0.15, CELLAR_Y + 0.03, z, 'charcoal', bevel=0)
    for x, z in ((0.0, -0.9), (0.6, 0.3), (-0.3, 0.2)):
        hv.cbox(0.2, 0.14, 0.16, x, CELLAR_Y + 0.03, z, 'kartblue', bevel=0.012)
    # The main deck: a thick yellow-edged girder and a plated floor.
    hv.cbox(W - 0.3, 0.08, D - 0.3, 0, DECK_Y - 0.03, 0, 'hazard', bevel=0.015)
    hv.cbox(W - 0.42, 0.04, D - 0.42, 0, DECK_Y + 0.03, 0, 'deck', bevel=0.006)
    # Plating seams and painted walkways.
    for k in range(-3, 4):
        hv.cbox(W - 0.46, 0.008, 0.012, 0, TOP_Y, k * 0.5, 'slate', bevel=0)
        hv.cbox(0.012, 0.008, D - 0.46, k * 0.5, TOP_Y, 0, 'slate', bevel=0)
    for s in (-1, 1):
        hv.cbox(W - 0.7, 0.018, 0.03, 0, TOP_Y, s * (HD - 0.2), 'sunny', bevel=0)
        hv.cbox(0.03, 0.018, D - 0.7, s * (HW - 0.2), TOP_Y, 0, 'sunny', bevel=0)
    # Handrails all round the edge.
    e = HW - 0.04
    for a, b in (((-e, TOP_Y, -e), (e, TOP_Y, -e)), ((e, TOP_Y, -e), (e, TOP_Y, e)), ((e, TOP_Y, e), (-e, TOP_Y, e)), ((-e, TOP_Y, e), (-e, TOP_Y, -e))):
        rail(hv, a, b)


def process(hv):
    # Raised process deck on the left, on short legs.
    hv.cbox(W * 0.44, 0.05, D * 0.78, -W * 0.22, TOP_Y, -D * 0.04, 'slate2', bevel=0.01)
    # Storage tanks: white with red bands, a roof rim and a ladder.
    for tx, tz, r, h in ((-1.15, 0.85, 0.38, 0.52), (-1.15, 0.0, 0.34, 0.46), (-0.48, 0.78, 0.26, 0.42)):
        hv.ccyl(r, h, tx, PROC_Y, tz, 'snow', seg=20, gradient=True)
        hv.ccyl(r + 0.012, 0.06, tx, PROC_Y + h * 0.62, tz, 'roofred', seg=20, bevel=0)
        hv.ccyl(r + 0.012, 0.03, tx, PROC_Y + h * 0.3, tz, 'roofred', seg=20, bevel=0)
        hv.ccyl(r + 0.02, 0.1, tx, PROC_Y + h, tz, 'pipe', seg=20, r_top=0.05)
        hv.ctorus(r + 0.01, 0.01, tx, PROC_Y + h + 0.01, tz, 'steel', axis='y', seg=20, ring=3)
        ladder(hv, tx + r * 0.72, tz + r * 0.72, PROC_Y, PROC_Y + h + 0.02, facing=-math.pi / 4)
    # Spherical pressure tanks on legs.
    for sz in (0.1, 0.58):
        hv.csphere(0.2, -0.48, PROC_Y + 0.28, sz, 'snow', seg=16, rings=12)
        hv.ctorus(0.2, 0.015, -0.48, PROC_Y + 0.28, sz, 'roofred', axis='y', seg=18, ring=4)
        for lx, lz in ((-0.11, -0.11), (0.11, -0.11), (-0.11, 0.11), (0.11, 0.11)):
            hv.ccyl(0.016, 0.2, -0.48 + lx, PROC_Y, sz + lz, 'charcoal', seg=5)
    # Distillation columns with platforms, railings and ladders.
    for cx, cz, r, h in ((-1.12, -0.82, 0.19, 1.45), (-0.55, -0.82, 0.16, 1.22)):
        hv.ccyl(r, h, cx, PROC_Y, cz, 'pipe', seg=16, r_top=r * 0.92, gradient=True)
        hv.csphere(r * 0.92, cx, PROC_Y + h, cz, 'pipe', seg=16, rings=8, sy=0.6)
        ring = 0.3
        while ring < h - 0.15:
            hv.ccyl(r + 0.07, 0.02, cx, PROC_Y + ring, cz, 'charcoal', seg=16, bevel=0)
            hv.ctorus(r + 0.07, 0.006, cx, PROC_Y + ring + 0.07, cz, 'steel', axis='y', seg=16, ring=3)
            ring += 0.36
        ladder(hv, cx + r + 0.03, cz, PROC_Y, PROC_Y + h, facing=math.pi / 2)
    # Pipe racks: a steel frame carrying three colored lines each way.
    for x, z in ((-0.82, -0.6), (-0.82, 0.0), (-0.82, 0.6), (-0.3, -0.82), (0.3, -0.82)):
        hv.cstrut((x, PROC_Y, z), (x, PROC_Y + 0.54, z), 0.016, 'charcoal', seg=4)
        hv.cbox(0.16, 0.025, 0.16, x, PROC_Y + 0.53, z, 'charcoal', bevel=0)
    for py, color in ((PROC_Y + 0.32, 'hazard'), (PROC_Y + 0.4, 'roofred'), (PROC_Y + 0.48, 'steel')):
        hv.cstrut((-0.82, py, -0.82), (-0.82, py, 0.82), 0.025, color, seg=8)
        hv.cstrut((-0.87, py, -0.82), (0.47, py, -0.82), 0.025, color, seg=8)
        hv.csphere(0.032, -0.82, py, -0.82, color, seg=8, rings=5)  # elbow


def derrick(hv):
    # Drill floor, a tapering lattice tower, the crown, the driller's cabin
    # and a rack of drill pipe. (The drill string and hoist are the game's.)
    hv.cbox(0.76, 0.06, 0.76, DX, TOP_Y, DZ, 'charcoal', bevel=0.01)
    hv.cbox(0.8, 0.012, 0.8, DX, TOP_Y + 0.06, DZ, 'hazard', bevel=0)
    corners = [(sx, sz) for sx in (-1, 1) for sz in (-1, 1)]
    def at(sx, sz, y):
        t = y / DERRICK_H
        half = 0.3 - 0.2 * t
        return (DX + sx * half, TOP_Y + 0.06 + y, DZ + sz * half)
    for sx, sz in corners:
        hv.cstrut(at(sx, sz, 0), at(sx, sz, DERRICK_H), 0.024, 'roofred', seg=6)
    levels = [0.0, 0.32, 0.64, 0.96, 1.26, DERRICK_H - 0.04]
    sides = [((-1, -1), (1, -1)), ((1, -1), (1, 1)), ((1, 1), (-1, 1)), ((-1, 1), (-1, -1))]
    for k, y in enumerate(levels):
        for a, b in sides:
            hv.cstrut(at(*a, y), at(*b, y), 0.012, 'white', seg=4)
            if k + 1 < len(levels):
                hv.cstrut(at(*a, y), at(*b, levels[k + 1]), 0.009, 'white', seg=4)
    hv.cbox(0.28, 0.08, 0.28, DX, TOP_Y + 0.06 + DERRICK_H, DZ, 'hazard', bevel=0.01)
    hv.cbox(0.06, 0.14, 0.06, DX, TOP_Y + 0.14 + DERRICK_H, DZ, 'roofred', bevel=0)
    hv.csphere(0.02, DX, TOP_Y + 0.3 + DERRICK_H, DZ, 'roofred', seg=6, rings=4)  # beacon
    # Driller's cabin (doghouse) beside the drill floor.
    hv.cbox(0.26, 0.2, 0.22, DX + 0.55, TOP_Y, DZ + 0.05, 'orange', bevel=0.015)
    hv.cbox(0.2, 0.06, 0.012, DX + 0.55, TOP_Y + 0.11, DZ + 0.165, 'glass', bevel=0)
    hv.cbox(0.28, 0.025, 0.24, DX + 0.55, TOP_Y + 0.2, DZ + 0.05, 'white', bevel=0)
    # Pipe rack: drill pipe lying on trestles.
    for z in (DZ - 0.32, DZ - 0.12):
        hv.cbox(0.04, 0.06, 0.04, DX + 0.55, TOP_Y, z, 'charcoal', bevel=0)
        hv.cbox(0.04, 0.06, 0.04, DX + 1.0, TOP_Y, z, 'charcoal', bevel=0)
    for k in range(5):
        y = TOP_Y + 0.075 + (k // 3) * 0.03
        x0 = DX + 0.5 + (k % 3) * 0.0
        hv.cstrut((DX + 0.5, y, DZ - 0.38 + k * 0.035), (DX + 1.05, y, DZ - 0.38 + k * 0.035), 0.014, 'rust', seg=6)


def flare(hv):
    # A lattice boom from the deck's back-left corner up and out over the sea.
    base = [(-1.5, PROC_Y, -1.32), (-1.32, PROC_Y, -1.5), (-1.55, PROC_Y, -1.55)]
    tip_y = FLARE_TOP - 0.22
    tip = [(FX + 0.06, tip_y, FZ - 0.02), (FX - 0.02, tip_y, FZ + 0.06), (FX - 0.04, tip_y, FZ - 0.04)]
    for a, b in zip(base, tip):
        hv.cstrut(a, b, 0.02, 'snow', seg=5)
    n = 6
    for i in range(n + 1):
        t = i / n
        ring = [[a[k] + (b[k] - a[k]) * t for k in range(3)] for a, b in zip(base, tip)]
        for j in range(3):
            hv.cstrut(ring[j], ring[(j + 1) % 3], 0.008, 'roofred', seg=3)
            if i < n:
                t2 = (i + 1) / n
                nxt = [base[(j + 1) % 3][k] + (tip[(j + 1) % 3][k] - base[(j + 1) % 3][k]) * t2 for k in range(3)]
                hv.cstrut(ring[j], nxt, 0.006, 'snow', seg=3)
    # The flare tip: a short stack where the flame burns.
    hv.ccyl(0.055, 0.2, FX, tip_y, FZ, 'slate', seg=10)
    hv.ccyl(0.06, 0.04, FX, FLARE_TOP - 0.04, FZ, 'black', seg=10)
    hv.cstrut((-1.5, PROC_Y + 0.1, -1.5), (FX, tip_y, FZ), 0.02, 'hazard', seg=6)  # gas line


def buildings(hv):
    # Control building (two storeys) with the radar mast.
    hv.cbox(0.88, 0.3, 0.7, QX, TOP_Y, QZ, 'snow', bevel=0.015)
    hv.cbox(0.9, 0.04, 0.72, QX, TOP_Y + 0.3, QZ, 'orange', bevel=0.01)
    hv.cbox(0.7, 0.24, 0.54, QX, TOP_Y + 0.34, QZ, 'snow', bevel=0.015)
    hv.cbox(0.74, 0.05, 0.58, QX, TOP_Y + 0.58, QZ, 'roofblue', bevel=0.01)
    hv.cbox(0.58, 0.09, 0.012, QX, TOP_Y + 0.43, QZ + 0.275, 'glassdark', bevel=0)  # bridge windows
    hv.cbox(0.012, 0.09, 0.44, QX + 0.355, TOP_Y + 0.43, QZ, 'glassdark', bevel=0)
    for i in range(3):
        hv.cbox(0.1, 0.08, 0.012, QX - 0.3 + i * 0.2, TOP_Y + 0.13, QZ + 0.355, 'glass', bevel=0)
    hv.cbox(0.14, 0.22, 0.012, QX + 0.32, TOP_Y, QZ + 0.355, 'navy', bevel=0)
    hv.ccyl(0.025, 0.3, QX, TOP_Y + 0.63, QZ, 'steel', seg=6)  # radar mast
    hv.cstrut((QX - 0.2, TOP_Y + 0.63, QZ), (QX - 0.2, TOP_Y + 0.85, QZ), 0.008, 'steel', seg=4)
    hv.csphere(0.025, QX - 0.2, TOP_Y + 0.87, QZ, 'white', seg=6, rings=4)
    # Accommodation block: three storeys, a stair tower, the helideck on top.
    ax, az, aw, ad, ah = 1.12, 1.02, 0.86, 0.9, 0.7
    for k in range(3):
        y = TOP_Y + k * ah / 3
        hv.cbox(aw, ah / 3 - 0.01, ad, ax, y, az, 'snow', bevel=0.012)
        hv.cbox(aw + 0.02, 0.012, ad + 0.02, ax, y + ah / 3 - 0.012, az, 'orange', bevel=0)
        for i in range(5):  # windows front and side
            hv.cbox(0.09, 0.08, 0.012, ax - 0.34 + i * 0.17, y + 0.08, az + ad / 2 + 0.006, 'glass', bevel=0)
            hv.cbox(0.012, 0.08, 0.09, ax + aw / 2 + 0.006, y + 0.08, az - 0.36 + i * 0.18, 'glass', bevel=0)
    hv.cbox(0.2, ah + 0.02, 0.24, ax - aw / 2 - 0.1, TOP_Y, az + 0.2, 'orange', bevel=0.012)  # stair tower
    hv.cbox(0.012, 0.5, 0.06, ax - aw / 2 - 0.2, TOP_Y + 0.1, az + 0.2, 'glass', bevel=0)
    # Helideck: a frame on the roof, the octagonal pad, its ring, H and lights.
    for sx, sz in ((-0.3, -0.3), (0.3, -0.3), (-0.3, 0.3), (0.3, 0.3)):
        hv.cstrut((ax + sx, TOP_Y + ah, az + sz), (HX + sx * 1.2, HELI_Y, HZ + sz * 1.2), 0.02, 'charcoal', seg=4)
    hv.ccyl(0.58, 0.02, HX, HELI_Y - 0.02, HZ, 'charcoal', seg=8, bevel=0)  # safety net frame
    hv.ccyl(0.56, 0.04, HX, HELI_Y, HZ, 'deck', seg=8)
    hv.ctorus(0.4, 0.018, HX, HELI_Y + 0.05, HZ, 'hazard', axis='y', seg=24, ring=4)
    for dxh in (-0.12, 0.12):
        hv.cbox(0.05, 0.012, 0.26, HX + dxh, HELI_Y + 0.04, HZ, 'white', bevel=0)
    hv.cbox(0.24, 0.012, 0.05, HX, HELI_Y + 0.041, HZ, 'white', bevel=0)
    for i in range(8):
        a = i / 8 * math.pi * 2 + math.pi / 8
        hv.csphere(0.022, HX + math.cos(a) * 0.5, HELI_Y + 0.055, HZ + math.sin(a) * 0.5, 'lamp', seg=6, rings=4)
    hv.ccyl(0.012, 0.18, HX + 0.5, HELI_Y + 0.04, HZ - 0.3, 'white', seg=4)  # windsock pole
    hv.ccyl(0.025, 0.1, HX + 0.5, HELI_Y + 0.2, HZ - 0.3, 'orange', seg=6, r_top=0.012)


def equipment(hv):
    # Pumpjack base, its post and the wellhead (the beam is a moving part).
    hv.cbox(0.32, 0.04, 0.72, PX, TOP_Y, PZ, 'charcoal', bevel=0)
    for sz in (-0.04, 0.04):
        hv.cstrut((PX - 0.1, TOP_Y + 0.04, PZ + sz), (PX, TOP_Y + 0.44, PZ), 0.016, 'black', seg=4)
        hv.cstrut((PX + 0.1, TOP_Y + 0.04, PZ + sz), (PX, TOP_Y + 0.44, PZ), 0.016, 'black', seg=4)
    hv.ccyl(0.055, 0.14, PX, TOP_Y + 0.04, PZ + 0.26, 'roofred', seg=8, r_top=0.045)
    hv.cbox(0.16, 0.1, 0.14, PX, TOP_Y + 0.04, PZ - 0.27, 'kartblue', bevel=0.01)  # motor
    # The crane's pedestal, with a ladder up to the cab.
    hv.ccyl(0.15, 0.32, CRX, TOP_Y, CRZ, 'hazard', seg=14, r_top=0.12)
    hv.ccyl(0.17, 0.03, CRX, TOP_Y, CRZ, 'charcoal', seg=14)
    ladder(hv, CRX + 0.15, CRZ, TOP_Y, TOP_Y + 0.32, facing=math.pi / 2)
    # Container laydown by the crane.
    for x, z, y, c in ((-1.0, 1.32, 0, 'roofred'), (-1.0, 1.12, 0, 'kartblue'), (-1.0, 1.22, 0.14, 'leaf'), (-0.62, 1.42, 0, 'orange')):
        hv.cbox(0.34, 0.14, 0.17, x, TOP_Y + y, z, c, bevel=0.008)
        for k in range(4):
            hv.cbox(0.006, 0.12, 0.175, x - 0.12 + k * 0.08, TOP_Y + y + 0.01, z, 'black', bevel=0)
    # Generator and compressor modules.
    hv.cbox(0.5, 0.26, 0.36, 0.42, TOP_Y, 0.82, 'orange', bevel=0.015)
    for k in range(5):
        hv.cbox(0.4, 0.012, 0.012, 0.42, TOP_Y + 0.05 + k * 0.04, 1.005, 'black', bevel=0)  # louvres
    hv.ccyl(0.04, 0.16, 0.3, TOP_Y + 0.26, 0.82, 'slate', seg=8)  # exhaust
    hv.cbox(0.36, 0.2, 0.3, 0.6, TOP_Y, 0.25, 'kartblue', bevel=0.015)
    hv.cstrut((0.6, TOP_Y + 0.2, 0.25), (0.6, TOP_Y + 0.2, -0.05), 0.02, 'steel', seg=6)
    # Lifeboats on davits along the left edge.
    for z in (0.35, 1.0):
        x = -HW + 0.02
        hv.cbox(0.14, 0.08, 0.4, x, TOP_Y + 0.08, z, 'orange', bevel=0.03)
        hv.cbox(0.12, 0.07, 0.3, x, TOP_Y + 0.15, z, 'white', bevel=0.03)
        for dz in (-0.16, 0.16):
            hv.cstrut((x + 0.12, TOP_Y, z + dz), (x + 0.12, TOP_Y + 0.28, z + dz), 0.012, 'charcoal', seg=4)
            hv.cstrut((x + 0.12, TOP_Y + 0.28, z + dz), (x, TOP_Y + 0.24, z + dz), 0.01, 'charcoal', seg=4)
    # Life rings on the rails.
    for x, z in ((0.0, HD - 0.04), (-HW + 0.04, -0.5), (HW - 0.04, 0.0)):
        hv.ctorus(0.035, 0.012, x, TOP_Y + 0.07, z, 'orange', axis='z' if abs(z) > 1 else 'x', seg=10, ring=4)


def build(hv):
    structure(hv)
    process(hv)
    derrick(hv)
    flare(hv)
    buildings(hv)
    equipment(hv)


# ---- Moving parts

def crane(hv):
    # The cab on its slewing ring at the origin (the top of the pedestal),
    # with the boom fixed at its angle; the game turns it and hangs the load.
    hv.ccyl(0.14, 0.03, 0, 0, 0, 'charcoal', seg=14)
    hv.cbox(0.26, 0.17, 0.28, 0, 0.03, -0.02, 'hazard', bevel=0.02)
    hv.cbox(0.012, 0.09, 0.14, -0.131, 0.08, 0.04, 'glass', bevel=0)
    hv.cbox(0.12, 0.09, 0.012, -0.06, 0.08, 0.121, 'glass', bevel=0)
    hv.cbox(0.22, 0.1, 0.12, 0.0, 0.03, -0.2, 'charcoal', bevel=0.012)  # counterweight
    hv.cstrut((0.06, 0.2, -0.1), (0.0, 0.42, -0.06), 0.012, 'hazard', seg=4)  # A-frame
    hv.cstrut((-0.06, 0.2, -0.1), (0.0, 0.42, -0.06), 0.012, 'hazard', seg=4)
    tip = (0, 0.1 + math.sin(BOOM_ANGLE) * BOOM_LEN, 0.08 + math.cos(BOOM_ANGLE) * BOOM_LEN)
    heel = (0, 0.1, 0.08)
    # Lattice boom: two chords and zigzag lacing.
    for s in (-1, 1):
        hv.cstrut((s * 0.04, heel[1], heel[2]), (s * 0.015, tip[1], tip[2]), 0.012, 'hazard', seg=4)
    hv.cstrut((0, heel[1] + 0.05, heel[2]), (0, tip[1] + 0.01, tip[2]), 0.01, 'hazard', seg=4)
    n = 8
    for i in range(n):
        t0, t1 = i / n, (i + 1) / n
        p0 = [heel[k] + (tip[k] - heel[k]) * t0 for k in range(3)]
        p1 = [heel[k] + (tip[k] - heel[k]) * t1 for k in range(3)]
        w0, w1 = 0.04 - 0.025 * t0, 0.04 - 0.025 * t1
        s = 1 if i % 2 == 0 else -1
        hv.cstrut((s * w0, p0[1], p0[2]), (-s * w1, p1[1], p1[2]), 0.006, 'white', seg=3)
    hv.cstrut((0, 0.42, -0.06), tip, 0.005, 'charcoal', seg=3)  # pendant line
    hv.cbox(0.05, 0.05, 0.05, tip[0], tip[1] - 0.03, tip[2], 'charcoal', bevel=0)  # sheave


def pumpjack(hv):
    # The walking beam about its pivot; horsehead at +z, counterweight at −z.
    hv.cbox(0.06, 0.07, 0.56, 0, -0.035, 0, 'hazard', bevel=0.012)
    hv.cstrut((-0.05, 0, 0), (0.05, 0, 0), 0.025, 'charcoal', seg=8)  # pivot
    # The horsehead, curved: drawn side-on in the y–z plane.
    pts = []
    for i in range(7):
        a = -math.pi / 2 + i / 6 * (math.pi * 0.62)
        pts.append((0.24 + math.cos(a) * 0.09, -0.11 + math.sin(a) * 0.12))
    outline = [(z, y) for z, y in pts] + [(0.24, 0.0), (0.22, 0.0), (0.22, -0.23)]
    hv.prism([(-z, y) for z, y in outline], 0.08, 0, 0, 0, 'roofred', axis='X', bevel=0.005)
    hv.cbox(0.13, 0.12, 0.12, 0, -0.08, -0.27, 'black', bevel=0.012)


def radar(hv):
    # A slotted antenna on a turning pedestal; the game spins it about y.
    hv.ccyl(0.03, 0.04, 0, -0.04, 0, 'steel', seg=8)
    hv.cbox(0.32, 0.045, 0.04, 0, 0, 0, 'white', bevel=0.012)
    hv.cbox(0.3, 0.025, 0.012, 0, 0.01, 0.022, 'charcoal', bevel=0)


def tanker(hv):
    # Bow at +z, keel at y = 0 (the game sails it round its loop).
    outline = [(-0.22, -0.66), (0.22, -0.66), (0.22, 0.52), (0.1, 0.84), (0, 0.9), (-0.1, 0.84), (-0.22, 0.52)]
    hv.cslab(outline, 0, 0.14, 'roofred', bevel=0.02)
    hv.cslab([(x * 1.03, z * 1.01) for x, z in outline], -0.005, 0.04, 'black', bevel=0)  # waterline, just proud of the hull
    hv.cslab([(x * 0.92, z * 0.97) for x, z in outline], 0.14, 0.03, 'deck', bevel=0)
    for z in (-0.15, 0.18, 0.5):
        hv.ccyl(0.13, 0.07, 0, 0.17, z, 'hazard', seg=14)
    hv.cstrut((0, 0.22, -0.3), (0, 0.22, 0.66), 0.018, 'pipe', seg=6)
    for z in (-0.3, 0.0, 0.35):
        hv.cbox(0.3, 0.012, 0.012, 0, 0.2, z, 'steel', bevel=0)  # manifolds
    hv.cbox(0.36, 0.2, 0.3, 0, 0.17, -0.48, 'snow', bevel=0.015)
    hv.cbox(0.3, 0.1, 0.24, 0, 0.37, -0.5, 'snow', bevel=0.012)
    hv.cbox(0.37, 0.05, 0.02, 0, 0.29, -0.32, 'glassdark', bevel=0)
    hv.cbox(0.31, 0.04, 0.02, 0, 0.42, -0.37, 'glassdark', bevel=0)
    hv.ccyl(0.05, 0.18, 0, 0.47, -0.56, 'hazard', seg=10, r_top=0.045)
    hv.ccyl(0.052, 0.04, 0, 0.65, -0.56, 'black', seg=10)
    hv.cstrut((0, 0.47, -0.45), (0, 0.62, -0.45), 0.006, 'steel', seg=4)  # mast


def helicopter(hv):
    # Nose at +z, skids at y = 0; the rotors are the game's.
    for side in (-1, 1):
        hv.cstrut((side * 0.09, 0.0, -0.16), (side * 0.09, 0.0, 0.17), 0.012, 'charcoal', seg=4)
        for z in (-0.07, 0.07):
            hv.cstrut((side * 0.09, 0.0, z), (side * 0.06, 0.06, z), 0.008, 'charcoal', seg=4)
    hv.csphere(0.13, 0, 0.13, 0.02, 'hazard', seg=14, rings=10, sy=0.8)
    hv.cbox(0.2, 0.05, 0.24, 0, 0.12, 0.0, 'roofred', bevel=0.02)
    hv.csphere(0.09, 0, 0.15, 0.1, 'paleblue', seg=12, rings=8, sy=0.8)
    hv.cstrut((0, 0.15, -0.08), (0, 0.17, -0.4), 0.035, 'hazard', r_end=0.02, seg=8)
    hv.cbox(0.02, 0.11, 0.06, 0, 0.13, -0.39, 'roofred', bevel=0)
    hv.ccyl(0.025, 0.06, 0, 0.22, 0.02, 'charcoal', seg=8)


PARTS = {'tanker': tanker, 'helicopter': helicopter, 'crane': crane, 'pumpjack': pumpjack, 'radar': radar}
