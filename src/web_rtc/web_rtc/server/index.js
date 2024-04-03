const puppeteer = require("puppeteer");
const ws = require("ws");
const express = require("express");

const signaling = new ws.Server({ port: 8090 });

signaling.on("listening", () => {
    console.log(`Signaling is running`);
});

signaling.on("connection", (socket) => {
    socket.on("message", (message, binary) => {
        signaling.clients.forEach((client) => {
            if (socket != client) {
                client.send(message, { binary: binary });
            }
        });
    });
});

signaling.on("error", (error) => {
    console.log("Error in signaling server: " + error.message);
});

const app = express();
app.use(express.static("public"));

app.get("/", (req, res) => {
    res.sendFile("index.html", { root: "public" });
});

app.listen(8080, async () => {
    console.log(`Express is running`);

    const browser = await puppeteer.launch({
        args: ["--use-fake-ui-for-media-stream", "--no-sandbox"],
        headless: true,
        executablePath: "/usr/bin/chromium",
    });

    const context = browser.defaultBrowserContext();
    context.overridePermissions("http://localhost:8080/", ["camera"]);

    const page = await browser.newPage();

    page.on("console", (message) => {
        console.log("SERVER: " + message.text());
    });

    await page.goto("http://localhost:8080/");
});
