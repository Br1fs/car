exports.updateApplication = async (req, res) => {
  try {
    const app = await Application.findById(req.params.id);

    if (!app) return res.status(404).json({ message: "Not found" });

    const body = JSON.parse(req.body.form || "{}");

    // ===== STATUS UPDATE LOGIC =====
    if (body.status?.current && body.status.current !== app.status.current) {
      const now = new Date();

      const last = app.status.history?.slice(-1)[0];

      let duration = null;

      if (last) {
        duration = Math.round((now - last.changedAt) / 60000);
      }

      app.status.history.push({
        from: app.status.current,
        to: body.status.current,
        changedAt: now,
        changedBy: body.user || "system",
        durationMinutes: duration,
      });

      app.status.current = body.status.current;
    }

    // остальные поля
    Object.assign(app, body);

    await app.save();

    res.json(app);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};