export type Supply = {
  id: string;
  name: string;
  unit_base: string;
  stock_on_hand: number;
  stock_min: number;
  avg_unit_cost: number;
};

const API_URL = "http://127.0.0.1:8000";

export async function getSupplies(): Promise<Supply[]> {
  const res = await fetch(`${API_URL}/supplies`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Error al cargar insumos");
  }

  return res.json();
}
