from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import get_settings
from .routers import (
    alerts,
    fixed_costs,
    health,
    movements,
    presentations,
    production,
    products,
    recipe_items,
    recipe_options,
    recipe_rules,
    recipe_variables,
    recipes,
    quotes,
    sales,
    supplies,
    units,
    purchases,
)

settings = get_settings()
origins = getattr(settings, "ALLOWED_ORIGINS", ["http://localhost:3000"])
if isinstance(origins, str):
    origins = [o.strip() for o in origins.split(",") if o.strip()]

app = FastAPI(title="SDSinventory API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(units.router)
app.include_router(supplies.router)
app.include_router(presentations.router)
app.include_router(purchases.router)
app.include_router(movements.router)
app.include_router(products.router)
app.include_router(recipes.router)
app.include_router(recipe_items.router)
app.include_router(recipe_variables.router)
app.include_router(recipe_options.router)
app.include_router(recipe_rules.router)
app.include_router(production.router)
app.include_router(alerts.router)
app.include_router(sales.router)
app.include_router(fixed_costs.router)
app.include_router(quotes.router)
