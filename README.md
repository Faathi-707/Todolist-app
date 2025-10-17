# TodoList

This was developed for the GirlstoCode capstone project. A task manager built with **Flask + MongoDB + HTML/CSS/JS**.  

CRUD - Create, read, update and delete files

Create tasks, **edit directly on the task detail page**, delete, re-order via drag-and-drop, search instantly on the client, and get friendly toast notifications for feedback.

---

## Tech Stack

- **Backend:** Python **3.10+**, Flask, PyMongo
- **Database:** MongoDB (local or Atlas)
- **Frontend:** HTML, CSS, vanilla JavaScript (no framework)

---

## Features

- Add / view / **edit on detail page** / delete tasks  
- Ongoing & Done sections with item counts and **Hide/Show** toggle  
- **Drag-and-drop reorder** (persists to DB order field)  
- **Client-side search & filter** (title/notes)  
- **Toast notifications** for success/error  

---

## Getting Started
    
### 1) Install dependencies
        Flask==3.0.0
        python-dotenv==1.0.1
        pymongo==4.6.1
### 2) Configure environment --- Create a .env in the project root:
        FLASK_ENV=development
        SECRET_KEY=dev-change-me
        MONGO_URI=mongodb://localhost:27017
        MONGO_DB=todolist
        MONGO_COLLECTION=tasks

4) Start the app
    # Option A: flask cli
    flask --app run.py run

    # Option B: python entrypoint
    python run.py
    Open http://localhost:5000.

## How to Use
    Add a task: Add task button on the list page or /add.

    Mark done/open: checkbox on list or “Mark as done / open” on the task detail page.

    Edit (title/notes/priority/due): use the inputs on the task detail page and save.

    Reorder: drag items within “Ongoing”. Order is saved to DB.

    Search: start typing in the search box on the list page (filters client-side).

    Delete: “Delete” on list row or detail page (confirmation shown).

## API (quick reference)
    Method & Path	Body / Params	Description
    GET /api/tasks	—	List tasks
    POST /api/tasks	{title, notes?, priority, due_date?}	Create a task
    PATCH /api/tasks/<id>	Partial fields (e.g. {completed:true})	Update/toggle fields
    PATCH /api/tasks/reorder	{ids: ["id1","id2",...]}	Persist new order (top→bottom)
    DELETE /api/tasks/<id>	—	Delete a task
    GET /healthz	—	App/DB health check

    Dates accepted from UI as dd/mm/yyyy, stored in DB as yyyy-mm-dd (ISO).

## Project Structure
    todolist/
    ├─ run.py                      # Entry point (starts Flask dev server)
    ├─ app/
    │  ├─ __init__.py              # App factory: loads .env, registers blueprint
    │  ├─ routes.py                # Pages + JSON API
    │  ├─ db.py                    # Mongo client + helpers (collection, serialize OIDs)
    │  ├─ schemas.py               # Minimal validation for create/update payloads
    │  ├─ templates/
    │  │  ├─ base.html             # Shared layout (head, navbar, scripts)
    │  │  ├─ index.html            # List page (Ongoing/Done, search, hide/show)
    │  │  ├─ add_task.html         # Add form page
    │  │  └─ task_detail.html      # SSR task view + inline edit + actions
    │  └─ static/
    │     ├─ css/
    │     │  └─ styles.css         # Tokens, layout, components, chips, utilities
    │     └─ js/
    │        └─ index.js           # Fetch helpers, rendering, DnD, search, toasts
    └─ .env                        # Local config (see above)
