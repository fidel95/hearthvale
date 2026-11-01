import * as THREE from 'three'
import { tileToWorld, type Tile } from './grid'

// Colored squares on single tiles, each with a bright border, so you can see
// exactly which tiles something will take while placing it: green where a
// tile is free, red where it isn't. One instanced mesh, grown as needed.

const CELL = 0.94 // a hair smaller than a tile, so neighbors show their borders

// A white square with a solid border and a see-through middle; each cell's
// instance color tints it.
function cellTexture(): THREE.Texture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')!
  g.fillStyle = 'rgba(255,255,255,0.45)'
  g.fillRect(0, 0, size, size)
  g.strokeStyle = 'rgba(255,255,255,1)'
  g.lineWidth = 7
  g.strokeRect(3.5, 3.5, size - 7, size - 7)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export interface Cell {
  tile: Tile
  color: string
}

export class TileCells {
  private scene: THREE.Scene
  private geometry = new THREE.PlaneGeometry(CELL, CELL).rotateX(-Math.PI / 2)
  // Drawn over everything, so a red tile under a building still shows.
  private material = new THREE.MeshBasicMaterial({ map: cellTexture(), transparent: true, depthWrite: false, depthTest: false })
  private mesh: THREE.InstancedMesh
  private color = new THREE.Color()
  private matrix = new THREE.Matrix4()
  private y: number

  constructor(scene: THREE.Scene, y = 0.03) {
    this.scene = scene
    this.y = y
    this.mesh = this.create(16)
  }

  private create(capacity: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity)
    mesh.count = 0
    mesh.frustumCulled = false
    mesh.renderOrder = 10
    this.scene.add(mesh)
    return mesh
  }

  show(cells: Cell[]) {
    if (cells.length > this.mesh.instanceMatrix.count) {
      this.scene.remove(this.mesh)
      this.mesh.dispose()
      this.mesh = this.create(Math.max(cells.length, this.mesh.instanceMatrix.count * 2))
    }
    cells.forEach((c, i) => {
      const p = tileToWorld(c.tile)
      this.mesh.setMatrixAt(i, this.matrix.makeTranslation(p.x, this.y, p.z))
      this.mesh.setColorAt(i, this.color.set(c.color))
    })
    this.mesh.count = cells.length
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  clear() {
    this.mesh.count = 0
  }
}
