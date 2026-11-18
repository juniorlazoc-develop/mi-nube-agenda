"""
Freno contra quien intenta adivinar la contraseña (fuerza bruta).

Cuando Mi Nube esté en internet, cualquiera podrá abrir el login y probar claves.
Por eso contamos los intentos FALLIDOS de cada dirección IP: al llegar a 5 en
15 minutos, esa IP queda bloqueada hasta que pase el tiempo.

Los intentos se guardan en memoria: si reinicias el servidor, el contador vuelve a cero.
Por eso el servidor debe correr con UN solo proceso (un "worker").
"""
from time import monotonic

MAX_FALLOS = 5
VENTANA_SEGUNDOS = 15 * 60


class LimitadorLogin:
    def __init__(self) -> None:
        self.fallos: dict[str, list[float]] = {}  # IP -> momentos de cada fallo

    def _limpiar(self) -> None:
        """Olvida los fallos viejos, para que la memoria no crezca sin fin."""
        limite = monotonic() - VENTANA_SEGUNDOS
        self.fallos = {
            ip: recientes
            for ip, momentos in self.fallos.items()
            if (recientes := [m for m in momentos if m > limite])
        }

    def bloqueada(self, ip: str) -> bool:
        self._limpiar()
        return len(self.fallos.get(ip, [])) >= MAX_FALLOS

    def registrar_fallo(self, ip: str) -> None:
        self.fallos.setdefault(ip, []).append(monotonic())

    def perdonar(self, ip: str) -> None:
        """Si entró bien, sus fallos anteriores ya no cuentan."""
        self.fallos.pop(ip, None)


limitador = LimitadorLogin()
