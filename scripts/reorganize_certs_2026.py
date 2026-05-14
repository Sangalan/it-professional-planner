"""
Reorganiza el plan de certificaciones 2026 siguiendo el calendario de 7 fases
(19 abr – 22 nov 2026): DLAI RAG → IBM RAG → NVIDIA → Neo4j Prof → Neo4j GDS
→ Ontotext → AWS SAP.
"""

import sqlite3

DB = "/Users/miguel/Projects/miguel-galan/git/it-professional-planner/backend/data/planner.db"

conn = sqlite3.connect(DB)
cur = conn.cursor()

# ── 1. ELIMINAR tareas de certificaciones ─────────────────────────────────────
CERT_IDS = [
    "cert-neo4j-prof", "cert-neo4j-gds", "cert-ontotext",
    "cert-nvidia", "cert-ibm-rag", "cert-dlai-rag", "cert-aws-sap",
]
ph = ",".join(["?"] * len(CERT_IDS))
cur.execute(f"DELETE FROM tasks WHERE milestone_id IN ({ph})", CERT_IDS)
deleted = cur.rowcount
print(f"Tareas eliminadas: {deleted}")

# ── 2. ACTUALIZAR fechas objetivo y notas de certificaciones ──────────────────
CERT_UPDATES = {
    "cert-dlai-rag": (
        "2026-05-03",
        "Fase 1 (19 abr – 3 may · 15h)\n"
        "Punto de control:\n"
        "- Fecha clave: 2026-04-28.\n"
        "- La sesión de estudio debe cerrar con comprensión clara de RAG, fragmentación, "
        "recuperación, evaluación y límites del enfoque.\n"
        "- Si quedan dudas estructurales sobre el flujo o sus compensaciones, "
        "mover el examen 2-4 días."
    ),
    "cert-ibm-rag": (
        "2026-06-07",
        "Fase 2 (4 may – 7 jun · 45h)\n"
        "8 cursos + capstone. Plan 6h/semana (~2h/día).\n"
        "Truco: hacer los labs con caso de uso ECM/BPM para el portfolio.\n"
        "Punto de control:\n"
        "- Fecha clave: 2026-06-06.\n"
        "- Deben quedar claros flujo RAG, evaluación básica, anclaje al contexto, "
        "recuperación y papel de los agentes.\n"
        "- Si no puedes explicar el flujo extremo a extremo con claridad, "
        "mover el examen 2-4 días."
    ),
    "cert-nvidia": (
        "2026-07-05",
        "Fase 3 (8 jun – 5 jul · 35h)\n"
        "Examen proctorizado: 60–70 preguntas, 90–120 min, $200 (Certiverse).\n"
        "Recursos: blueprint oficial NVIDIA + NeMo Agent Toolkit + "
        "practice tests Udemy (6 exámenes mock).\n"
        "Recordatorio: reservar el examen el primer día de la fase "
        "(4-6 semanas de antelación).\n"
        "Punto de control:\n"
        "- Fecha clave: 2026-07-04.\n"
        "- Debe haber soltura con conceptos de agentic AI, patrones, evaluación, "
        "safety y stack práctico.\n"
        "- Si todo suena teórico y poco operativo, mover el examen 3-5 días "
        "y reforzar demos/casos."
    ),
    "cert-neo4j-prof": (
        "2026-07-19",
        "Fase 4 (6 jul – 19 jul · 15h)\n"
        "Recursos: GraphAcademy — 'Cypher Fundamentals', "
        "'Graph Data Modeling Fundamentals', 'Importing Data'.\n"
        "Examen gratuito, 1h, 80% para aprobar.\n"
        "Punto de control:\n"
        "- Fecha clave: 2026-07-13.\n"
        "- Llegar al repaso final con solvencia sobre modelado de grafos, Cypher, "
        "índices/restricciones, importación y administración básica.\n"
        "- Si no hay sensación clara de aprobado, mover el examen 5-7 días."
    ),
    "cert-neo4j-gds": (
        "2026-08-02",
        "Fase 5 (20 jul – 2 ago · 20h)\n"
        "Recursos: GraphAcademy 'Introduction to Graph Data Science' + "
        "'Graph Data Science Fundamentals' + documentación GDS oficial.\n"
        "40 preguntas, 1h, 80%, gratuito.\n"
        "Punto de control:\n"
        "- Fecha clave: 2026-07-30.\n"
        "- Deben estar claros proyecciones de grafos, algoritmos principales, "
        "interpretación de resultados y flujos básicos de ML en GDS.\n"
        "- Si hay dudas fuertes en algoritmos, proyecciones o métricas, "
        "mover el examen 5-7 días."
    ),
    "cert-ontotext": (
        "2026-08-23",
        "Fase 6 (3 ago – 23 ago · 25h)\n"
        "Recursos: Ontotext Academy, learning path 'GraphDB Knowledge Graph Engineer' "
        "(gratuito, auto-paced, quizzes retomables, 70% por quiz).\n"
        "Punto de control:\n"
        "- Fecha clave: 2026-08-15.\n"
        "- Llegar al repaso final dominando RDF, SPARQL, inferencia, "
        "ingestiones y operativa base de GraphDB.\n"
        "- Si faltan reflejos con consultas o configuración, mover el examen 5-7 días."
    ),
    "cert-aws-sap": (
        "2026-11-22",
        "AWS Certified Solutions Architect - Professional (SAP-C02)\n\n"
        "Fase 7 (24 ago – 22 nov · 100h) — Plan 13 semanas:\n"
        "- Semanas 1-7 (24 ago – 11 oct): curso core ~50h "
        "(Adrian Cantrill o Stephane Maarek)\n"
        "- Semanas 8-10 (12 oct – 1 nov): hands-on AWS Free Tier + AWS SimuLearn ~25h\n"
        "- Semanas 11-12 (2 nov – 15 nov): simulacros Tutorials Dojo "
        "(mínimo 3 completos) ~20h\n"
        "- Semana 13 (16 nov – 22 nov): examen oficial de práctica AWS + "
        "revisión ligera. Examen real ~20 nov.\n\n"
        "Recordatorio: reservar el examen el 28 sep "
        "(4-6 semanas de antelación).\n\n"
        "Punto de control 1 (2026-10-12): completar el Practice Question Set oficial "
        "y cerrar las lagunas principales.\n"
        "Punto de control 2 (2026-11-02): llegar al simulacro 3 con >=80% de "
        "confianza/resultado.\n"
        "Si el PC2 no sale con solvencia, reprogramar el examen 7-10 días.\n\n"
        "Examen oficial: 75 preguntas, 180 min, $300.\n"
        "Dominios: organizacional (26%), nuevas soluciones (29%), "
        "mejora continua (25%), migración (20%).\n\n"
        "Recursos:\n"
        "- Guía del examen SAP-C02: "
        "https://docs.aws.amazon.com/aws-certification/latest/"
        "solutions-architect-professional-02/solutions-architect-professional-02.html\n"
        "- Página de certificación: "
        "https://aws.amazon.com/certification/certified-solutions-architect-professional/\n"
        "- Skill Builder: https://aws.amazon.com/certification/certification-prep/\n"
        "- Architecting on AWS: "
        "https://skillbuilder.aws/learn/TFDQJZ1UV5/architecting-on-aws/DPS7CTFY8J\n"
        "- Advanced Architecting on AWS: "
        "https://skillbuilder.aws/learn/BWA4N8R9QE/advanced-architecting-on-aws/P1VYB9XBZT\n"
        "- AWS Well-Architected Tool: "
        "https://docs.aws.amazon.com/wellarchitected/latest/userguide/intro.html"
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
# FASE 1 · DeepLearning.AI RAG (19 abr – 3 may · ~15h)
# ════════════════════════════════════════════════════════════════════════════════
new_tasks += [
    task("task-dlai-rag-s01",
         "DeepLearning.AI RAG - Introducción y conceptos RAG",
         "2026-04-19", "cert-dlai-rag"),
    task("task-dlai-rag-s02",
         "DeepLearning.AI RAG - Fragmentación y embeddings",
         "2026-04-20", "cert-dlai-rag"),
    task("task-dlai-rag-s03",
         "DeepLearning.AI RAG - Vector DBs: FAISS y Weaviate",
         "2026-04-21", "cert-dlai-rag"),
    task("task-dlai-rag-s04",
         "DeepLearning.AI RAG - Recuperación y reranking",
         "2026-04-22", "cert-dlai-rag"),
    task("task-dlai-rag-s05",
         "DeepLearning.AI RAG - Evaluación de pipelines RAG",
         "2026-04-23", "cert-dlai-rag"),
    task("task-dlai-rag-s06",
         "DeepLearning.AI RAG - Advanced RAG patterns",
         "2026-04-24", "cert-dlai-rag"),
    task("task-dlai-rag-s07",
         "DeepLearning.AI RAG - Caso de uso ECM/BPM con RAG",
         "2026-04-25", "cert-dlai-rag"),
    task("task-dlai-rag-review",
         "Repasar DeepLearning.AI RAG (repaso final)",
         "2026-04-28", "cert-dlai-rag"),
    task("task-dlai-rag-exam",
         "EXAMEN: DeepLearning.AI RAG",
         "2026-05-03", "cert-dlai-rag", "exam"),
]

# ════════════════════════════════════════════════════════════════════════════════
# FASE 2 · IBM RAG & Agentic AI (4 may – 7 jun · ~45h)
# ════════════════════════════════════════════════════════════════════════════════
new_tasks += [
    task("task-ibm-rag-s01",
         "IBM RAG & Agentic AI - Course 1: Generative AI Essentials (sesión 1)",
         "2026-05-04", "cert-ibm-rag"),
    task("task-ibm-rag-s02",
         "IBM RAG & Agentic AI - Course 1: Generative AI Essentials (sesión 2)",
         "2026-05-05", "cert-ibm-rag"),
    task("task-ibm-rag-s03",
         "IBM RAG & Agentic AI - Course 2: Introduction to RAG (sesión 1)",
         "2026-05-06", "cert-ibm-rag"),
    task("task-ibm-rag-s04",
         "IBM RAG & Agentic AI - Course 2: Introduction to RAG (sesión 2)",
         "2026-05-07", "cert-ibm-rag"),
    task("task-ibm-rag-s05",
         "IBM RAG & Agentic AI - Course 3: Advanced RAG Techniques (sesión 1)",
         "2026-05-08", "cert-ibm-rag"),
    task("task-ibm-rag-s06",
         "IBM RAG & Agentic AI - Course 3: Advanced RAG Techniques (sesión 2)",
         "2026-05-09", "cert-ibm-rag"),
    task("task-ibm-rag-s07",
         "IBM RAG & Agentic AI - Course 3: Advanced RAG Techniques (sesión 3)",
         "2026-05-10", "cert-ibm-rag"),
    task("task-ibm-rag-s08",
         "IBM RAG & Agentic AI - Course 4: Agentic AI Fundamentals (sesión 1)",
         "2026-05-11", "cert-ibm-rag"),
    task("task-ibm-rag-s09",
         "IBM RAG & Agentic AI - Course 4: Agentic AI Fundamentals (sesión 2)",
         "2026-05-12", "cert-ibm-rag"),
    task("task-ibm-rag-s10",
         "IBM RAG & Agentic AI - Course 4: Agentic AI Fundamentals (sesión 3)",
         "2026-05-13", "cert-ibm-rag"),
    task("task-ibm-rag-s11",
         "IBM RAG & Agentic AI - Course 5: LangGraph y sistemas multiagente (sesión 1)",
         "2026-05-14", "cert-ibm-rag"),
    task("task-ibm-rag-s12",
         "IBM RAG & Agentic AI - Course 5: LangGraph y sistemas multiagente (sesión 2)",
         "2026-05-15", "cert-ibm-rag"),
    task("task-ibm-rag-s13",
         "IBM RAG & Agentic AI - Course 5: LangGraph y sistemas multiagente (sesión 3)",
         "2026-05-16", "cert-ibm-rag"),
    task("task-ibm-rag-s14",
         "IBM RAG & Agentic AI - Course 6: CrewAI y orquestación de agentes (sesión 1)",
         "2026-05-17", "cert-ibm-rag"),
    task("task-ibm-rag-s15",
         "IBM RAG & Agentic AI - Course 6: CrewAI y orquestación de agentes (sesión 2)",
         "2026-05-18", "cert-ibm-rag"),
    task("task-ibm-rag-s16",
         "IBM RAG & Agentic AI - Course 6: CrewAI y orquestación de agentes (sesión 3)",
         "2026-05-19", "cert-ibm-rag"),
    task("task-ibm-rag-s17",
         "IBM RAG & Agentic AI - Course 7: MCP e integración de herramientas (sesión 1)",
         "2026-05-20", "cert-ibm-rag"),
    task("task-ibm-rag-s18",
         "IBM RAG & Agentic AI - Course 7: MCP e integración de herramientas (sesión 2)",
         "2026-05-21", "cert-ibm-rag"),
    task("task-ibm-rag-s19",
         "IBM RAG & Agentic AI - Capstone: diseño con caso ECM/BPM (sesión 1)",
         "2026-05-22", "cert-ibm-rag"),
    task("task-ibm-rag-s20",
         "IBM RAG & Agentic AI - Capstone: implementación RAG pipeline (sesión 2)",
         "2026-05-23", "cert-ibm-rag"),
    task("task-ibm-rag-s21",
         "IBM RAG & Agentic AI - Capstone: implementación agentes (sesión 3)",
         "2026-05-24", "cert-ibm-rag"),
    task("task-ibm-rag-s22",
         "IBM RAG & Agentic AI - Capstone: evaluación y entrega final (sesión 4)",
         "2026-05-25", "cert-ibm-rag"),
    task("task-ibm-rag-review",
         "Repasar IBM RAG & Agentic AI (repaso final)",
         "2026-06-06", "cert-ibm-rag"),
    task("task-ibm-rag-exam",
         "EXAMEN: IBM RAG & Agentic AI",
         "2026-06-07", "cert-ibm-rag", "exam"),
]

# ════════════════════════════════════════════════════════════════════════════════
# FASE 3 · NVIDIA Agentic AI Professional (8 jun – 5 jul · ~35h)
# ════════════════════════════════════════════════════════════════════════════════
new_tasks += [
    # Reservar examen el día de inicio (4-6 semanas de antelación)
    task("task-nvidia-book",
         "Reservar examen NVIDIA Agentic AI Professional (Certiverse)",
         "2026-06-08", "cert-nvidia", "NVIDIA exam booking", "17:30", "18:00"),

    task("task-nvidia-s01",
         "NVIDIA Agentic AI - Blueprint oficial y fundamentos agentic AI",
         "2026-06-08", "cert-nvidia"),
    task("task-nvidia-s02",
         "NVIDIA Agentic AI - NeMo Agent Toolkit: setup y primeros pasos",
         "2026-06-09", "cert-nvidia"),
    task("task-nvidia-s03",
         "NVIDIA Agentic AI - Patrones de orquestación: reactivo vs planificador",
         "2026-06-10", "cert-nvidia"),
    task("task-nvidia-s04",
         "NVIDIA Agentic AI - Memory, state y context management",
         "2026-06-11", "cert-nvidia"),
    task("task-nvidia-s05",
         "NVIDIA Agentic AI - Tool use y function calling en agentes",
         "2026-06-12", "cert-nvidia"),
    task("task-nvidia-s06",
         "NVIDIA Agentic AI - Multi-agent coordination y comunicación",
         "2026-06-13", "cert-nvidia"),
    task("task-nvidia-s07",
         "NVIDIA Agentic AI - Observabilidad: trazas, logs y métricas",
         "2026-06-14", "cert-nvidia"),
    task("task-nvidia-s08",
         "NVIDIA Agentic AI - Guardrails: safety, filtros y content policies",
         "2026-06-15", "cert-nvidia"),
    task("task-nvidia-s09",
         "NVIDIA Agentic AI - Evaluación de agentes: métricas y benchmarks",
         "2026-06-16", "cert-nvidia"),
    task("task-nvidia-s10",
         "NVIDIA Agentic AI - Deployment y producción en NVIDIA stack",
         "2026-06-17", "cert-nvidia"),
    task("task-nvidia-s11",
         "NVIDIA Agentic AI - Casos prácticos: RAG + agentes (ECM/BPM)",
         "2026-06-18", "cert-nvidia"),
    task("task-nvidia-s12",
         "NVIDIA Agentic AI - Repaso de arquitecturas de referencia",
         "2026-06-19", "cert-nvidia"),
    task("task-nvidia-s13",
         "NVIDIA Agentic AI - Review blueprint + lagunas identificadas",
         "2026-06-20", "cert-nvidia"),
    task("task-nvidia-s14",
         "NVIDIA Agentic AI - Preguntas de práctica (Udemy mock prep)",
         "2026-06-21", "cert-nvidia"),
    task("task-nvidia-mock1",
         "NVIDIA Agentic AI - Mock exam 1 (FlashGenius/Udemy)",
         "2026-06-22", "cert-nvidia"),
    task("task-nvidia-mock2",
         "NVIDIA Agentic AI - Mock exam 2 + revisión de errores",
         "2026-06-23", "cert-nvidia"),
    task("task-nvidia-mock3",
         "NVIDIA Agentic AI - Mock exam 3 + refuerzo de puntos débiles",
         "2026-06-24", "cert-nvidia"),
    task("task-nvidia-review1",
         "NVIDIA Agentic AI - Revisión profunda de errores (mocks 1-3)",
         "2026-06-25", "cert-nvidia"),
    task("task-nvidia-review2",
         "NVIDIA Agentic AI - Repaso orchestration, observability y guardrails",
         "2026-06-26", "cert-nvidia"),
    task("task-nvidia-mock4",
         "NVIDIA Agentic AI - Mock exam 4 (simulacro completo)",
         "2026-06-28", "cert-nvidia"),
    task("task-nvidia-mock5",
         "NVIDIA Agentic AI - Mock exam 5 + revisión de errores",
         "2026-06-29", "cert-nvidia"),
    task("task-nvidia-mock6",
         "NVIDIA Agentic AI - Mock exam 6 + checklist final",
         "2026-06-30", "cert-nvidia"),
    task("task-nvidia-final-review",
         "Repasar NVIDIA Agentic AI Professional (repaso final)",
         "2026-07-04", "cert-nvidia"),
    task("task-nvidia-exam",
         "EXAMEN: NVIDIA Agentic AI Professional",
         "2026-07-05", "cert-nvidia", "exam"),
]

# ════════════════════════════════════════════════════════════════════════════════
# FASE 4 · Neo4j Certified Professional (6 jul – 19 jul · ~15h)
# ════════════════════════════════════════════════════════════════════════════════
new_tasks += [
    task("task-neo4j-prof-s01",
         "Neo4j Certified Professional - Cypher Fundamentals (sesión 1)",
         "2026-07-06", "cert-neo4j-prof"),
    task("task-neo4j-prof-s02",
         "Neo4j Certified Professional - Cypher Fundamentals (sesión 2)",
         "2026-07-07", "cert-neo4j-prof"),
    task("task-neo4j-prof-s03",
         "Neo4j Certified Professional - Graph Data Modeling Fundamentals",
         "2026-07-08", "cert-neo4j-prof"),
    task("task-neo4j-prof-s04",
         "Neo4j Certified Professional - Importing Data into Neo4j",
         "2026-07-09", "cert-neo4j-prof"),
    task("task-neo4j-prof-s05",
         "Neo4j Certified Professional - Índices, restricciones y administración básica",
         "2026-07-10", "cert-neo4j-prof"),
    task("task-neo4j-prof-s06",
         "Neo4j Certified Professional - Preguntas de práctica (dataset recommendations)",
         "2026-07-11", "cert-neo4j-prof"),
    task("task-neo4j-prof-s07",
         "Neo4j Certified Professional - Repaso Cypher, modelado e importación",
         "2026-07-12", "cert-neo4j-prof"),
    task("task-neo4j-prof-review",
         "Repasar Neo4j Certified Professional (repaso final)",
         "2026-07-13", "cert-neo4j-prof"),
    task("task-neo4j-prof-exam",
         "EXAMEN: Neo4j Certified Professional",
         "2026-07-19", "cert-neo4j-prof", "exam"),
]

# ════════════════════════════════════════════════════════════════════════════════
# FASE 5 · Neo4j Graph Data Science (20 jul – 2 ago · ~20h)
# ════════════════════════════════════════════════════════════════════════════════
new_tasks += [
    task("task-neo4j-gds-s01",
         "Neo4j GDS - Introduction to Graph Data Science (sesión 1)",
         "2026-07-20", "cert-neo4j-gds"),
    task("task-neo4j-gds-s02",
         "Neo4j GDS - Introduction to Graph Data Science (sesión 2)",
         "2026-07-21", "cert-neo4j-gds"),
    task("task-neo4j-gds-s03",
         "Neo4j GDS - Graph Data Science Fundamentals (sesión 1)",
         "2026-07-22", "cert-neo4j-gds"),
    task("task-neo4j-gds-s04",
         "Neo4j GDS - Proyecciones de grafos y operaciones en memoria",
         "2026-07-23", "cert-neo4j-gds"),
    task("task-neo4j-gds-s05",
         "Neo4j GDS - Centralidad: PageRank, Betweenness, Closeness",
         "2026-07-24", "cert-neo4j-gds"),
    task("task-neo4j-gds-s06",
         "Neo4j GDS - Community detection: Louvain, WCC, LPA",
         "2026-07-25", "cert-neo4j-gds"),
    task("task-neo4j-gds-s07",
         "Neo4j GDS - Pathfinding: Dijkstra, A*, Shortest Path",
         "2026-07-26", "cert-neo4j-gds"),
    task("task-neo4j-gds-s08",
         "Neo4j GDS - Link prediction y similarity algorithms",
         "2026-07-27", "cert-neo4j-gds"),
    task("task-neo4j-gds-s09",
         "Neo4j GDS - Flujos de ML: pipeline de clasificación de nodos",
         "2026-07-28", "cert-neo4j-gds"),
    task("task-neo4j-gds-s10",
         "Neo4j GDS - Cuándo aplicar cada algoritmo: práctica y repaso",
         "2026-07-29", "cert-neo4j-gds"),
    task("task-neo4j-gds-review",
         "Repasar Neo4j Graph Data Science (repaso final)",
         "2026-07-30", "cert-neo4j-gds"),
    task("task-neo4j-gds-exam",
         "EXAMEN: Neo4j Graph Data Science",
         "2026-08-02", "cert-neo4j-gds", "exam"),
]

# ════════════════════════════════════════════════════════════════════════════════
# FASE 6 · Ontotext GraphDB KG Engineer (3 ago – 23 ago · ~25h)
# ════════════════════════════════════════════════════════════════════════════════
new_tasks += [
    task("task-ontotext-s01",
         "Ontotext GraphDB - Fundamentos RDF y modelo de datos en tripletas",
         "2026-08-03", "cert-ontotext"),
    task("task-ontotext-s02",
         "Ontotext GraphDB - SPARQL: consultas básicas SELECT y CONSTRUCT",
         "2026-08-04", "cert-ontotext"),
    task("task-ontotext-s03",
         "Ontotext GraphDB - SPARQL avanzado: OPTIONAL, FILTER, UNION",
         "2026-08-05", "cert-ontotext"),
    task("task-ontotext-s04",
         "Ontotext GraphDB - Ontologías OWL y SHACL para validación",
         "2026-08-06", "cert-ontotext"),
    task("task-ontotext-s05",
         "Ontotext GraphDB - Inferencia y razonamiento semántico",
         "2026-08-07", "cert-ontotext"),
    task("task-ontotext-s06",
         "Ontotext GraphDB - Importación: RDF/XML, Turtle, JSON-LD",
         "2026-08-08", "cert-ontotext"),
    task("task-ontotext-s07",
         "Ontotext GraphDB - Operativa: repositorios, backups y clustering",
         "2026-08-09", "cert-ontotext"),
    task("task-ontotext-s08",
         "Ontotext GraphDB - Knowledge Graph con datos ECM/documentos",
         "2026-08-10", "cert-ontotext"),
    task("task-ontotext-s09",
         "Ontotext GraphDB - Taxonomías y metadata semántica (puente ECM)",
         "2026-08-11", "cert-ontotext"),
    task("task-ontotext-s10",
         "Ontotext GraphDB - Quizzes de módulos y práctica SPARQL",
         "2026-08-12", "cert-ontotext"),
    task("task-ontotext-s11",
         "Ontotext GraphDB - Repaso RDF, SPARQL, inferencia e ingestión",
         "2026-08-13", "cert-ontotext"),
    task("task-ontotext-review",
         "Repasar Ontotext GraphDB KG Engineer (repaso final)",
         "2026-08-15", "cert-ontotext"),
    task("task-ontotext-exam",
         "EXAMEN: Ontotext GraphDB KG Engineer",
         "2026-08-23", "cert-ontotext", "exam"),
]

# ════════════════════════════════════════════════════════════════════════════════
# FASE 7 · AWS Solutions Architect Professional (24 ago – 22 nov · ~100h)
# ════════════════════════════════════════════════════════════════════════════════

# Reservar examen el 28 sep (4-6 semanas antes del examen de ~20 nov)
new_tasks.append(
    task("task-aws-sap-book",
         "Reservar examen AWS Certified Solutions Architect - Professional",
         "2026-09-28", "cert-aws-sap", "AWS exam booking", "17:30", "18:00")
)

# Semanas 1-7: curso core (24 ago – 11 oct · ~50h), sesión cada ~2 días
aws_core = [
    ("task-aws-sap-01", "AWS SAP-C02 - Guía oficial y diagnóstico inicial",                       "2026-08-24"),
    ("task-aws-sap-02", "AWS SAP-C02 - Dominio 1: Organizations, SCPs y cuentas",                  "2026-08-26"),
    ("task-aws-sap-03", "AWS SAP-C02 - Dominio 1: IAM Identity Center y federación",               "2026-08-28"),
    ("task-aws-sap-04", "AWS SAP-C02 - Dominio 1: logging, auditoría y governance",                "2026-09-01"),
    ("task-aws-sap-05", "AWS SAP-C02 - Dominio 1: Transit Gateway, DX y VPN",                     "2026-09-03"),
    ("task-aws-sap-06", "AWS SAP-C02 - Dominio 1: DNS híbrido y conectividad inter-región",        "2026-09-05"),
    ("task-aws-sap-07", "AWS SAP-C02 - Dominio 2: cómputo resiliente",                            "2026-09-07"),
    ("task-aws-sap-08", "AWS SAP-C02 - Dominio 2: datos y almacenamiento a escala",                "2026-09-09"),
    ("task-aws-sap-09", "AWS SAP-C02 - Dominio 2: integración y mensajería",                      "2026-09-11"),
    ("task-aws-sap-10", "AWS SAP-C02 - Dominio 2: serverless y event-driven",                     "2026-09-13"),
    ("task-aws-sap-11", "AWS SAP-C02 - Dominio 2: seguridad y cifrado",                           "2026-09-15"),
    ("task-aws-sap-12", "AWS SAP-C02 - Dominio 2: coste y rendimiento",                           "2026-09-17"),
    ("task-aws-sap-13", "AWS SAP-C02 - Dominio 3: observabilidad y operaciones",                  "2026-09-19"),
    ("task-aws-sap-14", "AWS SAP-C02 - Dominio 3: alta disponibilidad y disaster recovery",        "2026-09-21"),
    ("task-aws-sap-15", "AWS SAP-C02 - Dominio 3: backup, RPO/RTO y continuidad",                 "2026-09-23"),
    ("task-aws-sap-16", "AWS SAP-C02 - Dominio 3: performance tuning",                            "2026-09-25"),
    ("task-aws-sap-17", "AWS SAP-C02 - Dominio 3: cost optimization y FinOps",                    "2026-09-27"),
    ("task-aws-sap-18", "AWS SAP-C02 - Dominio 4: discovery y estrategia de migración",            "2026-09-29"),
    ("task-aws-sap-19", "AWS SAP-C02 - Dominio 4: migración de bases de datos",                   "2026-10-01"),
    ("task-aws-sap-20", "AWS SAP-C02 - Dominio 4: modernización con contenedores",                "2026-10-03"),
    ("task-aws-sap-21", "AWS SAP-C02 - Dominio 4: modernización serverless y eventing",           "2026-10-05"),
    ("task-aws-sap-22", "AWS SAP-C02 - AWS Well-Architected Tool hands-on",                       "2026-10-07"),
    ("task-aws-sap-23", "AWS SAP-C02 - Architecting on AWS repaso dirigido",                      "2026-10-09"),
    ("task-aws-sap-24", "AWS SAP-C02 - Advanced Architecting on AWS repaso dirigido",             "2026-10-11"),
]
for tid, title, d in aws_core:
    new_tasks.append(task(tid, title, d, "cert-aws-sap"))

# Semanas 8-10: hands-on + primeros simulacros (12 oct – 1 nov · ~25h)
aws_handson = [
    ("task-aws-sap-25",           "AWS SAP-C02 - Practice Question Set oficial (punto de control 1)",         "2026-10-12"),
    ("task-aws-sap-26",           "AWS SAP-C02 - Builder Labs y casos prácticos multi-cuenta",                "2026-10-14"),
    ("task-aws-sap-27",           "AWS SAP-C02 - Whiteboard enterprise multi-region",                        "2026-10-16"),
    ("task-aws-sap-28",           "AWS SAP-C02 - Whiteboard seguridad, red y compliance",                    "2026-10-19"),
    ("task-aws-sap-29",           "AWS SAP-C02 - Whiteboard migración y modernización",                      "2026-10-21"),
    ("task-aws-sap-handson-extra","AWS SAP-C02 - Hands-on AWS SimuLearn: escenarios avanzados",              "2026-10-23"),
    ("task-aws-sap-30",           "AWS SAP-C02 - Simulacro 1 por dominios (Tutorials Dojo)",                 "2026-10-26"),
    ("task-aws-sap-31",           "AWS SAP-C02 - Revisión de errores y flashcards (simulacro 1)",            "2026-10-28"),
    ("task-aws-sap-32",           "AWS SAP-C02 - Simulacro 2 y preguntas difíciles (Tutorials Dojo)",        "2026-10-30"),
]
for tid, title, d in aws_handson:
    new_tasks.append(task(tid, title, d, "cert-aws-sap"))

# Semanas 11-12: simulacros finales (2 nov – 15 nov · ~20h)
aws_mocks = [
    ("task-aws-sap-revision2",    "AWS SAP-C02 - Revisión de errores simulacro 2 + lagunas críticas",        "2026-11-02"),
    ("task-aws-sap-simulacro3",   "AWS SAP-C02 - Simulacro 3 completo (Tutorials Dojo)",                     "2026-11-05"),
    ("task-aws-sap-revision3",    "AWS SAP-C02 - Revisión errores simulacro 3: redes, migración, multicuenta","2026-11-07"),
    ("task-aws-sap-practica-aws", "AWS SAP-C02 - Examen oficial de práctica AWS (punto de control 2)",        "2026-11-10"),
    ("task-aws-sap-consolidacion","AWS SAP-C02 - Consolidación servicios clave y revisión de lagunas",        "2026-11-13"),
]
for tid, title, d in aws_mocks:
    new_tasks.append(task(tid, title, d, "cert-aws-sap"))

# Semana 13: última semana + examen
new_tasks.append(
    task("task-aws-sap-33",
         "AWS SAP-C02 - Repaso final y checklist de examen",
         "2026-11-16", "cert-aws-sap")
)
new_tasks.append(
    task("task-aws-sap-exam",
         "EXAMEN: AWS Certified Solutions Architect - Professional",
         "2026-11-20", "cert-aws-sap", "exam", "09:00", "12:00")
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
    c = t[8]  # milestone_id
    by_cert[c] = by_cert.get(c, 0) + 1
order = ["cert-dlai-rag","cert-ibm-rag","cert-nvidia","cert-neo4j-prof",
         "cert-neo4j-gds","cert-ontotext","cert-aws-sap"]
labels = {
    "cert-dlai-rag":   "Fase 1 · DLAI RAG          (19 abr – 3 may)",
    "cert-ibm-rag":    "Fase 2 · IBM RAG & Agentic  (4 may – 7 jun)",
    "cert-nvidia":     "Fase 3 · NVIDIA Agentic AI  (8 jun – 5 jul)",
    "cert-neo4j-prof": "Fase 4 · Neo4j Prof         (6 jul – 19 jul)",
    "cert-neo4j-gds":  "Fase 5 · Neo4j GDS          (20 jul – 2 ago)",
    "cert-ontotext":   "Fase 6 · Ontotext KG Eng    (3 ago – 23 ago)",
    "cert-aws-sap":    "Fase 7 · AWS SAP            (24 ago – 22 nov)",
}
for c in order:
    print(f"  {labels[c]}:  {by_cert.get(c, 0)} tareas")
