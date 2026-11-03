# Offshore Oil Refinery (4×4): a steel platform on legs in the sea, with
# storage tanks, distillation columns, pipe racks, crew quarters, a helipad,
# the flare stack, the drilling derrick and the crane's pedestal. Everything
# that moves (flame, smoke, drill, pumpjack, crane, radar, helicopter rotors,
# gulls) is the game's: quarryModels.ts, buildOilRefinery, mirrored here part
# for part. The tanker and the helicopter's body are models of their own.
import math

W = D = 4
DECK_Y = 0.28
HW = W / 2 - 0.18
HD = D / 2 - 0.18
TOP_Y = DECK_Y + 0.07
PROC_Y = TOP_Y + 0.05


def build(hv):
    # Legs into the sea, with yellow splash-zone collars, pontoons and braces.
    for sx in (-1, 1):
        for sz in (-1, 1):
            lx, lz = sx * (HW - 0.14), sz * (HD - 0.14)
            hv.ccyl(0.15, DECK_Y + 0.24, lx, -0.22, lz, 'deck', seg=12, r_top=0.13)
            hv.ccyl(0.18, 0.1, lx, 0.02, lz, 'hazard', seg=12)
        hv.ccyl(0.095, DECK_Y + 0.22, sx * (HW - 0.14), -0.2, 0, 'deck', seg=10, r_top=0.09)
        hv.ccyl(0.11, DECK_Y + 0.22, 0, -0.2, sx * (HD - 0.14), 'deck', seg=10, r_top=0.1)
        hv.cstrut((sx * (HW - 0.14), 0.07, -(D - 0.5) / 2), (sx * (HW - 0.14), 0.07, (D - 0.5) / 2), 0.11, 'roofred', seg=10)
        hv.cstrut((-(W - 0.6) / 2, 0.06, sx * (HD - 0.14)), ((W - 0.6) / 2, 0.24, sx * (HD - 0.14)), 0.025, 'slate', seg=4)
        hv.cstrut((sx * (HW - 0.14), 0.06, -(D - 0.6) / 2), (sx * (HW - 0.14), 0.24, (D - 0.6) / 2), 0.025, 'slate', seg=4)
    # The deck: a yellow rim round a grey plate, with railings.
    hv.cbox(W - 0.32, 0.05, D - 0.32, 0, DECK_Y, 0, 'hazard', bevel=0.015)
    hv.cbox(W - 0.42, 0.04, D - 0.42, 0, DECK_Y + 0.03, 0, 'deck', bevel=0.008)
    for side in (-1, 1):
        hv.cbox(W - 0.38, 0.02, 0.02, 0, TOP_Y + 0.08, side * (HD - 0.03), 'steel', bevel=0)
        hv.cbox(0.02, 0.02, D - 0.38, side * (HW - 0.03), TOP_Y + 0.08, 0, 'steel', bevel=0)
        for k in range(9):
            t = -1.7 + k * 0.425
            hv.cbox(0.015, 0.09, 0.015, t, TOP_Y, side * (HD - 0.03), 'steel', bevel=0)
            hv.cbox(0.015, 0.09, 0.015, side * (HW - 0.03), TOP_Y, t, 'steel', bevel=0)
    # Raised process deck on the left.
    hv.cbox(W * 0.44, 0.05, D * 0.78, -W * 0.22, TOP_Y, -D * 0.04, 'slate2', bevel=0.01)
    # Storage tanks with red bands and shallow cone roofs.
    for tx, tz, r, h in ((-1.15, 0.85, 0.38, 0.52), (-1.15, 0.0, 0.34, 0.46), (-0.48, 0.78, 0.26, 0.42)):
        hv.ccyl(r, h, tx, PROC_Y, tz, 'snow', seg=18)
        hv.ccyl(r + 0.01, 0.07, tx, PROC_Y + h * 0.62, tz, 'roofred', seg=18, bevel=0)
        hv.ccyl(r + 0.02, 0.1, tx, PROC_Y + h, tz, 'pipe', seg=18, r_top=0.03)
        hv.cstrut((tx + r, PROC_Y, tz), (tx + r * 0.7, PROC_Y + h, tz - r * 0.7), 0.01, 'charcoal', seg=4)  # ladder
    # Spherical pressure tanks on legs.
    for sz in (0.1, 0.58):
        hv.csphere(0.2, -0.48, PROC_Y + 0.28, sz, 'snow', seg=14, rings=10)
        hv.ctorus(0.2, 0.015, -0.48, PROC_Y + 0.28, sz, 'roofred', axis='y', seg=16, ring=4)
        for lx, lz in ((-0.1, -0.1), (0.1, -0.1), (-0.1, 0.1), (0.1, 0.1)):
            hv.ccyl(0.015, 0.18, -0.48 + lx, PROC_Y, sz + lz, 'charcoal', seg=5)
    # Distillation columns with ring walkways.
    for cx, cz, r, h in ((-1.12, -0.82, 0.19, 1.45), (-0.55, -0.82, 0.16, 1.22)):
        hv.ccyl(r, h, cx, PROC_Y, cz, 'pipe', seg=14, r_top=r * 0.92)
        hv.csphere(r * 0.92, cx, PROC_Y + h, cz, 'pipe', seg=14, rings=8, sy=0.6)
        ring = 0.28
        while ring < h - 0.15:
            hv.ccyl(r + 0.05, 0.025, cx, PROC_Y + ring, cz, 'charcoal', seg=14, bevel=0)
            ring += 0.34
    # Pipe racks: three colored lines each way.
    for py, color in ((PROC_Y + 0.32, 'hazard'), (PROC_Y + 0.4, 'roofred'), (PROC_Y + 0.48, 'steel')):
        hv.cstrut((-0.82, py, -0.82), (-0.82, py, 0.82), 0.025, color, seg=8)
        hv.cstrut((-0.87, py, -0.82), (0.47, py, -0.82), 0.025, color, seg=8)
    for x, z in ((-0.82, -0.6), (-0.82, 0.6), (0.3, -0.82)):
        hv.cstrut((x, PROC_Y, z), (x, PROC_Y + 0.5, z), 0.015, 'charcoal', seg=4)
    # Crew quarters and control block, with bridge windows and a radar mast.
    qx, qz = 1.05, -0.25
    hv.cbox(0.88, 0.34, 0.78, qx, TOP_Y, qz, 'snow', bevel=0.015)
    for z in (-0.2, 0.0, 0.2):
        hv.cbox(0.02, 0.1, 0.12, qx + 0.45, TOP_Y + 0.14, qz + z, 'glass', bevel=0)
    hv.cbox(0.9, 0.05, 0.8, qx, TOP_Y + 0.34, qz, 'orange', bevel=0.01)
    hv.cbox(0.72, 0.26, 0.62, qx, TOP_Y + 0.39, qz, 'snow', bevel=0.015)
    hv.cbox(0.76, 0.05, 0.66, qx, TOP_Y + 0.65, qz, 'roofblue', bevel=0.01)
    hv.cbox(0.56, 0.1, 0.02, qx, TOP_Y + 0.48, qz + 0.31, 'paleblue', bevel=0)
    hv.cbox(0.02, 0.1, 0.46, qx + 0.36, TOP_Y + 0.48, qz, 'paleblue', bevel=0)
    hv.cbox(0.2, 0.3, 0.02, qx - 0.2, TOP_Y, qz + 0.395, 'navy', bevel=0)  # door
    hv.ccyl(0.025, 0.22, qx, TOP_Y + 0.7, qz, 'steel', seg=6)
    # Helipad on a cantilever at the front right.
    hx, hz = 1.18, 1.12
    heli_y = TOP_Y + 0.24
    hv.cbox(0.12, 0.24, 0.12, hx - 0.18, TOP_Y, hz - 0.18, 'charcoal', bevel=0)
    hv.ccyl(0.56, 0.04, hx, heli_y, hz, 'deck', seg=8)
    hv.ctorus(0.4, 0.018, hx, heli_y + 0.045, hz, 'hazard', axis='y', seg=20, ring=4)
    for dx in (-0.12, 0.12):
        hv.cbox(0.05, 0.008, 0.26, hx + dx, heli_y + 0.04, hz, 'white', bevel=0)
    hv.cbox(0.24, 0.008, 0.05, hx, heli_y + 0.04, hz, 'white', bevel=0)
    for i in range(8):
        a = i / 8 * math.pi * 2 + math.pi / 8
        hv.csphere(0.022, hx + math.cos(a) * 0.5, heli_y + 0.055, hz + math.sin(a) * 0.5, 'lamp', seg=6, rings=4)
    # Flare stack at the back-left corner (the flame is the game's).
    fx, fz, fh = -1.42, -1.42, 1.95
    hv.ccyl(0.09, fh, fx, PROC_Y, fz, 'slate', seg=10, r_top=0.045)
    hv.ccyl(0.06, 0.14, fx, PROC_Y + fh - 0.18, fz, 'roofred', seg=10)
    hv.ccyl(0.06, 0.08, fx, PROC_Y + fh, fz, 'black', seg=10, r_top=0.05)
    for k in range(3):  # guy-wire struts
        a = k / 3 * math.pi * 2
        hv.cstrut((fx + math.cos(a) * 0.3, PROC_Y, fz + math.sin(a) * 0.3), (fx, PROC_Y + 1.1, fz), 0.008, 'charcoal', seg=4)
    # Drilling derrick: a tapering red lattice tower (drill and hoist move).
    dx, dz, dh = 0.22, -1.05, 1.55
    hv.cbox(0.72, 0.06, 0.72, dx, TOP_Y, dz, 'charcoal', bevel=0.01)
    for sx in (-1, 1):
        for sz in (-1, 1):
            hv.cstrut((dx + sx * 0.3, TOP_Y + 0.06, dz + sz * 0.3), (dx + sx * 0.1, TOP_Y + dh, dz + sz * 0.1), 0.028, 'roofred', seg=6)
    for y, span in ((0.45, 0.44), (0.9, 0.34), (1.35, 0.24)):
        for side in (-1, 1):
            hv.cbox(span, 0.025, 0.025, dx, TOP_Y + y, dz + side * (span / 2), 'white', bevel=0)
            hv.cbox(0.025, 0.025, span, dx + side * (span / 2), TOP_Y + y, dz, 'white', bevel=0)
    hv.cbox(0.28, 0.08, 0.28, dx, TOP_Y + dh, dz, 'hazard', bevel=0.01)
    # Pumpjack base, its post and the wellhead (the beam nods in the game).
    px, pz = 0.22, -0.05
    hv.cbox(0.32, 0.04, 0.72, px, TOP_Y, pz, 'charcoal', bevel=0)
    hv.cbox(0.1, 0.42, 0.08, px, TOP_Y + 0.04, pz, 'black', bevel=0)
    hv.ccyl(0.055, 0.14, px, TOP_Y + 0.04, pz + 0.26, 'roofred', seg=8, r_top=0.045)
    # The crane's pedestal (the crane turns in the game).
    hv.ccyl(0.15, 0.32, -0.18, TOP_Y, 1.38, 'hazard', seg=12, r_top=0.12)
    # Lifeboats on davits at the left edge.
    for z in (0.3, 1.0):
        hv.cbox(0.14, 0.12, 0.42, -1.86, TOP_Y - 0.02, z, 'orange', bevel=0.03)


def tanker(hv):
    # Bow at +z, keel at y = 0 (the game sails it round its loop).
    outline = [(-0.22, -0.66), (0.22, -0.66), (0.22, 0.52), (0.1, 0.84), (0, 0.9), (-0.1, 0.84), (-0.22, 0.52)]
    hv.cslab(outline, 0, 0.14, 'roofred', bevel=0.02)
    hv.cslab([(x * 1.03, z * 1.01) for x, z in outline], -0.005, 0.04, 'black', bevel=0)  # waterline, just proud of the hull
    hv.cslab([(x * 0.92, z * 0.97) for x, z in outline], 0.14, 0.03, 'deck', bevel=0)
    for z in (-0.15, 0.18, 0.5):
        hv.ccyl(0.13, 0.07, 0, 0.17, z, 'hazard', seg=14)
    hv.cstrut((0, 0.22, -0.3), (0, 0.22, 0.66), 0.018, 'pipe', seg=6)
    # Bridge at the stern, with windows and a funnel.
    hv.cbox(0.36, 0.2, 0.3, 0, 0.17, -0.48, 'snow', bevel=0.015)
    hv.cbox(0.3, 0.1, 0.24, 0, 0.37, -0.5, 'snow', bevel=0.012)
    hv.cbox(0.37, 0.05, 0.02, 0, 0.29, -0.32, 'glassdark', bevel=0)
    hv.cbox(0.31, 0.04, 0.02, 0, 0.42, -0.37, 'glassdark', bevel=0)
    hv.ccyl(0.05, 0.18, 0, 0.47, -0.56, 'hazard', seg=10, r_top=0.045)
    hv.ccyl(0.052, 0.04, 0, 0.65, -0.56, 'black', seg=10)


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


PARTS = {'tanker': tanker, 'helicopter': helicopter}
