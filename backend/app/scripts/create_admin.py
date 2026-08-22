"""Cria (ou promove) uma conta de administração.

Corre-se ao pé do servidor, com `make admin`, e é de propósito que não há
equivalente na aplicação: um caminho pela internet para criar administradores
é uma porta que só serve para ser arrombada. Quem tem acesso a este comando já
tem acesso à base de dados.

    make admin                          # pergunta tudo
    make admin EMAIL=a@b.pt NOME="Ana"  # pergunta só a palavra-passe

Se o e-mail já existir, a conta é promovida a administração em vez de rebentar
— é o que se quer quando alguém se registou primeiro e só depois se percebeu
que devia poder administrar.
"""

import getpass
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from sqlalchemy import func, select  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models import User, UserRole  # noqa: E402

MIN_PASSWORD = 8


def perguntar(rotulo: str, valor: str | None) -> str:
    """Usa o que veio do ambiente; só pergunta o que falta."""
    if valor and valor.strip():
        return valor.strip()
    if not sys.stdin.isatty():
        raise SystemExit(f"Falta {rotulo}. Passe-o assim: make admin {rotulo.upper()}=...")
    return input(f"{rotulo}: ").strip()


def pedir_palavra_passe() -> str:
    if senha := os.environ.get("PASSWORD", "").strip():
        # Vindo do ambiente fica no histórico da shell; avisa-se e segue.
        print("Aviso: a palavra-passe veio do ambiente e fica no histórico da shell.")
        return senha

    if not sys.stdin.isatty():
        raise SystemExit("Sem terminal para pedir a palavra-passe. Passe PASSWORD=...")

    while True:
        senha = getpass.getpass("Palavra-passe: ")
        if len(senha) < MIN_PASSWORD:
            print(f"Curta demais — pelo menos {MIN_PASSWORD} caracteres.")
            continue
        if senha != getpass.getpass("Repita: "):
            print("Não coincidem.")
            continue
        return senha


def main() -> None:
    email = perguntar("email", os.environ.get("EMAIL")).lower()
    if "@" not in email:
        raise SystemExit("Isso não parece um e-mail.")

    nome = perguntar("nome", os.environ.get("NOME"))
    senha = pedir_palavra_passe()

    with SessionLocal() as db:
        # Comparação sem maiúsculas: o e-mail é a identidade e não distingue.
        existente = db.scalar(select(User).where(func.lower(User.email) == email))

        if existente:
            existente.role = UserRole.ADMIN
            existente.password_hash = hash_password(senha)
            existente.is_active = True
            db.commit()
            print(f"Conta {email} promovida a administração e palavra-passe redefinida.")
            return

        db.add(
            User(
                name=nome,
                email=email,
                password_hash=hash_password(senha),
                role=UserRole.ADMIN,
                is_active=True,
            )
        )
        db.commit()
        print(f"Administrador {email} criado.")


if __name__ == "__main__":
    main()
