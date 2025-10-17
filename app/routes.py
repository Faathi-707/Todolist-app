# app/routes.py
from datetime import datetime, date  
from bson.objectid import ObjectId
from flask import Blueprint, render_template, request, jsonify, abort
from .db import tasks_collection, to_object_id, serialize
from .schemas import validate_create, validate_update
from pymongo.errors import PyMongoError

# Blueprint name "routes" prefixes endpoints as routes.<endpoint>
bp = Blueprint("routes", __name__)

# ---------------- HTML PAGES ----------------

@bp.get("/", endpoint="index")  # expose endpoint as routes.index
def home():
    """Landing page with listing; JS fetches data from /api."""
    return render_template("index.html")

@bp.get("/add", endpoint="add_task")  # expose endpoint as routes.add_task
def add_task_page():
    return render_template("add_task.html")

@bp.get("/tasks/<id>", endpoint="task_detail")
def task_detail_page(id):
    """Server-rendered page for an individual task."""
    col = tasks_collection()
    # Validate the id and look up the document
    try:
        oid = to_object_id(id)
    except ValueError:
        abort(404)

    doc = col.find_one({"_id": oid})
    if not doc:
        abort(404)

    task = serialize(doc)

    # Optional: compute overdue flag (not completed and due date in the past)
    is_overdue = False
    due = task.get("due_date")
    if due and not task.get("completed"):
        try:
            y, m, d = map(int, due.split("-"))
            is_overdue = date(y, m, d) < date.today()
        except Exception:
            # if due is malformed, just ignore and leave it not-overdue
            pass

    return render_template("task_detail.html", task=task, is_overdue=is_overdue)

# ---------------- JSON API ----------------

@bp.get("/api/tasks")
def list_tasks():
    """Return all tasks ordered by 'order' then 'created_at'."""
    try:
        col = tasks_collection()
        docs = col.find().sort([("order", 1), ("created_at", 1)])
        return jsonify([serialize(d) for d in docs]), 200
    except PyMongoError as e:
        return jsonify({"error": "db_error", "detail": str(e)}), 500
    except Exception as e:
        return jsonify({"error": "server_error", "detail": str(e)}), 500

@bp.post("/api/tasks")
def create_task():
    """Create a task. Body is JSON validated by schemas.validate_create."""
    payload = request.get_json(force=True, silent=True) or {}
    data, errors = validate_create(payload)
    if errors:
        return jsonify({"errors": errors}), 400

    now = datetime.utcnow().isoformat()
    data["created_at"] = now
    data["updated_at"] = now

    if payload.get("due_date"):
        data["due_date"] = payload["due_date"]

    col = tasks_collection()
    res = col.insert_one(data)
    created = col.find_one({"_id": res.inserted_id})
    return jsonify(serialize(created)), 201

@bp.patch("/api/tasks/<id>")
def update_task(id):
    """Partial update. Body validated by schemas.validate_update."""
    payload = request.get_json(force=True, silent=True) or {}
    doc, errors = validate_update(payload)
    if errors:
        return jsonify({"errors": errors}), 400

    doc["updated_at"] = datetime.utcnow().isoformat()

    col = tasks_collection()
    try:
        oid = to_object_id(id)
    except ValueError:
        return jsonify({"error": "invalid id"}), 400

    res = col.find_one_and_update({"_id": oid}, {"$set": doc}, return_document=True)
    if not res:
        return jsonify({"error": "not found"}), 404
    return jsonify(serialize(res)), 200

@bp.patch("/api/tasks/reorder")
def reorder_tasks():
    """
    Persist a new order for all tasks.
    Body: { "ids": ["<id1>", "<id2>", ...] } in the EXACT new order (top→bottom).
    """
    data = request.get_json(force=True, silent=True) or {}
    ids = data.get("ids")
    if not isinstance(ids, list) or not ids:
        return jsonify({"error": "ids must be a non-empty list"}), 400

    # Validate ids up front
    try:
        oids = [ObjectId(s) for s in ids]
    except Exception as e:
        return jsonify({"error": f"bad id in list: {e}"}), 400

    col = tasks_collection()
    now = datetime.utcnow().isoformat()

    for i, oid in enumerate(oids):
        col.update_one({"_id": oid}, {"$set": {"order": i, "updated_at": now}})

    return jsonify({"ok": True}), 200

@bp.delete("/api/tasks/<id>")
def delete_task(id):
    """Delete a task by id."""
    col = tasks_collection()
    try:
        oid = to_object_id(id)
    except ValueError:
        return jsonify({"error": "invalid id"}), 400

    res = col.delete_one({"_id": oid})
    if res.deleted_count == 0:
        return jsonify({"error": "not found"}), 404
    return jsonify({"ok": True}), 200

# ---------------- ADMIN / HEALTH ----------------

@bp.post("/admin/seed-order")
def seed_order_once():
    """Initialize 'order' for existing tasks based on created_at ascending."""
    col = tasks_collection()
    docs = list(col.find().sort("created_at", 1))
    for i, d in enumerate(docs):
        col.update_one({"_id": d["_id"]}, {"$set": {"order": i}})
    return jsonify({"ok": True, "updated": len(docs)}), 200

@bp.get("/healthz")
def healthz():
    """App and DB health check."""
    try:
        tasks_collection().database.command("ping")
        return jsonify({"ok": True}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500