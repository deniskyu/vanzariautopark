// ============================================================================
//  src/assets/icons.js — registru de iconițe pentru site-ul public
// ----------------------------------------------------------------------------
//  Toate iconițele ca șiruri SVG, folosite la randarea server-side (Hono).
//  Fiecare e pe grilă 24×24, contur 2px, stroke="currentColor" — preia automat
//  culoarea din context (galben pe fundal închis, negru pe suprafață galbenă).
//
//  Folosire în componente:  ${icon('phone')}  sau  ${icon('phone', 20)}
// ============================================================================

const P = {
  arrow: '<path d="M5 12h13"/><path d="m12 5 7 7-7 7"/>',
  bank: '<path d="M3 9.5 12 4l9 5.5"/><path d="M4.5 9.5v8"/><path d="M9 9.5v8"/><path d="M15 9.5v8"/><path d="M19.5 9.5v8"/><path d="M3 20.5h18"/>',
  calendar: '<rect x="3.5" y="4.5" width="17" height="16" rx="2"/><path d="M3.5 9h17"/><path d="M8 2.5v4M16 2.5v4"/><path d="M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2"/>',
  check: '<path d="M4 12.5l5 5 11-11"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.3l3.5 2"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
  facebook: '<path d="M14 8.5h2.5V5.5H14a3.5 3.5 0 0 0-3.5 3.5v2H8.5v3h2v6.5h3v-6.5h2.3l.7-3h-3v-1.7c0-.5.4-.8 1-.8z"/>',
  fuel: '<rect x="4" y="4" width="9" height="16" rx="1.5"/><path d="M13 8h3.5a1.5 1.5 0 0 1 1.5 1.5V16a1.5 1.5 0 0 0 3 0V10l-2.5-2.5"/><path d="M4 11h9"/>',
  gauge: '<path d="M4 15a8 8 0 0 1 16 0"/><path d="M12 15l4-4"/><circle cx="12" cy="15" r="1.3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/>',
  menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5 0-.4-.2-.7-.4-1-.3-.3-.4-.6-.4-1 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/>',
  phone: '<path d="M8.5 3.5h-3a2 2 0 0 0-2 2.2c.6 6.5 5.3 11.2 11.8 11.8a2 2 0 0 0 2.2-2v-3l-3.5-1.2-1.8 1.8a13 13 0 0 1-4.3-4.3l1.8-1.8L8.5 3.5z"/>',
  pin: '<path d="M12 21.5s7-6.3 7-11.2a7 7 0 1 0-14 0c0 4.9 7 11.2 7 11.2z"/><circle cx="12" cy="10" r="2.6"/>',
  road: '<path d="M6 3 4 21M18 3l2 18M12 4v2M12 10v2M12 16v2"/>',
  shield: '<path d="M12 3 4 6.2v5.6c0 4.9 8 9.2 8 9.2s8-4.3 8-9.2V6.2L12 3z"/><path d="m8.8 12 2.2 2.2 4.2-4.2"/>',
  steering: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 3v6.5M4.2 15.5l5.6-2M19.8 15.5l-5.6-2"/>',
  tag: '<path d="M3 12V4h8l9 9-8 8-9-9z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
  transmission: '<circle cx="6" cy="6" r="1.6"/><circle cx="12" cy="6" r="1.6"/><circle cx="18" cy="6" r="1.6"/><circle cx="6" cy="18" r="1.6"/><circle cx="12" cy="18" r="1.6"/><path d="M6 7.6v8.8M12 7.6v8.8M18 7.6V12H6"/>',
  truck: '<path d="M2.5 6.5h11v9h-11z"/><path d="M13.5 9.5h4l3 3v3h-7z"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/>',
  whatsapp: '<path d="M3.5 20.5l1.3-4.4A8.4 8.4 0 1 1 8 19.3l-4.5 1.2z"/><path d="M9 9.2c.2 1 .7 2 1.5 2.8s1.8 1.3 2.8 1.5l1-1.2 2 .8v1.6c-2.7.3-5.3-1-6.9-2.6S8 8.5 8.3 5.8h1.6l.8 2L9 9.2z"/>',
};

export const icon = (name, size = 24) => {
  const body = P[name];
  if (!body) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
};

export const ICON_NAMES = Object.keys(P);
export default { icon, ICON_NAMES };
