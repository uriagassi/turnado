import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { createDb } from "../server/src/db.js";
import { Doctors } from "../server/src/doctors/Doctors.js";
import { Appointments } from "../server/src/appointments/Appointments.js";
import { Tasks } from "../server/src/tasks/Tasks.js";

const dbPath = path.resolve("./server/data/dev.sqlite");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = createDb(dbPath, 5000);
const doctors = new Doctors(db, "רופא");
const appointments = new Appointments(db);
const tasks = new Tasks(db);

// Clear old data
db.exec(`
  DELETE FROM Tasks;
  DELETE FROM Appointments;
  DELETE FROM Doctors;
`);

// Insert Doctors
const drCohen = doctors.create({
  name: "ד\"ר כהן",
  specialty: "נוירולוגיה",
  clinic: "מרפאת אסותא ת\"א",
  phone: "03-7645000",
  address: "הברזל 20, תל אביב",
  email: "cohen.neuro@assuta.co.il",
  notes: "זמין בעיקר בימי שלישי ורביעי בבוקר",
});

const drLevi = doctors.create({
  name: "ד\"ר לוי",
  specialty: "רפואת עיניים",
  clinic: "מרכז רפואי רבין",
  phone: "03-9377377",
  address: "ז'בוטינסקי 39, פתח תקווה",
  notes: "מעקב קרקעית עין שנתי",
});

const drGolan = doctors.create({
  name: "ד\"ר גולן",
  specialty: "רפואה פנימית",
  clinic: "מכבי השלום",
  phone: "03-5100000",
  address: "יגאל אלון 96, תל אביב",
  notes: "רופא משפחה / פנימאי מרכז",
});

// Insert Next Appointment (Tomorrow 10:00 AM)
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow.setHours(10, 0, 0, 0);

const appt1 = appointments.create({
  doctorId: drCohen.id,
  dateTime: tomorrow.toISOString(),
  location: "מרפאת אסותא ת\"א",
  notes: "ביקורת נוירולוגית תקופתית",
});

// Past appointment
const lastMonth = new Date();
lastMonth.setDate(lastMonth.getDate() - 30);
lastMonth.setHours(11, 30, 0, 0);

const pastAppt = appointments.create({
  doctorId: drGolan.id,
  dateTime: lastMonth.toISOString(),
  location: "מכבי השלום",
  notes: "בדיקות תקופתיות וייעוץ",
});
appointments.setStatus(pastAppt.id, "done");
appointments.setSummary(pastAppt.id, "בדיקה גופנית תקינה. הומלץ מעקב לחץ דם ובדיקות דם שנתיות.");

// Insert Tasks (Open Items)
tasks.create({
  type: "form_17",
  title: "טופס 17 להשיג — נוירולוגיה",
  status: "in-progress",
  dueDate: tomorrow.toISOString().slice(0, 10),
  doctorId: drCohen.id,
  pendingAppointmentId: appt1.id,
  institution: "אסותא תל אביב",
  department: "נוירולוגיה",
  healthFund: "מכבי",
  codeNumber: "L0123",
  codeName: "ייעוץ רופא מומחה",
});

tasks.create({
  type: "test",
  title: "בדיקת דם (ספירה וביוכימיה)",
  status: "open",
  doctorId: drLevi.id,
  approximateDateWindow: "סוף אוגוסט",
  recurrenceWindow: "1-2 שבועות",
  requiresAdvanceScheduling: false,
});

tasks.create({
  type: "general_approval",
  title: "אישור ביטוח נסיעות לחו\"ל",
  status: "open",
  dueDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
  issuingBody: "הראל ביטוח",
  purpose: "כיסוי הרחבה למצב רפואי קיים",
});

tasks.create({
  type: "doctor_visit",
  title: "לתאם ביקור מעקב עם ד\"ר גולן",
  status: "open",
  doctorId: drGolan.id,
});

tasks.create({
  type: "test",
  title: "בדיקת ממוגרפיה שנתית",
  status: "open",
  recurrenceWindow: "11 חודשים",
  requiresAdvanceScheduling: true,
});

console.log("Demo seed data created successfully!");
db.close();
