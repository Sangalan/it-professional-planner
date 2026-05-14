"""
Plan de certificaciones 2026 — versión TOTALMENTE COMPACTA:
sin huecos en ninguna fase, incluida AWS SAP.
100h de AWS SAP cubiertos con 50 sesiones consecutivas de 2h
(en lugar de diseminadas en 13 semanas con gaps).

Final: 7 sep 2026 (en lugar de 17 oct).
Ahorro total vs. plan original (22 nov): 76 días (~11 semanas).
"""

import sqlite3

DB = "/Users/miguel/Projects/miguel-galan/git/it-professional-planner/backend/data/planner.db"

conn = sqlite3.connect(DB)
cur = conn.cursor()

# ── 1. ELIMINAR tareas existentes ─────────────────────────────────────────────
CERT_IDS = [
    "cert-neo4j-prof", "cert-neo4j-gds", "cert-ontotext",
    "cert-nvidia", "cert-ibm-rag", "cert-dlai-rag", "cert-aws-sap",
]
ph = ",".join(["?"] * len(CERT_IDS))
cur.execute(f"DELETE FROM tasks WHERE milestone_id IN ({ph})", CERT_IDS)
print(f"Tareas eliminadas: {cur.rowcount}")

# ── 2. ACTUALIZAR fechas objetivo y notas ─────────────────────────────────────
CERT_UPDATES = {
    "cert-dlai-rag": (
        "2026-04-27",
        "Fase 1 (19 abr – 27 abr · 15h) [compacto]\n"
        "Punto de control:\n"
        "- Fecha clave: 2026-04-26.\n"
        "- Cerrar con comprensión clara de RAG, fragmentación, recuperación, "
        "evaluación y límites del enfoque.\n"
        "- Si quedan dudas estructurales, mover el examen 2-4 días."
    ),
    "cert-ibm-rag": (
        "2026-05-21",
        "Fase 2 (28 abr – 21 may · 45h) [compacto]\n"
        "8 cursos + capstone. ~2h/día diarios.\n"
        "Truco: hacer los labs con caso de uso ECM/BPM para el portfolio.\n"
        "Punto de control:\n"
        "- Fecha clave: 2026-05-20.\n"
        "- Deben quedar claros flujo RAG, evaluación básica, anclaje al contexto "
        "y papel de los agentes.\n"
        "- Si no puedes explicar el flujo extremo a extremo, mover 2-4 días."
    ),
    "cert-nvidia": (
        "2026-06-14",
        "Fase 3 (22 may – 14 jun · 35h) [compacto]\n"
        "Examen proctorizado: 60–70 preguntas, 90–120 min, $200 (Certiverse).\n"
        "Recursos: blueprint oficial NVIDIA + NeMo Agent Toolkit + "
        "6 practice tests Udemy.\n"
        "Recordatorio: reservar en Certiverse el primer día de la fase.\n"
        "Punto de control:\n"
        "- Fecha clave: 2026-06-13.\n"
        "- Soltura con agentic AI, patrones, evaluación, safety y stack práctico.\n"
        "- Si todo suena teórico, mover el examen 3-5 días."
    ),
    "cert-neo4j-prof": (
        "2026-06-23",
        "Fase 4 (15 jun – 23 jun · 15h) [compacto]\n"
        "Recursos: GraphAcademy — Cypher Fundamentals + Graph Data Modeling + "
        "Importing Data. Examen gratuito 1h, 80%.\n"
        "Punto de control:\n"
        "- Fecha clave: 2026-06-22.\n"
        "- Solvencia en modelado, Cypher, índices, importación y admin básica.\n"
        "- Si no hay sensación de aprobado, mover 5-7 días."
    ),
    "cert-neo4j-gds": (
        "2026-07-05",
        "Fase 5 (24 jun – 5 jul · 20h) [compacto]\n"
        "Recursos: GraphAcademy 'Introduction to Graph Data Science' + "
        "'Graph Data Science Fundamentals' + docs GDS. 40 preguntas, 1h, 80%.\n"
        "Punto de control:\n"
        "- Fecha clave: 2026-07-04.\n"
        "- Proyecciones de grafos, algoritmos principales, interpretación "
        "de resultados y flujos de ML en GDS.\n"
        "- Si hay dudas fuertes, mover 5-7 días."
    ),
    "cert-ontotext": (
        "2026-07-18",
        "Fase 6 (6 jul – 18 jul · 25h) [compacto]\n"
        "Recursos: Ontotext Academy — learning path GraphDB KG Engineer "
        "(gratuito, auto-paced, quizzes 70% por módulo).\n"
        "Punto de control:\n"
        "- Fecha clave: 2026-07-17.\n"
        "- Dominio de RDF, SPARQL, inferencia, ingestiones y operativa GraphDB.\n"
        "- Si faltan reflejos con SPARQL, mover 5-7 días."
    ),
    "cert-aws-sap": (
        "2026-09-07",
        "AWS Certified Solutions Architect - Professional (SAP-C02)\n\n"
        "Fase 7 (19 jul – 7 sep · 100h · 51 días) [compacto, sin huecos]\n"
        "Plan aprovecha la dedicación diaria de 2h/día (100h = 50 sesiones):\n"
        "- Jul 19 – Aug 11: curso core (24 sesiones, ~48h)\n"
        "- Aug 12 – Aug 21: hands-on + whiteboards + deep-dives (10 sesiones, ~20h)\n"
        "- Aug 22 – Sep 4: simulacros y mocks (14 sesiones, ~28h)\n"
        "- Sep 5 – Sep 6: última revisión + repaso final (2 sesiones)\n"
        "- Sep 7: EXAMEN (lunes 09:00–12:00)\n\n"
        "Reserva del examen: 19 jul (primer día de fase, ~7 semanas de antelación).\n\n"
        "Punto de control 1 (2026-08-12): Practice Question Set oficial — "
        "cerrar lagunas principales.\n"
        "Punto de control 2 (2026-08-27): simulacro 3 con >=80%. "
        "Si no sale, reprogramar el examen 7-10 días.\n\n"
        "Examen oficial: 75 preguntas, 180 min, $300.\n"
        "Dominios: organizacional (26%), nuevas soluciones (29%), "
        "mejora continua (25%), migración (20%).\n\n"
        "Recursos:\n"
        "- Guía SAP-C02: "
        "https://docs.aws.amazon.com/aws-certification/latest/"
        "solutions-architect-professional-02/solutions-architect-professional-02.html\n"
        "- Certificación: "
        "https://aws.amazon.com/certification/certified-solutions-architect-professional/\n"
        "- Skill Builder: https://aws.amazon.com/certification/certification-prep/\n"
        "- Architecting on AWS: "
        "https://skillbuilder.aws/learn/TFDQJZ1UV5/architecting-on-aws/DPS7CTFY8J\n"
        "- Advanced Architecting on AWS: "
        "https://skillbuilder.aws/learn/BWA4N8R9QE/advanced-architecting-on-aws/P1VYB9XBZT"
    ),
}

for cert_id, (target_date, notes) in CERT_UPDATES.items():
    cur.execute(
        "UPDATE certifications SET target_date=?, notes=? WHERE id=?",
        (target_date, notes, cert_id),
    )
print("Certificaciones actualizadas.")

# ── 3. CREAR nuevas tareas ────────────────────────────────────────────────────
OBJ = "obj-certs"
CAT = "certificaciones"
CATS = '["certificaciones"]'

INSERT_SQL = """
INSERT INTO tasks (
    id, title, category_id, category_ids, date, start_time, end_time,
    status, priority, objective_id, milestone_id, is_fixed,
    percentage_completed, label
) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 1, ?, ?, 0, 0.0, ?)
"""

def task(tid, title, date_str, milestone, label="cert",
         start="14:00", end="16:00"):
    return (tid, title, CAT, CATS, date_str, start, end, OBJ, milestone, label)


new_tasks = []

# ════════════════════════════════════════════════════════════════════════════════
# FASE 1 · DeepLearning.AI RAG (19 abr – 27 abr · 9 días)
# ════════════════════════════════════════════════════════════════════════════════
new_tasks += [
    task("task-dlai-rag-s01", "DeepLearning.AI RAG - Introducción y conceptos RAG",        "2026-04-19", "cert-dlai-rag"),
    task("task-dlai-rag-s02", "DeepLearning.AI RAG - Fragmentación y embeddings",          "2026-04-20", "cert-dlai-rag"),
    task("task-dlai-rag-s03", "DeepLearning.AI RAG - Vector DBs: FAISS y Weaviate",        "2026-04-21", "cert-dlai-rag"),
    task("task-dlai-rag-s04", "DeepLearning.AI RAG - Recuperación y reranking",            "2026-04-22", "cert-dlai-rag"),
    task("task-dlai-rag-s05", "DeepLearning.AI RAG - Evaluación de pipelines RAG",         "2026-04-23", "cert-dlai-rag"),
    task("task-dlai-rag-s06", "DeepLearning.AI RAG - Advanced RAG patterns",               "2026-04-24", "cert-dlai-rag"),
    task("task-dlai-rag-s07", "DeepLearning.AI RAG - Caso de uso ECM/BPM con RAG",         "2026-04-25", "cert-dlai-rag"),
    task("task-dlai-rag-review", "Repasar DeepLearning.AI RAG (repaso final)",             "2026-04-26", "cert-dlai-rag"),
    task("task-dlai-rag-exam", "EXAMEN: DeepLearning.AI RAG",                              "2026-04-27", "cert-dlai-rag", "exam"),
]

# ════════════════════════════════════════════════════════════════════════════════
# FASE 2 · IBM RAG & Agentic AI (28 abr – 21 may · 24 días)
# ════════════════════════════════════════════════════════════════════════════════
new_tasks += [
    task("task-ibm-rag-s01",  "IBM RAG & Agentic AI - Course 1: Generative AI Essentials (sesión 1)",     "2026-04-28", "cert-ibm-rag"),
    task("task-ibm-rag-s02",  "IBM RAG & Agentic AI - Course 1: Generative AI Essentials (sesión 2)",     "2026-04-29", "cert-ibm-rag"),
    task("task-ibm-rag-s03",  "IBM RAG & Agentic AI - Course 2: Introduction to RAG (sesión 1)",          "2026-04-30", "cert-ibm-rag"),
    task("task-ibm-rag-s04",  "IBM RAG & Agentic AI - Course 2: Introduction to RAG (sesión 2)",          "2026-05-01", "cert-ibm-rag"),
    task("task-ibm-rag-s05",  "IBM RAG & Agentic AI - Course 3: Advanced RAG Techniques (sesión 1)",      "2026-05-02", "cert-ibm-rag"),
    task("task-ibm-rag-s06",  "IBM RAG & Agentic AI - Course 3: Advanced RAG Techniques (sesión 2)",      "2026-05-03", "cert-ibm-rag"),
    task("task-ibm-rag-s07",  "IBM RAG & Agentic AI - Course 3: Advanced RAG Techniques (sesión 3)",      "2026-05-04", "cert-ibm-rag"),
    task("task-ibm-rag-s08",  "IBM RAG & Agentic AI - Course 4: Agentic AI Fundamentals (sesión 1)",      "2026-05-05", "cert-ibm-rag"),
    task("task-ibm-rag-s09",  "IBM RAG & Agentic AI - Course 4: Agentic AI Fundamentals (sesión 2)",      "2026-05-06", "cert-ibm-rag"),
    task("task-ibm-rag-s10",  "IBM RAG & Agentic AI - Course 4: Agentic AI Fundamentals (sesión 3)",      "2026-05-07", "cert-ibm-rag"),
    task("task-ibm-rag-s11",  "IBM RAG & Agentic AI - Course 5: LangGraph y sistemas multiagente (ses.1)","2026-05-08", "cert-ibm-rag"),
    task("task-ibm-rag-s12",  "IBM RAG & Agentic AI - Course 5: LangGraph y sistemas multiagente (ses.2)","2026-05-09", "cert-ibm-rag"),
    task("task-ibm-rag-s13",  "IBM RAG & Agentic AI - Course 5: LangGraph y sistemas multiagente (ses.3)","2026-05-10", "cert-ibm-rag"),
    task("task-ibm-rag-s14",  "IBM RAG & Agentic AI - Course 6: CrewAI y orquestación de agentes (ses.1)","2026-05-11", "cert-ibm-rag"),
    task("task-ibm-rag-s15",  "IBM RAG & Agentic AI - Course 6: CrewAI y orquestación de agentes (ses.2)","2026-05-12", "cert-ibm-rag"),
    task("task-ibm-rag-s16",  "IBM RAG & Agentic AI - Course 6: CrewAI y orquestación de agentes (ses.3)","2026-05-13", "cert-ibm-rag"),
    task("task-ibm-rag-s17",  "IBM RAG & Agentic AI - Course 7: MCP e integración de herramientas (ses.1)","2026-05-14","cert-ibm-rag"),
    task("task-ibm-rag-s18",  "IBM RAG & Agentic AI - Course 7: MCP e integración de herramientas (ses.2)","2026-05-15","cert-ibm-rag"),
    task("task-ibm-rag-s19",  "IBM RAG & Agentic AI - Capstone: diseño con caso ECM/BPM (sesión 1)",      "2026-05-16", "cert-ibm-rag"),
    task("task-ibm-rag-s20",  "IBM RAG & Agentic AI - Capstone: implementación RAG pipeline (sesión 2)",  "2026-05-17", "cert-ibm-rag"),
    task("task-ibm-rag-s21",  "IBM RAG & Agentic AI - Capstone: implementación agentes (sesión 3)",       "2026-05-18", "cert-ibm-rag"),
    task("task-ibm-rag-s22",  "IBM RAG & Agentic AI - Capstone: evaluación y entrega final (sesión 4)",   "2026-05-19", "cert-ibm-rag"),
    task("task-ibm-rag-review","Repasar IBM RAG & Agentic AI (repaso final)",                             "2026-05-20", "cert-ibm-rag"),
    task("task-ibm-rag-exam", "EXAMEN: IBM RAG & Agentic AI",                                             "2026-05-21", "cert-ibm-rag", "exam"),
]

# ════════════════════════════════════════════════════════════════════════════════
# FASE 3 · NVIDIA Agentic AI Professional (22 may – 14 jun · 24 días)
# ════════════════════════════════════════════════════════════════════════════════
new_tasks += [
    task("task-nvidia-book",   "Reservar examen NVIDIA Agentic AI Professional (Certiverse)",  "2026-05-22", "cert-nvidia", "NVIDIA exam booking", "17:30", "18:00"),

    task("task-nvidia-s01",    "NVIDIA Agentic AI - Blueprint oficial y fundamentos agentic AI","2026-05-22", "cert-nvidia"),
    task("task-nvidia-s02",    "NVIDIA Agentic AI - NeMo Agent Toolkit: setup y primeros pasos","2026-05-23", "cert-nvidia"),
    task("task-nvidia-s03",    "NVIDIA Agentic AI - Patrones de orquestación: reactivo vs planificador","2026-05-24", "cert-nvidia"),
    task("task-nvidia-s04",    "NVIDIA Agentic AI - Memory, state y context management",       "2026-05-25", "cert-nvidia"),
    task("task-nvidia-s05",    "NVIDIA Agentic AI - Tool use y function calling en agentes",   "2026-05-26", "cert-nvidia"),
    task("task-nvidia-s06",    "NVIDIA Agentic AI - Multi-agent coordination y comunicación",  "2026-05-27", "cert-nvidia"),
    task("task-nvidia-s07",    "NVIDIA Agentic AI - Observabilidad: trazas, logs y métricas",  "2026-05-28", "cert-nvidia"),
    task("task-nvidia-s08",    "NVIDIA Agentic AI - Guardrails: safety, filtros y content policies","2026-05-29", "cert-nvidia"),
    task("task-nvidia-s09",    "NVIDIA Agentic AI - Evaluación de agentes: métricas y benchmarks","2026-05-30", "cert-nvidia"),
    task("task-nvidia-s10",    "NVIDIA Agentic AI - Deployment y producción en NVIDIA stack",  "2026-05-31", "cert-nvidia"),
    task("task-nvidia-s11",    "NVIDIA Agentic AI - Casos prácticos: RAG + agentes (ECM/BPM)", "2026-06-01", "cert-nvidia"),
    task("task-nvidia-s12",    "NVIDIA Agentic AI - Repaso de arquitecturas de referencia",    "2026-06-02", "cert-nvidia"),
    task("task-nvidia-s13",    "NVIDIA Agentic AI - Review blueprint + lagunas identificadas", "2026-06-03", "cert-nvidia"),
    task("task-nvidia-s14",    "NVIDIA Agentic AI - Preguntas de práctica (Udemy mock prep)",  "2026-06-04", "cert-nvidia"),
    task("task-nvidia-mock1",  "NVIDIA Agentic AI - Mock exam 1 (FlashGenius/Udemy)",          "2026-06-05", "cert-nvidia"),
    task("task-nvidia-mock2",  "NVIDIA Agentic AI - Mock exam 2 + revisión de errores",        "2026-06-06", "cert-nvidia"),
    task("task-nvidia-mock3",  "NVIDIA Agentic AI - Mock exam 3 + refuerzo de puntos débiles", "2026-06-07", "cert-nvidia"),
    task("task-nvidia-review1","NVIDIA Agentic AI - Revisión profunda de errores (mocks 1-3)", "2026-06-08", "cert-nvidia"),
    task("task-nvidia-review2","NVIDIA Agentic AI - Repaso orchestration, observability y guardrails","2026-06-09", "cert-nvidia"),
    task("task-nvidia-mock4",  "NVIDIA Agentic AI - Mock exam 4 (simulacro completo)",         "2026-06-10", "cert-nvidia"),
    task("task-nvidia-mock5",  "NVIDIA Agentic AI - Mock exam 5 + revisión de errores",        "2026-06-11", "cert-nvidia"),
    task("task-nvidia-mock6",  "NVIDIA Agentic AI - Mock exam 6 + checklist final",            "2026-06-12", "cert-nvidia"),
    task("task-nvidia-final-review","Repasar NVIDIA Agentic AI Professional (repaso final)",   "2026-06-13", "cert-nvidia"),
    task("task-nvidia-exam",   "EXAMEN: NVIDIA Agentic AI Professional",                       "2026-06-14", "cert-nvidia", "exam"),
]

# ════════════════════════════════════════════════════════════════════════════════
# FASE 4 · Neo4j Certified Professional (15 jun – 23 jun · 9 días)
# ════════════════════════════════════════════════════════════════════════════════
new_tasks += [
    task("task-neo4j-prof-s01","Neo4j Certified Professional - Cypher Fundamentals (sesión 1)", "2026-06-15", "cert-neo4j-prof"),
    task("task-neo4j-prof-s02","Neo4j Certified Professional - Cypher Fundamentals (sesión 2)", "2026-06-16", "cert-neo4j-prof"),
    task("task-neo4j-prof-s03","Neo4j Certified Professional - Graph Data Modeling Fundamentals","2026-06-17", "cert-neo4j-prof"),
    task("task-neo4j-prof-s04","Neo4j Certified Professional - Importing Data into Neo4j",       "2026-06-18", "cert-neo4j-prof"),
    task("task-neo4j-prof-s05","Neo4j Certified Professional - Índices, restricciones y admin básica","2026-06-19", "cert-neo4j-prof"),
    task("task-neo4j-prof-s06","Neo4j Certified Professional - Preguntas de práctica (dataset recommendations)","2026-06-20", "cert-neo4j-prof"),
    task("task-neo4j-prof-s07","Neo4j Certified Professional - Repaso Cypher, modelado e importación","2026-06-21", "cert-neo4j-prof"),
    task("task-neo4j-prof-review","Repasar Neo4j Certified Professional (repaso final)",        "2026-06-22", "cert-neo4j-prof"),
    task("task-neo4j-prof-exam","EXAMEN: Neo4j Certified Professional",                          "2026-06-23", "cert-neo4j-prof", "exam"),
]

# ════════════════════════════════════════════════════════════════════════════════
# FASE 5 · Neo4j Graph Data Science (24 jun – 5 jul · 12 días)
# ════════════════════════════════════════════════════════════════════════════════
new_tasks += [
    task("task-neo4j-gds-s01",   "Neo4j GDS - Introduction to Graph Data Science (sesión 1)",   "2026-06-24", "cert-neo4j-gds"),
    task("task-neo4j-gds-s02",   "Neo4j GDS - Introduction to Graph Data Science (sesión 2)",   "2026-06-25", "cert-neo4j-gds"),
    task("task-neo4j-gds-s03",   "Neo4j GDS - Graph Data Science Fundamentals (sesión 1)",      "2026-06-26", "cert-neo4j-gds"),
    task("task-neo4j-gds-s04",   "Neo4j GDS - Proyecciones de grafos y operaciones en memoria", "2026-06-27", "cert-neo4j-gds"),
    task("task-neo4j-gds-s05",   "Neo4j GDS - Centralidad: PageRank, Betweenness, Closeness",   "2026-06-28", "cert-neo4j-gds"),
    task("task-neo4j-gds-s06",   "Neo4j GDS - Community detection: Louvain, WCC, LPA",          "2026-06-29", "cert-neo4j-gds"),
    task("task-neo4j-gds-s07",   "Neo4j GDS - Pathfinding: Dijkstra, A*, Shortest Path",        "2026-06-30", "cert-neo4j-gds"),
    task("task-neo4j-gds-s08",   "Neo4j GDS - Link prediction y similarity algorithms",         "2026-07-01", "cert-neo4j-gds"),
    task("task-neo4j-gds-s09",   "Neo4j GDS - Flujos de ML: pipeline de clasificación de nodos","2026-07-02", "cert-neo4j-gds"),
    task("task-neo4j-gds-s10",   "Neo4j GDS - Cuándo aplicar cada algoritmo: práctica y repaso","2026-07-03", "cert-neo4j-gds"),
    task("task-neo4j-gds-review","Repasar Neo4j Graph Data Science (repaso final)",             "2026-07-04", "cert-neo4j-gds"),
    task("task-neo4j-gds-exam",  "EXAMEN: Neo4j Graph Data Science",                            "2026-07-05", "cert-neo4j-gds", "exam"),
]

# ════════════════════════════════════════════════════════════════════════════════
# FASE 6 · Ontotext GraphDB KG Engineer (6 jul – 18 jul · 13 días)
# ════════════════════════════════════════════════════════════════════════════════
new_tasks += [
    task("task-ontotext-s01",   "Ontotext GraphDB - Fundamentos RDF y modelo de datos en tripletas","2026-07-06", "cert-ontotext"),
    task("task-ontotext-s02",   "Ontotext GraphDB - SPARQL: consultas básicas SELECT y CONSTRUCT",  "2026-07-07", "cert-ontotext"),
    task("task-ontotext-s03",   "Ontotext GraphDB - SPARQL avanzado: OPTIONAL, FILTER, UNION",      "2026-07-08", "cert-ontotext"),
    task("task-ontotext-s04",   "Ontotext GraphDB - Ontologías OWL y SHACL para validación",        "2026-07-09", "cert-ontotext"),
    task("task-ontotext-s05",   "Ontotext GraphDB - Inferencia y razonamiento semántico",           "2026-07-10", "cert-ontotext"),
    task("task-ontotext-s06",   "Ontotext GraphDB - Importación: RDF/XML, Turtle, JSON-LD",         "2026-07-11", "cert-ontotext"),
    task("task-ontotext-s07",   "Ontotext GraphDB - Operativa: repositorios, backups y clustering", "2026-07-12", "cert-ontotext"),
    task("task-ontotext-s08",   "Ontotext GraphDB - Knowledge Graph con datos ECM/documentos",      "2026-07-13", "cert-ontotext"),
    task("task-ontotext-s09",   "Ontotext GraphDB - Taxonomías y metadata semántica (puente ECM)",  "2026-07-14", "cert-ontotext"),
    task("task-ontotext-s10",   "Ontotext GraphDB - Quizzes de módulos y práctica SPARQL",          "2026-07-15", "cert-ontotext"),
    task("task-ontotext-s11",   "Ontotext GraphDB - Repaso RDF, SPARQL, inferencia e ingestión",    "2026-07-16", "cert-ontotext"),
    task("task-ontotext-review","Repasar Ontotext GraphDB KG Engineer (repaso final)",              "2026-07-17", "cert-ontotext"),
    task("task-ontotext-exam",  "EXAMEN: Ontotext GraphDB KG Engineer",                             "2026-07-18", "cert-ontotext", "exam"),
]

# ════════════════════════════════════════════════════════════════════════════════
# FASE 7 · AWS SAP-C02 (19 jul – 7 sep · 51 días) — SIN HUECOS
# 50 sesiones de 2h = 100h del presupuesto oficial del plan.
# ════════════════════════════════════════════════════════════════════════════════

# Reserva del examen (primer día de la fase, ~7 semanas de antelación)
new_tasks.append(
    task("task-aws-sap-book",
         "Reservar examen AWS Certified Solutions Architect - Professional",
         "2026-07-19", "cert-aws-sap", "AWS exam booking", "17:30", "18:00")
)

# Bloque A — Curso core (19 jul – 11 ago · 24 sesiones, 48h)
aws_core = [
    ("task-aws-sap-01", "AWS SAP-C02 - Guía oficial y diagnóstico inicial",                        "2026-07-19"),
    ("task-aws-sap-02", "AWS SAP-C02 - Dominio 1: Organizations, SCPs y cuentas",                  "2026-07-20"),
    ("task-aws-sap-03", "AWS SAP-C02 - Dominio 1: IAM Identity Center y federación",               "2026-07-21"),
    ("task-aws-sap-04", "AWS SAP-C02 - Dominio 1: logging, auditoría y governance",                "2026-07-22"),
    ("task-aws-sap-05", "AWS SAP-C02 - Dominio 1: Transit Gateway, DX y VPN",                     "2026-07-23"),
    ("task-aws-sap-06", "AWS SAP-C02 - Dominio 1: DNS híbrido y conectividad inter-región",        "2026-07-24"),
    ("task-aws-sap-07", "AWS SAP-C02 - Dominio 2: cómputo resiliente",                            "2026-07-25"),
    ("task-aws-sap-08", "AWS SAP-C02 - Dominio 2: datos y almacenamiento a escala",                "2026-07-26"),
    ("task-aws-sap-09", "AWS SAP-C02 - Dominio 2: integración y mensajería",                      "2026-07-27"),
    ("task-aws-sap-10", "AWS SAP-C02 - Dominio 2: serverless y event-driven",                     "2026-07-28"),
    ("task-aws-sap-11", "AWS SAP-C02 - Dominio 2: seguridad y cifrado",                           "2026-07-29"),
    ("task-aws-sap-12", "AWS SAP-C02 - Dominio 2: coste y rendimiento",                           "2026-07-30"),
    ("task-aws-sap-13", "AWS SAP-C02 - Dominio 3: observabilidad y operaciones",                  "2026-07-31"),
    ("task-aws-sap-14", "AWS SAP-C02 - Dominio 3: alta disponibilidad y disaster recovery",        "2026-08-01"),
    ("task-aws-sap-15", "AWS SAP-C02 - Dominio 3: backup, RPO/RTO y continuidad",                 "2026-08-02"),
    ("task-aws-sap-16", "AWS SAP-C02 - Dominio 3: performance tuning",                            "2026-08-03"),
    ("task-aws-sap-17", "AWS SAP-C02 - Dominio 3: cost optimization y FinOps",                    "2026-08-04"),
    ("task-aws-sap-18", "AWS SAP-C02 - Dominio 4: discovery y estrategia de migración",            "2026-08-05"),
    ("task-aws-sap-19", "AWS SAP-C02 - Dominio 4: migración de bases de datos",                   "2026-08-06"),
    ("task-aws-sap-20", "AWS SAP-C02 - Dominio 4: modernización con contenedores",                "2026-08-07"),
    ("task-aws-sap-21", "AWS SAP-C02 - Dominio 4: modernización serverless y eventing",           "2026-08-08"),
    ("task-aws-sap-22", "AWS SAP-C02 - AWS Well-Architected Tool hands-on",                       "2026-08-09"),
    ("task-aws-sap-23", "AWS SAP-C02 - Architecting on AWS repaso dirigido",                      "2026-08-10"),
    ("task-aws-sap-24", "AWS SAP-C02 - Advanced Architecting on AWS repaso dirigido",             "2026-08-11"),
]
for tid, title, d in aws_core:
    new_tasks.append(task(tid, title, d, "cert-aws-sap"))

# Bloque B — Hands-on + whiteboards + deep-dives (12 ago – 21 ago · 10 sesiones, 20h)
aws_handson = [
    ("task-aws-sap-25",            "AWS SAP-C02 - Practice Question Set oficial (punto de control 1)",   "2026-08-12"),
    ("task-aws-sap-26",            "AWS SAP-C02 - Builder Labs y casos prácticos multi-cuenta",          "2026-08-13"),
    ("task-aws-sap-27",            "AWS SAP-C02 - Whiteboard enterprise multi-region",                   "2026-08-14"),
    ("task-aws-sap-28",            "AWS SAP-C02 - Whiteboard seguridad, red y compliance",               "2026-08-15"),
    ("task-aws-sap-29",            "AWS SAP-C02 - Whiteboard migración y modernización",                 "2026-08-16"),
    ("task-aws-sap-handson-extra", "AWS SAP-C02 - Hands-on AWS SimuLearn: escenarios avanzados",         "2026-08-17"),
    ("task-aws-sap-deep-storage",  "AWS SAP-C02 - Deep-dive storage: S3, EBS, EFS, FSx, DataSync",       "2026-08-18"),
    ("task-aws-sap-deep-network",  "AWS SAP-C02 - Deep-dive networking: VPC, TGW, GWLB, endpoints",      "2026-08-19"),
    ("task-aws-sap-deep-new",      "AWS SAP-C02 - Deep-dive nuevos servicios: Bedrock, Q, IAM IC",       "2026-08-20"),
    ("task-aws-sap-deep-multi",    "AWS SAP-C02 - Escenarios multicuenta y Control Tower avanzado",      "2026-08-21"),
]
for tid, title, d in aws_handson:
    new_tasks.append(task(tid, title, d, "cert-aws-sap"))

# Bloque C — Simulacros y mocks (22 ago – 4 sep · 14 sesiones, 28h)
aws_mocks = [
    ("task-aws-sap-30",            "AWS SAP-C02 - Simulacro 1 por dominios (Tutorials Dojo)",           "2026-08-22"),
    ("task-aws-sap-31",            "AWS SAP-C02 - Revisión de errores y flashcards (simulacro 1)",      "2026-08-23"),
    ("task-aws-sap-32",            "AWS SAP-C02 - Simulacro 2 y preguntas difíciles (Tutorials Dojo)",  "2026-08-24"),
    ("task-aws-sap-revision2",     "AWS SAP-C02 - Revisión errores simulacro 2 + lagunas críticas",     "2026-08-25"),
    ("task-aws-sap-mock-extra1",   "AWS SAP-C02 - Mock exam adicional (Stephane Maarek / Jon Bonso)",   "2026-08-26"),
    ("task-aws-sap-simulacro3",    "AWS SAP-C02 - Simulacro 3 completo (punto de control 2)",           "2026-08-27"),
    ("task-aws-sap-revision3",     "AWS SAP-C02 - Revisión errores simulacro 3: redes, migración, multicuenta","2026-08-28"),
    ("task-aws-sap-mock-extra2",   "AWS SAP-C02 - Mock exam adicional (FlashGenius)",                   "2026-08-29"),
    ("task-aws-sap-debiles",       "AWS SAP-C02 - Refuerzo de dominios débiles identificados",          "2026-08-30"),
    ("task-aws-sap-practica-aws",  "AWS SAP-C02 - Examen oficial de práctica AWS",                      "2026-08-31"),
    ("task-aws-sap-flashcards",    "AWS SAP-C02 - Flashcards intensivas de servicios clave",            "2026-09-01"),
    ("task-aws-sap-multi-dr",      "AWS SAP-C02 - Escenarios complejos multi-región y DR",              "2026-09-02"),
    ("task-aws-sap-consolidacion", "AWS SAP-C02 - Consolidación servicios clave y revisión de lagunas", "2026-09-03"),
    ("task-aws-sap-mock-final",    "AWS SAP-C02 - Mock final completo + checklist de errores",          "2026-09-04"),
]
for tid, title, d in aws_mocks:
    new_tasks.append(task(tid, title, d, "cert-aws-sap"))

# Bloque D — Últimos días + examen (5 sep – 7 sep · 3 días)
new_tasks.append(
    task("task-aws-sap-last-review",
         "AWS SAP-C02 - Última revisión de notas, flashcards y servicios clave",
         "2026-09-05", "cert-aws-sap")
)
new_tasks.append(
    task("task-aws-sap-33",
         "AWS SAP-C02 - Repaso final y checklist de examen",
         "2026-09-06", "cert-aws-sap")
)
new_tasks.append(
    task("task-aws-sap-exam",
         "EXAMEN: AWS Certified Solutions Architect - Professional",
         "2026-09-07", "cert-aws-sap", "exam", "09:00", "12:00")
)

# ── Insertar todas las tareas ─────────────────────────────────────────────────
for t in new_tasks:
    cur.execute(INSERT_SQL, t)

conn.commit()
conn.close()

print(f"Tareas creadas: {len(new_tasks)}")
print("\nResumen por fase:")
by_cert = {}
for t in new_tasks:
    c = t[8]
    by_cert[c] = by_cert.get(c, 0) + 1
order = ["cert-dlai-rag","cert-ibm-rag","cert-nvidia","cert-neo4j-prof",
         "cert-neo4j-gds","cert-ontotext","cert-aws-sap"]
labels = {
    "cert-dlai-rag":   "Fase 1 · DLAI RAG         (19 abr – 27 abr ·  9 d)",
    "cert-ibm-rag":    "Fase 2 · IBM RAG & Agentic(28 abr – 21 may · 24 d)",
    "cert-nvidia":     "Fase 3 · NVIDIA Agentic AI(22 may – 14 jun · 24 d)",
    "cert-neo4j-prof": "Fase 4 · Neo4j Prof       (15 jun – 23 jun ·  9 d)",
    "cert-neo4j-gds":  "Fase 5 · Neo4j GDS        (24 jun –  5 jul · 12 d)",
    "cert-ontotext":   "Fase 6 · Ontotext KG Eng  ( 6 jul – 18 jul · 13 d)",
    "cert-aws-sap":    "Fase 7 · AWS SAP          (19 jul –  7 sep · 51 d)",
}
for c in order:
    print(f"  {labels[c]}:  {by_cert.get(c, 0)} tareas")
