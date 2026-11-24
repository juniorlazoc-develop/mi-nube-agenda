/**
 * Íconos de línea dibujados a mano en SVG (24 x 24).
 *
 * Todos usan stroke="currentColor": toman el color del texto que los rodea,
 * así sirven igual en el tema oscuro y en el claro sin tocar nada.
 * Uso: <Icono nombre="agenda" />  ·  <Logo />
 */
const TRAZOS = {
  inicio: (
    <>
      <path d="M3.5 10.5 12 4l8.5 6.5" />
      <path d="M5.5 9v10.5h13V9" />
      <path d="M10 19.5v-5.5h4v5.5" />
    </>
  ),
  agenda: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M8 14h2M14 14h2M8 17h2" />
    </>
  ),
  avisos: (
    <>
      <path d="M6 10a6 6 0 0 1 12 0c0 4.5 1.8 6.2 2.5 7H3.5c.7-.8 2.5-2.5 2.5-7Z" />
      <path d="M10 20a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  bitacora: (
    <>
      <path d="M6 3.5h11a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H6Z" />
      <path d="M6 3.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2" />
      <path d="M9.5 8.5h5.5M9.5 12h5.5" />
    </>
  ),
  gastos: (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5Z" />
      <path d="M20 10h-4a2 2 0 0 0 0 4h4" />
      <path d="M16.2 12h.1" />
    </>
  ),
  fotos: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="9.5" r="1.6" />
      <path d="m4 17 4.5-4.5 3 3 3-3.5 5.5 5.5" />
    </>
  ),
  ajustes: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
      <path d="M4 12h5M13 12h7" />
      <circle cx="11" cy="12" r="2" />
    </>
  ),
  salir: (
    <>
      <path d="M14 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H14" />
      <path d="M10 12h10M16.5 8.5 20 12l-3.5 3.5" />
    </>
  ),
  nube: <path d="M7.5 18.5h9.5a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 9.6a4.5 4.5 0 0 0 .5 8.9Z" />,
  candado: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <path d="M12 14.5v2" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  ojo: (
    <>
      <path d="M2.5 12C5 7 8.3 5 12 5s7 2 9.5 7c-2.5 5-5.8 7-9.5 7s-7-2-9.5-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "ojo-tachado": (
    <>
      <path d="M2.5 12C5 7 8.3 5 12 5s7 2 9.5 7c-2.5 5-5.8 7-9.5 7s-7-2-9.5-7Z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M4 20 20 4" />
    </>
  ),
};

export function Icono({ nombre, tamano = 20, className = "" }) {
  return (
    <svg
      className={`icono ${className}`}
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TRAZOS[nombre]}
    </svg>
  );
}

/** Marca de la app: una nube blanca sobre un cuadrado con degradado azul. */
export function Logo({ className = "" }) {
  return (
    <span className={`logo ${className}`} aria-hidden="true">
      <Icono nombre="nube" tamano={22} />
    </span>
  );
}
