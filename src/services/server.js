import applicationsRouter from "./routes/applications.js";
import decisionsRouter from "./routes/decisions.js";

app.use("/api/applications", applicationsRouter);
app.use("/api/decisions", decisionsRouter);

app.use(express.json());
