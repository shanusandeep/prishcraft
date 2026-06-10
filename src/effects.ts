import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
}

/** Tiny cube confetti when a block breaks — cheap and very satisfying. */
export class Particles {
  private items: Particle[] = [];
  private geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);

  constructor(private scene: THREE.Scene) {}

  burst(x: number, y: number, z: number, color: number, count = 10): void {
    const mat = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.position.set(
        x + (Math.random() - 0.5) * 0.6,
        y + (Math.random() - 0.5) * 0.6,
        z + (Math.random() - 0.5) * 0.6,
      );
      this.scene.add(mesh);
      this.items.push({
        mesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4 + 1, (Math.random() - 0.5) * 4),
        life: 0.5 + Math.random() * 0.25,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.items.splice(i, 1);
        continue;
      }
      p.vel.y -= 12 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const s = Math.min(1, p.life * 3);
      p.mesh.scale.setScalar(s);
    }
  }
}
