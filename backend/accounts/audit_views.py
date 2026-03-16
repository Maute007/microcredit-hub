"""
Vista de auditoria: histórico agregado de acções de utilizadores (django-simple-history).
Acesso restrito a admins.
"""
import csv
import io
from django.apps import apps
from django.http import HttpResponse
from django.utils.formats import number_format
from rest_framework import permissions
from rest_framework.views import APIView
from rest_framework.response import Response

# Mapeamento: (app_label, model_name) -> nome legível da entidade
AUDIT_ENTITIES = {
    ("accounts", "HistoricalUser"): "Utilizador",
    ("accounts", "HistoricalProfile"): "Perfil",
    ("accounts", "HistoricalRole"): "Papel",
    ("clients", "HistoricalClient"): "Cliente",
    ("hr", "HistoricalEmployee"): "Colaborador",
    ("hr", "HistoricalVacation"): "Férias",
    ("hr", "HistoricalAttendanceRecord"): "Presença",
    ("hr", "HistoricalSalarySlip"): "Recibo",
    ("hr", "HistoricalPayrollAdjustment"): "Lançamento folha",
    ("loans", "HistoricalLoan"): "Empréstimo",
    ("loans", "HistoricalPayment"): "Pagamento",
    ("loans", "HistoricalLoanCategory"): "Categoria empréstimo",
    ("loans", "HistoricalCollateral"): "Garantia",
    ("accounting", "HistoricalTransaction"): "Transação",
    ("accounting", "HistoricalTax"): "Imposto",
}

ACTION_LABELS = {"+": "Criado", "~": "Alterado", "-": "Eliminado"}


# select_related para obter nomes legíveis (ex: cliente do empréstimo)
SELECT_RELATED = {
    ("loans", "HistoricalLoan"): ("history_user", "client"),
    ("loans", "HistoricalPayment"): ("history_user", "loan", "loan__client"),
    ("loans", "HistoricalCollateral"): ("history_user", "loan", "loan__client"),
    ("accounting", "HistoricalTransaction"): ("history_user", "loan", "loan__client"),
}


def _build_audit_queryset(app_label, model_name, user_id=None, date_from=None, date_to=None, action_type=None):
    """Constrói queryset para um modelo histórico com filtros."""
    try:
        model = apps.get_model(app_label, model_name)
    except LookupError:
        return None
    qs = model.objects.select_related("history_user").all()
    rel = SELECT_RELATED.get((app_label, model_name))
    if rel:
        qs = qs.select_related(*rel)
    if user_id is not None:
        qs = qs.filter(history_user_id=user_id)
    if date_from:
        qs = qs.filter(history_date__date__gte=date_from)
    if date_to:
        qs = qs.filter(history_date__date__lte=date_to)
    if action_type and action_type in ("+", "~", "-"):
        qs = qs.filter(history_type=action_type)
    return qs


def _fmt_mt(val):
    """Formata montante em MT."""
    if val is None:
        return ""
    try:
        return f"{float(val):,.2f} MT".replace(",", " ").replace(".", ",")
    except (TypeError, ValueError):
        return str(val)


def _get_display_name(rec, entity_name, app_label, model_name):
    """Retorna um nome legível para o registo (ex: «Maria João - 5.000 MT»)."""
    obj_id = getattr(rec, "id", None)
    try:
        if (app_label, model_name) == ("clients", "HistoricalClient"):
            name = getattr(rec, "name", None) or ""
            return name or f"Cliente #{obj_id}"
        if (app_label, model_name) == ("loans", "HistoricalLoan"):
            client = getattr(rec, "client", None)
            client_name = getattr(client, "name", None) if client else None
            amount = getattr(rec, "amount", None)
            amt = _fmt_mt(amount) if amount is not None else ""
            if client_name:
                return f"{client_name} — {amt}"
            return f"Empréstimo #{obj_id} — {amt}"
        if (app_label, model_name) == ("loans", "HistoricalPayment"):
            loan = getattr(rec, "loan", None)
            client_name = ""
            if loan:
                client = getattr(loan, "client", None)
                client_name = getattr(client, "name", "") if client else ""
            amount = _fmt_mt(getattr(rec, "amount", None))
            date_val = getattr(rec, "date", None)
            date_str = str(date_val) if date_val else ""
            if client_name:
                return f"{client_name} — {amount}" + (f" ({date_str})" if date_str else "")
            return f"Pagamento {amount}" + (f" — {date_str}" if date_str else "")
        if (app_label, model_name) == ("loans", "HistoricalLoanCategory"):
            return getattr(rec, "name", None) or f"Categoria #{obj_id}"
        if (app_label, model_name) == ("loans", "HistoricalCollateral"):
            desc = getattr(rec, "description", None) or ""
            return (desc[:60] + "…") if desc and len(desc) > 60 else (desc or f"Garantia #{obj_id}")
        if (app_label, model_name) == ("accounting", "HistoricalTransaction"):
            desc = getattr(rec, "description", None) or getattr(rec, "category", None) or ""
            amount = _fmt_mt(getattr(rec, "amount", None))
            t = getattr(rec, "type", "")
            tipo = "Entrada" if t == "entrada" else "Saída"
            return f"{tipo} {amount}" + (f" — {desc[:40]}" if desc else "")
        if (app_label, model_name) == ("accounting", "HistoricalTax"):
            return getattr(rec, "name", None) or f"Imposto #{obj_id}"
        if (app_label, model_name) in [
            ("accounts", "HistoricalUser"),
            ("accounts", "HistoricalProfile"),
            ("accounts", "HistoricalRole"),
        ]:
            user = getattr(rec, "history_user", None) if "User" in model_name else None
            if user:
                return getattr(user, "get_full_name", lambda: "")().strip() or getattr(user, "username", "") or ""
            return getattr(rec, "first_name", None) or getattr(rec, "username", None) or getattr(rec, "name", None) or f"#{obj_id}"
        if (app_label, model_name) in [
            ("hr", "HistoricalEmployee"),
            ("hr", "HistoricalVacation"),
            ("hr", "HistoricalAttendanceRecord"),
            ("hr", "HistoricalSalarySlip"),
            ("hr", "HistoricalPayrollAdjustment"),
        ]:
            name = getattr(rec, "employee_name", None) or getattr(rec, "name", None)
            if name:
                return str(name)
            emp = getattr(rec, "employee", None)
            if emp:
                return getattr(emp, "name", None) or str(emp)
    except Exception:
        pass
    return f"{entity_name} #{obj_id}" if obj_id is not None else entity_name


def _record_to_row(rec, entity_name, app_label, model_name):
    """Converte um registo histórico num dict para resposta/export."""
    source = f"{app_label}.{model_name}"
    display_name = _get_display_name(rec, entity_name, app_label, model_name)
    return {
        "id": rec.history_id,
        "source": source,
        "entity": entity_name,
        "object_id": getattr(rec, "id", None),
        "display_name": display_name,
        "action": rec.history_type,
        "action_label": ACTION_LABELS.get(rec.history_type, rec.history_type),
        "date": rec.history_date.isoformat() if rec.history_date else None,
        "date_date": rec.history_date.date().isoformat() if rec.history_date else None,
        "user_id": rec.history_user_id,
        "user_name": (rec.history_user.get_full_name() or rec.history_user.username) if rec.history_user else None,
        "user_username": rec.history_user.username if rec.history_user else None,
        "change_reason": rec.history_change_reason or "",
    }


class AuditLogView(APIView):
    """Histórico agregado de acções. Filtros: user, date_from, date_to, action_type. Paginação e exportação."""

    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        user_id = request.query_params.get("user")
        if user_id:
            try:
                user_id = int(user_id)
            except (ValueError, TypeError):
                user_id = None
        date_from = request.query_params.get("date_from", "").strip() or None
        date_to = request.query_params.get("date_to", "").strip() or None
        action_type = request.query_params.get("action_type", "").strip() or None
        format_type = request.query_params.get("format", "json")
        limit = min(int(request.query_params.get("limit", 100)), 500)
        offset = max(0, int(request.query_params.get("offset", 0)))

        rows = []
        fetch_per_model = 3000 if format_type == "csv" else min(limit + offset + 500, 2000)
        for (app_label, model_name), entity_name in AUDIT_ENTITIES.items():
            qs = _build_audit_queryset(app_label, model_name, user_id, date_from, date_to, action_type)
            if qs is None:
                continue
            for rec in qs.order_by("-history_date")[:fetch_per_model]:
                rows.append(_record_to_row(rec, entity_name, app_label, model_name))

        rows.sort(key=lambda r: r["date"] or "", reverse=True)
        total = len(rows)

        if format_type == "csv":
            export_rows = rows[:10000]
            return self._csv_response(export_rows, date_from, date_to)

        rows = rows[offset : offset + limit]
        return Response({
            "results": rows,
            "count": total,
            "limit": limit,
            "offset": offset,
        })

    def _csv_response(self, rows, date_from, date_to):
        buf = io.StringIO()
        buf.write("\ufeff")
        writer = csv.writer(buf)
        writer.writerow(["Data", "Utilizador", "Entidade", "Acção", "ID Objecto", "Motivo"])
        for r in rows:
            writer.writerow([
                r.get("date") or "",
                r.get("user_name") or r.get("user_username") or "",
                r.get("entity") or "",
                r.get("action_label") or "",
                r.get("object_id") or "",
                r.get("change_reason") or "",
            ])
        content = buf.getvalue().encode("utf-8-sig")
        resp = HttpResponse(content, content_type="text/csv; charset=utf-8")
        fn = f"auditoria_{date_from or 'inicio'}_{date_to or 'fim'}.csv"
        resp["Content-Disposition"] = f'attachment; filename="{fn}"'
        return resp


# Labels amigáveis para campos
FRIENDLY_FIELD_LABELS = {
    "name": "Nome",
    "first_name": "Nome próprio",
    "last_name": "Apelido",
    "username": "Utilizador",
    "email": "E-mail",
    "phone": "Telefone",
    "document": "Documento / BI",
    "address": "Morada",
    "city": "Cidade",
    "occupation": "Profissão",
    "status": "Estado",
    "amount": "Montante",
    "interest_rate": "Taxa de juro (%)",
    "term": "Prazo (meses)",
    "start_date": "Data de início",
    "end_date": "Data de término",
    "monthly_payment": "Prestação mensal",
    "total_amount": "Montante total",
    "date": "Data",
    "description": "Descrição",
    "category": "Categoria",
    "type": "Tipo",
    "method": "Método de pagamento",
    "receipt": "Referência do recibo",
    "installment_number": "Número da prestação",
    "item_type": "Tipo de item",
    "estimated_value": "Valor estimado",
    "condition": "Estado",
    "serial_number": "Número de série",
    "notes": "Observações",
    "code": "Código",
    "employee": "Colaborador",
    "client": "Cliente",
    "loan": "Empréstimo",
}


def _record_to_friendly_details(rec, app_label, model_name):
    """Converte o registo histórico numa lista de {label, value} com linguagem amigável."""
    skip = {"history_id", "history_date", "history_change_reason", "history_type", "history_user"}
    details = []
    for f in rec._meta.get_fields():
        if f.name in skip:
            continue
        if getattr(f, "many_to_many", False) or (getattr(f, "one_to_many", False) and not getattr(f, "concrete", True)):
            continue
        if not getattr(f, "concrete", True) and not hasattr(f, "get_internal_type"):
            continue
        try:
            val = getattr(rec, f.name, None)
        except Exception:
            continue
        if val is None:
            continue
        if isinstance(val, str) and not val.strip():
            continue
        label = FRIENDLY_FIELD_LABELS.get(f.name, getattr(f, "verbose_name", f.name) or f.name.replace("_", " ").title())
        if hasattr(f, "get_internal_type"):
            it = f.get_internal_type()
            if it == "DecimalField":
                val_str = _fmt_mt(val)
            elif it == "DateField":
                val_str = val.strftime("%d/%m/%Y") if hasattr(val, "strftime") else str(val)
            elif it == "DateTimeField":
                val_str = val.strftime("%d/%m/%Y %H:%M") if hasattr(val, "strftime") else str(val)
            elif it == "BooleanField":
                val_str = "Sim" if val else "Não"
            elif it == "ForeignKey" or it == "OneToOneField":
                val_str = str(val) if val else ""
            elif it == "CharField" and getattr(f, "choices", None):
                val_str = dict(f.choices).get(val, str(val))
            else:
                val_str = str(val)
        elif hasattr(val, "choices") and hasattr(f, "choices") and f.choices:
            val_str = dict(f.choices).get(val, str(val))
        else:
            val_str = str(val)
        if val_str:
            details.append({"label": str(label), "value": val_str})
    return details


# Mapeamento inverso: entidade legível -> (app_label, model_name)
ENTITY_TO_MODEL = {v: (a, m) for (a, m), v in AUDIT_ENTITIES.items()}


class AuditLogDetailView(APIView):
    """Detalhes de um registo de auditoria: campos alterados (diff). Requer entity e history_id."""

    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        entity = request.query_params.get("entity", "").strip()
        source = request.query_params.get("source", "").strip()  # app_label.model_name
        try:
            history_id = int(request.query_params.get("history_id", 0))
        except (ValueError, TypeError):
            return Response({"detail": "history_id inválido"}, status=400)

        app_label, model_name = None, None
        if source:
            parts = source.split(".")
            if len(parts) == 2 and (parts[0], parts[1]) in AUDIT_ENTITIES:
                app_label, model_name = parts[0], parts[1]
        if not app_label and entity and entity in ENTITY_TO_MODEL:
            app_label, model_name = ENTITY_TO_MODEL[entity]
        if not app_label or not model_name:
            return Response({"detail": "entity ou source inválido"}, status=400)

        try:
            model = apps.get_model(app_label, model_name)
        except LookupError:
            return Response({"detail": "Modelo não encontrado"}, status=404)

        rel = SELECT_RELATED.get((app_label, model_name))
        qs = model.objects.filter(history_id=history_id).select_related("history_user")
        if rel:
            qs = qs.select_related(*rel)
        rec = qs.first()
        if not rec:
            return Response({"detail": "Registo não encontrado"}, status=404)

        display_name = _get_display_name(
            rec, AUDIT_ENTITIES.get((app_label, model_name), entity), app_label, model_name
        )

        details = _record_to_friendly_details(rec, app_label, model_name)

        changes = []
        if rec.history_type == "~":
            obj_id = getattr(rec, "id", None)
            prev_qs = model.objects.filter(history_date__lt=rec.history_date)
            if obj_id is not None:
                prev_qs = prev_qs.filter(id=obj_id)
            prev = prev_qs.order_by("-history_date").first()
            if prev and hasattr(rec, "diff_against"):
                try:
                    delta = rec.diff_against(prev)
                    for c in delta.changes:
                        changes.append({
                            "field": c.field,
                            "old": str(c.old) if c.old is not None else None,
                            "new": str(c.new) if c.new is not None else None,
                        })
                except Exception:
                    pass

        return Response({
            "entity": AUDIT_ENTITIES.get((app_label, model_name), entity),
            "display_name": display_name,
            "history_id": history_id,
            "action": rec.history_type,
            "action_label": ACTION_LABELS.get(rec.history_type, rec.history_type),
            "date": rec.history_date.isoformat() if rec.history_date else None,
            "user_name": (rec.history_user.get_full_name() or rec.history_user.username) if rec.history_user else None,
            "object_id": getattr(rec, "id", None),
            "change_reason": rec.history_change_reason or "",
            "details": details,
            "changes": changes,
        })


class AuditLogLatestView(APIView):
    """Últimas acções de utilizadores (para dashboard/overview). limit 50 por defeito."""

    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        user_id = request.query_params.get("user")
        if user_id:
            try:
                user_id = int(user_id)
            except (ValueError, TypeError):
                user_id = None
        limit = min(int(request.query_params.get("limit", 50)), 100)

        rows = []
        per_model = max(limit // len(AUDIT_ENTITIES), 10)
        for (app_label, model_name), entity_name in AUDIT_ENTITIES.items():
            qs = _build_audit_queryset(app_label, model_name, user_id=user_id)
            if qs is None:
                continue
            for rec in qs.order_by("-history_date")[:per_model]:
                rows.append(_record_to_row(rec, entity_name, app_label, model_name))

        rows.sort(key=lambda r: r["date"] or "", reverse=True)
        return Response({"results": rows[:limit]})
