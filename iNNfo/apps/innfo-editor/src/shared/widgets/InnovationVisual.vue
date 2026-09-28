<script setup lang="ts">
/**
 * InnovationVisual — Renders live, frame-accurate animated SVG representations
 * of historical innovations in action on a clean, light/white studio canvas.
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    innovationName?: string
    assetPath?: string
    frame: number
    totalFrames?: number
    fps?: number
  }>(),
  {
    innovationName: '',
    assetPath: '',
    frame: 0,
    totalFrames: 150,
    fps: 30,
  },
)

const innovationKind = computed(() => {
  const s = `${props.innovationName} ${props.assetPath}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (s.includes('rueda') || s.includes('wheel')) return 'rueda'
  if (s.includes('vapor') || s.includes('steam')) return 'vapor'
  if (s.includes('brujula') || s.includes('compass')) return 'brujula'
  if (s.includes('telefono') || s.includes('phone')) return 'telefono'
  if (s.includes('penicilina') || s.includes('penicillin')) return 'penicilina'
  if (s.includes('imprenta') || s.includes('print')) return 'imprenta'
  if (s.includes('escritura') || s.includes('writing')) return 'escritura'
  if (s.includes('automovil') || s.includes('car') || s.includes('coche')) return 'automovil'
  if (s.includes('computadora') || s.includes('computer')) return 'computadora'
  if (s.includes('electricidad') || s.includes('electricity')) return 'electricidad'
  if (s.includes('internet') || s.includes('red') || s.includes('network')) return 'internet'
  return 'generic'
})
</script>

<template>
  <div class="w-full h-full flex items-center justify-center bg-white dark:bg-slate-900 overflow-hidden relative select-none">
    <!-- Clean Minimalist Grid Background -->
    <div class="absolute inset-0 opacity-40 dark:opacity-10 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:20px_20px]"></div>

    <!-- 1. LA RUEDA (Rolling Wheel) -->
    <svg
      v-if="innovationKind === 'rueda'"
      viewBox="0 0 500 280"
      class="w-full h-full max-h-[360px] object-contain relative z-10"
    >
      <!-- Ground Line -->
      <line x1="40" y1="220" x2="460" y2="220" stroke="#cbd5e1" stroke-width="3" stroke-linecap="round" />
      
      <!-- Ground Motion Dashes (Moving left to simulate rolling right) -->
      <g stroke="#94a3b8" stroke-width="2" stroke-linecap="round" opacity="0.6">
        <line
          v-for="i in 8"
          :key="i"
          :x1="((i * 60 - (frame * 5) % 480 + 480) % 480) + 10"
          y1="228"
          :x2="((i * 60 - (frame * 5) % 480 + 480) % 480) + 35"
          y2="228"
        />
      </g>

      <!-- Dust Particles Behind Wheel -->
      <circle
        :cx="200 - ((frame * 3) % 40)"
        :cy="215 - ((frame * 1.5) % 15)"
        :r="2 + ((frame % 15) * 0.3)"
        fill="#94a3b8"
        :opacity="Math.max(0, 0.7 - (frame % 15) * 0.05)"
      />
      <circle
        :cx="190 - (((frame + 7) * 3) % 40)"
        :cy="216 - (((frame + 7) * 1.2) % 12)"
        :r="1.5 + (((frame + 7) % 15) * 0.25)"
        fill="#cbd5e1"
        :opacity="Math.max(0, 0.6 - ((frame + 7) % 15) * 0.04)"
      />

      <!-- Rotating Wheel Group -->
      <g :transform="`translate(250, 140) rotate(${frame * 5})`">
        <!-- Outer Wood/Bronze Rim -->
        <circle cx="0" cy="0" r="76" fill="none" stroke="#78350f" stroke-width="12" />
        <circle cx="0" cy="0" r="70" fill="#fef3c7" stroke="#b45309" stroke-width="2" />
        
        <!-- Metal Studs around rim -->
        <circle
          v-for="deg in [0, 45, 90, 135, 180, 225, 270, 315]"
          :key="deg"
          :cx="70 * Math.cos((deg * Math.PI) / 180)"
          :cy="70 * Math.sin((deg * Math.PI) / 180)"
          r="2.5"
          fill="#451a03"
        />

        <!-- Spokes -->
        <line x1="-70" y1="0" x2="70" y2="0" stroke="#92400e" stroke-width="6" stroke-linecap="round" />
        <line x1="0" y1="-70" x2="0" y2="70" stroke="#92400e" stroke-width="6" stroke-linecap="round" />
        <line x1="-50" y1="-50" x2="50" y2="50" stroke="#92400e" stroke-width="5" stroke-linecap="round" />
        <line x1="-50" y1="50" x2="50" y2="-50" stroke="#92400e" stroke-width="5" stroke-linecap="round" />

        <!-- Central Hub -->
        <circle cx="0" cy="0" r="22" fill="#78350f" stroke="#451a03" stroke-width="3" />
        <circle cx="0" cy="0" r="10" fill="#f59e0b" stroke="#78350f" stroke-width="2" />
        <circle cx="0" cy="0" r="4" fill="#451a03" />
      </g>
    </svg>

    <!-- 2. MOTOR DE VAPOR (Steam Engine) -->
    <svg
      v-else-if="innovationKind === 'vapor'"
      viewBox="0 0 500 280"
      class="w-full h-full max-h-[360px] object-contain relative z-10"
    >
      <!-- Base platform -->
      <rect x="50" y="210" width="400" height="15" rx="3" fill="#334155" />

      <!-- Boiler Tank -->
      <rect x="80" y="110" width="130" height="95" rx="14" fill="#475569" stroke="#1e293b" stroke-width="3" />
      <line x1="95" y1="110" x2="95" y2="205" stroke="#334155" stroke-width="3" />
      <line x1="195" y1="110" x2="195" y2="205" stroke="#334155" stroke-width="3" />

      <!-- Chimney with Steam Exhaust -->
      <path d="M 105 110 L 105 60 L 125 50 L 125 110 Z" fill="#334155" stroke="#1e293b" stroke-width="2" />

      <!-- Steam Puffs Rising -->
      <g fill="#94a3b8">
        <circle
          :cx="115 - ((frame * 0.8) % 25)"
          :cy="45 - ((frame * 1.8) % 45)"
          :r="8 + ((frame % 45) * 0.3)"
          :opacity="Math.max(0, 0.8 - (frame % 45) * 0.018)"
        />
        <circle
          :cx="115 - (((frame + 15) * 0.8) % 25)"
          :cy="45 - (((frame + 15) * 1.8) % 45)"
          :r="8 + (((frame + 15) % 45) * 0.3)"
          :opacity="Math.max(0, 0.8 - ((frame + 15) % 45) * 0.018)"
        />
        <circle
          :cx="115 - (((frame + 30) * 0.8) % 25)"
          :cy="45 - (((frame + 30) * 1.8) % 45)"
          :r="8 + (((frame + 30) % 45) * 0.3)"
          :opacity="Math.max(0, 0.8 - ((frame + 30) % 45) * 0.018)"
        />
      </g>

      <!-- Piston Cylinder -->
      <rect x="230" y="145" width="70" height="40" rx="4" fill="#64748b" stroke="#1e293b" stroke-width="2" />
      <!-- Piston Rod Moving in/out -->
      <rect :x="270 + Math.sin(frame * 0.2) * 20" y="160" width="55" height="10" rx="2" fill="#cbd5e1" stroke="#334155" stroke-width="1.5" />

      <!-- Flywheel at the right -->
      <g :transform="`translate(380, 160) rotate(${frame * 10})`">
        <circle cx="0" cy="0" r="50" fill="none" stroke="#0f172a" stroke-width="8" />
        <circle cx="0" cy="0" r="44" fill="none" stroke="#475569" stroke-width="2" />
        <!-- Counterweight -->
        <path d="M -30 25 A 40 40 0 0 0 30 25 Z" fill="#334155" />
        <!-- Spokes -->
        <line x1="-45" y1="0" x2="45" y2="0" stroke="#475569" stroke-width="4" />
        <line x1="0" y1="-45" x2="0" y2="45" stroke="#475569" stroke-width="4" />
        <!-- Center axle -->
        <circle cx="0" cy="0" r="14" fill="#0f172a" />
        <circle cx="0" cy="0" r="5" fill="#94a3b8" />
      </g>

      <!-- Connecting Bar -->
      <line
        :x1="320 + Math.sin(frame * 0.2) * 20"
        y1="165"
        :x2="380 + Math.cos((frame * 10 * Math.PI) / 180) * 25"
        :y2="160 + Math.sin((frame * 10 * Math.PI) / 180) * 25"
        stroke="#0284c7"
        stroke-width="4"
        stroke-linecap="round"
      />
    </svg>

    <!-- 3. LA BRÚJULA (Magnetic Compass) -->
    <svg
      v-else-if="innovationKind === 'brujula'"
      viewBox="0 0 500 280"
      class="w-full h-full max-h-[360px] object-contain relative z-10"
    >
      <!-- Outer Brass Casing -->
      <circle cx="250" cy="140" r="88" fill="#d97706" stroke="#78350f" stroke-width="4" />
      <circle cx="250" cy="140" r="82" fill="#fef3c7" stroke="#b45309" stroke-width="3" />
      <circle cx="250" cy="140" r="76" fill="#fffbeb" stroke="#d97706" stroke-width="1.5" />

      <!-- Top suspension ring -->
      <circle cx="250" cy="45" r="14" fill="none" stroke="#b45309" stroke-width="4" />

      <!-- Degree markings -->
      <g stroke="#92400e" stroke-width="1.5">
        <line
          v-for="deg in [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]"
          :key="deg"
          :x1="250 + 68 * Math.cos((deg * Math.PI) / 180)"
          :y1="140 + 68 * Math.sin((deg * Math.PI) / 180)"
          :x2="250 + 75 * Math.cos((deg * Math.PI) / 180)"
          :y2="140 + 75 * Math.sin((deg * Math.PI) / 180)"
        />
      </g>

      <!-- Cardinal Letters -->
      <text x="250" y="80" text-anchor="middle" font-size="14" font-weight="bold" fill="#dc2626" font-family="serif">N</text>
      <text x="250" y="208" text-anchor="middle" font-size="12" font-weight="bold" fill="#475569" font-family="serif">S</text>
      <text x="312" y="144" text-anchor="middle" font-size="12" font-weight="bold" fill="#475569" font-family="serif">E</text>
      <text x="188" y="144" text-anchor="middle" font-size="12" font-weight="bold" fill="#475569" font-family="serif">W</text>

      <!-- Compass Needle with Magnetic Oscillation / Damping -->
      <g :transform="`translate(250, 140) rotate(${Math.sin(frame * 0.08) * Math.exp(-((frame % 60) * 0.04)) * 25})`">
        <!-- North Pointer (Red) -->
        <polygon points="0,-64 10,-8 0,0 -10,-8" fill="#ef4444" stroke="#b91c1c" stroke-width="1" />
        <polygon points="0,-64 0,0 -10,-8" fill="#dc2626" />
        
        <!-- South Pointer (Silver/Slate) -->
        <polygon points="0,64 10,8 0,0 -10,8" fill="#94a3b8" stroke="#475569" stroke-width="1" />
        <polygon points="0,64 0,0 10,8" fill="#cbd5e1" />

        <!-- Center Brass Pivot Cap -->
        <circle cx="0" cy="0" r="7" fill="#b45309" stroke="#78350f" stroke-width="2" />
        <circle cx="0" cy="0" r="2.5" fill="#fef3c7" />
      </g>
    </svg>

    <!-- 4. EL TELÉFONO (Telephone) -->
    <svg
      v-else-if="innovationKind === 'telefono'"
      viewBox="0 0 500 280"
      class="w-full h-full max-h-[360px] object-contain relative z-10"
    >
      <!-- Sound Wave Pulses Emitter (Left) -->
      <g stroke="#3b82f6" fill="none" stroke-width="2.5" stroke-linecap="round">
        <path
          :d="`M 140 100 A ${20 + ((frame * 2) % 40)} ${20 + ((frame * 2) % 40)} 0 0 0 140 180`"
          :opacity="Math.max(0, 1 - ((frame * 2) % 40) / 40)"
        />
        <path
          :d="`M 130 90 A ${35 + ((frame * 2) % 40)} ${35 + ((frame * 2) % 40)} 0 0 0 130 190`"
          :opacity="Math.max(0, 1 - (((frame * 2) % 40) + 15) / 55)"
        />
      </g>

      <!-- Telephone Base Body -->
      <path d="M 200 220 L 220 140 L 280 140 L 300 220 Z" fill="#1e293b" stroke="#0f172a" stroke-width="3" rx="4" />
      
      <!-- Rotary Dial -->
      <circle cx="250" cy="180" r="24" fill="#f8fafc" stroke="#cbd5e1" stroke-width="3" />
      <circle cx="250" cy="180" r="8" fill="#334155" />
      <circle
        v-for="deg in [0, 36, 72, 108, 144, 180, 216, 252, 288, 324]"
        :key="deg"
        :cx="250 + 16 * Math.cos((deg * Math.PI) / 180)"
        :cy="180 + 16 * Math.sin((deg * Math.PI) / 180)"
        r="2"
        fill="#64748b"
      />

      <!-- Twin Bells on Top (Ringing Vibration) -->
      <g :transform="`translate(225, 125) rotate(${Math.sin(frame * 1.5) * 8})`">
        <path d="M -15 0 A 15 15 0 0 1 15 0 Z" fill="#eab308" stroke="#a16207" stroke-width="2" />
      </g>
      <g :transform="`translate(275, 125) rotate(${-Math.sin(frame * 1.5) * 8})`">
        <path d="M -15 0 A 15 15 0 0 1 15 0 Z" fill="#eab308" stroke="#a16207" stroke-width="2" />
      </g>

      <!-- Handset Cradle & Handset (Vibrating) -->
      <g :transform="`translate(250, 100) rotate(${Math.sin(frame * 1.5) * 3})`">
        <!-- Bar -->
        <rect x="-60" y="-8" width="120" height="12" rx="4" fill="#0f172a" />
        <!-- Earpiece / Mouthpiece cups -->
        <path d="M -60 -20 C -45 -20 -45 5 -60 10 Z" fill="#334155" />
        <path d="M 60 -20 C 45 -20 45 5 60 10 Z" fill="#334155" />
      </g>
    </svg>

    <!-- 5. LA PENICILINA (Penicillin Antibiotic Action) -->
    <svg
      v-else-if="innovationKind === 'penicilina'"
      viewBox="0 0 500 280"
      class="w-full h-full max-h-[360px] object-contain relative z-10"
    >
      <!-- Petri Dish Glass Rim -->
      <circle cx="250" cy="140" r="95" fill="#f8fafc" stroke="#94a3b8" stroke-width="4" opacity="0.9" />
      <circle cx="250" cy="140" r="90" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.5" />

      <!-- Antibacterial Inhibition Halo (Expanding Clear Zone) -->
      <circle
        cx="250"
        cy="140"
        :r="25 + Math.min(50, (frame % 90) * 0.6)"
        fill="#e0f2fe"
        stroke="#38bdf8"
        stroke-dasharray="4 2"
        stroke-width="2"
        opacity="0.8"
      />

      <!-- Penicillium Mold Colony at the center -->
      <g fill="#0d9488" stroke="#115e59" stroke-width="1.5">
        <circle cx="250" cy="140" r="16" />
        <circle cx="242" cy="135" r="10" />
        <circle cx="258" cy="138" r="11" />
        <circle cx="250" cy="148" r="9" />
      </g>

      <!-- Surrounding Bacterial Cells (Staphylococcus) -->
      <!-- Outer unaffected bacteria -->
      <circle
        v-for="(b, idx) in [
          { x: 180, y: 80 }, { x: 320, y: 85 }, { x: 175, y: 190 }, { x: 325, y: 195 },
          { x: 165, y: 140 }, { x: 335, y: 140 }, { x: 210, y: 65 }, { x: 290, y: 65 }
        ]"
        :key="idx"
        :cx="b.x"
        :cy="b.y"
        r="4.5"
        fill="#f59e0b"
        stroke="#b45309"
        stroke-width="1"
      />

      <!-- Bacteria in middle zone dissolving as halo expands -->
      <circle
        v-for="(b, idx) in [
          { x: 210, y: 110, dist: 45 },
          { x: 290, y: 115, dist: 47 },
          { x: 205, y: 165, dist: 50 },
          { x: 295, y: 160, dist: 48 }
        ]"
        :key="'inner-' + idx"
        :cx="b.x"
        :cy="b.y"
        :r="Math.max(1, 4 - ((frame % 90) * 0.05))"
        fill="#eab308"
        :opacity="Math.max(0, 1 - (frame % 90) / b.dist)"
      />
    </svg>

    <!-- 6. LA IMPRENTA (Printing Press) -->
    <svg
      v-else-if="innovationKind === 'imprenta'"
      viewBox="0 0 500 280"
      class="w-full h-full max-h-[360px] object-contain relative z-10"
    >
      <!-- Press wooden frame -->
      <rect x="140" y="40" width="20" height="190" fill="#78350f" rx="3" />
      <rect x="340" y="40" width="20" height="190" fill="#78350f" rx="3" />
      <rect x="140" y="40" width="220" height="24" fill="#92400e" rx="3" />
      <rect x="140" y="210" width="220" height="20" fill="#92400e" rx="3" />

      <!-- Vertical Screw & Lever Rotating -->
      <rect x="242" y="64" width="16" height="50" fill="#64748b" />
      <!-- Lever handle -->
      <line
        :x1="250 - Math.cos(frame * 0.08) * 55"
        y1="75"
        :x2="250 + Math.cos(frame * 0.08) * 55"
        y2="75"
        stroke="#451a03"
        stroke-width="6"
        stroke-linecap="round"
      />

      <!-- Press Platen (Moves Up/Down) -->
      <rect
        x="180"
        :y="110 + Math.abs(Math.sin(frame * 0.08)) * 25"
        width="140"
        height="18"
        fill="#334155"
        stroke="#0f172a"
        stroke-width="2"
        rx="2"
      />

      <!-- Movable Type Bed Below -->
      <rect x="170" y="165" width="160" height="20" fill="#1e293b" rx="2" />
      <!-- Tiny letter type blocks -->
      <rect
        v-for="i in 12"
        :key="i"
        :x="180 + i * 11"
        y="160"
        width="7"
        height="6"
        fill="#94a3b8"
      />

      <!-- Fresh Printed Paper Sheet sliding out -->
      <g :transform="`translate(${Math.max(0, (frame % 80) * 1.5)}, 0)`">
        <rect x="185" y="178" width="130" height="16" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" rx="1" />
        <!-- Printed text lines -->
        <line x1="195" y1="184" x2="270" y2="184" stroke="#0f172a" stroke-width="1.5" />
        <line x1="195" y1="189" x2="300" y2="189" stroke="#0f172a" stroke-width="1.5" />
      </g>
    </svg>

    <!-- 7. LA ESCRITURA (Writing / Stylus) -->
    <svg
      v-else-if="innovationKind === 'escritura'"
      viewBox="0 0 500 280"
      class="w-full h-full max-h-[360px] object-contain relative z-10"
    >
      <!-- Clay Tablet / Scroll -->
      <rect x="120" y="50" width="260" height="180" rx="12" fill="#fed7aa" stroke="#c2410c" stroke-width="3" />
      <rect x="130" y="60" width="240" height="160" rx="8" fill="#ffedd5" />

      <!-- Horizontal guideline rows -->
      <line v-for="y in [95, 135, 175]" :key="y" x1="145" :y1="y" x2="355" :y2="y" stroke="#fdba74" stroke-width="1.5" stroke-dasharray="3 3" />

      <!-- Cuneiform / Ancient Glyph Inscriptions (Revealed progressively) -->
      <g stroke="#7c2d12" stroke-width="3" stroke-linecap="round">
        <!-- Row 1 Glyphs -->
        <path d="M 150 85 L 165 85 M 155 78 L 165 85 L 155 92" :opacity="frame > 10 ? 1 : 0" />
        <path d="M 180 80 L 195 90 M 180 90 L 195 80" :opacity="frame > 25 ? 1 : 0" />
        <path d="M 215 78 L 215 92 M 205 85 L 225 85" :opacity="frame > 40 ? 1 : 0" />
        <path d="M 245 80 L 260 85 L 245 90" :opacity="frame > 55 ? 1 : 0" />

        <!-- Row 2 Glyphs -->
        <path d="M 150 125 L 165 125 L 155 132" :opacity="frame > 70 ? 1 : 0" />
        <path d="M 185 120 L 185 132 M 175 126 L 195 126" :opacity="frame > 85 ? 1 : 0" />
        <path d="M 215 122 L 230 130 L 215 132" :opacity="frame > 100 ? 1 : 0" />
      </g>

      <!-- Moving Reed Stylus / Pen -->
      <g :transform="`translate(${150 + (frame % 110) * 1.8}, ${85 + Math.floor((frame % 110) / 55) * 40 + Math.sin(frame * 0.4) * 4}) rotate(-35)`">
        <polygon points="0,0 -8,-70 8,-70" fill="#d97706" stroke="#92400e" stroke-width="2" />
        <polygon points="0,0 -3,-15 3,-15" fill="#451a03" />
      </g>
    </svg>

    <!-- 8. EL AUTOMÓVIL (Automobile) -->
    <svg
      v-else-if="innovationKind === 'automovil'"
      viewBox="0 0 500 280"
      class="w-full h-full max-h-[360px] object-contain relative z-10"
    >
      <!-- Road Surface -->
      <line x1="40" y1="215" x2="460" y2="215" stroke="#475569" stroke-width="3" />
      
      <!-- Moving Road Dashes -->
      <g stroke="#94a3b8" stroke-width="3" stroke-linecap="round">
        <line
          v-for="i in 6"
          :key="i"
          :x1="((i * 80 - (frame * 10) % 480 + 480) % 480) + 10"
          y1="225"
          :x2="((i * 80 - (frame * 10) % 480 + 480) % 480) + 45"
          y2="225"
        />
      </g>

      <!-- Car Body (with slight suspension bounce) -->
      <g :transform="`translate(0, ${Math.sin(frame * 0.3) * 2})`">
        <!-- Headlight Beam -->
        <polygon points="370,165 470,140 470,195" fill="#fef08a" opacity="0.35" />

        <!-- Chassis & Cab -->
        <path
          d="M 130 185 L 140 145 L 200 145 L 240 110 L 330 110 L 370 150 L 380 185 Z"
          fill="#dc2626"
          stroke="#991b1b"
          stroke-width="3"
        />
        <!-- Windows -->
        <polygon points="245,116 325,116 360,150 245,150" fill="#e0f2fe" stroke="#0284c7" stroke-width="2" />
        
        <!-- Headlight Lamp -->
        <circle cx="378" cy="165" r="6" fill="#fef08a" stroke="#ca8a04" stroke-width="2" />
      </g>

      <!-- Front Spinning Wheel -->
      <g :transform="`translate(330, 195) rotate(${frame * 12})`">
        <circle cx="0" cy="0" r="22" fill="#1e293b" stroke="#0f172a" stroke-width="5" />
        <circle cx="0" cy="0" r="14" fill="#cbd5e1" stroke="#64748b" stroke-width="1.5" />
        <line x1="-14" y1="0" x2="14" y2="0" stroke="#475569" stroke-width="3" />
        <line x1="0" y1="-14" x2="0" y2="14" stroke="#475569" stroke-width="3" />
        <circle cx="0" cy="0" r="4" fill="#0f172a" />
      </g>

      <!-- Rear Spinning Wheel -->
      <g :transform="`translate(180, 195) rotate(${frame * 12})`">
        <circle cx="0" cy="0" r="22" fill="#1e293b" stroke="#0f172a" stroke-width="5" />
        <circle cx="0" cy="0" r="14" fill="#cbd5e1" stroke="#64748b" stroke-width="1.5" />
        <line x1="-14" y1="0" x2="14" y2="0" stroke="#475569" stroke-width="3" />
        <line x1="0" y1="-14" x2="0" y2="14" stroke="#475569" stroke-width="3" />
        <circle cx="0" cy="0" r="4" fill="#0f172a" />
      </g>
    </svg>

    <!-- 9. LA COMPUTADORA MODERNA (Computer / Circuit / Binary Streams) -->
    <svg
      v-else-if="innovationKind === 'computadora'"
      viewBox="0 0 500 280"
      class="w-full h-full max-h-[360px] object-contain relative z-10"
    >
      <!-- Circuit Board Base -->
      <rect x="80" y="45" width="340" height="190" rx="10" fill="#0f172a" stroke="#1e293b" stroke-width="3" />

      <!-- Circuit Traces -->
      <g stroke="#38bdf8" stroke-width="2" fill="none" opacity="0.6">
        <path d="M 100 80 L 180 80 L 210 110" />
        <path d="M 100 140 L 190 140" />
        <path d="M 100 200 L 170 200 L 210 170" />
        <path d="M 290 110 L 320 80 L 400 80" />
        <path d="M 310 140 L 400 140" />
        <path d="M 290 170 L 330 200 L 400 200" />
      </g>

      <!-- Flowing Data Pulses (Bits) -->
      <circle
        :cx="100 + ((frame * 3) % 110)"
        cy="80"
        r="3"
        fill="#38bdf8"
        stroke="#bae6fd"
      />
      <circle
        :cx="100 + (((frame + 15) * 3) % 90)"
        cy="140"
        r="3"
        fill="#38bdf8"
        stroke="#bae6fd"
      />
      <circle
        :cx="310 + ((frame * 3) % 90)"
        cy="140"
        r="3"
        fill="#38bdf8"
        stroke="#bae6fd"
      />

      <!-- Central CPU Chip (Pulsing Glow) -->
      <rect x="210" y="100" width="80" height="80" rx="8" fill="#1e293b" stroke="#38bdf8" stroke-width="3" />
      <rect x="225" y="115" width="50" height="50" rx="4" fill="#0284c7" />
      <text x="250" y="145" text-anchor="middle" font-size="12" font-weight="bold" fill="#ffffff" font-family="monospace">CPU</text>

      <!-- Microchip Pins around CPU -->
      <g stroke="#cbd5e1" stroke-width="2">
        <line v-for="i in 5" :key="'pin-t-' + i" :x1="220 + i * 10" y1="94" :x2="220 + i * 10" y2="100" />
        <line v-for="i in 5" :key="'pin-b-' + i" :x1="220 + i * 10" y1="180" :x2="220 + i * 10" y2="186" />
      </g>
    </svg>

    <!-- 10. GENERACIÓN DE ELECTRICIDAD (Dynamo & Light Bulb) -->
    <svg
      v-else-if="innovationKind === 'electricidad'"
      viewBox="0 0 500 280"
      class="w-full h-full max-h-[360px] object-contain relative z-10"
    >
      <!-- Generator Dynamo on the Left -->
      <rect x="80" y="90" width="100" height="100" rx="8" fill="#334155" stroke="#1e293b" stroke-width="3" />
      <!-- Spinning Rotor -->
      <g :transform="`translate(130, 140) rotate(${frame * 12})`">
        <circle cx="0" cy="0" r="32" fill="#0284c7" stroke="#0369a1" stroke-width="3" />
        <line x1="-28" y1="0" x2="28" y2="0" stroke="#f8fafc" stroke-width="4" />
        <line x1="0" y1="-28" x2="0" y2="28" stroke="#f8fafc" stroke-width="4" />
      </g>

      <!-- Connecting Power Cables -->
      <path d="M 180 125 C 240 125, 260 125, 320 125" fill="none" stroke="#dc2626" stroke-width="3" />
      <path d="M 180 155 C 240 155, 260 155, 320 155" fill="none" stroke="#2563eb" stroke-width="3" />

      <!-- Electric Sparks / Energy Bolts along wires -->
      <polygon
        v-if="frame % 6 < 4"
        :points="`${220 + (frame % 8) * 6},122 ${230 + (frame % 8) * 6},128 ${226 + (frame % 8) * 6},128 ${234 + (frame % 8) * 6},136`"
        fill="#fde047"
      />

      <!-- Incandescent Light Bulb on Right -->
      <!-- Glow Aura -->
      <circle cx="360" cy="130" :r="45 + Math.sin(frame * 0.3) * 6" fill="#fef08a" opacity="0.45" />
      <!-- Bulb Glass -->
      <path d="M 345 155 C 330 145 330 110 360 110 C 390 110 390 145 375 155 Z" fill="#fef9c3" stroke="#eab308" stroke-width="3" />
      <!-- Glowing Filament -->
      <path d="M 353 145 L 358 130 L 362 130 L 367 145" fill="none" stroke="#ca8a04" stroke-width="2.5" />
      <!-- Base Screw -->
      <rect x="348" y="155" width="24" height="15" rx="2" fill="#64748b" stroke="#334155" stroke-width="2" />
    </svg>

    <!-- 11. INTERNET (Global Connected Network) -->
    <svg
      v-else-if="innovationKind === 'internet'"
      viewBox="0 0 500 280"
      class="w-full h-full max-h-[360px] object-contain relative z-10"
    >
      <!-- Central Globe / Network Core -->
      <circle cx="250" cy="140" r="55" fill="#f0f9ff" stroke="#0284c7" stroke-width="2" />
      <!-- Globe latitude / longitude rings -->
      <ellipse cx="250" cy="140" rx="55" ry="22" fill="none" stroke="#bae6fd" stroke-width="1.5" />
      <ellipse cx="250" cy="140" rx="22" ry="55" fill="none" stroke="#bae6fd" stroke-width="1.5" />

      <!-- Network Nodes around globe -->
      <g stroke="#38bdf8" stroke-width="2">
        <line x1="250" y1="85" x2="160" y2="70" />
        <line x1="250" y1="85" x2="340" y2="70" />
        <line x1="250" y1="195" x2="160" y2="210" />
        <line x1="250" y1="195" x2="340" y2="210" />
        <line x1="195" y1="140" x2="110" y2="140" />
        <line x1="305" y1="140" x2="390" y2="140" />
      </g>

      <!-- Flying Data Packets along lines -->
      <circle
        :cx="250 - ((frame * 2.5) % 90)"
        :cy="85 - (((frame * 2.5) % 90) * 0.16)"
        r="4"
        fill="#6366f1"
      />
      <circle
        :cx="250 + ((frame * 2.5) % 90)"
        :cy="85 - (((frame * 2.5) % 90) * 0.16)"
        r="4"
        fill="#6366f1"
      />
      <circle
        :cx="250 + ((frame * 2.5) % 90)"
        :cy="195 + (((frame * 2.5) % 90) * 0.16)"
        r="4"
        fill="#6366f1"
      />

      <!-- Node Badges -->
      <circle
        v-for="(n, idx) in [
          { x: 160, y: 70 }, { x: 340, y: 70 },
          { x: 110, y: 140 }, { x: 390, y: 140 },
          { x: 160, y: 210 }, { x: 340, y: 210 }
        ]"
        :key="idx"
        :cx="n.x"
        :cy="n.y"
        r="9"
        fill="#0284c7"
        stroke="#ffffff"
        stroke-width="2"
      />
    </svg>

    <!-- 12. GENERIC INNOVATION MECHANISM (Fallback) -->
    <svg
      v-else
      viewBox="0 0 500 280"
      class="w-full h-full max-h-[360px] object-contain relative z-10"
    >
      <!-- Interlocking Precision Gear Train -->
      <g :transform="`translate(210, 140) rotate(${frame * 4})`">
        <circle cx="0" cy="0" r="50" fill="#f1f5f9" stroke="#475569" stroke-width="8" stroke-dasharray="14 8" />
        <circle cx="0" cy="0" r="42" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" />
        <circle cx="0" cy="0" r="15" fill="#334155" />
      </g>

      <g :transform="`translate(290, 140) rotate(${-frame * 4 + 10})`">
        <circle cx="0" cy="0" r="40" fill="#f1f5f9" stroke="#6366f1" stroke-width="7" stroke-dasharray="12 7" />
        <circle cx="0" cy="0" r="32" fill="#ffffff" stroke="#c7d2fe" stroke-width="2" />
        <circle cx="0" cy="0" r="12" fill="#4338ca" />
      </g>
    </svg>
  </div>
</template>
