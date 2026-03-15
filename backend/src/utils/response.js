const ok = (res, data, status = 200) => res.status(status).json({ success: true, ...data });

const fail = (res, code, message, status = 400) =>
  res.status(status).json({ success: false, error: { code, message } });

module.exports = { ok, fail };
