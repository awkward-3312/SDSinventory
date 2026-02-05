def list_units(cur):
    cur.execute("select id, code, name from public.units order by id;")
    return cur.fetchall()
