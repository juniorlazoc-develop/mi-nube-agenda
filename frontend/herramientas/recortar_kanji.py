"""
Crea src/assets/kanji-mincho.woff2: una fuente diminuta solo con los kanji que usa la app.

Una tipografía japonesa completa pesa decenas de MB porque trae miles de caracteres,
y Mi Nube apenas usa unos cuantos. Este script los busca en src/ y guarda solo esos.
Si agregas texto japonés nuevo, vuelve a ejecutarlo (estando en la carpeta frontend):

    pip install fonttools brotli
    python herramientas/recortar_kanji.py
"""
import re
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

FRONTEND = Path(__file__).resolve().parent.parent
ORIGEN = FRONTEND / "node_modules/@fontsource/shippori-mincho/files/shippori-mincho-japanese-700-normal.woff2"
SALIDA = FRONTEND / "src/assets/kanji-mincho.woff2"
JAPONES = re.compile(r"[぀-ヿ㐀-鿿]")


def caracteres_usados() -> set[str]:
    usados = set()
    for archivo in (FRONTEND / "src").rglob("*"):
        if archivo.suffix in (".jsx", ".js"):
            usados.update(JAPONES.findall(archivo.read_text(encoding="utf-8")))
    return usados


def main() -> None:
    faltan = caracteres_usados()
    print(f"{len(faltan)} caracteres japoneses en uso")
    fuente = TTFont(ORIGEN)
    disponibles = fuente.getBestCmap()
    sin_glifo = {c for c in faltan if ord(c) not in disponibles}
    if sin_glifo:
        print("Sin glifo:", "".join(sorted(sin_glifo)))
    opciones = subset.Options(layout_features=[], notdef_outline=True, hinting=False)
    recorte = subset.Subsetter(opciones)
    recorte.populate(unicodes=[ord(c) for c in faltan - sin_glifo])
    recorte.subset(fuente)
    fuente.flavor = "woff2"
    SALIDA.parent.mkdir(exist_ok=True)
    fuente.save(SALIDA)
    print(f"{SALIDA.name}: {SALIDA.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
