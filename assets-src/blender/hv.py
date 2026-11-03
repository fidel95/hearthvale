# Hearthvale's modelling kit for Blender: the shapes our buildings are made
# of, in the same style as the Kenney kits the rest of the town uses.
#
# The style, so everything sits together:
# - One shared palette texture (palette.png, a grid of color swatches). Every
#   surface samples one swatch, so a whole building is one material and draws
#   in one go, like Kenney's colormap.png. The palette starts with Kenney's
#   City Kit colors, so our walls and roofs match theirs.
# - Chunky shapes with softly bevelled edges, dark trim bands, roofs that
#   overhang, windows in dark frames with blue glass.
# - Sizes in tiles: a 3×3 building is about 2.7 wide. Blender's Z is up, and
#   the front faces −Y (which becomes the game's +Z, toward the camera).
#
# Every helper takes positions as the center of the part's base (x, y, z).

import math

import bmesh
import bpy

# ---- The palette: name → color. Each gets a swatch (16 across, 4 down) with
# a gentle light-to-dark gradient from top to bottom, like Kenney's.
COLORS = {
    # Kenney City Kit (Commercial) colors
    'green': '#61cb8b', 'yellow': '#ffc044', 'orange': '#ff7e44', 'red': '#cf534f',
    'blue': '#6794d9', 'skyblue': '#d0e8ff', 'purple': '#a878e8', 'pink': '#f378f0',
    'steel': '#868ba1', 'charcoal': '#4f5260', 'lavender': '#a0a8c9', 'white': '#ffffff',
    'salmon': '#f1976c', 'brown': '#b06041', 'peach': '#f2bf99', 'cream': '#fde4c7',
    'terracotta': '#cf735b', 'apricot': '#faae8a', 'black': '#3a3c3f', 'slate': '#515566',
    'slate2': '#666b80', 'bluegray': '#8e95b3', 'ink': '#38383d', 'leaf': '#3da679',
    # Extras for our buildings
    'glass': '#5b8fd6', 'glassdark': '#3e5f96', 'brick': '#b9503e', 'brickdark': '#8f3b30',
    'wood': '#9a6a43', 'wooddark': '#6e4a2f', 'stone': '#c9c3b6', 'stonedark': '#a39d91',
    'concrete': '#b8bcc4', 'asphalt': '#5a5e66', 'roofred': '#c8463a', 'roofblue': '#3f6fc4',
    'roofgreen': '#3f9a6a', 'roofgray': '#6d7380', 'gold': '#f2c14e', 'firered': '#d83a33',
    'navy': '#2f4f8a', 'mint': '#cdeee0', 'butter': '#ffe9b0', 'snow': '#f6f7fb',
    'lilac': '#e3d8ff', 'lightwood': '#d8a86a', 'grass': '#5cb85c', 'hedge': '#3f9a4f',
    'sand': '#ecd9a8', 'rust': '#b8642e', 'light': '#fff6c8', 'teal': '#2fae8f',
}
NAMES = list(COLORS)
COLS, ROWS = 16, 4
SIZE = 512


def _rgb(hex_color):
    h = hex_color.lstrip('#')
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]


def palette_image():
    """The palette as a Blender image (packed, so it goes into each .glb)."""
    image = bpy.data.images.get('hearthvale-palette')
    if image:
        return image
    image = bpy.data.images.new('hearthvale-palette', SIZE, SIZE, alpha=False)
    sw, sh = SIZE // COLS, SIZE // ROWS
    pixels = [0.0] * (SIZE * SIZE * 4)
    for i, name in enumerate(NAMES):
        col, row = i % COLS, i // COLS
        r, g, b = _rgb(COLORS[name])
        for y in range(sh):
            t = y / (sh - 1)  # 0 at the swatch's bottom, 1 at its top
            k = 0.9 + 0.14 * t  # a little darker at the bottom, lighter at the top
            px = [min(1, r * k), min(1, g * k), min(1, b * k), 1]
            # Blender's image rows count from the bottom; row 0 is the top of the picture.
            yy = SIZE - (row + 1) * sh + y
            for x in range(col * sw, (col + 1) * sw):
                j = (yy * SIZE + x) * 4
                pixels[j:j + 4] = px
    image.pixels = pixels
    image.pack()
    return image


def material():
    m = bpy.data.materials.get('hearthvale')
    if m:
        return m
    m = bpy.data.materials.new('hearthvale')
    m.use_nodes = True
    nodes = m.node_tree.nodes
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Metallic'].default_value = 0
    bsdf.inputs['Roughness'].default_value = 0.85
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = palette_image()
    tex.interpolation = 'Closest'
    m.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    return m


def _swatch_uv(color, t=0.5):
    """Where a color sits in the palette: u across, v up (t: 0 bottom of the swatch, 1 top)."""
    i = NAMES.index(color)
    col, row = i % COLS, i // COLS
    u = (col + 0.5) / COLS
    top = 1 - row / ROWS - 0.01
    bottom = 1 - (row + 1) / ROWS + 0.01
    return u, bottom + (top - bottom) * t


# ---- Building up a model

_parts = []


def reset():
    """Start a new model: an empty scene."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _parts.clear()


def _finish_part(obj, color, bevel, gradient):
    obj.data.materials.append(material())
    # Small parts stay sharp: a bevel there costs vertices nobody can see.
    dims = obj.dimensions
    if bevel > 0 and min(dims) >= 0.06:
        mod = obj.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(40)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier='bevel')
    # Every face samples its color's swatch; with a gradient, by height.
    me = obj.data
    uv = me.uv_layers.new(name='UVMap') if not me.uv_layers else me.uv_layers[0]
    zs = [v.co.z for v in me.vertices]
    zmin, zmax = min(zs), max(zs)
    for loop in me.loops:
        z = me.vertices[loop.vertex_index].co.z
        t = (z - zmin) / (zmax - zmin) if gradient and zmax > zmin else 0.55
        uv.data[loop.index].uv = _swatch_uv(color, t)
    _parts.append(obj)
    return obj


def _object_from_bmesh(bm, name):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def box(w, d, h, x=0, y=0, z=0, color='white', bevel=0.015, rz=0, gradient=False):
    """A box w (x) × d (y) × h (z), its base centered at (x, y, z)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(0, 0, h / 2), verts=bm.verts)
    obj = _object_from_bmesh(bm, 'box')
    obj.rotation_euler.z = rz
    obj.location = (x, y, z)
    _apply(obj)
    return _finish_part(obj, color, min(bevel, w / 3, d / 3, h / 3), gradient)


def cyl(r, h, x=0, y=0, z=0, color='white', seg=12, r_top=None, bevel=0.01, axis='Z', gradient=False):
    """A cylinder (or cone, with r_top) of radius r and height h standing on (x, y, z).
    axis 'X' or 'Y' lays it down along that axis, centered at (x, y, z)."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r_top is None else r_top, depth=h)
    if axis == 'Z':
        bmesh.ops.translate(bm, vec=(0, 0, h / 2), verts=bm.verts)
    obj = _object_from_bmesh(bm, 'cyl')
    if axis == 'X':
        obj.rotation_euler.y = math.pi / 2
    elif axis == 'Y':
        obj.rotation_euler.x = math.pi / 2
    obj.location = (x, y, z)
    _apply(obj)
    return _finish_part(obj, color, bevel if (r_top is None or r_top > 0) else 0, gradient)


def prism(points, depth, x=0, y=0, z=0, color='white', axis='X', bevel=0.01):
    """A shape extruded from a 2D outline: points (across, up) in the plane
    facing `axis`, extruded `depth` along it, centered on (x, y, z)."""
    bm = bmesh.new()
    n = len(points)
    front = [bm.verts.new((-depth / 2, a, b)) for a, b in points]
    back = [bm.verts.new((depth / 2, a, b)) for a, b in points]
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    for i in range(n):
        bm.faces.new([front[i], front[(i + 1) % n], back[(i + 1) % n], back[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = _object_from_bmesh(bm, 'prism')
    if axis == 'Y':
        obj.rotation_euler.z = math.pi / 2
    obj.location = (x, y, z)
    _apply(obj)
    return _finish_part(obj, color, bevel, False)


def gable_roof(w, d, h, x=0, y=0, z=0, color='roofred', gable='cream', overhang=0.08, thick=0.05, ridge='X'):
    """A pitched roof over a w × d wall top at height z: the triangular gable
    ends in `gable` color, and two roof slabs that overhang all round.
    ridge: which way the ridge runs."""
    across, along = (d, w) if ridge == 'X' else (w, d)
    half = across / 2
    # The attic: a triangular prism in the wall color.
    prism([(-half, 0), (half, 0), (0, h)], along, x, y, z, gable, axis='X' if ridge == 'X' else 'Y', bevel=0)
    # Two slabs lying on the slopes, from the ridge down past the eaves.
    pitch = math.atan2(h, half)
    for side in (-1, 1):
        dy, dz = side * math.cos(pitch), -math.sin(pitch)  # down the slope
        ny, nz = side * math.sin(pitch), math.cos(pitch)  # out of the roof
        top = (0.0, h)
        eave = (side * half + dy * overhang / math.cos(pitch), dz * overhang / math.cos(pitch))
        pts = [top, eave, (eave[0] + ny * thick, eave[1] + nz * thick), (top[0] + ny * thick, top[1] + nz * thick)]
        prism(pts, along + overhang * 2, x, y, z, color, axis='X' if ridge == 'X' else 'Y', bevel=0.008)
    # A ridge cap along the top.
    if ridge == 'X':
        cyl(thick * 0.9, along + overhang * 2, x, y, z + h + thick * 0.2, color, seg=8, axis='X', bevel=0)
    else:
        cyl(thick * 0.9, along + overhang * 2, x, y, z + h + thick * 0.2, color, seg=8, axis='Y', bevel=0)


def hip_roof(w, d, h, x=0, y=0, z=0, color='roofred', overhang=0.08):
    """A roof sloping on all four sides, over a w × d top at height z."""
    W, D = w / 2 + overhang, d / 2 + overhang
    ridge = max(0.0, (W - D)) if W > D else 0.0
    ridge_y = max(0.0, (D - W)) if D > W else 0.0
    bm = bmesh.new()
    base = [bm.verts.new(p) for p in ((-W, -D, 0), (W, -D, 0), (W, D, 0), (-W, D, 0))]
    if ridge > 0:
        top = [bm.verts.new((-ridge, 0, h)), bm.verts.new((ridge, 0, h))]
        bm.faces.new([base[0], base[1], top[1], top[0]])
        bm.faces.new([base[1], base[2], top[1]])
        bm.faces.new([base[2], base[3], top[0], top[1]])
        bm.faces.new([base[3], base[0], top[0]])
    elif ridge_y > 0:
        top = [bm.verts.new((0, -ridge_y, h)), bm.verts.new((0, ridge_y, h))]
        bm.faces.new([base[0], base[1], top[0]])
        bm.faces.new([base[1], base[2], top[1], top[0]])
        bm.faces.new([base[2], base[3], top[1]])
        bm.faces.new([base[3], base[0], top[0], top[1]])
    else:
        apex = bm.verts.new((0, 0, h))
        for i in range(4):
            bm.faces.new([base[i], base[(i + 1) % 4], apex])
    bm.faces.new(list(reversed(base)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = _object_from_bmesh(bm, 'hip')
    obj.location = (x, y, z)
    _apply(obj)
    _finish_part(obj, color, 0.01, False)
    # A thin eave board under the edge.
    box(w + overhang * 2, d + overhang * 2, 0.035, x, y, z - 0.03, color, bevel=0.01)


# ---- Facades: windows, doors, trim. `face` is the side they're on: '-y'
# (front), '+y' (back), '-x' (left), '+x' (right); `at` is that wall's
# position along its normal (e.g. −d/2 for the front of a box of depth d).

def _on_face(face, at, u, z, w, h, depth, color, bevel=0.012):
    if face in ('-y', '+y'):
        s = -1 if face == '-y' else 1
        return box(w, depth, h, u, at + s * depth / 2 - s * 0.01, z, color, bevel)
    s = -1 if face == '-x' else 1
    return box(depth, w, h, at + s * depth / 2 - s * 0.01, u, z, color, bevel)


def window(face, at, u, z, w=0.22, h=0.26, frame='charcoal', glass='glass', sill=True):
    """A window centered at u along the wall, its bottom at height z."""
    _on_face(face, at, u, z, w, h, 0.035, frame, 0.012)
    _on_face(face, at + (0.022 if face[0] == '+' else -0.022), u, z + 0.03, w - 0.06, h - 0.06, 0.02, glass, 0.004)
    if sill:
        _on_face(face, at, u, z - 0.025, w + 0.04, 0.03, 0.06, 'white', 0.008)


def windows(face, at, start, end, z, count, **kw):
    """A row of evenly spaced windows between start and end along the wall."""
    step = (end - start) / count
    for i in range(count):
        window(face, at, start + step * (i + 0.5), z, **kw)


def door(face, at, u, w=0.24, h=0.36, color='wooddark', frame='white', z=0):
    _on_face(face, at, u, z, w + 0.06, h + 0.04, 0.035, frame, 0.01)
    _on_face(face, at + (0.022 if face[0] == '+' else -0.022), u, z, w, h, 0.03, color, 0.006)
    # A little step out front.
    _on_face(face, at, u, z - 0.0, w + 0.12, 0.03, 0.12, 'stonedark', 0.008)


def trim(w, d, z, color='charcoal', h=0.05, out=0.025):
    """A band round a w × d block at height z, standing slightly proud of the walls."""
    box(w + out * 2, d + out * 2, h, 0, 0, z, color, bevel=0.01)


def block(w, d, h, x=0, y=0, z=0, wall='cream', base='charcoal', top='charcoal', parapet=True):
    """A building block: a dark plinth, walls, and a flat roof with a rim
    (Kenney's look). Returns the height of its roof."""
    box(w + 0.04, d + 0.04, 0.07, x, y, z, base, bevel=0.012)
    box(w, d, h, x, y, z, wall, bevel=0.02)
    if parapet:
        box(w + 0.06, d + 0.06, 0.07, x, y, z + h, top, bevel=0.015)
        box(w - 0.08, d - 0.08, 0.02, x, y, z + h + 0.05, 'slate2', bevel=0.0)
    return z + h


def ground(w, d, color='concrete', h=0.04):
    """A paved lot under the building."""
    box(w, d, h, 0, 0, 0, color, bevel=0.01)


# ---- Finishing

def _apply(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.select_set(False)


def export(path):
    """Join everything into one mesh with one material and write a .glb."""
    bpy.ops.object.select_all(action='DESELECT')
    for o in _parts:
        if o.name in bpy.data.objects:
            o.select_set(True)
    bpy.context.view_layer.objects.active = _parts[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = 'model'
    # Merge the materials every part brought along into the one.
    obj.data.materials.clear()
    obj.data.materials.append(material())
    for poly in obj.data.polygons:
        poly.material_index = 0
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials='EXPORT',
        export_image_format='AUTO',
    )
