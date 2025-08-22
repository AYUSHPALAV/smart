from flask import Flask, render_template_string, send_from_directory, jsonify
import os
import pandas as pd

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ATTENDANCE_DIR = os.path.join(BASE_DIR, "Attendance")
STUDENTS_CSV = os.path.join(BASE_DIR, "StudentDetails", "studentdetails.csv")


@app.get("/")
def index():
    subjects = []
    if os.path.exists(ATTENDANCE_DIR):
        for name in os.listdir(ATTENDANCE_DIR):
            full = os.path.join(ATTENDANCE_DIR, name)
            if os.path.isdir(full):
                subjects.append(name)
    return render_template_string(
        """
        <!doctype html>
        <html>
        <head>
            <meta charset="utf-8" />
            <title>Attendance Dashboard</title>
            <style>
                body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial; margin:24px; background:#0f1115; color:#e6e6e6}
                h1{margin:0 0 16px}
                .card{background:#161a22; padding:16px; border-radius:12px; margin-bottom:16px; border:1px solid #202a35}
                a{color:#7aa2f7; text-decoration:none}
                table{width:100%; border-collapse:collapse; margin-top:12px}
                th, td{border-bottom:1px solid #232b36; padding:8px; text-align:left}
                th{background:#0d1117; position:sticky; top:0}
                .grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:12px}
                .chip{display:inline-block; padding:6px 10px; border-radius:16px; background:#0d1117; border:1px solid #202a35}
                .muted{color:#9aa4b2}
                .btn{padding:8px 12px; border-radius:8px; border:1px solid #2b3542; background:#1a2230; color:#e6e6e6}
            </style>
        </head>
        <body>
            <h1>Attendance Dashboard</h1>
            <div class="card">
                <h3>Subjects</h3>
                {% if subjects %}
                <div class="grid">
                    {% for s in subjects %}
                    <div class="card">
                        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                            <div><strong>{{ s }}</strong></div>
                            <a class="btn" href="/subject/{{ s }}">Open</a>
                        </div>
                    </div>
                    {% endfor %}
                </div>
                {% else %}
                <div class="muted">No subjects yet. Take attendance from the desktop app first.</div>
                {% endif %}
            </div>
            <div class="card">
                <h3>Students</h3>
                <div id="students"></div>
            </div>
            <script>
                fetch('/api/students').then(r=>r.json()).then(data=>{
                    const el=document.getElementById('students');
                    if(!data.length){ el.innerHTML = '<div class="muted">No students enrolled yet.</div>'; return; }
                    let html = '<table><thead><tr><th>Enrollment</th><th>Name</th></tr></thead><tbody>';
                    for(const s of data){
                        html += `<tr><td>${s.Enrollment??''}</td><td>${s.Name??''}</td></tr>`;
                    }
                    html += '</tbody></table>';
                    el.innerHTML = html;
                }).catch(()=>{document.getElementById('students').innerHTML='<div class="muted">Failed to load students.</div>'});
            </script>
        </body>
        </html>
        """,
        subjects=subjects,
    )


@app.get("/subject/<subject>")
def subject_page(subject: str):
    sub_dir = os.path.join(ATTENDANCE_DIR, subject)
    sessions = []
    if os.path.exists(sub_dir):
        for f in os.listdir(sub_dir):
            if f.endswith(".csv") and f != "attendance.csv":
                sessions.append(f)
    return render_template_string(
        """
        <!doctype html>
        <html>
        <head>
            <meta charset="utf-8" />
            <title>{{ subject }} - Attendance</title>
            <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial; margin:24px; background:#0f1115; color:#e6e6e6}
            .card{background:#161a22; padding:16px; border-radius:12px; margin-bottom:16px; border:1px solid #202a35}
            table{width:100%; border-collapse:collapse; margin-top:12px}
            th, td{border-bottom:1px solid #232b36; padding:8px; text-align:left}
            a{color:#7aa2f7}
            </style>
        </head>
        <body>
            <a href="/">← Back</a>
            <h2>{{ subject }}</h2>
            <div class="card">
                <h3>Summary</h3>
                <div id="summary"></div>
            </div>
            <div class="card">
                <h3>Sessions</h3>
                {% if sessions %}
                    <ul>
                    {% for s in sessions %}
                        <li><a href="/subject/{{ subject }}/session/{{ s }}">{{ s }}</a></li>
                    {% endfor %}
                    </ul>
                {% else %}
                    <div class="muted">No sessions yet.</div>
                {% endif %}
            </div>
            <script>
                fetch(`/api/subject/{{ subject }}/summary`).then(r=>r.json()).then(data=>{
                    const el = document.getElementById('summary');
                    if(!data.rows){ el.innerHTML = '<div class="muted">No summary.</div>'; return; }
                    let html = '<table><thead><tr>';
                    for(const h of data.headers){ html += `<th>${h}</th>`; }
                    html += '</tr></thead><tbody>';
                    for(const row of data.rows){
                        html += '<tr>' + row.map(v=>`<td>${v??''}</td>`).join('') + '</tr>';
                    }
                    html += '</tbody></table>';
                    el.innerHTML = html;
                }).catch(()=>{document.getElementById('summary').innerHTML='<div class="muted">Failed to load.</div>'});
            </script>
        </body>
        </html>
        """,
        subject=subject,
        sessions=sessions,
    )


@app.get("/subject/<subject>/session/<filename>")
def subject_session(subject: str, filename: str):
    return send_from_directory(os.path.join(ATTENDANCE_DIR, subject), filename)


@app.get("/api/students")
def api_students():
    if not os.path.exists(STUDENTS_CSV):
        return jsonify([])
    try:
        df = pd.read_csv(STUDENTS_CSV)
        return df.to_dict(orient="records")
    except Exception:
        return jsonify([])


@app.get("/api/subject/<subject>/summary")
def api_subject_summary(subject: str):
    summary_csv = os.path.join(ATTENDANCE_DIR, subject, "attendance.csv")
    if not os.path.exists(summary_csv):
        return jsonify({"headers": [], "rows": []})
    try:
        df = pd.read_csv(summary_csv)
        return jsonify({
            "headers": list(df.columns),
            "rows": df.fillna("").values.tolist(),
        })
    except Exception:
        return jsonify({"headers": [], "rows": []})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)


