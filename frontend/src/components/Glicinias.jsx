/**
 * Decoración japonesa dibujada con código (sin imágenes, por eso pesa casi nada).
 *
 *   <Glicinias />  ramas de glicinia que cuelgan y se mecen.
 *   <Sello />      sello rojo de firma, como los que estampan los artistas japoneses.
 *
 * Los racimos se generan con matemáticas: cada fila de flores es más angosta y más
 * oscura que la anterior. "azar" siempre da los mismos números para una misma semilla;
 * así el dibujo no cambia cada vez que React vuelve a pintar la pantalla.
 */
function azar(semilla) {
  let x = semilla;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

/** Pasa de un color a otro. t=0 es el primero y t=1 el segundo. */
function mezclar(a, b, t) {
  return `rgb(${a.map((valor, i) => Math.round(valor + (b[i] - valor) * t)).join(",")})`;
}
const LILA_CLARO = [226, 212, 248];
const LILA_OSCURO = [102, 70, 176];

function crearFlores(semilla, largo, ancho) {
  const r = azar(semilla);
  const flores = [];
  const filas = Math.round(largo / 11);
  for (let fila = 0; fila < filas; fila++) {
    const avance = fila / (filas - 1);
    const media = ancho * (1 - avance * 0.92) * (0.75 + r() * 0.25); // se angosta hacia la punta
    const cantidad = avance > 0.75 ? 1 : avance > 0.4 ? 2 : 3;
    for (let i = 0; i < cantidad; i++) {
      flores.push({
        x: (cantidad === 1 ? 0 : (i / (cantidad - 1) - 0.5) * media * 2) + (r() - 0.5) * 4,
        y: avance * largo + (r() - 0.5) * 6,
        rx: 6.5 - avance * 3.2,
        ry: 4.6 - avance * 2,
        giro: (r() - 0.5) * 70,
        color: mezclar(LILA_CLARO, LILA_OSCURO, Math.min(1, avance * 0.8 + r() * 0.25)),
      });
    }
  }
  return flores;
}

// Posición, largo y ancho de cada racimo sobre un lienzo de 1600 de ancho.
const RACIMOS = [
  [40, 170, 30], [150, 250, 36], [260, 130, 26], [370, 210, 32], [500, 110, 24], [640, 150, 28],
  [790, 95, 22], [930, 140, 26], [1060, 120, 26], [1190, 220, 34], [1310, 150, 28], [1420, 280, 38],
  [1530, 180, 30],
].map(([x, largo, ancho], i) => ({ x, largo, flores: crearFlores(i + 7, largo, ancho), n: i }));

export function Glicinias({ className = "" }) {
  return (
    <svg className={`glicinias ${className}`} viewBox="0 0 1600 340" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
      <path
        className="glicinias-rama"
        d="M-20 10 C 200 44 330 -6 520 18 S 880 42 1060 14 S 1420 -4 1620 26"
      />
      {RACIMOS.map((racimo) => (
        <g
          key={racimo.n}
          className="racimo"
          style={{ "--retraso": `${racimo.n * -0.7}s`, transformOrigin: `${racimo.x}px 12px` }}
        >
          <path className="glicinias-rama fina" d={`M${racimo.x} 12 V${racimo.largo + 14}`} />
          {racimo.flores.map((f, i) => (
            <ellipse
              key={i}
              cx={racimo.x + f.x}
              cy={18 + f.y}
              rx={f.rx}
              ry={f.ry}
              fill={f.color}
              transform={`rotate(${f.giro} ${racimo.x + f.x} ${18 + f.y})`}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

export function Sello({ className = "", kanji = "雲" }) {
  return (
    <span className={`sello ${className}`} aria-hidden="true">
      {kanji}
    </span>
  );
}
