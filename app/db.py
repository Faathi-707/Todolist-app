from pymongo import MongoClient
from bson.objectid import ObjectId
from flask import current_app, g

# create one Mongo client per process
def _client():
    if "mongo_client" not in g:
        g.mongo_client = MongoClient(current_app.config["MONGODB_URI"])
    return g.mongo_client

def tasks_collection():
    client = _client()
    db = client[current_app.config["MONGODB_DB"]]
    # single "tasks" collection
    return db.tasks

def to_object_id(id_str):
    # convert safe. raises ValueError if bad id
    try:
        return ObjectId(id_str)
    except Exception as e:
        raise ValueError("Invalid id") from e

def serialize(task_doc):
    # convert Mongo ObjectId to string for JSON
    return {
        "id": str(task_doc["_id"]),
        "title": task_doc["title"],
        "notes": task_doc.get("notes", ""),
        "priority": task_doc.get("priority", "normal"),
        "completed": bool(task_doc.get("completed", False)),
        "created_at": task_doc.get("created_at"),
        "updated_at": task_doc.get("updated_at"),
        "due_date": task_doc.get("due_date"),
    }
