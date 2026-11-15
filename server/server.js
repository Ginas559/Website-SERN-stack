require("dotenv").config();

const app = require("./src/app");
const { port } = require("./src/config/config");
const orderService = require("./src/services/orderService");

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    setInterval(() => {
        orderService.releaseExpiredVnpayOrders().catch(() => {});
    }, 300000);
});
