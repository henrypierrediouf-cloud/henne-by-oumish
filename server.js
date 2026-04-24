const express    = require('express');
const cors       = require('cors');
const nodemailer = require('nodemailer');
const { Pool }   = require('pg');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── PostgreSQL ────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reservations (
      id          BIGINT PRIMARY KEY,
      created_at  TIMESTAMPTZ NOT NULL,
      prenom      TEXT NOT NULL,
      nom         TEXT NOT NULL,
      email       TEXT NOT NULL,
      tel         TEXT,
      prestation  TEXT NOT NULL,
      date        TEXT NOT NULL,
      nb          TEXT,
      ville       TEXT,
      styles      TEXT,
      message     TEXT NOT NULL,
      statut      TEXT NOT NULL DEFAULT 'En attente'
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS avis (
      id          BIGINT PRIMARY KEY,
      created_at  TIMESTAMPTZ NOT NULL,
      prenom      TEXT NOT NULL,
      prestation  TEXT,
      note        INTEGER NOT NULL DEFAULT 5,
      commentaire TEXT NOT NULL,
      statut      TEXT NOT NULL DEFAULT 'En attente'
    )
  `);
}

// ── Middlewares ───────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ── Config email ──────────────────────────────────────────
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_DEST = process.env.EMAIL_DEST || 'oumydioufdiakhate1@gmail.com';
const ADMIN_KEY  = process.env.ADMIN_KEY;

if (!ADMIN_KEY) {
  console.error('❌ Variable d\'environnement ADMIN_KEY manquante. Arrêt du serveur.');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
});

// ── Helpers ───────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function labelPrestation(val) {
  const map = {
    mariage:  '💍 Henné Mariage',
    evjf:     '🥂 Henné Soirée / EVJF',
    domicile: '🏠 Henné à domicile (déplacement chez le client)',
    artiste:  '🏡 Henné chez l\'artiste (Zone B Ballon, villa 109, Dakar)',
    stand:    '🎪 Stand Événement',
    autre:    '✨ Autre / Sur mesure',
  };
  return map[val] || val;
}

function rowToObj(r) {
  return {
    id:         Number(r.id),
    createdAt:  r.created_at,
    prenom:     r.prenom,
    nom:        r.nom,
    email:      r.email,
    tel:        r.tel,
    prestation: r.prestation,
    date:       r.date,
    nb:         r.nb,
    ville:      r.ville,
    styles:     r.styles,
    message:    r.message,
    statut:     r.statut,
  };
}

// ── POST /api/reservation ─────────────────────────────────
app.post('/api/reservation', async (req, res) => {
  const { prenom, nom, email, tel, prestation, date, nb, ville, styles, message } = req.body;

  if (!prenom || !nom || !email || !prestation || !date || !message) {
    return res.status(400).json({ success: false, error: 'Champs obligatoires manquants.' });
  }

  const id         = Date.now();
  const createdAt  = new Date().toISOString();
  const stylesStr  = Array.isArray(styles) ? styles.join(', ') : (styles || '—');

  await pool.query(
    `INSERT INTO reservations
       (id, created_at, prenom, nom, email, tel, prestation, date, nb, ville, styles, message, statut)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'En attente')`,
    [
      id, createdAt,
      prenom.trim(), nom.trim(), email.trim().toLowerCase(),
      tel?.trim() || '—', labelPrestation(prestation),
      date, nb || '—', ville?.trim() || '—',
      stylesStr, message.trim(),
    ]
  );

  const reservation = {
    id, createdAt,
    prenom: prenom.trim(), nom: nom.trim(),
    email: email.trim().toLowerCase(),
    prestation: labelPrestation(prestation),
    date, nb: nb || '—', ville: ville?.trim() || '—',
    styles: stylesStr, message: message.trim(), statut: 'En attente',
  };

  console.log(`\n✅ Nouvelle réservation #${id}`);
  console.log(`   ${reservation.prenom} ${reservation.nom} — ${reservation.prestation} — ${formatDate(date)}`);

  const mailArtiste = {
    from:    `"Henné by Oumoul Khalifa — Réservations" <${EMAIL_USER}>`,
    to:      EMAIL_DEST,
    subject: `🌿 Nouvelle réservation — ${reservation.prenom} ${reservation.nom} (${formatDate(date)})`,
    html: `
      <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;background:#FAF5EC;border-radius:12px;overflow:hidden;">
        <div style="background:#6B1A2A;padding:32px 40px;text-align:center;">
          <h1 style="color:#E8C97A;font-size:1.6rem;margin:0;font-weight:300;letter-spacing:.05em;">
            Henné <span style="color:#fff;">by Oumoul Khalifa</span>
          </h1>
          <p style="color:rgba(255,255,255,.7);margin:8px 0 0;font-size:.9rem;">Nouvelle demande de réservation</p>
        </div>
        <div style="padding:36px 40px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,.2);font-size:.85rem;color:#5C3A2A;width:38%;font-weight:600;">Nom</td><td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,.2);font-size:.9rem;color:#2C1810;">${reservation.prenom} ${reservation.nom}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,.2);font-size:.85rem;color:#5C3A2A;font-weight:600;">Email</td><td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,.2);font-size:.9rem;color:#2C1810;"><a href="mailto:${reservation.email}" style="color:#6B1A2A;">${reservation.email}</a></td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,.2);font-size:.85rem;color:#5C3A2A;font-weight:600;">Téléphone</td><td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,.2);font-size:.9rem;color:#2C1810;">${reservation.tel}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,.2);font-size:.85rem;color:#5C3A2A;font-weight:600;">Prestation</td><td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,.2);font-size:.9rem;color:#2C1810;">${reservation.prestation}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,.2);font-size:.85rem;color:#5C3A2A;font-weight:600;">Date souhaitée</td><td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,.2);font-size:.9rem;color:#2C1810;">${formatDate(date)}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,.2);font-size:.85rem;color:#5C3A2A;font-weight:600;">Nombre de personnes</td><td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,.2);font-size:.9rem;color:#2C1810;">${reservation.nb}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,.2);font-size:.85rem;color:#5C3A2A;font-weight:600;">Ville / Lieu</td><td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,.2);font-size:.9rem;color:#2C1810;">${reservation.ville}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,.2);font-size:.85rem;color:#5C3A2A;font-weight:600;">Styles souhaités</td><td style="padding:10px 0;border-bottom:1px solid rgba(201,168,76,.2);font-size:.9rem;color:#2C1810;">${reservation.styles}</td></tr>
          </table>
          <div style="margin-top:24px;background:#fff;border-left:4px solid #C9A84C;padding:18px 20px;border-radius:0 8px 8px 0;">
            <p style="font-size:.8rem;color:#5C3A2A;font-weight:600;margin:0 0 8px;text-transform:uppercase;letter-spacing:.1em;">Message</p>
            <p style="font-size:.92rem;color:#2C1810;line-height:1.7;margin:0;">${reservation.message.replace(/\n/g, '<br>')}</p>
          </div>
          <div style="margin-top:28px;text-align:center;">
            <a href="mailto:${reservation.email}?subject=Réponse à votre demande de réservation — Henné by Oumoul Khalifa"
               style="display:inline-block;background:#6B1A2A;color:#fff;padding:13px 28px;border-radius:30px;text-decoration:none;font-size:.82rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;">
              Répondre à ${reservation.prenom} →
            </a>
          </div>
        </div>
        <div style="background:#2C1810;padding:20px 40px;text-align:center;">
          <p style="color:rgba(250,245,236,.4);font-size:.75rem;margin:0;">Réservation #${id} — ${new Date().toLocaleString('fr-FR')}</p>
        </div>
      </div>
    `,
  };

  const mailClient = {
    from:    `"Henné by Oumoul Khalifa" <${EMAIL_USER}>`,
    to:      reservation.email,
    subject: `✨ Votre demande de réservation — Henné by Oumoul Khalifa`,
    html: `
      <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;background:#FAF5EC;border-radius:12px;overflow:hidden;">
        <div style="background:#6B1A2A;padding:36px 40px;text-align:center;">
          <h1 style="color:#E8C97A;font-size:1.8rem;margin:0;font-weight:300;letter-spacing:.05em;">
            Henné <span style="color:#fff;">by Oumoul Khalifa</span>
          </h1>
        </div>
        <div style="padding:40px;">
          <h2 style="font-size:1.5rem;color:#6B1A2A;font-weight:300;margin:0 0 16px;">Merci, ${reservation.prenom} ! 🌿</h2>
          <p style="font-size:.95rem;color:#5C3A2A;line-height:1.8;margin:0 0 24px;">
            J'ai bien reçu votre demande de réservation et je vous recontacte <strong>dans les 24 heures</strong>
            pour confirmer votre date et répondre à toutes vos questions.
          </p>
          <div style="background:#fff;border-radius:10px;padding:24px 28px;border:1px solid rgba(201,168,76,.25);margin-bottom:28px;">
            <h3 style="font-size:.8rem;text-transform:uppercase;letter-spacing:.15em;color:#C9A84C;margin:0 0 16px;">Récapitulatif de votre demande</h3>
            <p style="margin:6px 0;font-size:.9rem;color:#2C1810;"><strong>Prestation :</strong> ${reservation.prestation}</p>
            <p style="margin:6px 0;font-size:.9rem;color:#2C1810;"><strong>Date souhaitée :</strong> ${formatDate(date)}</p>
            <p style="margin:6px 0;font-size:.9rem;color:#2C1810;"><strong>Lieu :</strong> ${reservation.ville}</p>
          </div>
          <p style="font-size:.88rem;color:#5C3A2A;line-height:1.7;">
            En attendant, n'hésitez pas à consulter ma galerie sur TikTok (@hennecilbyoumy) pour vous inspirer,
            ou à me contacter directement si vous avez une question urgente.
          </p>
          <div style="margin-top:32px;text-align:center;padding:24px;background:rgba(107,26,42,.05);border-radius:10px;">
            <p style="font-size:.8rem;color:#5C3A2A;margin:0 0 8px;font-weight:600;">Besoin de me joindre rapidement ?</p>
            <a href="tel:+221766955333" style="color:#6B1A2A;font-size:.95rem;text-decoration:none;font-weight:600;">+221 76 695 53 33</a>
            <span style="color:#C9A84C;margin:0 12px;">|</span>
            <a href="mailto:oumydioufdiakhate1@gmail.com" style="color:#6B1A2A;font-size:.95rem;text-decoration:none;font-weight:600;">oumydioufdiakhate1@gmail.com</a>
          </div>
        </div>
        <div style="background:#2C1810;padding:24px 40px;text-align:center;">
          <p style="color:rgba(250,245,236,.5);font-size:.78rem;margin:0;">
            © 2025 Henné by Oumoul Khalifa — Dakar, Sénégal<br>
            Vous recevez cet email car vous avez rempli le formulaire de réservation.
          </p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailArtiste);
    await transporter.sendMail(mailClient);
    console.log(`   📧 Emails envoyés à ${EMAIL_DEST} et ${reservation.email}`);
  } catch (err) {
    console.warn(`   ⚠️  Email non envoyé : ${err.message}`);
  }

  res.json({ success: true, id });
});

// ── GET /api/reservations ─────────────────────────────────
app.get('/api/reservations', async (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Accès non autorisé.' });
  }
  const { rows } = await pool.query('SELECT * FROM reservations ORDER BY created_at DESC');
  res.json({ total: rows.length, reservations: rows.map(rowToObj) });
});

// ── GET /api/reservations/export ──────────────────────────
app.get('/api/reservations/export', async (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Accès non autorisé.' });
  }

  const { rows } = await pool.query('SELECT * FROM reservations ORDER BY created_at DESC');
  const data = rows.map(rowToObj);

  const entetes = ['ID','Date création','Prénom','Nom','Email','Téléphone','Prestation','Date événement','Nb personnes','Ville','Styles','Message','Statut'];
  const lignes  = data.map(r => [
    r.id, r.createdAt, r.prenom, r.nom, r.email, r.tel,
    r.prestation, formatDate(r.date), r.nb, r.ville,
    r.styles, `"${(r.message || '').replace(/"/g, '""')}"`, r.statut,
  ].join(';'));

  const csv = [entetes.join(';'), ...lignes].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="reservations.csv"');
  res.send('﻿' + csv);
});

// ── PATCH /api/reservations/:id/statut ───────────────────
app.patch('/api/reservations/:id/statut', async (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Accès non autorisé.' });
  }

  const id      = parseInt(req.params.id);
  const statut  = req.body.statut;
  const valides = ['En attente', 'Confirmée', 'Annulée', 'Terminée'];

  if (!valides.includes(statut)) {
    return res.status(400).json({ error: `Statut invalide. Valeurs : ${valides.join(', ')}` });
  }

  const { rows } = await pool.query(
    'UPDATE reservations SET statut=$1 WHERE id=$2 RETURNING *',
    [statut, id]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Réservation introuvable.' });
  }

  console.log(`   ✏️  Réservation #${id} → ${statut}`);
  res.json({ success: true, reservation: rowToObj(rows[0]) });
});

// ── DELETE /api/reservations/:id ─────────────────────────
app.delete('/api/reservations/:id', async (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Accès non autorisé.' });
  }

  const id = parseInt(req.params.id);
  const { rows } = await pool.query(
    'DELETE FROM reservations WHERE id=$1 RETURNING *',
    [id]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Réservation introuvable.' });
  }

  const r = rowToObj(rows[0]);
  console.log(`   🗑  Réservation #${id} supprimée (${r.prenom} ${r.nom})`);
  res.json({ success: true });
});

// ── POST /api/avis ────────────────────────────────────────
app.post('/api/avis', async (req, res) => {
  const { prenom, prestation, note, commentaire } = req.body;

  if (!prenom || !commentaire || !note) {
    return res.status(400).json({ success: false, error: 'Champs obligatoires manquants.' });
  }

  const noteInt = parseInt(note);
  if (noteInt < 1 || noteInt > 5) {
    return res.status(400).json({ success: false, error: 'Note invalide (1-5).' });
  }

  const id        = Date.now();
  const createdAt = new Date().toISOString();

  await pool.query(
    `INSERT INTO avis (id, created_at, prenom, prestation, note, commentaire, statut)
     VALUES ($1,$2,$3,$4,$5,$6,'En attente')`,
    [id, createdAt, prenom.trim(), prestation?.trim() || '', noteInt, commentaire.trim()]
  );

  console.log(`\n⭐ Nouvel avis #${id} de ${prenom.trim()} (${noteInt}/5)`);
  res.json({ success: true });
});

// ── GET /api/avis (public — approuvés uniquement) ─────────
app.get('/api/avis', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, created_at, prenom, prestation, note, commentaire
     FROM avis WHERE statut='Approuvé' ORDER BY created_at DESC`
  );
  res.json(rows);
});

// ── GET /api/avis/all (admin) ─────────────────────────────
app.get('/api/avis/all', async (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Accès non autorisé.' });
  }
  const { rows } = await pool.query('SELECT * FROM avis ORDER BY created_at DESC');
  res.json(rows);
});

// ── PATCH /api/avis/:id/statut (admin) ───────────────────
app.patch('/api/avis/:id/statut', async (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Accès non autorisé.' });
  }

  const id     = parseInt(req.params.id);
  const statut = req.body.statut;
  const valides = ['En attente', 'Approuvé', 'Rejeté'];

  if (!valides.includes(statut)) {
    return res.status(400).json({ error: `Statut invalide. Valeurs : ${valides.join(', ')}` });
  }

  const { rows } = await pool.query(
    'UPDATE avis SET statut=$1 WHERE id=$2 RETURNING *',
    [statut, id]
  );

  if (rows.length === 0) return res.status(404).json({ error: 'Avis introuvable.' });
  console.log(`   ✏️  Avis #${id} → ${statut}`);
  res.json({ success: true, avis: rows[0] });
});

// ── DELETE /api/avis/:id (admin) ──────────────────────────
app.delete('/api/avis/:id', async (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Accès non autorisé.' });
  }

  const { rows } = await pool.query(
    'DELETE FROM avis WHERE id=$1 RETURNING *',
    [parseInt(req.params.id)]
  );

  if (rows.length === 0) return res.status(404).json({ error: 'Avis introuvable.' });
  console.log(`   🗑  Avis #${req.params.id} supprimé`);
  res.json({ success: true });
});

// ── Démarrage ─────────────────────────────────────────────
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log('\n🌿 ─────────────────────────────────────────');
      console.log(`   Henné by Oumoul Khalifa — Serveur démarré`);
      console.log(`   http://localhost:${PORT}`);
      console.log('─────────────────────────────────────────────');
      console.log(`   Base de données  → PostgreSQL`);
      console.log(`   Admin JSON       → /api/reservations?key=${ADMIN_KEY}`);
      console.log(`   Export CSV       → /api/reservations/export?key=${ADMIN_KEY}`);
      console.log('─────────────────────────────────────────────\n');
    });
  })
  .catch(err => {
    console.error('❌ Impossible de se connecter à la base de données :', err.message);
    process.exit(1);
  });
