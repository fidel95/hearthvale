# Builds Hearthvale's own models: each script in models/ makes one building
# with the kit in hv.py, and this writes it to public/models/hearthvale/.
#
#   npm run models                 every model
#   npm run models -- town-hall    just these
#   npm run models -- --preview out.png town-hall school
#                                  also render them side by side to a picture
#   (add --preview-only to render the built ones without building again)
#
# (npm run models finds Blender: scripts/blender.mjs.)

import importlib.util
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import hv  # noqa: E402

OUT = os.path.join(HERE, '..', '..', 'public', 'models', 'hearthvale')
MODELS = os.path.join(HERE, 'models')


def load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(MODELS, name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def preview(names, path):
    import bpy

    bpy.ops.wm.read_factory_settings(use_empty=True)
    # Lined up along the camera's left-to-right, 3.2 apart.
    yaw = math.radians(41)
    across = (math.cos(yaw), math.sin(yaw))
    gap = 3.2
    for i, name in enumerate(names):
        bpy.ops.import_scene.gltf(filepath=os.path.join(OUT, name + '.glb'))
        for o in bpy.context.selected_objects:
            if o.parent is None:
                o.location.x += across[0] * gap * i
                o.location.y += across[1] * gap * i
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x, scene.render.resolution_y = 520 * max(1, len(names)), 560
    world = bpy.data.worlds.new('sky')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.62, 0.8, 0.92, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
    scene.world = world
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3.2
    sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(35))
    scene.collection.objects.link(sun)
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.001))
    grass = bpy.data.materials.new('grass')
    grass.use_nodes = True
    grass.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.3, 0.6, 0.25, 1)
    bpy.context.object.data.materials.append(grass)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = gap * len(names) + 0.4
    mid = gap * (len(names) - 1) / 2
    cx, cy = across[0] * mid, across[1] * mid
    # The game's view: looking down from the front-right.
    d = 20
    cam.rotation_euler = (math.radians(55), 0, yaw)
    look = (-math.sin(yaw) * math.sin(math.radians(55)), math.cos(yaw) * math.sin(math.radians(55)), -math.cos(math.radians(55)))
    cam.location = (cx - look[0] * d, cy - look[1] * d, 0.5 - look[2] * d)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    shot = None
    if '--preview' in args:
        i = args.index('--preview')
        shot = args[i + 1]
        del args[i:i + 2]
    only_preview = '--preview-only' in args
    if only_preview:
        args.remove('--preview-only')
    names = args or sorted(f[:-3] for f in os.listdir(MODELS) if f.endswith('.py'))
    os.makedirs(OUT, exist_ok=True)
    for name in [] if only_preview else names:
        module = load(name)
        hv.reset()
        module.build(hv)
        hv.export(os.path.join(OUT, name + '.glb'))
        print(f'built {name}')
        # Moving parts, each its own file (name.part.glb), modelled about the
        # point the game moves it around.
        for part, make in getattr(module, 'PARTS', {}).items():
            hv.reset()
            make(hv)
            hv.export(os.path.join(OUT, f'{name}.{part}.glb'))
            print(f'built {name}.{part}')
    if shot:
        preview(names, shot)
        print(f'preview {shot}')


main()
