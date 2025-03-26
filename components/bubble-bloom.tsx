"use client"

import { useRef, useState, useEffect, useMemo } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera, Environment, Html } from "@react-three/drei"
import { Physics, useSphere } from "@react-three/cannon"
import { Vector3, Color } from "three"
import { EffectComposer, Bloom, ChromaticAberration } from "@react-three/postprocessing"
import { BlendFunction } from "postprocessing"
import { BubbleShader } from "./bubble-shader"

export default function BubbleBloom() {
  return (
    <Canvas shadows dpr={[1, 2]}>
      <color attach="background" args={["#000"]} />
      <fog attach="fog" args={["#000", 10, 40]} />
      <ambientLight intensity={0.2} />

      <PerspectiveCamera makeDefault position={[0, 0, 15]} fov={60} />

      <Environment preset="night" />

      <Physics
        gravity={[0, 0, 0]}
        defaultContactMaterial={{
          friction: 0.1,
          restitution: 0.9,
        }}
      >
        <BubbleBloomScene />
      </Physics>

      <EffectComposer>
        <Bloom intensity={1.5} luminanceThreshold={0.2} luminanceSmoothing={0.9} blendFunction={BlendFunction.SCREEN} />
        <ChromaticAberration
          offset={[0.0005, 0.0005]}
          blendFunction={BlendFunction.NORMAL}
          radialModulation={true}
          modulationOffset={0.5}
        />
      </EffectComposer>

      <OrbitControls enablePan={false} enableZoom={true} maxDistance={25} minDistance={5} rotateSpeed={0.5} />

      <Html position={[0, 0, 0]} center style={{ pointerEvents: "none" }}>
        <div className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
          <div className="absolute top-4 left-4 text-white/70 text-sm">
            Tap to create bubbles
            <br />
            Swipe to change gravity
          </div>
        </div>
      </Html>
    </Canvas>
  )
}

function BubbleBloomScene() {
  const { viewport, camera } = useThree()
  const [bubbles, setBubbles] = useState([])
  const [clusters, setClusters] = useState([])
  const [gravity, setGravity] = useState([0, 0, 0])
  const maxBubbles = 50
  const maxClusters = 10
  const nextBubbleId = useRef(0)
  const nextClusterId = useRef(0)
  const pointerDown = useRef(false)
  const pointerPosition = useRef([0, 0, 0])
  const lastPointerPosition = useRef([0, 0, 0])
  const gestureActive = useRef(false)

  // Handle pointer events
  useEffect(() => {
    const handlePointerDown = (e) => {
      pointerDown.current = true

      // Convert screen coordinates to world coordinates
      const x = (e.clientX / window.innerWidth) * 2 - 1
      const y = -(e.clientY / window.innerHeight) * 2 + 1

      // Project to 3D space
      const vector = new Vector3(x, y, 0.5)
      vector.unproject(camera)
      const dir = vector.sub(camera.position).normalize()
      const distance = -camera.position.z / dir.z
      const pos = camera.position.clone().add(dir.multiplyScalar(distance))

      pointerPosition.current = [pos.x, pos.y, pos.z]
      lastPointerPosition.current = [pos.x, pos.y, pos.z]

      // Create a burst of bubbles
      createBubbleBurst(pos.x, pos.y, pos.z)
    }

    const handlePointerMove = (e) => {
      if (!pointerDown.current) return

      // Convert screen coordinates to world coordinates
      const x = (e.clientX / window.innerWidth) * 2 - 1
      const y = -(e.clientY / window.innerHeight) * 2 + 1

      // Project to 3D space
      const vector = new Vector3(x, y, 0.5)
      vector.unproject(camera)
      const dir = vector.sub(camera.position).normalize()
      const distance = -camera.position.z / dir.z
      const pos = camera.position.clone().add(dir.multiplyScalar(distance))

      pointerPosition.current = [pos.x, pos.y, pos.z]

      // Calculate swipe direction and update gravity
      if (pointerDown.current) {
        const dx = pointerPosition.current[0] - lastPointerPosition.current[0]
        const dy = pointerPosition.current[1] - lastPointerPosition.current[1]

        // Only update gravity if the swipe is significant
        if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
          gestureActive.current = true
          setGravity([dx * 2, -dy * 2, 0])
        }
      }

      lastPointerPosition.current = [pos.x, pos.y, pos.z]
    }

    const handlePointerUp = () => {
      pointerDown.current = false

      // Reset gravity after a delay if it was a swipe gesture
      if (gestureActive.current) {
        setTimeout(() => {
          setGravity([0, 0, 0])
          gestureActive.current = false
        }, 1000)
      }
    }

    window.addEventListener("pointerdown", handlePointerDown)
    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown)
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [camera])

  // Create a burst of bubbles
  const createBubbleBurst = (x, y, z) => {
    const burstCount = Math.floor(Math.random() * 5) + 3
    const newBubbles = []

    for (let i = 0; i < burstCount; i++) {
      // Random position near the tap
      const offsetX = (Math.random() - 0.5) * 2
      const offsetY = (Math.random() - 0.5) * 2
      const offsetZ = (Math.random() - 0.5) * 2

      // Random size
      const size = Math.random() * 0.5 + 0.5

      // Random velocity
      const velX = (Math.random() - 0.5) * 2
      const velY = (Math.random() - 0.5) * 2
      const velZ = (Math.random() - 0.5) * 2

      // Random color from palette
      const colorIndex = Math.floor(Math.random() * BUBBLE_COLORS.length)
      const color = BUBBLE_COLORS[colorIndex]

      newBubbles.push({
        id: nextBubbleId.current++,
        position: [x + offsetX, y + offsetY, z + offsetZ],
        velocity: [velX, velY, velZ],
        size,
        color,
        age: 0,
        lifespan: Math.random() * 10 + 10, // 10-20 seconds
        clusterId: null,
        pulsatePhase: Math.random() * Math.PI * 2,
      })
    }

    setBubbles((prev) => {
      // Limit the number of bubbles
      const combined = [...prev, ...newBubbles]
      if (combined.length > maxBubbles) {
        return combined.slice(combined.length - maxBubbles)
      }
      return combined
    })
  }

  // Update bubbles and clusters
  useFrame((state, delta) => {
    // Update bubbles
    setBubbles((prev) => {
      return prev.map((bubble) => {
        // Skip if bubble is part of a cluster
        if (bubble.clusterId !== null) return bubble

        // Apply gravity
        const newVelX = bubble.velocity[0] + gravity[0] * delta
        const newVelY = bubble.velocity[1] + gravity[1] * delta
        const newVelZ = bubble.velocity[2] + gravity[2] * delta

        // Apply damping
        const damping = 0.98
        const newVelocity = [newVelX * damping, newVelY * damping, newVelZ * damping]

        // Update position
        const newPosition = [
          bubble.position[0] + newVelocity[0] * delta,
          bubble.position[1] + newVelocity[1] * delta,
          bubble.position[2] + newVelocity[2] * delta,
        ]

        // Update age
        const newAge = bubble.age + delta

        return {
          ...bubble,
          position: newPosition,
          velocity: newVelocity,
          age: newAge,
          size: bubble.size * (1 + Math.sin(state.clock.elapsedTime * 2 + bubble.pulsatePhase) * 0.05),
        }
      })
    })

    // Check for bubble collisions and form clusters
    const bubblesToCluster = []
    const clusterMap = {}

    // Group bubbles that are close to each other
    bubbles.forEach((bubble1, i) => {
      if (bubble1.clusterId !== null) return

      bubbles.forEach((bubble2, j) => {
        if (i === j || bubble2.clusterId !== null) return

        const dx = bubble1.position[0] - bubble2.position[0]
        const dy = bubble1.position[1] - bubble2.position[1]
        const dz = bubble1.position[2] - bubble2.position[2]
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

        // If bubbles are close enough, mark them for clustering
        if (distance < (bubble1.size + bubble2.size) * 1.5) {
          bubblesToCluster.push(bubble1.id)
          bubblesToCluster.push(bubble2.id)

          // Track which bubbles should be in the same cluster
          if (!clusterMap[bubble1.id]) clusterMap[bubble1.id] = []
          if (!clusterMap[bubble2.id]) clusterMap[bubble2.id] = []

          clusterMap[bubble1.id].push(bubble2.id)
          clusterMap[bubble2.id].push(bubble1.id)
        }
      })
    })

    // Create new clusters from colliding bubbles
    if (bubblesToCluster.length > 0 && clusters.length < maxClusters) {
      // Find connected components (bubbles that should form a single cluster)
      const visited = new Set()
      const components = []

      bubblesToCluster.forEach((bubbleId) => {
        if (visited.has(bubbleId)) return

        // BFS to find all connected bubbles
        const component = []
        const queue = [bubbleId]
        visited.add(bubbleId)

        while (queue.length > 0) {
          const current = queue.shift()
          component.push(current)

          if (clusterMap[current]) {
            clusterMap[current].forEach((neighbor) => {
              if (!visited.has(neighbor)) {
                visited.add(neighbor)
                queue.push(neighbor)
              }
            })
          }
        }

        if (component.length > 1) {
          components.push(component)
        }
      })

      // Create clusters from components
      components.forEach((component) => {
        const clusterBubbles = component.map((id) => bubbles.find((b) => b.id === id)).filter(Boolean)

        if (clusterBubbles.length > 1) {
          // Calculate average position and size
          let avgX = 0,
            avgY = 0,
            avgZ = 0,
            totalSize = 0
          const colors = []

          clusterBubbles.forEach((bubble) => {
            avgX += bubble.position[0]
            avgY += bubble.position[1]
            avgZ += bubble.position[2]
            totalSize += bubble.size
            colors.push(bubble.color)
          })

          avgX /= clusterBubbles.length
          avgY /= clusterBubbles.length
          avgZ /= clusterBubbles.length

          // Create a new cluster
          const clusterId = nextClusterId.current++
          const newCluster = {
            id: clusterId,
            position: [avgX, avgY, avgZ],
            velocity: [0, 0, 0],
            size: totalSize * 0.8, // Slightly smaller than sum of parts
            colors,
            bubbleCount: clusterBubbles.length,
            age: 0,
            lifespan: Math.random() * 15 + 15, // 15-30 seconds
            pulsatePhase: Math.random() * Math.PI * 2,
            bubbleIds: component,
          }

          setClusters((prev) => [...prev, newCluster])

          // Mark bubbles as part of the cluster
          setBubbles((prev) =>
            prev.map((bubble) => (component.includes(bubble.id) ? { ...bubble, clusterId } : bubble)),
          )
        }
      })
    }

    // Update clusters
    setClusters((prev) => {
      return prev.map((cluster) => {
        // Apply gravity
        const newVelX = cluster.velocity[0] + gravity[0] * delta * 0.5
        const newVelY = cluster.velocity[1] + gravity[1] * delta * 0.5
        const newVelZ = cluster.velocity[2] + gravity[2] * delta * 0.5

        // Apply damping
        const damping = 0.95
        const newVelocity = [newVelX * damping, newVelY * damping, newVelZ * damping]

        // Update position
        const newPosition = [
          cluster.position[0] + newVelocity[0] * delta,
          cluster.position[1] + newVelocity[1] * delta,
          cluster.position[2] + newVelocity[2] * delta,
        ]

        // Update age
        const newAge = cluster.age + delta

        // Pulsate size
        const pulsateAmount = 0.05 + (cluster.bubbleCount / 10) * 0.05
        const newSize =
          cluster.size * (1 + Math.sin(state.clock.elapsedTime * 1.5 + cluster.pulsatePhase) * pulsateAmount)

        return {
          ...cluster,
          position: newPosition,
          velocity: newVelocity,
          age: newAge,
          size: newSize,
        }
      })
    })

    // Check for cluster collapse
    setClusters((prev) => {
      const collapsedIds = []

      prev.forEach((cluster) => {
        // Clusters collapse when they reach a certain age or size
        if (cluster.age > cluster.lifespan || cluster.bubbleCount > 10) {
          collapsedIds.push(cluster.id)

          // Create splash effect at cluster position
          createSplashEffect(
            cluster.position[0],
            cluster.position[1],
            cluster.position[2],
            cluster.size,
            cluster.colors,
          )
        }
      })

      // Remove collapsed clusters
      if (collapsedIds.length > 0) {
        // Free bubbles from collapsed clusters
        setBubbles((prev) =>
          prev.map((bubble) => (collapsedIds.includes(bubble.clusterId) ? { ...bubble, clusterId: null } : bubble)),
        )

        return prev.filter((cluster) => !collapsedIds.includes(cluster.id))
      }

      return prev
    })

    // Remove old bubbles
    setBubbles((prev) => prev.filter((bubble) => bubble.age < bubble.lifespan))
  })

  // Create splash effect when clusters collapse
  const createSplashEffect = (x, y, z, size, colors) => {
    const splashCount = Math.floor(size * 3) + 5
    const newBubbles = []

    for (let i = 0; i < splashCount; i++) {
      // Radial burst pattern
      const angle1 = Math.random() * Math.PI * 2
      const angle2 = Math.random() * Math.PI * 2
      const radius = Math.random() * size * 2

      const offsetX = Math.sin(angle1) * Math.cos(angle2) * radius
      const offsetY = Math.sin(angle1) * Math.sin(angle2) * radius
      const offsetZ = Math.cos(angle1) * radius

      // Random size
      const bubbleSize = Math.random() * 0.4 + 0.2

      // Velocity away from center
      const speed = Math.random() * 3 + 1
      const velX = (offsetX * speed) / radius
      const velY = (offsetY * speed) / radius
      const velZ = (offsetZ * speed) / radius

      // Random color from the cluster's colors
      const colorIndex = Math.floor(Math.random() * colors.length)
      const color = colors[colorIndex]

      newBubbles.push({
        id: nextBubbleId.current++,
        position: [x + offsetX * 0.2, y + offsetY * 0.2, z + offsetZ * 0.2],
        velocity: [velX, velY, velZ],
        size: bubbleSize,
        color,
        age: 0,
        lifespan: Math.random() * 5 + 5, // 5-10 seconds
        clusterId: null,
        pulsatePhase: Math.random() * Math.PI * 2,
      })
    }

    setBubbles((prev) => {
      // Limit the number of bubbles
      const combined = [...prev, ...newBubbles]
      if (combined.length > maxBubbles) {
        return combined.slice(combined.length - maxBubbles)
      }
      return combined
    })
  }

  return (
    <>
      {/* Render individual bubbles */}
      {bubbles.map(
        (bubble) =>
          bubble.clusterId === null && (
            <Bubble
              key={bubble.id}
              position={bubble.position}
              size={bubble.size}
              color={bubble.color}
              age={bubble.age}
              lifespan={bubble.lifespan}
            />
          ),
      )}

      {/* Render clusters */}
      {clusters.map((cluster) => (
        <BubbleCluster
          key={cluster.id}
          position={cluster.position}
          size={cluster.size}
          colors={cluster.colors}
          bubbleCount={cluster.bubbleCount}
          age={cluster.age}
          lifespan={cluster.lifespan}
        />
      ))}
    </>
  )
}

// Individual bubble component
function Bubble({ position, size, color, age, lifespan }) {
  const meshRef = useRef()
  const [sphereRef, api] = useSphere(() => ({
    args: [size],
    mass: size,
    position,
    linearDamping: 0.9,
  }))

  // Fade in/out based on age
  const opacity = useMemo(() => {
    if (age < 1) return age // Fade in
    if (age > lifespan - 1) return lifespan - age // Fade out
    return 1
  }, [age, lifespan])

  // Pulsating animation
  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.getElapsedTime()
      meshRef.current.scale.x = 1 + Math.sin(t * 2) * 0.05
      meshRef.current.scale.y = 1 + Math.sin(t * 2) * 0.05
      meshRef.current.scale.z = 1 + Math.sin(t * 2) * 0.05
    }
  })

  return (
    <mesh ref={sphereRef}>
      <mesh ref={meshRef} scale={[size, size, size]}>
        <sphereGeometry args={[1, 32, 32]} />
        <BubbleShader color={color} opacity={opacity} />
      </mesh>
    </mesh>
  )
}

// Bubble cluster component
function BubbleCluster({ position, size, colors, bubbleCount, age, lifespan }) {
  const groupRef = useRef()
  const [sphereRef, api] = useSphere(() => ({
    args: [size],
    mass: size * 2,
    position,
    linearDamping: 0.95,
  }))

  // Generate a blended color from all bubbles in the cluster
  const blendedColor = useMemo(() => {
    if (colors.length === 0) return "#8A2BE2" // Default color

    // Average the colors
    let r = 0,
      g = 0,
      b = 0
    colors.forEach((colorStr) => {
      const color = new Color(colorStr)
      r += color.r
      g += color.g
      b += color.b
    })

    r /= colors.length
    g /= colors.length
    b /= colors.length

    return new Color(r, g, b).getStyle()
  }, [colors])

  // Fade in/out based on age
  const opacity = useMemo(() => {
    if (age < 1) return age // Fade in
    if (age > lifespan - 1) return lifespan - age // Fade out
    return 1
  }, [age, lifespan])

  // Create mini-bubbles for the cluster
  const miniBubbles = useMemo(() => {
    const bubbles = []
    const count = Math.min(bubbleCount, 10) // Limit for performance

    for (let i = 0; i < count; i++) {
      const angle1 = Math.random() * Math.PI * 2
      const angle2 = Math.random() * Math.PI * 2
      const radius = Math.random() * size * 0.8

      const x = Math.sin(angle1) * Math.cos(angle2) * radius
      const y = Math.sin(angle1) * Math.sin(angle2) * radius
      const z = Math.cos(angle1) * radius

      const bubbleSize = Math.random() * 0.3 + 0.2

      // Random color from the cluster's colors
      const colorIndex = Math.floor(Math.random() * colors.length)
      const color = colors[colorIndex]

      bubbles.push({
        position: [x, y, z],
        size: bubbleSize,
        color,
      })
    }

    return bubbles
  }, [bubbleCount, size, colors])

  // Animate the cluster
  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.getElapsedTime()

      // Rotate slowly
      groupRef.current.rotation.x = Math.sin(t * 0.2) * 0.1
      groupRef.current.rotation.y = Math.sin(t * 0.3) * 0.1

      // Pulsate
      const pulse = 1 + Math.sin(t) * 0.05
      groupRef.current.scale.set(pulse, pulse, pulse)
    }
  })

  return (
    <group ref={sphereRef}>
      <group ref={groupRef}>
        {/* Main cluster body */}
        <mesh scale={[size, size, size]}>
          <sphereGeometry args={[1, 32, 32]} />
          <BubbleShader color={blendedColor} opacity={opacity * 0.7} />
        </mesh>

        {/* Mini bubbles */}
        {miniBubbles.map((bubble, i) => (
          <mesh key={i} position={bubble.position} scale={[bubble.size, bubble.size, bubble.size]}>
            <sphereGeometry args={[1, 16, 16]} />
            <BubbleShader color={bubble.color} opacity={opacity * 0.9} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// Color palette for bubbles
const BUBBLE_COLORS = [
  "#4A90E2", // Blue
  "#C644FC", // Purple
  "#5E17EB", // Deep Purple
  "#2DE2E6", // Cyan
  "#FF61D8", // Pink
  "#FF9966", // Sunset Orange
  "#6A82FB", // Periwinkle
  "#05DFD7", // Turquoise
]

