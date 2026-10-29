/**
 * High-definition SVG representations of device inspection photos
 * encoded as Data URIs for instant, reliable display across all devices.
 */

function createDeviceSvg(type: 'cracked' | 'workbench' | 'screen_installed' | 'tested'): string {
  let title = '';
  let badgeColor = '#FF6A00';
  let innerGraphic = '';

  if (type === 'cracked') {
    title = 'ENTRADA — VIDRO QUEBRADO';
    badgeColor = '#EF4444';
    innerGraphic = `
      <!-- Phone Frame -->
      <rect x="130" y="40" width="240" height="420" rx="30" fill="#1e293b" stroke="#64748b" stroke-width="4"/>
      <rect x="145" y="65" width="210" height="370" rx="15" fill="#0f172a"/>
      <!-- Crack patterns -->
      <path d="M 330 80 L 280 140 L 295 190 L 220 230 L 190 310" stroke="#f87171" stroke-width="2.5" fill="none" opacity="0.9"/>
      <path d="M 280 140 L 210 160 L 170 150" stroke="#fca5a5" stroke-width="1.8" fill="none" opacity="0.8"/>
      <path d="M 295 190 L 340 240 L 310 320" stroke="#f87171" stroke-width="2" fill="none" opacity="0.8"/>
      <!-- Screen damage artifact -->
      <circle cx="310" cy="110" r="16" fill="#ef4444" opacity="0.6"/>
      <!-- Punch hole camera -->
      <circle cx="250" cy="80" r="6" fill="#020617"/>
    `;
  } else if (type === 'workbench') {
    title = 'DIAGNÓSTICO — BANCADA TÉCNICA';
    badgeColor = '#3B82F6';
    innerGraphic = `
      <!-- Antistatic Mat -->
      <rect x="40" y="40" width="420" height="420" rx="16" fill="#047857" opacity="0.25" stroke="#10b981" stroke-width="2"/>
      <!-- Disassembled Phone -->
      <rect x="90" y="90" width="180" height="320" rx="20" fill="#18181b" stroke="#52525b" stroke-width="3"/>
      <!-- Motherboard & Battery sections -->
      <rect x="110" y="110" width="140" height="110" rx="8" fill="#15803d" stroke="#22c55e" stroke-width="2"/>
      <rect x="110" y="230" width="140" height="150" rx="8" fill="#27272a"/>
      <text x="180" y="315" fill="#a1a1aa" font-size="12" text-anchor="middle" font-family="monospace">BATTERY Li-ion</text>
      <!-- Screws on magnetic mat -->
      <circle cx="340" cy="130" r="5" fill="#e4e4e7" stroke="#71717a"/>
      <circle cx="360" cy="130" r="5" fill="#e4e4e7" stroke="#71717a"/>
      <circle cx="380" cy="130" r="5" fill="#e4e4e7" stroke="#71717a"/>
      <circle cx="340" cy="155" r="5" fill="#e4e4e7" stroke="#71717a"/>
      <!-- Precision Tweezers -->
      <path d="M 320 340 L 260 210 L 268 205 L 335 330 Z" fill="#94a3b8"/>
    `;
  } else if (type === 'screen_installed') {
    title = 'MANUTENÇÃO — NOVO DISPLAY INSTALADO';
    badgeColor = '#FF6A00';
    innerGraphic = `
      <!-- Phone Frame with Fresh Screen -->
      <rect x="130" y="40" width="240" height="420" rx="30" fill="#18181b" stroke="#FF6A00" stroke-width="4"/>
      <rect x="145" y="65" width="210" height="370" rx="15" fill="#09090b"/>
      <!-- Protective Peel Film tab -->
      <path d="M 320 65 L 355 65 L 355 100 Z" fill="#38bdf8" opacity="0.8"/>
      <!-- Clean display reflection lines -->
      <path d="M 160 380 L 280 120" stroke="#ffffff" stroke-width="2" opacity="0.15"/>
      <path d="M 180 390 L 300 130" stroke="#ffffff" stroke-width="1" opacity="0.1"/>
      <!-- Brand Seal -->
      <circle cx="250" cy="240" r="32" fill="#FF6A00" opacity="0.15"/>
      <text x="250" y="245" fill="#FF6A00" font-size="14" font-weight="bold" text-anchor="middle" font-family="sans-serif">OLED OK</text>
    `;
  } else {
    title = 'TESTES E FINALIZAÇÃO — 100% FUNCIONAL';
    badgeColor = '#10B981';
    innerGraphic = `
      <!-- Phone in Perfect Working State -->
      <rect x="130" y="40" width="240" height="420" rx="30" fill="#18181b" stroke="#10b981" stroke-width="5"/>
      <rect x="145" y="65" width="210" height="370" rx="15" fill="#022c22"/>
      <!-- Success Checkmark circle on screen -->
      <circle cx="250" cy="220" r="48" fill="#10b981"/>
      <path d="M 230 220 L 245 235 L 275 205" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="250" y="300" fill="#34d399" font-size="16" font-weight="bold" text-anchor="middle" font-family="sans-serif">TESTES APROVADOS</text>
      <text x="250" y="325" fill="#a7f3d0" font-size="12" text-anchor="middle" font-family="sans-serif">Touch • Câmeras • Carga</text>
    `;
  }

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#18181b"/>
      <stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
  </defs>
  <rect width="500" height="500" fill="url(#bg)"/>
  
  <!-- Subtle Grid Pattern -->
  <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse">
    <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#27272a" stroke-width="1"/>
  </pattern>
  <rect width="500" height="500" fill="url(#grid)" opacity="0.4"/>

  ${innerGraphic}

  <!-- Header Badge -->
  <rect x="25" y="15" width="450" height="32" rx="8" fill="#18181b" stroke="#3f3f46" stroke-width="1.5"/>
  <circle cx="45" cy="31" r="6" fill="${badgeColor}"/>
  <text x="65" y="36" fill="#f4f4f5" font-size="12" font-weight="bold" letter-spacing="1" font-family="system-ui, sans-serif">${title}</text>
  <text x="455" y="36" fill="#a1a1aa" font-size="11" font-weight="600" text-anchor="end" font-family="sans-serif">STORE ACESSÓRIOS</text>
</svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const MOCK_REPAIR_PHOTOS = {
  cracked: createDeviceSvg('cracked'),
  workbench: createDeviceSvg('workbench'),
  screen_installed: createDeviceSvg('screen_installed'),
  tested: createDeviceSvg('tested'),
};
