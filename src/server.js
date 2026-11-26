const app = require("./app");
const { testConnection } = require("./config/database");

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server berjalan di http://0.0.0.0:${PORT}`);
    await testConnection();
});