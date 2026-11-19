import { Canvas } from '@react-three/fiber';
import { Avatar } from '../avatar/Avatar';
import type { AvatarConfig } from '../avatar/config';
import type { AnimName } from '../avatar/poses';

/** Small live 3D portrait of an avatar (used in dashboard, lobby, invite). */
export default function AvatarPreview({ config, anim = 'idle', className = '', full }: { config: AvatarConfig; anim?: AnimName; className?: string; full?: boolean }) {
  return (
    <div className={className}>
      <Canvas dpr={[1, 1.5]} camera={full ? { position: [0, 0.9, 3.4], fov: 32 } : { position: [0, 1.25, 1.5], fov: 30 }} onCreated={({ camera }) => camera.lookAt(0, full ? 0.8 : 1.2, 0)}>
        <ambientLight intensity={0.8} color="#ffe6ee" />
        <directionalLight position={[2, 3, 3]} intensity={2.2} color="#fff1dc" />
        <directionalLight position={[-3, 2, -2]} intensity={1.2} color="#ff9fb8" />
        <group rotation={[0, 0.3, 0]}>
          <Avatar config={config} anim={anim} shadow={false} />
        </group>
      </Canvas>
    </div>
  );
}
