exports.createApplication = async (req, res) => {
  try {
    const last = await Application.findOne().sort({ protocolNumber: -1 });

    const nextNumber = last?.protocolNumber
      ? last.protocolNumber + 1
      : 528;

    const form = JSON.parse(req.body.form);

    const app = new Application({
      ...form,
      protocolNumber: nextNumber,
      status: {
        current: "На одобрении",
        history: [],
      },
    });

    await app.save();

    res.json(app);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};