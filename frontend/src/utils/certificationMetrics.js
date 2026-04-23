function toMinutes(task) {
  const est = Number(task?.duration_estimated);
  if (Number.isFinite(est) && est > 0) return est;
  if (!task?.start_time || !task?.end_time) return 0;
  const [sh, sm] = String(task.start_time).split(':').map(Number);
  const [eh, em] = String(task.end_time).split(':').map(Number);
  if (![sh, sm, eh, em].every(Number.isFinite)) return 0;
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  return Math.max(0, end - start);
}

function dayDiff(fromISO, toISO) {
  if (!fromISO || !toISO) return null;
  const from = new Date(`${fromISO}T12:00:00`);
  const to = new Date(`${toISO}T12:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.max(0, Math.round((to - from) / 86400000));
}

function isExamTask(task) {
  return /^EXAMEN:/i.test(task?.title || '');
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function formatHours(hours) {
  if (!Number.isFinite(hours)) return null;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

export function buildCertificationStatsMap(certs = [], tasks = []) {
  const byCertId = {};
  for (const cert of certs) {
    const certTasks = tasks
      .filter(t => t?.milestone_id === cert.id && t?.date)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (certTasks.length === 0) {
      byCertId[cert.id] = { studyHours: null, daysToExam: null };
      continue;
    }

    const firstTaskDate = certTasks[0].date;
    const lastTaskDate = certTasks[certTasks.length - 1].date;
    const examTaskDates = certTasks.filter(isExamTask).map(t => t.date).sort((a, b) => a.localeCompare(b));
    const examDate = examTaskDates.length > 0 ? examTaskDates[examTaskDates.length - 1] : (cert.target_date || lastTaskDate);
    const studyMinutes = certTasks.filter(t => !isExamTask(t)).reduce((sum, t) => sum + toMinutes(t), 0);

    byCertId[cert.id] = {
      studyHours: round1(studyMinutes / 60),
      daysToExam: dayDiff(firstTaskDate, examDate),
    };
  }
  return byCertId;
}

export function formatCertificationStats(stats) {
  if (!stats) return '';
  const parts = [];
  if (stats.studyHours != null) parts.push(`${formatHours(stats.studyHours)}h estudio`);
  if (stats.daysToExam != null) parts.push(`${stats.daysToExam}d`);
  return parts.join(' · ');
}

