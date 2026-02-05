"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { API_URL } from "@/lib/api";

type RecipeItem = {
  id: string;
  recipe_id: string;
  supply_id: string;
  supply_name: string;
  unit_base: string;
  qty_base: number;
  waste_pct: number;
  avg_unit_cost: number;
  qty_formula?: string | null;
};

type RecipeCost = {
  recipe_id: string;
  items: Array<{ supply_id: string; qty_with_waste: number; unit_code?: string }>;
  materials_cost: number;
  currency: string;
  is_variable?: boolean;
};

type Supply = { id: string; name: string; unit_base: string };
type Recipe = {
  id: string;
  product_id: string;
  name: string;
  product_type?: string;
  margin_target?: number;
  product_margin_target?: number;
};

type FixedCostsSummary = {
  operational_cost_per_order: number;
  currency: string;
  active: boolean;
};

type RecipeVar = {
  id: string;
  code: string;
  label: string;
  min_value: number | null;
  max_value: number | null;
  default_value: number | null;
};

type RecipeOptionValue = {
  id: string;
  value_key: string;
  label: string;
  numeric_value: number;
};

type RecipeOption = {
  id: string;
  code: string;
  label: string;
  values: RecipeOptionValue[];
};

type RecipeRule = {
  id: string;
  scope: string;
  target_supply_id?: string | null;
  condition_var: string;
  operator: string;
  condition_value: string;
  effect_type: string;
  effect_value: number;
};

export default function RecipeDetailPage() {
  const params = useParams();
  const recipeId = String(params?.id ?? "");

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [cost, setCost] = useState<RecipeCost | null>(null);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [variables, setVariables] = useState<RecipeVar[]>([]);
  const [options, setOptions] = useState<RecipeOption[]>([]);
  const [rules, setRules] = useState<RecipeRule[]>([]);
  const [operationalPerOrder, setOperationalPerOrder] = useState<number>(0);
  const [operationalCurrency, setOperationalCurrency] = useState<string>("HNL");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [supplyId, setSupplyId] = useState("");
  const [qtyBase, setQtyBase] = useState(1);
  const [wastePct, setWastePct] = useState(0);
  const [qtyFormula, setQtyFormula] = useState("");
  const [calcMode, setCalcMode] = useState<
    "fixed" | "area" | "perimeter" | "width" | "height" | "manual"
  >("fixed");
  const [calcFactor, setCalcFactor] = useState<number>(1);
  const [manualFormula, setManualFormula] = useState("");
  const [savingMargin, setSavingMargin] = useState(false);
  const [simpleMode, setSimpleMode] = useState(true);
  const [showCalcAdvanced, setShowCalcAdvanced] = useState(false);

  const [editRecipeName, setEditRecipeName] = useState("");

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editSupplyId, setEditSupplyId] = useState("");
  const [editQtyBase, setEditQtyBase] = useState(1);
  const [editWastePct, setEditWastePct] = useState(0);
  const [editQtyFormula, setEditQtyFormula] = useState("");

  const [width, setWidth] = useState(1);
  const [height, setHeight] = useState(1);

  const [previewVars, setPreviewVars] = useState<Record<string, string>>({});
  const [previewOpts, setPreviewOpts] = useState<Record<string, string>>({});

  const [priceMode, setPriceMode] = useState<"margin" | "markup">("margin");
  const [priceValue, setPriceValue] = useState<number>(0.4);
  const [priceInputMode, setPriceInputMode] = useState<"decimal" | "percent">("percent");

  const [varCode, setVarCode] = useState("");
  const [varLabel, setVarLabel] = useState("");
  const [varMin, setVarMin] = useState<string>("");
  const [varMax, setVarMax] = useState<string>("");
  const [varDefault, setVarDefault] = useState<string>("");

  const [optCode, setOptCode] = useState("");
  const [optLabel, setOptLabel] = useState("");

  const [valOptionId, setValOptionId] = useState("");
  const [valKey, setValKey] = useState("");
  const [valLabel, setValLabel] = useState("");
  const [valNumeric, setValNumeric] = useState<string>("0");

  const [ruleScope, setRuleScope] = useState("global");
  const [ruleSupplyId, setRuleSupplyId] = useState("");
  const [ruleVar, setRuleVar] = useState("");
  const [ruleOp, setRuleOp] = useState("==");
  const [ruleValue, setRuleValue] = useState("");
  const [ruleEffectType, setRuleEffectType] = useState("multiplier");
  const [ruleEffectValue, setRuleEffectValue] = useState<string>("1");

  async function load() {
    if (!recipeId) return;
    setLoading(true);
    setErr(null);
    try {
      const [rRes, iRes, sRes, vRes, oRes, rulesRes, fRes] = await Promise.all([
        fetch(`${API_URL}/recipes/${recipeId}`, { cache: "no-store" }),
        fetch(`${API_URL}/recipe-items?recipe_id=${recipeId}`, { cache: "no-store" }),
        fetch(`${API_URL}/supplies?include_inactive=true`, { cache: "no-store" }),
        fetch(`${API_URL}/recipe-variables?recipe_id=${recipeId}`, { cache: "no-store" }),
        fetch(`${API_URL}/recipe-options/with-values?recipe_id=${recipeId}`, { cache: "no-store" }),
        fetch(`${API_URL}/recipe-rules?recipe_id=${recipeId}`, { cache: "no-store" }),
        fetch(`${API_URL}/fixed-costs/summary/active`, { cache: "no-store" }),
      ]);
      const rData = (await rRes.json()) as Recipe;
      const iData = (await iRes.json()) as RecipeItem[];
      const sData = (await sRes.json()) as Supply[];
      const vData = (await vRes.json()) as RecipeVar[];
      const oData = (await oRes.json()) as RecipeOption[];
      const rulesData = (await rulesRes.json()) as RecipeRule[];
      const fixedData = (await fRes.json()) as FixedCostsSummary;
      setRecipe(rData);
      setEditRecipeName(rData.name);
      const targetMargin = rData.margin_target ?? rData.product_margin_target ?? 0.4;
      setPriceMode("margin");
      setPriceInputMode("percent");
      setPriceValue(Number.isFinite(targetMargin) ? Number(targetMargin) : 0.4);
      setItems(iData);
      setSupplies(sData);
      setVariables(vData);
      setOptions(oData);
      setRules(rulesData);
      if (fixedData && typeof fixedData.operational_cost_per_order === "number") {
        setOperationalPerOrder(Number(fixedData.operational_cost_per_order || 0));
        setOperationalCurrency(fixedData.currency || "HNL");
      }
    } catch {
      setErr("No se pudieron cargar los datos de la receta");
    } finally {
      setLoading(false);
    }
  }

  async function loadCost() {
    if (!recipeId) return;
    try {
      const varsPayload: Record<string, number> = {};
      variables.forEach((v) => {
        const raw = (previewVars[v.code] ?? "").trim();
        if (raw === "") {
          if (v.default_value != null) varsPayload[v.code] = Number(v.default_value);
          else if (v.min_value != null) varsPayload[v.code] = Number(v.min_value);
        } else {
          varsPayload[v.code] = Number(raw);
        }
      });

      const optsPayload: Record<string, string> = {};
      options.forEach((o) => {
        const raw = (previewOpts[o.code] ?? "").trim();
        if (raw) {
          optsPayload[o.code] = raw;
        } else if (o.values[0]) {
          optsPayload[o.code] = o.values[0].value_key;
        }
      });

      const [cRes] = await Promise.all([
        fetch(`${API_URL}/recipes/${recipeId}/cost`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            width,
            height,
            vars: Object.keys(varsPayload).length ? varsPayload : null,
            opts: Object.keys(optsPayload).length ? optsPayload : null,
            strict: false,
          }),
          cache: "no-store",
        }),
      ]);
      if (!cRes.ok) {
        setErr(await readError(cRes, "No se pudo calcular costo"));
        return;
      }
      const cData = (await cRes.json()) as RecipeCost;
      setCost(cData);
    } catch {
      setErr("No se pudo calcular costo");
    }
  }

  function applyAutoCalcForSupply(supply: Supply | undefined) {
    if (!supply) return;
    const unit = (supply.unit_base || "").toLowerCase().replace(/\s+/g, "");

    // Mapeo automático por unidad base
    if (unit.includes("m2") || unit.includes("m²") || unit.includes("m^2")) {
      setCalcMode("area");
      setCalcFactor(1);
      return;
    }
    if (unit.includes("ml")) {
      setCalcMode("area");
      setCalcFactor(1);
      return;
    }
    if (unit === "m" || unit.includes("metro") || unit.includes("mt")) {
      setCalcMode("width");
      setCalcFactor(1);
      return;
    }
    if (unit.includes("unidad") || unit.includes("uni") || unit.includes("pieza") || unit.includes("pz") || unit.includes("hoja")) {
      setCalcMode("fixed");
      setQtyBase(1);
      return;
    }

    setCalcMode("fixed");
    setQtyBase(1);
  }

  useEffect(() => {
    load();
  }, [recipeId]);

  useEffect(() => {
    if (!variables.length) return;
    setPreviewVars((prev) => {
      const next = { ...prev };
      variables.forEach((v) => {
        if ((next[v.code] ?? "").trim() === "" && v.default_value != null) {
          next[v.code] = String(v.default_value);
        }
      });
      return next;
    });
  }, [variables]);

  useEffect(() => {
    if (!options.length) return;
    setPreviewOpts((prev) => {
      const next = { ...prev };
      options.forEach((o) => {
        if (!next[o.code] && o.values[0]) {
          next[o.code] = o.values[0].value_key;
        }
      });
      return next;
    });
  }, [options]);

  useEffect(() => {
    loadCost();
  }, [recipeId, width, height, previewVars, previewOpts]);

  const autoFormula = useMemo(() => {
    const factor = Number(calcFactor);
    const factorSuffix = !Number.isFinite(factor) || factor === 1 ? "" : ` * ${factor}`;
    if (calcMode === "area") return `width * height${factorSuffix}`;
    if (calcMode === "perimeter") return `2 * (width + height)${factorSuffix}`;
    if (calcMode === "width") return `width${factorSuffix}`;
    if (calcMode === "height") return `height${factorSuffix}`;
    return "";
  }, [calcMode, calcFactor]);

  const autoPreviewQty = useMemo(() => {
    const w = Number(width);
    const h = Number(height);
    const f = Number(calcFactor);
    const factor = Number.isFinite(f) ? f : 1;
    if (calcMode === "area") {
      if (w <= 0 || h <= 0) return null;
      return w * h * factor;
    }
    if (calcMode === "perimeter") {
      if (w <= 0 || h <= 0) return null;
      return 2 * (w + h) * factor;
    }
    if (calcMode === "width") {
      if (w <= 0) return null;
      return w * factor;
    }
    if (calcMode === "height") {
      if (h <= 0) return null;
      return h * factor;
    }
    return null;
  }, [calcMode, width, height, calcFactor]);

  const calcModeLabel = useMemo(() => {
    if (calcMode === "fixed") return "Fijo";
    if (calcMode === "area") return "Área (ancho × alto)";
    if (calcMode === "perimeter") return "Perímetro (2 × (ancho + alto))";
    if (calcMode === "width") return "Ancho";
    if (calcMode === "height") return "Alto";
    return "Manual";
  }, [calcMode]);

  useEffect(() => {
    if (calcMode === "fixed") {
      setQtyFormula("");
      return;
    }
    if (calcMode === "manual") {
      setQtyFormula(manualFormula);
      return;
    }
    setQtyFormula(autoFormula);
  }, [calcMode, autoFormula, manualFormula]);

  async function addItem() {
    if (!recipeId || !supplyId) return;
    setLoading(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_URL}/recipe-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe_id: recipeId,
          supply_id: supplyId,
          qty_base: Number(qtyBase),
          waste_pct: Number(wastePct),
          qty_formula: qtyFormula.trim() || null,
        }),
      });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo agregar el insumo");
        setErr(msg);
        return;
      }
      setSupplyId("");
      setQtyBase(1);
      setWastePct(0);
      setQtyFormula("");
      setCalcMode("fixed");
      setCalcFactor(1);
      setManualFormula("");
      setNotice("✅ Insumo agregado");
      await load();
      await loadCost();
    } catch {
      setErr("No se pudo agregar el insumo");
    } finally {
      setLoading(false);
    }
  }

  function startEditItem(it: RecipeItem) {
    setEditingItemId(it.id);
    setEditSupplyId(it.supply_id);
    setEditQtyBase(it.qty_base);
    setEditWastePct(it.waste_pct);
    setEditQtyFormula(it.qty_formula || "");
  }

  async function saveItemEdit(itemId: string) {
    if (!recipeId) return;
    setLoading(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_URL}/recipe-items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe_id: recipeId,
          supply_id: editSupplyId,
          qty_base: Number(editQtyBase),
          waste_pct: Number(editWastePct),
          qty_formula: editQtyFormula.trim() || null,
        }),
      });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo actualizar el insumo");
        setErr(msg);
        return;
      }
      setEditingItemId(null);
      setNotice("✅ Insumo actualizado");
      await load();
      await loadCost();
    } catch (e) {
      setErr("No se pudo actualizar el insumo");
    } finally {
      setLoading(false);
    }
  }

  async function deleteItem(itemId: string) {
    if (!recipeId) return;
    const target = items.find((i) => i.id === itemId)?.supply_name ?? "este insumo";
    if (!confirm(`¿Eliminar "${target}" de la receta?`)) return;
    setLoading(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_URL}/recipe-items/${itemId}`, { method: "DELETE" });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo eliminar el insumo");
        setErr(msg);
        return;
      }
      setNotice("✅ Insumo eliminado");
      await load();
      await loadCost();
    } catch {
      setErr("No se pudo eliminar el insumo");
    } finally {
      setLoading(false);
    }
  }

  async function addVariable() {
    if (!recipeId || !varCode.trim() || !varLabel.trim()) return;
    setLoading(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_URL}/recipe-variables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe_id: recipeId,
          code: varCode.trim(),
          label: varLabel.trim(),
          min_value: varMin.trim() === "" ? null : Number(varMin),
          max_value: varMax.trim() === "" ? null : Number(varMax),
          default_value: varDefault.trim() === "" ? null : Number(varDefault),
        }),
      });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo crear la variable");
        setErr(msg);
        return;
      }
      setVarCode("");
      setVarLabel("");
      setVarMin("");
      setVarMax("");
      setVarDefault("");
      setNotice("✅ Variable agregada");
      await load();
      await loadCost();
    } catch {
      setErr("No se pudo crear la variable");
    } finally {
      setLoading(false);
    }
  }

  async function deleteVariable(varId: string) {
    if (!confirm("¿Eliminar esta variable?")) return;
    setLoading(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_URL}/recipe-variables/${varId}`, { method: "DELETE" });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo eliminar la variable");
        setErr(msg);
        return;
      }
      setNotice("✅ Variable eliminada");
      await load();
      await loadCost();
    } catch {
      setErr("No se pudo eliminar la variable");
    } finally {
      setLoading(false);
    }
  }

  async function addOption() {
    if (!recipeId || !optCode.trim() || !optLabel.trim()) return;
    setLoading(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_URL}/recipe-options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe_id: recipeId,
          code: optCode.trim(),
          label: optLabel.trim(),
        }),
      });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo crear la opción");
        setErr(msg);
        return;
      }
      setOptCode("");
      setOptLabel("");
      setNotice("✅ Opción creada");
      await load();
      await loadCost();
    } catch {
      setErr("No se pudo crear la opción");
    } finally {
      setLoading(false);
    }
  }

  async function deleteOption(optionId: string) {
    if (!confirm("¿Eliminar esta opción y sus valores?")) return;
    setLoading(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_URL}/recipe-options/${optionId}`, { method: "DELETE" });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo eliminar la opción");
        setErr(msg);
        return;
      }
      setNotice("✅ Opción eliminada");
      await load();
      await loadCost();
    } catch {
      setErr("No se pudo eliminar la opción");
    } finally {
      setLoading(false);
    }
  }

  async function addOptionValue() {
    if (!valOptionId || !valKey.trim() || !valLabel.trim()) return;
    setLoading(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_URL}/recipe-option-values`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          option_id: valOptionId,
          value_key: valKey.trim(),
          label: valLabel.trim(),
          numeric_value: Number(valNumeric),
        }),
      });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo crear el valor");
        setErr(msg);
        return;
      }
      setValKey("");
      setValLabel("");
      setValNumeric("0");
      setNotice("✅ Valor agregado");
      await load();
      await loadCost();
    } catch {
      setErr("No se pudo crear el valor");
    } finally {
      setLoading(false);
    }
  }

  async function deleteOptionValue(valueId: string) {
    if (!confirm("¿Eliminar este valor?")) return;
    setLoading(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_URL}/recipe-option-values/${valueId}`, { method: "DELETE" });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo eliminar el valor");
        setErr(msg);
        return;
      }
      setNotice("✅ Valor eliminado");
      await load();
      await loadCost();
    } catch {
      setErr("No se pudo eliminar el valor");
    } finally {
      setLoading(false);
    }
  }

  async function addRule() {
    if (!recipeId || !ruleVar.trim() || !ruleValue.trim()) return;
    setLoading(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_URL}/recipe-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe_id: recipeId,
          scope: ruleScope,
          target_supply_id: ruleScope === "supply" ? ruleSupplyId || null : null,
          condition_var: ruleVar.trim(),
          operator: ruleOp,
          condition_value: ruleValue.trim(),
          effect_type: ruleEffectType,
          effect_value: Number(ruleEffectValue),
        }),
      });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo crear la regla");
        setErr(msg);
        return;
      }
      setRuleVar("");
      setRuleValue("");
      setRuleEffectValue("1");
      setNotice("✅ Regla creada");
      await load();
      await loadCost();
    } catch {
      setErr("No se pudo crear la regla");
    } finally {
      setLoading(false);
    }
  }

  async function deleteRule(ruleId: string) {
    if (!confirm("¿Eliminar esta regla?")) return;
    setLoading(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_URL}/recipe-rules/${ruleId}`, { method: "DELETE" });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo eliminar la regla");
        setErr(msg);
        return;
      }
      setNotice("✅ Regla eliminada");
      await load();
      await loadCost();
    } catch {
      setErr("No se pudo eliminar la regla");
    } finally {
      setLoading(false);
    }
  }

  async function saveRecipeName() {
    if (!recipeId) return;
    setLoading(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_URL}/recipes/${recipeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editRecipeName.trim() || "Base" }),
      });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo actualizar la receta");
        setErr(msg);
        return;
      }
      setNotice("✅ Receta actualizada");
      await load();
    } catch {
      setErr("No se pudo actualizar la receta");
    } finally {
      setLoading(false);
    }
  }

  async function deleteRecipe() {
    if (!recipeId) return;
    if (!confirm(`¿Eliminar la receta "${recipe?.name ?? "esta receta"}"?`)) return;
    setLoading(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_URL}/recipes/${recipeId}`, { method: "DELETE" });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo eliminar la receta");
        setErr(msg);
        return;
      }
      setNotice("✅ Receta eliminada");
      if (recipe?.product_id) {
        window.location.href = `/products/${recipe.product_id}`;
      } else {
        window.location.href = "/products";
      }
    } catch {
      setErr("No se pudo eliminar la receta");
    } finally {
      setLoading(false);
    }
  }

  async function saveMarginTarget() {
    if (!recipeId) return;
    setSavingMargin(true);
    setErr(null);
    setNotice(null);
    const raw = Number(priceValue);
    const marginToSave =
      priceMode === "margin" ? Math.min(Math.max(raw, 0), 0.99) : raw / (1 + Math.max(raw, 0));
    try {
      const res = await fetch(`${API_URL}/recipes/${recipeId}/margin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ margin_target: marginToSave, apply_to_product: true }),
      });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo guardar el margen");
        setErr(msg);
        return;
      }
      setRecipe((prev) =>
        prev
          ? { ...prev, margin_target: marginToSave, product_margin_target: marginToSave }
          : prev
      );
      setNotice("✅ Margen objetivo guardado para la receta y el producto");
    } catch {
      setErr("No se pudo guardar el margen");
    } finally {
      setSavingMargin(false);
    }
  }

  const isVariable = cost?.is_variable || items.some((i) => i.qty_formula);
  const willUseFormula = isVariable || calcMode !== "fixed";
  const currency = cost?.currency || operationalCurrency || "HNL";
  const materialsCost = Number(cost?.materials_cost || 0);
  const operationalCost = Number(operationalPerOrder || 0);
  const totalCost = materialsCost + operationalCost;
  const safeMargin = Math.min(Math.max(priceValue, 0), 0.99);
  const safeMarkup = Math.max(priceValue, 0);
  const suggestedPrice =
    priceMode === "margin" ? totalCost / (1 - safeMargin) : totalCost * (1 + safeMarkup);
  const utilMaterials = suggestedPrice - materialsCost;
  const utilTotal = suggestedPrice - totalCost;
  const zeroCostSupplies = useMemo(
    () => items.filter((i) => Number(i.avg_unit_cost || 0) <= 0),
    [items]
  );
  const hasZeroCostSupplies = zeroCostSupplies.length > 0;
  const hasOperationalCost = operationalCost > 0;
  const consumptionBySupply = useMemo(() => {
    const map = new Map<string, number>();
    (cost?.items || []).forEach((it) => {
      if (it.supply_id) map.set(it.supply_id, Number(it.qty_with_waste));
    });
    return map;
  }, [cost]);

  async function readError(res: Response, fallback: string): Promise<string> {
    try {
      const data = await res.json();
      return data?.detail || data?.error || fallback;
    } catch {
      const text = await res.text().catch(() => "");
      return text || fallback;
    }
  }

  return (
    <main className="p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Receta (BOM)</h1>
          {recipe && (
            <div className="text-sm text-zinc-600">
              {recipe.name} • {recipe.product_type === "variable" ? "Variable" : "Fija"}
            </div>
          )}
        </div>
        <Link className="font-semibold hover:underline" href="/products">
          ← Volver a Productos
        </Link>
      </div>

      <div className="card mb-6">
        <div className="font-semibold mb-2">Modo de trabajo</div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className={simpleMode ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
            onClick={() => {
              setSimpleMode(true);
              setShowCalcAdvanced(false);
            }}
            type="button"
          >
            Simple
          </button>
          <button
            className={!simpleMode ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
            onClick={() => setSimpleMode(false)}
            type="button"
          >
            Avanzado
          </button>
        </div>
        <div className="text-xs text-zinc-600 mt-2">
          En modo simple solo ves lo esencial para generar precio y aceptar. Cambia a avanzado para variables, opciones y reglas.
        </div>
      </div>

      {recipe && (
        <div className="card mb-6">
          <div className="font-semibold mb-2">Editar receta</div>
          <div className="flex gap-2 flex-wrap items-end">
            <label className="grid gap-1">
              <span className="text-sm font-medium">Nombre</span>
              <input
                className="border rounded px-3 py-2"
                value={editRecipeName}
                onChange={(e) => setEditRecipeName(e.target.value)}
              />
            </label>
            <button className="btn btn-primary" onClick={saveRecipeName} disabled={loading}>
              Guardar
            </button>
            <button className="btn btn-secondary" onClick={deleteRecipe} disabled={loading}>
              Eliminar receta
            </button>
          </div>
        </div>
      )}

      <div className="card mb-4">
        <div className="font-semibold mb-2">Vista previa</div>
        {willUseFormula && (
          <div className="grid gap-3 sm:grid-cols-3 mb-3">
            <label className="grid gap-1">
              <span className="text-sm font-medium">Ancho</span>
              <input
                className="border rounded px-3 py-2"
                type="number"
                min={0}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Alto</span>
              <input
                className="border rounded px-3 py-2"
                type="number"
                min={0}
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
              />
            </label>
            <div className="text-xs text-zinc-600 mt-6">
              Fórmulas permiten variables `width`/`height` (o `ancho`/`alto`)
            </div>
          </div>
        )}

        {!simpleMode && options.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3 mb-3">
            {options.map((o) => (
              <label key={o.id} className="grid gap-1">
                <span className="text-sm font-medium">{o.label}</span>
                <select
                  className="border rounded px-3 py-2"
                  value={previewOpts[o.code] ?? ""}
                  onChange={(e) =>
                    setPreviewOpts((prev) => ({ ...prev, [o.code]: e.target.value }))
                  }
                >
                  <option value="">Selecciona…</option>
                  {o.values.map((v) => (
                    <option key={v.id} value={v.value_key}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}

        {!simpleMode && variables.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3 mb-3">
            {variables.map((v) => (
              <label key={v.id} className="grid gap-1">
                <span className="text-sm font-medium">{v.label}</span>
                <input
                  className="border rounded px-3 py-2"
                  type="number"
                  min={v.min_value ?? undefined}
                  max={v.max_value ?? undefined}
                  value={previewVars[v.code] ?? ""}
                  onChange={(e) =>
                    setPreviewVars((prev) => ({ ...prev, [v.code]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
        )}

        {cost && (
          <div className="text-2xl font-bold">
            {cost.currency} {cost.materials_cost}
          </div>
        )}
        <div className="text-xs text-zinc-600 mt-2">
          Nota: si el insumo es por pieza, la merma se calcula como rendimiento real (no como +%).
        </div>
        <div className="text-xs text-zinc-600 mt-2">
          Consejo: primero define el costo de materiales y luego el margen objetivo en la calculadora de precio.
        </div>
      </div>

      {cost && (
        <div className="card mb-6">
          {hasZeroCostSupplies && (
            <div className="card mb-3 border-amber-200 bg-amber-50">
              <div className="text-sm font-semibold text-amber-800">⚠️ Costos en 0</div>
              <div className="text-sm text-amber-800">
                Estos insumos no tienen costo promedio todavía:
                <b> {zeroCostSupplies.map((s) => s.supply_name).join(", ")}</b>.
                Registra compras para calcular costo unitario.
              </div>
              <div className="mt-2">
                <a className="btn btn-outline btn-sm" href="/purchases">
                  Ir a Compras
                </a>
              </div>
            </div>
          )}
          {!hasOperationalCost && (
            <div className="card mb-3 border-sky-200 bg-sky-50">
              <div className="text-sm font-semibold text-sky-800">ℹ️ Costo operativo en 0</div>
              <div className="text-sm text-sky-800">
                No hay un período activo de costos fijos. Si lo deseas, actívalo para incluir el operativo por pedido.
              </div>
              <div className="mt-2">
                <a className="btn btn-outline btn-sm" href="/fixed-costs">
                  Ir a Costos fijos
                </a>
              </div>
            </div>
          )}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="font-semibold">Precio sugerido automático</div>
              <div className="text-xs text-zinc-600">
                Margen = ganancia / precio • Markup = ganancia / costo
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                className="border rounded px-3 py-2 text-sm"
                value={priceMode}
                onChange={(e) => setPriceMode(e.target.value as "margin" | "markup")}
              >
                <option value="margin">Margen</option>
                <option value="markup">Markup</option>
              </select>
              <input
                className="border rounded px-3 py-2 w-28"
                type="number"
                step="0.01"
                min={0}
                max={priceInputMode === "percent" ? 99 : priceMode === "margin" ? 0.99 : 5}
                value={priceInputMode === "percent" ? priceValue * 100 : priceValue}
                onChange={(e) => {
                  const raw = Number(e.target.value || 0);
                  setPriceValue(priceInputMode === "percent" ? raw / 100 : raw);
                }}
                placeholder="Ej: 0.40"
              />
              <div className="flex items-center gap-2 text-xs text-zinc-600">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={priceInputMode === "percent"}
                    onChange={(e) => setPriceInputMode(e.target.checked ? "percent" : "decimal")}
                  />
                  Ingresar en %
                </label>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setPriceMode("margin");
                    setPriceValue(0.4);
                    setPriceInputMode("percent");
                  }}
                >
                  Usar 40%
                </button>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={saveMarginTarget}
                disabled={savingMargin}
              >
                {savingMargin ? "Guardando..." : "Aceptar margen"}
              </button>
            </div>
            <div className="text-xs text-zinc-600 mt-1">
              Ej: 0.40 = 40%
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="stat-card bg-amber-50 border-amber-200">
              <div className="text-xs text-amber-700">Costo materiales</div>
              <div className="text-xl font-bold text-amber-900">
                {currency} {materialsCost.toFixed(2)}
              </div>
              <div className="text-xs text-amber-700">Por unidad</div>
            </div>
            <div className="stat-card bg-amber-50 border-amber-200">
              <div className="text-xs text-amber-700">Costo operativo</div>
              <div className="text-xl font-bold text-amber-900">
                {operationalCurrency} {operationalCost.toFixed(2)}
              </div>
              <div className="text-xs text-amber-700">Por pedido (activo)</div>
            </div>
            <div className="stat-card bg-emerald-50 border-emerald-200">
              <div className="text-xs text-emerald-700">Precio sugerido</div>
              <div className="text-xl font-bold text-emerald-900">
                {currency} {suggestedPrice.toFixed(2)}
              </div>
              <div className="text-xs text-emerald-700">
                {priceMode === "margin"
                  ? `Margen ${(safeMargin * 100).toFixed(0)}%`
                  : `Markup ${(safeMarkup * 100).toFixed(0)}%`}
              </div>
            </div>
            <div className="stat-card bg-sky-50 border-sky-200">
              <div className="text-xs text-sky-700">Utilidad materiales</div>
              <div className="text-xl font-bold text-sky-900">
                {currency} {utilMaterials.toFixed(2)}
              </div>
              <div className="text-xs text-sky-700">Precio − materiales</div>
            </div>
            <div className="stat-card bg-sky-50 border-sky-200">
              <div className="text-xs text-sky-700">Utilidad total</div>
              <div className="text-xl font-bold text-sky-900">
                {currency} {utilTotal.toFixed(2)}
              </div>
              <div className="text-xs text-sky-700">Precio − (materiales + operativo)</div>
            </div>
          </div>

          <div className="text-xs text-zinc-600 mt-3">
            Nota: el operativo viene del período activo de costos fijos (prorrateado por pedido).
          </div>
        </div>
      )}

      {!simpleMode && (
      <div className="card mb-6">
        <div className="font-semibold mb-2">Variables numéricas</div>
        <div className="grid gap-3 sm:grid-cols-5">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Código</span>
            <input
              className="border rounded px-3 py-2"
              value={varCode}
              onChange={(e) => setVarCode(e.target.value)}
              placeholder="Ej: ancho_extra"
            />
          </label>
          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium">Etiqueta</span>
            <input
              className="border rounded px-3 py-2"
              value={varLabel}
              onChange={(e) => setVarLabel(e.target.value)}
              placeholder="Ej: Ancho extra"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Min</span>
            <input
              className="border rounded px-3 py-2"
              type="number"
              value={varMin}
              onChange={(e) => setVarMin(e.target.value)}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Max</span>
            <input
              className="border rounded px-3 py-2"
              type="number"
              value={varMax}
              onChange={(e) => setVarMax(e.target.value)}
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 mt-3">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Default</span>
            <input
              className="border rounded px-3 py-2"
              type="number"
              value={varDefault}
              onChange={(e) => setVarDefault(e.target.value)}
            />
          </label>
          <div className="sm:col-span-2 flex items-end">
            <button className="btn btn-primary" onClick={addVariable} disabled={loading}>
              Agregar variable
            </button>
          </div>
        </div>

        {variables.length === 0 ? (
          <p className="text-zinc-600 mt-3">No hay variables aún.</p>
        ) : (
          <table className="table-base w-full mt-3">
            <thead>
              <tr>
                <th className="border p-2 text-left">Código</th>
                <th className="border p-2 text-left">Etiqueta</th>
                <th className="border p-2 text-right">Min</th>
                <th className="border p-2 text-right">Max</th>
                <th className="border p-2 text-right">Default</th>
                <th className="border p-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {variables.map((v) => (
                <tr key={v.id}>
                  <td className="border p-2">{v.code}</td>
                  <td className="border p-2">{v.label}</td>
                  <td className="border p-2 text-right">{v.min_value ?? "—"}</td>
                  <td className="border p-2 text-right">{v.max_value ?? "—"}</td>
                  <td className="border p-2 text-right">{v.default_value ?? "—"}</td>
                  <td className="border p-2">
                    <button className="btn btn-secondary btn-sm" onClick={() => deleteVariable(v.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      )}

      {!simpleMode && (
      <div className="card mb-6">
        <div className="font-semibold mb-2">Opciones (catálogo)</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Código</span>
            <input
              className="border rounded px-3 py-2"
              value={optCode}
              onChange={(e) => setOptCode(e.target.value)}
              placeholder="Ej: doble_cara"
            />
          </label>
          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium">Etiqueta</span>
            <input
              className="border rounded px-3 py-2"
              value={optLabel}
              onChange={(e) => setOptLabel(e.target.value)}
              placeholder="Ej: Doble cara"
            />
          </label>
        </div>
        <div className="mt-3">
          <button className="btn btn-primary" onClick={addOption} disabled={loading}>
            Crear opción
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-4 mt-4">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Opción</span>
            <select
              className="border rounded px-3 py-2"
              value={valOptionId}
              onChange={(e) => setValOptionId(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label} ({o.code})
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Valor key</span>
            <input
              className="border rounded px-3 py-2"
              value={valKey}
              onChange={(e) => setValKey(e.target.value)}
              placeholder="Ej: si"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Etiqueta</span>
            <input
              className="border rounded px-3 py-2"
              value={valLabel}
              onChange={(e) => setValLabel(e.target.value)}
              placeholder="Ej: Sí"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Valor numérico</span>
            <input
              className="border rounded px-3 py-2"
              type="number"
              value={valNumeric}
              onChange={(e) => setValNumeric(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-3">
          <button className="btn btn-primary" onClick={addOptionValue} disabled={loading}>
            Agregar valor
          </button>
        </div>

        {options.length === 0 ? (
          <p className="text-zinc-600 mt-3">No hay opciones aún.</p>
        ) : (
          <div className="mt-3 grid gap-3">
            {options.map((o) => (
              <div key={o.id} className="card">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">{o.label} ({o.code})</div>
                  <button className="btn btn-secondary btn-sm" onClick={() => deleteOption(o.id)}>
                    Eliminar opción
                  </button>
                </div>
                {o.values.length === 0 ? (
                  <p className="text-zinc-600">Sin valores.</p>
                ) : (
                  <table className="table-base w-full">
                    <thead>
                      <tr>
                        <th className="border p-2 text-left">Key</th>
                        <th className="border p-2 text-left">Etiqueta</th>
                        <th className="border p-2 text-right">Num</th>
                        <th className="border p-2 text-left">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {o.values.map((v) => (
                        <tr key={v.id}>
                          <td className="border p-2">{v.value_key}</td>
                          <td className="border p-2">{v.label}</td>
                          <td className="border p-2 text-right">{v.numeric_value}</td>
                          <td className="border p-2">
                            <button className="btn btn-secondary btn-sm" onClick={() => deleteOptionValue(v.id)}>
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {!simpleMode && (
      <div className="card mb-6">
        <div className="font-semibold mb-2">Reglas (if/then)</div>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Scope</span>
            <select
              className="border rounded px-3 py-2"
              value={ruleScope}
              onChange={(e) => setRuleScope(e.target.value)}
            >
              <option value="global">Global</option>
              <option value="supply">Por insumo</option>
            </select>
          </label>
          {ruleScope === "supply" && (
            <label className="grid gap-1">
              <span className="text-sm font-medium">Insumo</span>
              <select
                className="border rounded px-3 py-2"
                value={ruleSupplyId}
                onChange={(e) => setRuleSupplyId(e.target.value)}
              >
                <option value="">Selecciona…</option>
                {supplies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="grid gap-1">
            <span className="text-sm font-medium">Variable</span>
            <input
              className="border rounded px-3 py-2"
              value={ruleVar}
              onChange={(e) => setRuleVar(e.target.value)}
              placeholder="Ej: doble_cara"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Operador</span>
            <select
              className="border rounded px-3 py-2"
              value={ruleOp}
              onChange={(e) => setRuleOp(e.target.value)}
            >
              <option value="==">==</option>
              <option value="!=">!=</option>
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value=">=">&gt;=</option>
              <option value="<=">&lt;=</option>
            </select>
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-4 mt-3">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Valor</span>
            <input
              className="border rounded px-3 py-2"
              value={ruleValue}
              onChange={(e) => setRuleValue(e.target.value)}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Efecto</span>
            <select
              className="border rounded px-3 py-2"
              value={ruleEffectType}
              onChange={(e) => setRuleEffectType(e.target.value)}
            >
              <option value="multiplier">Multiplicador</option>
              <option value="add_qty">Sumar qty</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Valor efecto</span>
            <input
              className="border rounded px-3 py-2"
              type="number"
              value={ruleEffectValue}
              onChange={(e) => setRuleEffectValue(e.target.value)}
            />
          </label>
          <div className="flex items-end">
            <button className="btn btn-primary" onClick={addRule} disabled={loading}>
              Agregar regla
            </button>
          </div>
        </div>

        {rules.length === 0 ? (
          <p className="text-zinc-600 mt-3">No hay reglas aún.</p>
        ) : (
          <table className="table-base w-full mt-3">
            <thead>
              <tr>
                <th className="border p-2 text-left">Scope</th>
                <th className="border p-2 text-left">Variable</th>
                <th className="border p-2 text-left">Condición</th>
                <th className="border p-2 text-left">Efecto</th>
                <th className="border p-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td className="border p-2">
                    {r.scope === "supply"
                      ? `Insumo (${supplies.find((s) => s.id === r.target_supply_id)?.name || r.target_supply_id})`
                      : "Global"}
                  </td>
                  <td className="border p-2">{r.condition_var}</td>
                  <td className="border p-2">
                    {r.operator} {r.condition_value}
                  </td>
                  <td className="border p-2">
                    {r.effect_type} {r.effect_value}
                  </td>
                  <td className="border p-2">
                    <button className="btn btn-secondary btn-sm" onClick={() => deleteRule(r.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      )}

      <div className="card mb-6">
        <div className="font-semibold mb-2">Agregar insumo</div>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium">Insumo</span>
            <select
              className="border rounded px-3 py-2"
              value={supplyId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSupplyId(nextId);
                const selected = supplies.find((s) => s.id === nextId);
                applyAutoCalcForSupply(selected);
              }}
            >
              <option value="">Selecciona…</option>
              {supplies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.unit_base})
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Cantidad base (si no usas fórmula)</span>
            <input
              className="border rounded px-3 py-2"
              type="number"
              min={0}
              value={qtyBase}
              onChange={(e) => setQtyBase(Number(e.target.value))}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Merma %</span>
            <input
              className="border rounded px-3 py-2"
              type="number"
              min={0}
              value={wastePct}
              onChange={(e) => setWastePct(Number(e.target.value))}
            />
          </label>
        </div>
        {simpleMode && (
          <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
            <div className="text-xs text-zinc-600">
              Cálculo automático: {calcModeLabel}
              {calcMode !== "fixed" && qtyFormula ? ` • ${qtyFormula}` : ""}
            </div>
            <button
              className="btn btn-outline btn-sm"
              type="button"
              onClick={() => setShowCalcAdvanced((v) => !v)}
            >
              {showCalcAdvanced ? "Ocultar cálculo" : "Modificar cálculo"}
            </button>
          </div>
        )}

        {(!simpleMode || showCalcAdvanced) && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 mt-3">
              <label className="grid gap-1">
                <span className="text-sm font-medium">Modo de cálculo</span>
                <select
                  className="border rounded px-3 py-2"
                  value={calcMode}
                  onChange={(e) => {
                    const next = e.target.value as
                      | "fixed"
                      | "area"
                      | "perimeter"
                      | "width"
                      | "height"
                      | "manual";
                    if (next === "manual" && !manualFormula && qtyFormula) {
                      setManualFormula(qtyFormula);
                    }
                    setCalcMode(next);
                  }}
                >
                  <option value="fixed">Fijo (usa cantidad base)</option>
                  <option value="area">Área (ancho × alto)</option>
                  <option value="perimeter">Perímetro (2 × (ancho + alto))</option>
                  <option value="width">Ancho</option>
                  <option value="height">Alto</option>
                  <option value="manual">Manual (escribir fórmula)</option>
                </select>
                <span className="text-xs text-zinc-600">
                  Se sugiere automáticamente según la unidad base del insumo.
                </span>
              </label>
              {calcMode !== "fixed" && calcMode !== "manual" && (
                <label className="grid gap-1">
                  <span className="text-sm font-medium">Factor</span>
                  <input
                    className="border rounded px-3 py-2"
                    type="number"
                    step="0.01"
                    min={0}
                    value={calcFactor}
                    onChange={(e) => setCalcFactor(Number(e.target.value))}
                    placeholder="Ej: 1.15"
                  />
                </label>
              )}
            </div>

            {calcMode === "fixed" ? (
              <div className="text-xs text-zinc-600 mt-2">
                Se usará la cantidad base fija para este insumo.
              </div>
            ) : (
              <div className="grid gap-2 mt-3">
                <label className="grid gap-1">
                  <span className="text-sm font-medium">
                    {calcMode === "manual" ? "Fórmula (manual)" : "Fórmula automática"}
                  </span>
                  <input
                    className="border rounded px-3 py-2"
                    value={qtyFormula}
                    onChange={(e) => {
                      if (calcMode !== "manual") return;
                      setManualFormula(e.target.value);
                      setQtyFormula(e.target.value);
                    }}
                    readOnly={calcMode !== "manual"}
                    placeholder="Ej: width * height * 1.15"
                  />
                </label>
                {calcMode !== "manual" && qtyFormula && (
                  <div className="text-xs text-zinc-600">
                    Se calcula con ancho/alto. Puedes cambiar el modo o pasar a manual.
                  </div>
                )}
                {calcMode !== "manual" && autoPreviewQty != null && (
                  <div className="text-xs text-zinc-600">
                    Vista rápida con el ancho/alto actual: {autoPreviewQty.toFixed(3)}
                  </div>
                )}
                {calcMode === "manual" && (
                  <div className="text-xs text-zinc-600">
                    Si usas fórmula, la cantidad base queda como respaldo (no se usa en cálculos).
                  </div>
                )}
              </div>
            )}
          </>
        )}
        <div className="mt-3">
          <button className="btn btn-primary" onClick={addItem} disabled={!supplyId || loading}>
            Agregar
          </button>
        </div>
      </div>

      {err && <div className="mb-3 text-red-700 font-semibold">❌ {err}</div>}
      {notice && <div className="mb-3 text-green-700 font-semibold">{notice}</div>}

      {items.length === 0 ? (
        <p className="text-zinc-600">Esta receta no tiene insumos aún.</p>
      ) : (
        <table className="table-base w-full">
          <thead>
            <tr>
              <th className="border p-2 text-left">Insumo</th>
              <th className="border p-2 text-right">Cantidad</th>
              <th className="border p-2 text-right">Merma %</th>
              <th className="border p-2 text-right">Fórmula</th>
              <th className="border p-2 text-right">Consumo real</th>
              <th className="border p-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td className="border p-2">
                  {editingItemId === it.id ? (
                    <select
                      className="border rounded px-2 py-1"
                      value={editSupplyId}
                      onChange={(e) => setEditSupplyId(e.target.value)}
                    >
                      <option value="">Selecciona…</option>
                      {supplies.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.unit_base})
                        </option>
                      ))}
                    </select>
                  ) : (
                    it.supply_name
                  )}
                </td>
                <td className="border p-2 text-right">
                  {editingItemId === it.id ? (
                    <input
                      className="border rounded px-2 py-1 w-24 text-right"
                      type="number"
                      min={0}
                      value={editQtyBase}
                      onChange={(e) => setEditQtyBase(Number(e.target.value))}
                    />
                  ) : (
                    `${it.qty_base} ${it.unit_base}`
                  )}
                </td>
                <td className="border p-2 text-right">
                  {editingItemId === it.id ? (
                    <input
                      className="border rounded px-2 py-1 w-20 text-right"
                      type="number"
                      min={0}
                      value={editWastePct}
                      onChange={(e) => setEditWastePct(Number(e.target.value))}
                    />
                  ) : (
                    it.waste_pct
                  )}
                </td>
                <td className="border p-2 text-right">
                  {editingItemId === it.id ? (
                    <input
                      className="border rounded px-2 py-1"
                      value={editQtyFormula}
                      onChange={(e) => setEditQtyFormula(e.target.value)}
                    />
                  ) : (
                    it.qty_formula || "—"
                  )}
                </td>
                <td className="border p-2 text-right">
                  {consumptionBySupply.has(it.supply_id)
                    ? `${(consumptionBySupply.get(it.supply_id) || 0).toFixed(3)} ${it.unit_base}`
                    : "—"}
                </td>
                <td className="border p-2">
                  {editingItemId === it.id ? (
                    <div className="flex gap-2 flex-wrap">
                      <button className="btn btn-primary btn-sm" onClick={() => saveItemEdit(it.id)}>
                        Guardar
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingItemId(null)}>
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      <button className="btn btn-secondary btn-sm" onClick={() => startEditItem(it)}>
                        Editar
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => deleteItem(it.id)}>
                        Eliminar
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
