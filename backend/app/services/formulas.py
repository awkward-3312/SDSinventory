import ast
import math
import re
from fastapi import HTTPException


ALLOWED_BINOPS = (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow, ast.Mod)
ALLOWED_UNARYOPS = (ast.UAdd, ast.USub)
_NAME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_]*$")


class FormulaEvaluator(ast.NodeVisitor):
    def __init__(self, variables: dict[str, float]):
        self.variables = {k.lower(): float(v) for k, v in variables.items()}

    def visit(self, node):  # type: ignore[override]
        if isinstance(node, ast.Expression):
            return self.visit(node.body)
        if isinstance(node, ast.BinOp):
            left = self.visit(node.left)
            right = self.visit(node.right)
            if isinstance(node.op, ast.Add):
                return left + right
            if isinstance(node.op, ast.Sub):
                return left - right
            if isinstance(node.op, ast.Mult):
                return left * right
            if isinstance(node.op, ast.Div):
                return left / right
            if isinstance(node.op, ast.Pow):
                return left ** right
            if isinstance(node.op, ast.Mod):
                return left % right
            raise HTTPException(status_code=400, detail="Operador no permitido en fórmula")
        if isinstance(node, ast.UnaryOp):
            val = self.visit(node.operand)
            if isinstance(node.op, ast.UAdd):
                return +val
            if isinstance(node.op, ast.USub):
                return -val
            raise HTTPException(status_code=400, detail="Operador unario no permitido en fórmula")
        if isinstance(node, ast.Num):  # py<3.8
            return float(node.n)
        if isinstance(node, ast.Constant):
            if isinstance(node.value, (int, float)):
                return float(node.value)
            raise HTTPException(status_code=400, detail="Constante no permitida en fórmula")
        if isinstance(node, ast.Name):
            name = node.id.lower()
            if not _NAME_RE.match(node.id):
                raise HTTPException(status_code=400, detail=f"Variable inválida en fórmula: {node.id}")
            if name not in self.variables:
                raise HTTPException(status_code=400, detail=f"Variable requerida no enviada: {node.id}")
            return float(self.variables[name])
        if isinstance(node, ast.Call):
            raise HTTPException(status_code=400, detail="Funciones no permitidas en fórmula")
        raise HTTPException(status_code=400, detail="Expresión no permitida en fórmula")


def eval_formula(expr: str, variables: dict[str, float]) -> float:
    try:
        tree = ast.parse(expr, mode="eval")
    except SyntaxError:
        raise HTTPException(status_code=400, detail="Fórmula inválida")
    evaluator = FormulaEvaluator(variables)
    return float(evaluator.visit(tree))


def validate_formula(expr: str, allowed_names: set[str] | None = None) -> set[str]:
    if not expr or not expr.strip():
        raise HTTPException(status_code=400, detail="Fórmula vacía")
    if len(expr) > 200:
        raise HTTPException(status_code=400, detail="Fórmula demasiado larga")
    try:
        tree = ast.parse(expr, mode="eval")
    except SyntaxError:
        raise HTTPException(status_code=400, detail="Fórmula inválida")

    names: set[str] = set()
    allowed = {n.lower() for n in allowed_names} if allowed_names else None

    for node in ast.walk(tree):
        if isinstance(node, ast.Name):
            if not _NAME_RE.match(node.id):
                raise HTTPException(status_code=400, detail=f"Variable inválida en fórmula: {node.id}")
            name = node.id.lower()
            if allowed is not None and name not in allowed:
                raise HTTPException(status_code=400, detail=f"Variable no permitida en fórmula: {node.id}")
            names.add(name)
        elif isinstance(node, ast.BinOp):
            if not isinstance(node.op, ALLOWED_BINOPS):
                raise HTTPException(status_code=400, detail="Operador no permitido en fórmula")
        elif isinstance(node, ast.UnaryOp):
            if not isinstance(node.op, ALLOWED_UNARYOPS):
                raise HTTPException(status_code=400, detail="Operador unario no permitido en fórmula")
        elif isinstance(node, (ast.Call, ast.Attribute, ast.Subscript, ast.Lambda)):
            raise HTTPException(status_code=400, detail="Expresión no permitida en fórmula")
        elif isinstance(node, (ast.Expr, ast.Expression, ast.Load, ast.Constant, ast.Num)):
            pass
        elif isinstance(node, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow, ast.Mod, ast.UAdd, ast.USub)):
            pass
        else:
            # block any unexpected node
            if not isinstance(node, (ast.BinOp, ast.UnaryOp, ast.Name, ast.Constant, ast.Num, ast.Expression)):
                raise HTTPException(status_code=400, detail="Expresión no permitida en fórmula")

    # evaluate with safe dummy values to catch invalid math
    dummy = {n: 1.0 for n in names}
    val = eval_formula(expr, dummy)
    if not math.isfinite(val):
        raise HTTPException(status_code=400, detail="Fórmula inválida (resultado no finito)")
    if val <= 0:
        raise HTTPException(status_code=400, detail="Fórmula inválida (resultado debe ser > 0)")
    return names
