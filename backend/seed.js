const { db, initSchema } = require('./db');

function clearAll() {
  const tables = ['tasks','work_blocks','events','publications','certifications','repos','prs','milestones','objectives','categories'];
  for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();
}

function seed() {
  initSchema();
  clearAll();

  // ── CATEGORIES ──────────────────────────────────────────────
  const cats = [
    { id: 'linkedin',       name: 'LinkedIn',       color: '#2563eb' },
    { id: 'contenido',      name: 'Contenido',       color: '#7c3aed' },
    { id: 'github',         name: 'GitHub / OSS',    color: '#059669' },
    { id: 'eventos',        name: 'Eventos',         color: '#ea580c' },
    { id: 'certificaciones',name: 'Certificaciones', color: '#dc2626' },
    { id: 'web',            name: 'Web',             color: '#0f766e' },
    { id: 'admin',          name: 'Admin',           color: '#6b7280' },
    { id: 'opensearchcon',  name: 'OpenSearchCon',   color: '#b91c1c' },
  ];
  const insertCat = db.prepare('INSERT OR REPLACE INTO categories VALUES (@id,@name,@color)');
  for (const c of cats) insertCat.run(c);

  // ── OBJECTIVES ──────────────────────────────────────────────
  const objectives = [
    { id:'obj-linkedin',  title:'Posicionamiento en LinkedIn',       description:'Mejorar visibilidad, impresiones y audiencia cualificada.', category_id:'linkedin',       start_date:'2026-04-01', end_date:'2026-06-30', target_value:'+500 seguidores, >10000 imp/mes, 14 publicaciones', progress_mode:'task_based', percentage_completed:0, status:'not_started', priority:1, notes:'' },
    { id:'obj-oss',       title:'Autoridad técnica en open source',  description:'Ejecutar PRs, publicar repos y ganar visibilidad técnica.', category_id:'github',         start_date:'2026-04-01', end_date:'2026-06-30', target_value:'8 PRs Q2, 6 repos, >50 estrellas',                  progress_mode:'task_based', percentage_completed:0, status:'not_started', priority:1, notes:'' },
    { id:'obj-certs',     title:'Credenciales en IA',                description:'Completar certificaciones diferenciales.',                  category_id:'certificaciones', start_date:'2026-04-01', end_date:'2026-06-30', target_value:'5-6 certificaciones',                               progress_mode:'task_based', percentage_completed:0, status:'not_started', priority:1, notes:'' },
    { id:'obj-eventos',   title:'Presencia en eventos',              description:'Asistir a eventos clave y extraer contenido y networking.', category_id:'eventos',        start_date:'2026-04-01', end_date:'2026-06-30', target_value:'5-6 eventos relevantes',                            progress_mode:'task_based', percentage_completed:0, status:'not_started', priority:2, notes:'' },
    { id:'obj-web',       title:'Nueva web corporativa',             description:'Diseñar, desarrollar y publicar la nueva web de Sangalan.',  category_id:'web',            start_date:'2026-05-01', end_date:'2026-06-16', target_value:'Go-live 16 junio',                                   progress_mode:'task_based', percentage_completed:0, status:'not_started', priority:1, notes:'' },
  ];
  const insertObj = db.prepare('INSERT OR REPLACE INTO objectives (id,title,description,category_id,start_date,end_date,target_value,progress_mode,percentage_completed,status,priority,notes) VALUES (@id,@title,@description,@category_id,@start_date,@end_date,@target_value,@progress_mode,@percentage_completed,@status,@priority,@notes)');
  for (const o of objectives) insertObj.run(o);

  // ── MILESTONES ──────────────────────────────────────────────
  const milestones = [
    { id:'milestone-opensearchcon', objective_id:'obj-eventos',   title:'Asistencia a OpenSearchCon Europe',  description:'', target_date:'2026-04-17', percentage_completed:0, status:'not_started', weight:10 },
    { id:'milestone-neo4j-prof',    objective_id:'obj-certs',     title:'Neo4j Certified Professional',        description:'', target_date:'2026-04-21', percentage_completed:0, status:'not_started', weight:10 },
    { id:'milestone-neo4j-gds',     objective_id:'obj-certs',     title:'Neo4j Graph Data Science',            description:'', target_date:'2026-04-28', percentage_completed:0, status:'not_started', weight:10 },
    { id:'milestone-ontotext',      objective_id:'obj-certs',     title:'Ontotext GraphDB KG Engineer',        description:'', target_date:'2026-05-12', percentage_completed:0, status:'not_started', weight:10 },
    { id:'milestone-nvidia',        objective_id:'obj-certs',     title:'NVIDIA Agentic AI Professional',      description:'', target_date:'2026-05-19', percentage_completed:0, status:'not_started', weight:20 },
    { id:'milestone-ibm-rag',       objective_id:'obj-certs',     title:'IBM RAG & Agentic AI',                description:'', target_date:'2026-06-03', percentage_completed:0, status:'not_started', weight:10 },
    { id:'milestone-dlai-rag',      objective_id:'obj-certs',     title:'DeepLearning.AI RAG',                 description:'', target_date:'2026-06-17', percentage_completed:0, status:'not_started', weight:10 },
    { id:'milestone-web-live',      objective_id:'obj-web',       title:'Go-live sangalan.com',                description:'', target_date:'2026-06-16', percentage_completed:0, status:'not_started', weight:30 },
    { id:'milestone-q2-end',        objective_id:'obj-linkedin',  title:'Cierre de trimestre Q2',              description:'', target_date:'2026-06-30', percentage_completed:0, status:'not_started', weight:10 },
    { id:'milestone-aiengineer',    objective_id:'obj-eventos',   title:'AI Engineer Europe',                  description:'', target_date:'2026-04-10', percentage_completed:0, status:'not_started', weight:8  },
    { id:'milestone-datainnovation', objective_id:'obj-eventos',  title:'Data Innovation Summit',              description:'', target_date:'2026-05-08', percentage_completed:0, status:'not_started', weight:8  },
    { id:'milestone-aisummit',      objective_id:'obj-eventos',   title:'AI Summit London',                    description:'', target_date:'2026-06-11', percentage_completed:0, status:'not_started', weight:8  },
  ];
  const insertMs = db.prepare('INSERT OR REPLACE INTO milestones VALUES (@id,@objective_id,@title,@description,@target_date,@percentage_completed,@status,@weight)');
  for (const m of milestones) insertMs.run(m);

  // ── EVENTS ──────────────────────────────────────────────────
  const events = [
    { id:'event-ai-engineer-europe', title:'AI Engineer Europe',         start_date:'2026-04-08', end_date:'2026-04-10', location:'Londres, UK',     format:'presencial', estimated_cost:1200, category_id:'eventos',       notes:'' },
    { id:'event-opensearchcon',      title:'OpenSearchCon Europe',        start_date:'2026-04-16', end_date:'2026-04-17', location:'Praga, CZ',       format:'presencial', estimated_cost:900,  category_id:'opensearchcon', notes:'' },
    { id:'event-data-innovation',    title:'Data Innovation Summit',      start_date:'2026-05-06', end_date:'2026-05-08', location:'Estocolmo, SE',   format:'presencial', estimated_cost:1100, category_id:'eventos',       notes:'' },
    { id:'event-cybersec-europe',    title:'Cybersec Europe',             start_date:'2026-05-20', end_date:'2026-05-21', location:'Bruselas, BE',    format:'presencial', estimated_cost:600,  category_id:'eventos',       notes:'' },
    { id:'event-communitylive',      title:'Hyland CommunityLIVE',        start_date:'2026-05-30', end_date:'2026-06-02', location:'Online / TBD',    format:'online',     estimated_cost:0,    category_id:'eventos',       notes:'' },
    { id:'event-ai-summit',          title:'AI Summit London',            start_date:'2026-06-10', end_date:'2026-06-11', location:'Londres, UK',     format:'presencial', estimated_cost:1000, category_id:'eventos',       notes:'' },
    { id:'event-gitex-ai-europe',    title:'GITEX AI Europe',             start_date:'2026-06-30', end_date:'2026-06-30', location:'Berlín, DE',      format:'presencial', estimated_cost:700,  category_id:'eventos',       notes:'' },
  ];
  const insertEv = db.prepare('INSERT OR REPLACE INTO events VALUES (@id,@title,@start_date,@end_date,@location,@format,@estimated_cost,@category_id,@notes)');
  for (const e of events) insertEv.run(e);

  // ── PUBLICATIONS ─────────────────────────────────────────────
  const publications = [
    { id:'pub-01', date:'2026-04-06', type:'post',    title:'Por qué RAG es el futuro de la gestión documental empresarial',  category_id:'contenido',     status:'pending', notes:'' },
    { id:'pub-02', date:'2026-04-13', type:'video',   title:'Demo: RAG sobre Alfresco en 5 minutos con LangChain',            category_id:'contenido',     status:'pending', notes:'' },
    { id:'pub-03', date:'2026-04-18', type:'post',    title:'OpenSearchCon 2026: 3 claves sobre el futuro de la búsqueda IA', category_id:'opensearchcon', status:'pending', notes:'' },
    { id:'pub-04', date:'2026-04-20', type:'post',    title:'5 errores al implementar búsqueda con IA en tu ECM',             category_id:'contenido',     status:'pending', notes:'' },
    { id:'pub-05', date:'2026-04-27', type:'video',   title:'Mi experiencia en AI Engineer Europe 2026',                     category_id:'contenido',     status:'pending', notes:'' },
    { id:'pub-06', date:'2026-05-04', type:'post',    title:'Ontologías + LLMs: estructurar conocimiento para RAG',          category_id:'contenido',     status:'pending', notes:'' },
    { id:'pub-07', date:'2026-05-11', type:'article', title:'Guía: Implementar RAG en Alfresco/Hyland paso a paso',          category_id:'contenido',     status:'pending', notes:'' },
    { id:'pub-08', date:'2026-05-18', type:'video',   title:'Data Innovation Summit: lo que aprendí sobre RAG en producción',category_id:'contenido',     status:'pending', notes:'' },
    { id:'pub-09', date:'2026-05-25', type:'post',    title:'BPM + IA Generativa: automatizar procesos con contexto documental', category_id:'contenido', status:'pending', notes:'' },
    { id:'pub-10', date:'2026-06-01', type:'video',   title:'De 0 a contributor en OpenRAG: mi camino en open source',      category_id:'contenido',     status:'pending', notes:'' },
    { id:'pub-11', date:'2026-06-08', type:'post',    title:'El futuro de Hyland/Alfresco con IA',                          category_id:'contenido',     status:'pending', notes:'' },
    { id:'pub-12', date:'2026-06-15', type:'article', title:'Arquitectura: ECM inteligente con RAG, ontologías y agentes',  category_id:'contenido',     status:'pending', notes:'' },
    { id:'pub-13', date:'2026-06-22', type:'video',   title:'AI Summit London: lecciones para ECM',                         category_id:'contenido',     status:'pending', notes:'' },
    { id:'pub-14', date:'2026-06-29', type:'post',    title:'Balance Q2: certificaciones, open source y lo que viene en H2',category_id:'contenido',     status:'pending', notes:'' },
  ];
  const insertPub = db.prepare('INSERT OR REPLACE INTO publications VALUES (@id,@date,@type,@title,@category_id,@status,@notes)');
  for (const p of publications) insertPub.run(p);

  // ── CERTIFICATIONS ───────────────────────────────────────────
  const certifications = [
    { id:'cert-neo4j-prof', title:'Neo4j Certified Professional',   target_date:'2026-04-21', category_id:'certificaciones', status:'not_started', notes:'' },
    { id:'cert-neo4j-gds',  title:'Neo4j Graph Data Science',       target_date:'2026-04-28', category_id:'certificaciones', status:'not_started', notes:'' },
    { id:'cert-ontotext',   title:'Ontotext GraphDB KG Engineer',   target_date:'2026-05-12', category_id:'certificaciones', status:'not_started', notes:'' },
    { id:'cert-nvidia',     title:'NVIDIA Agentic AI Professional', target_date:'2026-05-19', category_id:'certificaciones', status:'not_started', notes:'' },
    { id:'cert-ibm-rag',    title:'IBM RAG & Agentic AI',           target_date:'2026-06-03', category_id:'certificaciones', status:'not_started', notes:'' },
    { id:'cert-dlai-rag',   title:'DeepLearning.AI RAG',            target_date:'2026-06-17', category_id:'certificaciones', status:'not_started', notes:'' },
  ];
  const insertCert = db.prepare('INSERT OR REPLACE INTO certifications VALUES (@id,@title,@target_date,@category_id,@status,@notes)');
  for (const c of certifications) insertCert.run(c);

  // ── REPOS ────────────────────────────────────────────────────
  const repos = [
    { id:'repo-alfresco-rag-starter',   title:'alfresco-rag-starter',   target_date:'2026-04-15', category_id:'github', status:'not_started', notes:'' },
    { id:'repo-ecm-ontology-toolkit',   title:'ecm-ontology-toolkit',   target_date:'2026-04-30', category_id:'github', status:'not_started', notes:'' },
    { id:'repo-rag-benchmark-ecm',      title:'rag-benchmark-ecm',      target_date:'2026-05-13', category_id:'github', status:'not_started', notes:'' },
    { id:'repo-alfresco-ai-search',     title:'alfresco-ai-search',     target_date:'2026-05-27', category_id:'github', status:'not_started', notes:'' },
    { id:'repo-bpm-agent-orchestrator', title:'bpm-agent-orchestrator', target_date:'2026-06-09', category_id:'github', status:'not_started', notes:'' },
    { id:'repo-awesome-ecm-ai',         title:'awesome-ecm-ai',         target_date:'2026-06-23', category_id:'github', status:'not_started', notes:'' },
  ];
  const insertRepo = db.prepare('INSERT OR REPLACE INTO repos VALUES (@id,@title,@target_date,@category_id,@status,@notes)');
  for (const r of repos) insertRepo.run(r);

  // ── PRs ──────────────────────────────────────────────────────
  const prs = [
    { id:'pr-01', title:'Pipeline Langflow legal documents', start_date:'2026-03-30', end_date:'2026-04-05', category_id:'github', objective_id:'obj-oss', status:'not_started', notes:'' },
    { id:'pr-02', title:'Section-aware chunking',            start_date:'2026-04-06', end_date:'2026-04-16', category_id:'github', objective_id:'obj-oss', status:'not_started', notes:'' },
    { id:'pr-03', title:'Enrichment pipeline LLM → JSON',   start_date:'2026-04-17', end_date:'2026-04-30', category_id:'github', objective_id:'obj-oss', status:'not_started', notes:'' },
    { id:'pr-04', title:'Alfresco connector básico',         start_date:'2026-05-01', end_date:'2026-05-15', category_id:'github', objective_id:'obj-oss', status:'not_started', notes:'' },
    { id:'pr-05', title:'Alfresco metadata + versioning',    start_date:'2026-05-16', end_date:'2026-05-30', category_id:'github', objective_id:'obj-oss', status:'not_started', notes:'' },
    { id:'pr-06', title:'Debug / observabilidad pipeline RAG',start_date:'2026-06-01', end_date:'2026-06-10', category_id:'github', objective_id:'obj-oss', status:'not_started', notes:'' },
    { id:'pr-07', title:'Hybrid retrieval BM25 + vector tuning',start_date:'2026-06-11', end_date:'2026-06-25', category_id:'github', objective_id:'obj-oss', status:'not_started', notes:'' },
    { id:'pr-08', title:'Neo4j / GraphRAG integration',       start_date:'2026-06-26', end_date:'2026-07-15', category_id:'github', objective_id:'obj-oss', status:'not_started', notes:'' },
  ];
  const insertPR = db.prepare('INSERT OR REPLACE INTO prs VALUES (@id,@title,@start_date,@end_date,@category_id,@objective_id,@status,@notes)');
  for (const p of prs) insertPR.run(p);

  // ── WORK BLOCKS ──────────────────────────────────────────────
  const blocks = [
    { id:'block-1', name:'Trabajo profundo (PRs/código)', type:'codigo',     start_time:'09:00', end_time:'13:00', category_id:'github',          weekday:null },
    { id:'block-2', name:'Certificaciones',               type:'estudio',    start_time:'14:00', end_time:'16:00', category_id:'certificaciones',  weekday:null },
    { id:'block-3', name:'LinkedIn engagement',           type:'engagement', start_time:'16:00', end_time:'16:30', category_id:'linkedin',         weekday:null },
    { id:'block-4', name:'Repos / Web',                  type:'build',      start_time:'16:30', end_time:'18:30', category_id:'web',              weekday:null },
    { id:'block-5', name:'Admin',                        type:'admin',      start_time:'18:30', end_time:'19:00', category_id:'admin',            weekday:null },
    { id:'block-6', name:'Contenido',                    type:'content',    start_time:'20:00', end_time:'22:00', category_id:'contenido',        weekday:null },
  ];
  const insertBlock = db.prepare('INSERT OR REPLACE INTO work_blocks VALUES (@id,@name,@type,@start_time,@end_time,@category_id,@weekday)');
  for (const b of blocks) insertBlock.run(b);

  // ── TASKS ────────────────────────────────────────────────────
  // Build task list: explicit + derived
  const tasks = [];

  const t = (id, title, date, start_time, end_time, category_id, priority, objective_id, milestone_id, is_fixed, label, description) => ({
    id, title, description: description || '', category_id, subcategory: '',
    date, start_time, end_time,
    duration_estimated: start_time && end_time ? timeDiff(start_time, end_time) : 60,
    status: 'pending', priority: priority || 2,
    objective_id: objective_id || null,
    milestone_id: milestone_id || null,
    is_fixed: is_fixed ? 1 : 0,
    notes: '', label: label || '', percentage_completed: 0
  });

  function timeDiff(s, e) {
    const [sh, sm] = s.split(':').map(Number);
    const [eh, em] = e.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  }

  // ── ABRIL: Semana 1 (1–5 abr) — Setup LinkedIn ──────────────
  tasks.push(t('task-apr-01-linkedin-audit',   'Auditar perfil LinkedIn actual',          '2026-04-01','16:30','18:30','linkedin',    1,'obj-linkedin',null, true,  'setup'));
  tasks.push(t('task-apr-01-pr1-start',        'Iniciar PR1: Pipeline Langflow',           '2026-04-01','09:00','13:00','github',     1,'obj-oss',    null, true,  'PR1'));
  tasks.push(t('task-apr-02-headline',         'Actualizar headline LinkedIn',             '2026-04-02','16:30','18:30','linkedin',    1,'obj-linkedin',null, true,  'setup'));
  tasks.push(t('task-apr-02-pr1-cont',         'PR1 continuación',                         '2026-04-02','09:00','13:00','github',     2,'obj-oss',    null, false, 'PR1'));
  tasks.push(t('task-apr-03-banner',           'Actualizar foto y banner LinkedIn',        '2026-04-03','16:30','18:30','linkedin',    1,'obj-linkedin',null, true,  'setup'));
  tasks.push(t('task-apr-03-pr1-cont',         'PR1 continuación',                         '2026-04-03','09:00','13:00','github',     2,'obj-oss',    null, false, 'PR1'));
  tasks.push(t('task-apr-04-about',            'Redactar sección About LinkedIn',          '2026-04-04','16:30','18:30','linkedin',    1,'obj-linkedin',null, false, 'setup'));
  tasks.push(t('task-apr-04-pr1-cont',         'PR1 continuación',                         '2026-04-04','09:00','13:00','github',     2,'obj-oss',    null, false, 'PR1'));
  tasks.push(t('task-apr-05-featured',         'Configurar sección Featured LinkedIn',     '2026-04-05','16:30','18:30','linkedin',    2,'obj-linkedin',null, false, 'setup'));
  tasks.push(t('task-apr-05-pr1-finish',       'PR1 finalizar y enviar',                   '2026-04-05','09:00','13:00','github',     1,'obj-oss',    null, true,  'PR1'));

  // ── ABRIL: Semana 2 (6–12 abr) — Post1 + PR2 + AI Engineer ─
  tasks.push(t('task-apr-06-post1',            'Preparar y publicar Post #1 LinkedIn',     '2026-04-06','20:00','22:00','contenido',  1,'obj-linkedin',null, true,  'post','Por qué RAG es el futuro de la gestión documental empresarial'));
  tasks.push(t('task-apr-06-fork-openrag',     'Fork de OpenRAG en GitHub',                '2026-04-06','09:00','13:00','github',     1,'obj-oss',    null, true,  'setup'));
  tasks.push(t('task-apr-07-pr2-start',        'Iniciar PR2: Section-aware chunking',      '2026-04-07','09:00','13:00','github',     1,'obj-oss',    null, true,  'PR2'));
  tasks.push(t('task-apr-07-neo4j-study',      'Estudio Neo4j Certified Professional',     '2026-04-07','14:00','16:00','certificaciones',1,'obj-certs','milestone-neo4j-prof',false,'cert'));
  tasks.push(t('task-apr-08-ai-engineer',      'Asistir AI Engineer Europe (día 1)',        '2026-04-08','09:00','19:00','eventos',    1,'obj-eventos','milestone-aiengineer',true, 'evento'));
  tasks.push(t('task-apr-09-ai-engineer',      'Asistir AI Engineer Europe (día 2)',        '2026-04-09','09:00','19:00','eventos',    1,'obj-eventos','milestone-aiengineer',true, 'evento'));
  tasks.push(t('task-apr-10-ai-engineer',      'Asistir AI Engineer Europe (día 3)',        '2026-04-10','09:00','19:00','eventos',    1,'obj-eventos','milestone-aiengineer',true, 'evento'));
  tasks.push(t('task-apr-10-prep-post2',       'Preparar contenido Post #2 (Demo RAG)',    '2026-04-10','20:00','22:00','contenido',  2,'obj-linkedin',null, false, 'prep'));

  // ── ABRIL: Semana 3 (13–19 abr) — Post2 + OpenSearchCon ─────
  tasks.push(t('task-apr-13-post2',            'Publicar Post #2 (Demo RAG Alfresco)',     '2026-04-13','20:00','22:00','contenido',  1,'obj-linkedin',null, true,  'post','Demo: RAG sobre Alfresco en 5 minutos con LangChain'));
  tasks.push(t('task-apr-13-pr2-cont',         'PR2 continuación',                         '2026-04-13','09:00','13:00','github',     2,'obj-oss',    null, false, 'PR2'));
  tasks.push(t('task-apr-13-neo4j-study',      'Estudio Neo4j (semana 2)',                 '2026-04-13','14:00','16:00','certificaciones',2,'obj-certs','milestone-neo4j-prof',false,'cert'));
  tasks.push(t('task-apr-14-repo-alf-start',   'Iniciar alfresco-rag-starter repo',        '2026-04-14','16:30','18:30','github',     1,'obj-oss',    null, false, 'repo'));
  tasks.push(t('task-apr-14-neo4j-study',      'Estudio Neo4j (sesión 3)',                 '2026-04-14','14:00','16:00','certificaciones',2,'obj-certs','milestone-neo4j-prof',false,'cert'));
  tasks.push(t('task-apr-15-repo-alf-publish', 'Publicar alfresco-rag-starter en GitHub',  '2026-04-15','16:30','18:30','github',     1,'obj-oss',    null, true,  'repo'));
  tasks.push(t('task-apr-15-neo4j-study',      'Estudio Neo4j (sesión 4)',                 '2026-04-15','14:00','16:00','certificaciones',2,'obj-certs','milestone-neo4j-prof',false,'cert'));
  tasks.push(t('task-apr-16-opensearchcon-1',  'OpenSearchCon Europe — día 1',             '2026-04-16','09:00','19:00','opensearchcon',1,'obj-eventos','milestone-opensearchcon',true,'evento'));
  tasks.push(t('task-apr-17-opensearchcon-2',  'OpenSearchCon Europe — día 2',             '2026-04-17','09:00','19:00','opensearchcon',1,'obj-eventos','milestone-opensearchcon',true,'evento'));
  tasks.push(t('task-apr-18-post3-bonus',      'Publicar Post Bonus OpenSearchCon',        '2026-04-18','20:00','22:00','opensearchcon',1,'obj-linkedin',null, true,'post','OpenSearchCon 2026: 3 claves sobre el futuro de la búsqueda con IA'));
  tasks.push(t('task-apr-18-pr3-start',        'Iniciar PR3: Enrichment pipeline',         '2026-04-18','09:00','13:00','github',     1,'obj-oss',    null, true,  'PR3'));

  // ── ABRIL: Semana 4 (20–26 abr) — Post3 + Neo4j cert ────────
  tasks.push(t('task-apr-20-post4',            'Publicar Post #3 (5 errores IA búsqueda)', '2026-04-20','20:00','22:00','contenido',  1,'obj-linkedin',null, true, 'post','5 errores al implementar búsqueda con IA en tu ECM'));
  tasks.push(t('task-apr-20-neo4j-prep',       'Repasar temario Neo4j Prof (repaso final)','2026-04-20','14:00','16:00','certificaciones',1,'obj-certs','milestone-neo4j-prof',false,'cert'));
  tasks.push(t('task-apr-21-neo4j-exam',       'EXAMEN: Neo4j Certified Professional',     '2026-04-21','14:00','16:00','certificaciones',1,'obj-certs','milestone-neo4j-prof',true, 'exam'));
  tasks.push(t('task-apr-21-pr3-cont',         'PR3 continuación',                         '2026-04-21','09:00','13:00','github',     2,'obj-oss',    null, false, 'PR3'));
  tasks.push(t('task-apr-22-neo4j-gds-start',  'Iniciar estudio Neo4j GDS',                '2026-04-22','14:00','16:00','certificaciones',1,'obj-certs','milestone-neo4j-gds', false,'cert'));
  tasks.push(t('task-apr-22-linkedin-engage',  'LinkedIn: comentar y conectar',            '2026-04-22','16:00','16:30','linkedin',    2,'obj-linkedin',null, false,'engagement'));
  tasks.push(t('task-apr-23-neo4j-gds-study',  'Estudio Neo4j GDS (sesión 2)',             '2026-04-23','14:00','16:00','certificaciones',2,'obj-certs','milestone-neo4j-gds', false,'cert'));
  tasks.push(t('task-apr-24-ecm-ontology',     'Publicar ecm-ontology-toolkit',            '2026-04-24','16:30','18:30','github',     1,'obj-oss',    null, false, 'repo'));
  tasks.push(t('task-apr-27-post5',            'Publicar Post #4 (AI Engineer video)',     '2026-04-27','20:00','22:00','contenido',  1,'obj-linkedin',null, true, 'post','Mi experiencia en AI Engineer Europe 2026'));
  tasks.push(t('task-apr-28-neo4j-gds-exam',   'EXAMEN: Neo4j Graph Data Science',        '2026-04-28','14:00','16:00','certificaciones',1,'obj-certs','milestone-neo4j-gds', true, 'exam'));
  tasks.push(t('task-apr-28-pr3-finish',       'PR3 finalizar y enviar',                   '2026-04-28','09:00','13:00','github',     1,'obj-oss',    null, false, 'PR3'));
  tasks.push(t('task-apr-30-ecm-ontology-pub', 'Publicar ecm-ontology-toolkit en GitHub',  '2026-04-30','16:30','18:30','github',     1,'obj-oss',    null, true,  'repo'));

  // ── MAYO: Semana 1 (1–8 may) — PR4 + Data Innovation ────────
  tasks.push(t('task-may-01-pr4-start',        'Iniciar PR4: Alfresco connector básico',   '2026-05-01','09:00','13:00','github',     1,'obj-oss',    null, true,  'PR4'));
  tasks.push(t('task-may-01-ontotext-start',   'Iniciar estudio Ontotext GraphDB',         '2026-05-01','14:00','16:00','certificaciones',1,'obj-certs','milestone-ontotext',false,'cert'));
  tasks.push(t('task-may-04-post6',            'Publicar Post #5 (Ontologías+LLMs)',       '2026-05-04','20:00','22:00','contenido',  1,'obj-linkedin',null, true, 'post','Ontologías + LLMs: estructurar conocimiento para RAG'));
  tasks.push(t('task-may-04-web-design-start', 'Iniciar diseño nueva web Sangalan',        '2026-05-04','16:30','18:30','web',        1,'obj-web',    null, false, 'web'));
  tasks.push(t('task-may-05-ontotext-study',   'Estudio Ontotext (sesión 2)',              '2026-05-05','14:00','16:00','certificaciones',2,'obj-certs','milestone-ontotext',false,'cert'));
  tasks.push(t('task-may-06-data-innovation',  'Data Innovation Summit (día 1)',           '2026-05-06','09:00','19:00','eventos',    1,'obj-eventos','milestone-datainnovation',true,'evento'));
  tasks.push(t('task-may-07-data-innovation',  'Data Innovation Summit (día 2)',           '2026-05-07','09:00','19:00','eventos',    1,'obj-eventos','milestone-datainnovation',true,'evento'));
  tasks.push(t('task-may-08-data-innovation',  'Data Innovation Summit (día 3)',           '2026-05-08','09:00','19:00','eventos',    1,'obj-eventos','milestone-datainnovation',true,'evento'));

  // ── MAYO: Semana 2 (11–17 may) — Post6 + Ontotext cert + Repo
  tasks.push(t('task-may-11-post7',            'Publicar Post #6 (Guía RAG Alfresco)',     '2026-05-11','20:00','22:00','contenido',  1,'obj-linkedin',null, true, 'post','Guía: Implementar RAG en Alfresco/Hyland paso a paso'));
  tasks.push(t('task-may-11-ontotext-prep',    'Repasar Ontotext (repaso final)',          '2026-05-11','14:00','16:00','certificaciones',1,'obj-certs','milestone-ontotext',false,'cert'));
  tasks.push(t('task-may-12-ontotext-exam',    'EXAMEN: Ontotext GraphDB KG Engineer',    '2026-05-12','14:00','16:00','certificaciones',1,'obj-certs','milestone-ontotext',true, 'exam'));
  tasks.push(t('task-may-13-rag-benchmark',    'Publicar rag-benchmark-ecm',              '2026-05-13','16:30','18:30','github',     1,'obj-oss',    null, true,  'repo'));
  tasks.push(t('task-may-14-nvidia-start',     'Iniciar estudio NVIDIA Agentic AI',       '2026-05-14','14:00','16:00','certificaciones',1,'obj-certs','milestone-nvidia',   false,'cert'));
  tasks.push(t('task-may-14-pr4-finish',       'PR4 finalizar y enviar',                  '2026-05-14','09:00','13:00','github',     1,'obj-oss',    null, true,  'PR4'));

  // ── MAYO: Semana 3 (18–24 may) — Post7 + NVIDIA + Cybersec ──
  tasks.push(t('task-may-18-post8',            'Publicar Post #7 (Data Summit video)',     '2026-05-18','20:00','22:00','contenido',  1,'obj-linkedin',null, true, 'post','Data Innovation Summit: lo que aprendí sobre RAG en producción'));
  tasks.push(t('task-may-18-nvidia-study',     'Estudio NVIDIA Agentic AI (sesión 2)',    '2026-05-18','14:00','16:00','certificaciones',2,'obj-certs','milestone-nvidia',   false,'cert'));
  tasks.push(t('task-may-19-nvidia-exam',      'EXAMEN: NVIDIA Agentic AI Professional',  '2026-05-19','14:00','16:00','certificaciones',1,'obj-certs','milestone-nvidia',   true, 'exam'));
  tasks.push(t('task-may-19-pr5-start',        'Iniciar PR5: Alfresco metadata+versioning','2026-05-19','09:00','13:00','github',    1,'obj-oss',    null, true,  'PR5'));
  tasks.push(t('task-may-20-cybersec',         'Cybersec Europe (día 1)',                 '2026-05-20','09:00','19:00','eventos',    2,'obj-eventos',null, true,  'evento'));
  tasks.push(t('task-may-21-cybersec',         'Cybersec Europe (día 2)',                 '2026-05-21','09:00','19:00','eventos',    2,'obj-eventos',null, true,  'evento'));
  tasks.push(t('task-may-22-web-wireframes',   'Wireframes y contenido web',              '2026-05-22','16:30','18:30','web',        1,'obj-web',    null, false, 'web'));

  // ── MAYO: Semana 4 (25–31 may) — Post8 + Repos + CommunityLIVE
  tasks.push(t('task-may-25-post9',            'Publicar Post #8 (BPM + IA Gen)',         '2026-05-25','20:00','22:00','contenido',  1,'obj-linkedin',null, true, 'post','BPM + IA Generativa: automatizar procesos con contexto documental'));
  tasks.push(t('task-may-27-alfresco-search',  'Publicar alfresco-ai-search',             '2026-05-27','16:30','18:30','github',     1,'obj-oss',    null, true,  'repo'));
  tasks.push(t('task-may-30-community-live',   'Hyland CommunityLIVE (día 1)',            '2026-05-30','09:00','19:00','eventos',    2,'obj-eventos',null, true,  'evento'));
  tasks.push(t('task-may-30-pr5-finish',       'PR5 finalizar y enviar',                  '2026-05-30','09:00','13:00','github',     1,'obj-oss',    null, true,  'PR5'));
  tasks.push(t('task-may-31-community-live',   'Hyland CommunityLIVE (día 2)',            '2026-05-31','09:00','19:00','eventos',    2,'obj-eventos',null, true,  'evento'));
  tasks.push(t('task-may-31-ibm-rag-start',    'Iniciar estudio IBM RAG & Agentic AI',   '2026-05-31','14:00','16:00','certificaciones',1,'obj-certs','milestone-ibm-rag',  false,'cert'));

  // ── JUNIO: Semana 1 (1–7 jun) — Post9 + IBM RAG + PR6 ───────
  tasks.push(t('task-jun-01-post10',           'Publicar Post #9 (Open Source video)',    '2026-06-01','20:00','22:00','contenido',  1,'obj-linkedin',null, true, 'post','De 0 a contributor en OpenRAG: mi camino en open source'));
  tasks.push(t('task-jun-01-community-live',   'Hyland CommunityLIVE (día 3)',            '2026-06-01','09:00','19:00','eventos',    2,'obj-eventos',null, true,  'evento'));
  tasks.push(t('task-jun-01-pr6-start',        'Iniciar PR6: Debug/observabilidad RAG',   '2026-06-01','09:00','13:00','github',     1,'obj-oss',    null, true,  'PR6'));
  tasks.push(t('task-jun-02-community-live',   'Hyland CommunityLIVE (día 4)',            '2026-06-02','09:00','19:00','eventos',    2,'obj-eventos',null, true,  'evento'));
  tasks.push(t('task-jun-03-ibm-rag-exam',     'EXAMEN: IBM RAG & Agentic AI',           '2026-06-03','14:00','16:00','certificaciones',1,'obj-certs','milestone-ibm-rag',  true, 'exam'));
  tasks.push(t('task-jun-04-web-dev-start',    'Iniciar desarrollo web Sangalan',         '2026-06-04','16:30','18:30','web',        1,'obj-web',    'milestone-web-live',false,'web'));
  tasks.push(t('task-jun-05-linkedin-review',  'Review semanal LinkedIn + métricas',      '2026-06-05','18:30','19:00','admin',      2,'obj-linkedin',null, false,'admin'));

  // ── JUNIO: Semana 2 (8–14 jun) — Post10 + AI Summit + PR7 ──
  tasks.push(t('task-jun-08-post11',           'Publicar Post #10 (Hyland+IA)',           '2026-06-08','20:00','22:00','contenido',  1,'obj-linkedin',null, true, 'post','El futuro de Hyland/Alfresco con IA'));
  tasks.push(t('task-jun-08-bpm-repo',         'Publicar bpm-agent-orchestrator',         '2026-06-09','16:30','18:30','github',     1,'obj-oss',    null, true,  'repo'));
  tasks.push(t('task-jun-09-pr6-finish',       'PR6 finalizar y enviar',                  '2026-06-09','09:00','13:00','github',     1,'obj-oss',    null, true,  'PR6'));
  tasks.push(t('task-jun-10-ai-summit-1',      'AI Summit London (día 1)',                '2026-06-10','09:00','19:00','eventos',    1,'obj-eventos','milestone-aisummit',true,'evento'));
  tasks.push(t('task-jun-11-ai-summit-2',      'AI Summit London (día 2)',                '2026-06-11','09:00','19:00','eventos',    1,'obj-eventos','milestone-aisummit',true,'evento'));
  tasks.push(t('task-jun-11-pr7-start',        'Iniciar PR7: Hybrid retrieval tuning',    '2026-06-11','09:00','13:00','github',     1,'obj-oss',    null, true,  'PR7'));
  tasks.push(t('task-jun-12-dlai-rag-start',   'Iniciar estudio DeepLearning.AI RAG',     '2026-06-12','14:00','16:00','certificaciones',1,'obj-certs','milestone-dlai-rag', false,'cert'));
  tasks.push(t('task-jun-13-web-dev',          'Desarrollo web (componentes)',             '2026-06-13','16:30','18:30','web',        1,'obj-web',    'milestone-web-live',false,'web'));

  // ── JUNIO: Semana 3 (15–21 jun) — Post11 + Web go-live + DLAI
  tasks.push(t('task-jun-15-post12',           'Publicar Post #11 (Arquitectura ECM)',    '2026-06-15','20:00','22:00','contenido',  1,'obj-linkedin',null, true, 'post','Arquitectura: ECM inteligente con RAG, ontologías y agentes'));
  tasks.push(t('task-jun-15-web-final',        'Web Sangalan: revisión final pre-launch', '2026-06-15','16:30','18:30','web',        1,'obj-web',    'milestone-web-live',true, 'web'));
  tasks.push(t('task-jun-16-web-golive',       'GO-LIVE: Publicar nueva web sangalan.com','2026-06-16','16:30','18:30','web',        1,'obj-web',    'milestone-web-live',true, 'exam'));
  tasks.push(t('task-jun-17-dlai-rag-exam',    'EXAMEN: DeepLearning.AI RAG',             '2026-06-17','14:00','16:00','certificaciones',1,'obj-certs','milestone-dlai-rag', true, 'exam'));
  tasks.push(t('task-jun-18-linkedin-review',  'Review métricas LinkedIn semana',         '2026-06-18','18:30','19:00','admin',      2,'obj-linkedin',null, false,'admin'));

  // ── JUNIO: Semana 4 (22–30 jun) — Post12 + PR8 + Cierre Q2 ─
  tasks.push(t('task-jun-22-post13',           'Publicar Post #12 (AI Summit video)',     '2026-06-22','20:00','22:00','contenido',  1,'obj-linkedin',null, true, 'post','AI Summit London: lecciones para ECM'));
  tasks.push(t('task-jun-23-awesome-ecm',      'Publicar awesome-ecm-ai',                 '2026-06-23','16:30','18:30','github',     1,'obj-oss',    null, true,  'repo'));
  tasks.push(t('task-jun-25-pr7-finish',       'PR7 finalizar y enviar',                  '2026-06-25','09:00','13:00','github',     1,'obj-oss',    null, true,  'PR7'));
  tasks.push(t('task-jun-25-review-q2',        'Review Q2 completo',                      '2026-06-25','18:30','19:00','admin',      1,null,         null, true,  'admin'));
  tasks.push(t('task-jun-26-pr8-start',        'Iniciar PR8: Neo4j/GraphRAG integration', '2026-06-26','09:00','13:00','github',     1,'obj-oss',    null, true,  'PR8'));
  tasks.push(t('task-jun-29-post14',           'Publicar Post #13 (Balance Q2)',          '2026-06-29','20:00','22:00','contenido',  1,'obj-linkedin','milestone-q2-end',true,'post','Balance Q2: certificaciones, open source y lo que viene en H2'));
  tasks.push(t('task-jun-30-gitex',            'GITEX AI Europe',                         '2026-06-30','09:00','19:00','eventos',    2,'obj-eventos',null, true,  'evento'));
  tasks.push(t('task-jun-30-q2-close',         'Cierre oficial Q2 — métricas finales',    '2026-06-30','18:30','19:00','admin',      1,'obj-linkedin','milestone-q2-end',true,'admin'));

  const insertTask = db.prepare(`INSERT OR REPLACE INTO tasks
    (id,title,description,category_id,subcategory,date,start_time,end_time,duration_estimated,status,priority,objective_id,milestone_id,is_fixed,notes,label,percentage_completed)
    VALUES (@id,@title,@description,@category_id,@subcategory,@date,@start_time,@end_time,@duration_estimated,@status,@priority,@objective_id,@milestone_id,@is_fixed,@notes,@label,@percentage_completed)`);

  const insertAll = db.transaction((rows) => { for (const row of rows) insertTask.run(row); });
  insertAll(tasks);

  console.log(`✅ Seed completado: ${tasks.length} tareas, ${events.length} eventos, ${certifications.length} certificaciones, ${repos.length} repos, ${prs.length} PRs`);
}

seed();
