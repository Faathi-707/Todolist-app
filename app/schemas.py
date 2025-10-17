# tiny validation helpers. keep it beginner-friendly.

PRIORITIES = {"low", "normal", "high"}

def validate_create(payload):
    errors = []
    title = (payload.get("title") or "").strip()
    if not title:
        errors.append("title is required")
    priority = (payload.get("priority") or "normal").lower()
    if priority not in PRIORITIES:
        errors.append("priority must be low, normal, or high")
    if errors:
        return None, errors
    return {
        "title": title,
        "notes": (payload.get("notes") or "").strip(),
        "priority": priority,
        "completed": False,
    }, None

def validate_update(payload):
    doc = {}
    if "title" in payload:
        title = (payload.get("title") or "").strip()
        if not title:
            return None, ["title cannot be empty"]
        doc["title"] = title
    if "notes" in payload:
        doc["notes"] = (payload.get("notes") or "").strip()
    if "priority" in payload:
        p = (payload.get("priority") or "").lower()
        if p not in PRIORITIES:
            return None, ["priority must be low, normal, or high"]
        doc["priority"] = p
    if "completed" in payload:
        doc["completed"] = bool(payload.get("completed"))
    return doc, None
