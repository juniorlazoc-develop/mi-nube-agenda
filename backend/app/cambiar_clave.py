"""
¿Olvidaste tu contraseña? Cámbiala desde la terminal (no desde la web, por seguridad):

    cd mi-nube\\backend
    .venv\\Scripts\\python.exe -m app.cambiar_clave

Solo funciona en la PC donde está la base de datos: quien puede abrir esta
terminal ya es el dueño de los datos.
"""
from getpass import getpass

from sqlmodel import Session, select

from app.database import crear_tablas, engine
from app.models import Usuario
from app.seguridad import hashear, registrar_cambio_de_clave


def main() -> None:
    crear_tablas()
    with Session(engine) as session:
        usuario = session.exec(select(Usuario)).first()
        if not usuario:
            print("Todavía no hay cuenta. Ábrela en la web (http://localhost:5173) y créala.")
            return
        print(f"Cuenta: {usuario.usuario} ({usuario.nombre})")
        nueva = getpass("Nueva contraseña (no se verá al escribir): ")
        if len(nueva) < 8:
            print("❌ Debe tener al menos 8 caracteres. No se cambió nada.")
            return
        if getpass("Repítela: ") != nueva:
            print("❌ No coinciden. No se cambió nada.")
            return
        usuario.hash_contrasena = hashear(nueva)
        session.add(usuario)
        session.commit()
        registrar_cambio_de_clave(session)
        print("✅ Contraseña cambiada. Ya puedes entrar con la nueva.")


if __name__ == "__main__":
    main()
