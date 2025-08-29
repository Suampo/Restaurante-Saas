const express = require('express');
const router = express.Router();

function decodeJwtNoVerify(t) {
  try {
    const [, payload] = String(t).split('.');
    const json = Buffer.from(payload.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

router.get('/debug/token/inspect', (req, res) => {
  const token = (req.query.token || '').trim();
  if (!token) return res.status(400).json({ ok:false, error:'falta ?token=' });
  const payload = decodeJwtNoVerify(token);
  res.json({ ok: !!payload, payload });
});

module.exports = router;
