import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';
import cors from 'cors';
import multer from 'multer';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const port = Number(process.env.PORT || 8787);
const serverDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(serverDir, 'data');
const dbFile = path.join(dataDir, 'molenaar.db');

fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(dbFile);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    number TEXT NOT NULL,
    location TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    surname TEXT NOT NULL,
    employee_number TEXT NOT NULL,
    qualification TEXT NOT NULL,
    project_id TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS member_documents (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    file_blob BLOB NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
  );
`);

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, mode: 'shared-database', timestamp: new Date().toISOString() });
});

app.get('/projects', (_req, res) => {
  const rows = db.prepare('SELECT id, name, number, location, created_at as createdAt FROM projects ORDER BY created_at DESC').all();
  res.json(rows);
});

app.post('/projects', (req, res) => {
  const { id, name, number, location, createdAt } = req.body ?? {};
  if (!name || !number || !location) {
    res.status(400).json({ error: 'name, number, and location are required' });
    return;
  }

  const project = {
    id: id || crypto.randomUUID(),
    name: String(name).trim(),
    number: String(number).trim(),
    location: String(location).trim(),
    createdAt: createdAt || new Date().toISOString()
  };

  db.prepare(
    'INSERT INTO projects (id, name, number, location, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(project.id, project.name, project.number, project.location, project.createdAt);

  res.status(201).json(project);
});

app.delete('/projects/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('UPDATE members SET project_id = NULL WHERE project_id = ?').run(id);
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  res.status(204).end();
});

app.delete('/projects', (_req, res) => {
  db.prepare('DELETE FROM projects').run();
  db.prepare('UPDATE members SET project_id = NULL').run();
  res.status(204).end();
});

app.get('/members', (_req, res) => {
  const memberRows = db
    .prepare(
      `
        SELECT id, name, surname, employee_number as employeeNumber,
               qualification, project_id as projectId, created_at as createdAt
        FROM members
        ORDER BY created_at DESC
      `
    )
    .all();

  const docRows = db
    .prepare(
      `
        SELECT id, member_id as memberId, name, mime_type as type, size
        FROM member_documents
        ORDER BY created_at DESC
      `
    )
    .all();

  const docsByMember = new Map();
  docRows.forEach((doc) => {
    if (!docsByMember.has(doc.memberId)) {
      docsByMember.set(doc.memberId, []);
    }
    docsByMember.get(doc.memberId).push({
      id: doc.id,
      name: doc.name,
      type: doc.type,
      size: doc.size
    });
  });

  const members = memberRows.map((member) => ({
    ...member,
    documents: docsByMember.get(member.id) || []
  }));

  res.json(members);
});

app.post('/members', upload.array('documents'), (req, res) => {
  const { id, name, surname, employeeNumber, qualification, projectId, createdAt } = req.body ?? {};

  if (!name || !surname || !employeeNumber || !qualification) {
    res.status(400).json({ error: 'name, surname, employeeNumber and qualification are required' });
    return;
  }

  const member = {
    id: id || crypto.randomUUID(),
    name: String(name).trim(),
    surname: String(surname).trim(),
    employeeNumber: String(employeeNumber).trim(),
    qualification: String(qualification).trim(),
    projectId: projectId || null,
    createdAt: createdAt || new Date().toISOString()
  };

  const transaction = db.transaction(() => {
    db.prepare(
      `
        INSERT INTO members (
          id, name, surname, employee_number, qualification, project_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      member.id,
      member.name,
      member.surname,
      member.employeeNumber,
      member.qualification,
      member.projectId,
      member.createdAt
    );

    const files = req.files || [];
    files.forEach((file) => {
      const isPdfType = (file.mimetype || '').toLowerCase() === 'application/pdf';
      const isPdfName = (file.originalname || '').toLowerCase().endsWith('.pdf');
      if (!isPdfType && !isPdfName) {
        throw new Error(`Only PDF files are supported: ${file.originalname}`);
      }

      db.prepare(
        `
          INSERT INTO member_documents (
            id, member_id, name, mime_type, size, file_blob, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      ).run(
        crypto.randomUUID(),
        member.id,
        file.originalname,
        file.mimetype || 'application/pdf',
        file.size,
        file.buffer,
        new Date().toISOString()
      );
    });
  });

  try {
    transaction();
  } catch (error) {
    res.status(400).json({ error: error.message || 'Could not save member' });
    return;
  }

  const documents = db
    .prepare(
      `
        SELECT id, name, mime_type as type, size
        FROM member_documents
        WHERE member_id = ?
        ORDER BY created_at DESC
      `
    )
    .all(member.id);

  res.status(201).json({ ...member, documents });
});

app.delete('/members/:id', (req, res) => {
  db.prepare('DELETE FROM member_documents WHERE member_id = ?').run(req.params.id);
  db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

app.delete('/members', (_req, res) => {
  db.prepare('DELETE FROM member_documents').run();
  db.prepare('DELETE FROM members').run();
  res.status(204).end();
});

app.get('/members/:memberId/documents/:documentId', (req, res) => {
  const { memberId, documentId } = req.params;
  const doc = db
    .prepare(
      `
        SELECT id, name, mime_type as type, size, file_blob as blob
        FROM member_documents
        WHERE id = ? AND member_id = ?
        LIMIT 1
      `
    )
    .get(documentId, memberId);

  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  res.setHeader('Content-Type', doc.type || 'application/pdf');
  res.setHeader('Content-Length', String(doc.size));
  res.setHeader('Content-Disposition', `attachment; filename="${doc.name.replace(/"/g, '')}"`);
  res.send(doc.blob);
});

app.listen(port, () => {
  console.log(`Molenaar backend running on http://localhost:${port}`);
});