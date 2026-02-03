import os
from dotenv import load_dotenv
import psycopg

load_dotenv()

def check_db():
    db_url = os.getenv("DATABASE_URL")
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute("select 1;")
            return cur.fetchone()
