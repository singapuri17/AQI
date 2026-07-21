"""One-time migration: add gender, date_of_birth, document_path columns to users table."""
import sqlite3

conn = sqlite3.connect('urban_air.db')
cur  = conn.cursor()

cur.execute('PRAGMA table_info(users)')
existing = [row[1] for row in cur.fetchall()]
print('Existing columns:', existing)

new_cols = [
    ('gender',        'TEXT'),
    ('date_of_birth', 'TEXT'),
    ('document_path', 'TEXT'),
]

for col, definition in new_cols:
    if col not in existing:
        cur.execute(f'ALTER TABLE users ADD COLUMN {col} {definition}')
        print(f'  Added: {col}')
    else:
        print(f'  Already exists: {col}')

conn.commit()
conn.close()
print('Migration complete.')
