import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Sparkles } from '@react-three/drei';
import { useTour } from '../../context';
import { PHOTO_SLOTS, ROOM_BY_ID, type PhotoSlot } from '../../layout';
import type { ResolvedMedia } from '../../../lib/types';
import { CanvasText } from '../CanvasText';
import { Chandelier, GOLD, BRASS } from '../Architecture';
import { Plant } from '../Props';
import { wallWashTexture } from '../textures';

const R = ROOM_BY_ID.gallery;

/** Fit a photo of the given aspect into a square of `size` without cropping. */
export function fitPhoto(aspect: number, size: number) {
  return aspect >= 1 ? { w: size, h: size / aspect } : { w: size * aspect, h: size };
}

const loader = new THREE.TextureLoader();
loader.setCrossOrigin('anonymous');

function usePhotoTexture(url: string | undefined) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    let loaded: THREE.Texture | null = null;
    loader.load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        t.generateMipmaps = true;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        loaded = t;
        if (alive) setTex(t);
        else t.dispose();
      },
      undefined,
      () => alive && setTex(null),
    );
    return () => {
      alive = false;
      loaded?.dispose();
    };
  }, [url]);
  return tex;
}

export function PhotoFrame({ slot, media }: { slot: PhotoSlot; media?: ResolvedMedia }) {
  const tex = usePhotoTexture(media?.url);
  const img = tex?.image as { width?: number; height?: number } | undefined;
  const aspect = media?.width && media?.height ? media.width / media.height : img?.width && img?.height ? img.width / img.height : 4 / 5;
  const { w, h } = fitPhoto(aspect, slot.size * 0.78);
  const matB = slot.size * 0.07;
  const frameB = slot.size * 0.055;
  const W = w + matB * 2 + frameB * 2;
  const H = h + matB * 2 + frameB * 2;
  const gold = GOLD();
  const brass = BRASS();
  const photoMat = useMemo(
    () => (tex ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(0.93, 0.93, 0.93) }) : null),
    [tex],
  );
  useEffect(() => () => photoMat?.dispose(), [photoMat]);

  return (
    <group position={[slot.x, slot.y, slot.z]} rotation={[0, slot.rotY, 0]}>
      {/* wall wash from the picture light */}
      <mesh position={[0, H / 2 + 0.2 - (H + 1.2) / 2, -0.03]}>
        <planeGeometry args={[W * 1.7, H + 1.2]} />
        <meshBasicMaterial map={wallWashTexture()} color="#ffd9a0" transparent opacity={0.45} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      {/* frame: outer moulding + inner lip */}
      <mesh material={gold} position={[0, 0, 0.04]} castShadow>
        <boxGeometry args={[W, H, 0.08]} />
      </mesh>
      <mesh position={[0, 0, 0.082]}>
        <planeGeometry args={[W - frameB * 1.2, H - frameB * 1.2]} />
        <meshStandardMaterial color="#6b4a22" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* passe-partout */}
      <mesh position={[0, 0, 0.085]}>
        <planeGeometry args={[w + matB * 2, h + matB * 2]} />
        <meshStandardMaterial color="#fbf7f0" roughness={0.95} />
      </mesh>
      {photoMat ? (
        <mesh material={photoMat} position={[0, 0, 0.088]}>
          <planeGeometry args={[w, h]} />
        </mesh>
      ) : (
        <group position={[0, 0, 0.088]}>
          <mesh>
            <planeGeometry args={[w, h]} />
            <meshStandardMaterial color="#efe0dc" roughness={1} />
          </mesh>
          <CanvasText
            position={[0, 0, 0.002]}
            width={w * 0.8}
            px={600}
            lines={[
              { text: media ? 'Loading…' : `Memory ${slot.slot + 1}`, font: 'italic 64px "Cormorant Garamond"', color: '#a07a7a', gap: 8 },
              { text: media ? '' : 'waiting to be framed', font: '36px "Inter"', color: '#b89a9a' },
            ]}
          />
        </group>
      )}
      {/* picture light */}
      <group position={[0, H / 2 + 0.16, 0.12]}>
        <mesh material={brass} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.035, 0.035, Math.min(W * 0.6, 1.4), 12]} />
        </mesh>
        <mesh position={[0, -0.04, 0.02]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, Math.min(W * 0.58, 1.36), 8]} />
          <meshBasicMaterial color={new THREE.Color('#fff1d2').multiplyScalar(2.5)} toneMapped={false} />
        </mesh>
        <mesh material={brass} position={[0, 0.02, -0.08]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.16, 6]} />
        </mesh>
      </group>
      {/* caption plaque */}
      {media?.caption ? (
        <group position={[0, -H / 2 - 0.32, 0.02]}>
          <mesh material={brass}>
            <boxGeometry args={[Math.max(1.0, Math.min(2.2, W * 0.8)), 0.3, 0.02]} />
          </mesh>
          <CanvasText
            position={[0, 0, 0.012]}
            width={Math.max(0.95, Math.min(2.1, W * 0.78))}
            px={800}
            padding={6}
            lines={[{ text: media.caption, font: 'italic 600 54px "Cormorant Garamond"', color: '#2a1a10' }]}
          />
        </group>
      ) : null}
    </group>
  );
}

export function GalleryRoom() {
  const { photos } = useTour();
  const bySlot = useMemo(() => new Map(photos.map((p) => [p.slot, p])), [photos]);
  const cz = (R.z0 + R.z1) / 2;
  return (
    <group>
      {[-11, 0, 11].map((x) => (
        <pointLight key={x} position={[x, 5.4, cz]} intensity={24} distance={13} decay={1.6} color="#ffe6c4" />
      ))}
      {[-11.3, 0, 11.3].map((x) => (
        <Chandelier key={x} position={[x, R.height - 1.6, cz]} scale={0.85} drop={1.6} />
      ))}
      {PHOTO_SLOTS.map((s) => (
        <PhotoFrame key={s.slot} slot={s} media={bySlot.get(s.slot)} />
      ))}
      {/* long gallery runner */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, cz]}>
        <planeGeometry args={[30, 2.2]} />
        <meshStandardMaterial color="#c9a961" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, cz]}>
        <planeGeometry args={[29.8, 2.0]} />
        <meshStandardMaterial color="#5a6a56" roughness={0.95} />
      </mesh>
      <Plant position={[R.x0 + 0.8, 0, R.z1 - 0.8]} scale={0.9} />
      <Plant position={[R.x1 - 0.8, 0, R.z1 - 0.8]} scale={0.9} />
      <Sparkles count={50} scale={[32, 4, 6]} position={[0, 2.8, cz]} size={1.8} speed={0.2} color="#ffe2c8" opacity={0.5} />
    </group>
  );
}
