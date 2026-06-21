# app/database.py
import psycopg2
from psycopg2.extras import RealDictCursor

DB_HOST = "db.vusczbabvvuwmtyylxcx.supabase.co"
DB_PORT = 5432
DB_USER = "postgres"
DB_NAME = "postgres"
DB_PASS = "YashavipAtlanis@453"

def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASS,
        dbname=DB_NAME,
        sslmode="require"
    )

def get_db():
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()
