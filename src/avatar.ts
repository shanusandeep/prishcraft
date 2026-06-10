import * as THREE from 'three';

export interface AvatarLook {
  body: number;
  legs: number;
  hair: number;
  /** floating name label above the head */
  name?: string;
  nameColor?: string;
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

function makeNameSprite(name: string, color: string): THREE.Sprite {
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
  sprite.scale.set(2.4, 0.6, 1);
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
  if (look.name) group.add(makeNameSprite(look.name, look.nameColor ?? '#5b4a78'));

  return { group, armL, armR, legL, legR };
}
