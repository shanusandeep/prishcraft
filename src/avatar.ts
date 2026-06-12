import * as THREE from 'three';

export interface AvatarLook {
  body: number;
  legs: number;
  hair: number;
  /** floating name label above the head */
  name?: string;
  nameColor?: string;
  /** whole-body scale (e.g. 0.7 for a small elf) */
  scale?: number;
  /** big pointy ears */
  ears?: boolean;
  /** pointy wizard hat in this color */
  hat?: number;
}

export interface AvatarRig {
  group: THREE.Group;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
}

let faceTexture: THREE.CanvasTexture | null = null;

/** Draws a friendly face, shared by every character. */
function getFaceTexture(): THREE.CanvasTexture {
  if (faceTexture) return faceTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffe8d1';
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = '#4a3b66';
  ctx.fillRect(8, 12, 5, 6);
  ctx.fillRect(19, 12, 5, 6);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(9, 13, 2, 2);
  ctx.fillRect(20, 13, 2, 2);
  ctx.fillStyle = '#ffc4d0';
  ctx.fillRect(5, 19, 4, 3);
  ctx.fillRect(23, 19, 4, 3);
  ctx.fillStyle = '#4a3b66';
  ctx.fillRect(13, 23, 6, 2);
  ctx.fillRect(11, 21, 2, 2);
  ctx.fillRect(19, 21, 2, 2);
  faceTexture = new THREE.CanvasTexture(c);
  faceTexture.magFilter = THREE.NearestFilter;
  faceTexture.minFilter = THREE.NearestFilter;
  faceTexture.colorSpace = THREE.SRGBColorSpace;
  return faceTexture;
}

/** A floating text label (room names, NPC names). */
export function makeTextSprite(text: string, color: string, width = 2.4): THREE.Sprite {
  return makeNameSprite(text, color, width);
}

function makeNameSprite(name: string, color: string, width = 2.4): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.font = 'bold 34px "Chalkboard SE", "Comic Sans MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.strokeText(name, 128, 32);
  ctx.fillStyle = color;
  ctx.fillText(name, 128, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sprite.scale.set(width, width * 0.25, 1);
  sprite.position.y = 2.15;
  return sprite;
}

export function buildAvatar(look: AvatarLook): AvatarRig {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: look.body });
  const legMat = new THREE.MeshLambertMaterial({ color: look.legs });
  const cream = new THREE.MeshLambertMaterial({ color: 0xffe8d1 });
  const hairMat = new THREE.MeshLambertMaterial({ color: look.hair });
  const faceMat = new THREE.MeshLambertMaterial({ map: getFaceTexture() });

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.5, 0.55),
    // box material order: +x, -x, +y, -y, +z (front), -z
    [cream, cream, hairMat, cream, faceMat, hairMat],
  );
  head.position.y = 1.5;

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), bodyMat);
  body.position.y = 0.95;

  const limb = (w: number, len: number, mat: THREE.Material) => {
    const geo = new THREE.BoxGeometry(w, len, w);
    geo.translate(0, -len / 2, 0); // pivot at the top so limbs swing
    return new THREE.Mesh(geo, mat);
  };

  const armL = limb(0.16, 0.55, bodyMat);
  const armR = limb(0.16, 0.55, bodyMat);
  armL.position.set(-0.34, 1.22, 0);
  armR.position.set(0.34, 1.22, 0);

  const legL = limb(0.18, 0.62, legMat);
  const legR = limb(0.18, 0.62, legMat);
  legL.position.set(-0.13, 0.65, 0);
  legR.position.set(0.13, 0.65, 0);

  group.add(head, body, armL, armR, legL, legR);

  if (look.hat !== undefined) {
    const mat = new THREE.MeshLambertMaterial({ color: look.hat });
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.07, 0.74), mat);
    const mid = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.4), mat);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.22), mat);
    const point = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.1), mat);
    brim.position.y = 0.28;
    mid.position.y = 0.42;
    tip.position.set(0.03, 0.62, 0);
    point.position.set(0.07, 0.78, 0);
    point.rotation.z = -0.25;
    head.add(brim, mid, tip, point);
  }

  if (look.ears) {
    const earGeo = new THREE.BoxGeometry(0.08, 0.3, 0.14);
    const earL = new THREE.Mesh(earGeo, cream);
    const earR = new THREE.Mesh(earGeo, cream);
    earL.position.set(-0.32, 0.12, 0);
    earR.position.set(0.32, 0.12, 0);
    earL.rotation.z = 0.35;
    earR.rotation.z = -0.35;
    head.add(earL, earR);
  }

  if (look.name) group.add(makeNameSprite(look.name, look.nameColor ?? '#5b4a78'));
  if (look.scale) group.scale.setScalar(look.scale);

  return { group, armL, armR, legL, legR };
}
