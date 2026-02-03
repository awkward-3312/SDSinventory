import os
from dotenv import load_dotenv
import psycopg

load_dotenv()

db_url = os.getenv("DATABASE_URL")

print("Conectando a la base de datos...")

with psycopg.connect(db_url) as conn:
    with conn.cursor() as cur:
        cur.execute("select 1;")
        result = cur.fetchone()
        print("Conexión OK:", result)
