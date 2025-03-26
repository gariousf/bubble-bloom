"use client"

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import { Color } from "three"

// Custom bubble shader with iridescence and glow
export function BubbleShader({ color = "#4A90E2", opacity = 1 }) {
  const materialRef = useRef()

  // Convert color string to THREE.Color
  const threeColor = useMemo(() => new Color(color), [color])

  // Update uniforms
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime()
      materialRef.current.uniforms.uOpacity.value = opacity
    }
  })

  // Shader code
  const shaderData = useMemo(
    () => ({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: threeColor },
        uOpacity: { value: opacity },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;
        
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uOpacity;
        
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;
        
        // Simplex noise function
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
        
        float snoise(vec2 v) {
          const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                             -0.577350269189626, 0.024390243902439);
          vec2 i  = floor(v + dot(v, C.yy));
          vec2 x0 = v - i + dot(i, C.xx);
          vec2 i1;
          i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;
          i = mod289(i);
          vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                + i.x + vec3(0.0, i1.x, 1.0));
          vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                                  dot(x12.zw, x12.zw)), 0.0);
          m = m * m;
          m = m * m;
          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
          vec3 g;
          g.x = a0.x * x0.x + h.x * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }
        
        void main() {
          // Fresnel effect for edge glow
          vec3 viewDirection = normalize(cameraPosition - vPosition);
          float fresnel = pow(1.0 - dot(viewDirection, vNormal), 3.0);
          
          // Noise pattern for iridescence
          vec2 noiseCoord = vUv * 5.0 + uTime * 0.1;
          float noise = snoise(noiseCoord) * 0.5 + 0.5;
          
          // Create iridescent color shift
          vec3 iridescence = vec3(
            0.5 + 0.5 * sin(noise * 6.28 + uTime),
            0.5 + 0.5 * sin(noise * 6.28 + uTime + 2.09),
            0.5 + 0.5 * sin(noise * 6.28 + uTime + 4.18)
          );
          
          // Blend base color with iridescence
          vec3 finalColor = mix(uColor, iridescence, fresnel * 0.6);
          
          // Add glow at edges
          finalColor += vec3(0.3, 0.3, 0.6) * pow(fresnel, 2.0);
          
          // Apply opacity
          gl_FragColor = vec4(finalColor, uOpacity * (0.3 + fresnel * 0.7));
        }
      `,
    }),
    [threeColor, opacity],
  )

  return <shaderMaterial ref={materialRef} args={[shaderData]} transparent depthWrite={false} toneMapped={false} />
}

