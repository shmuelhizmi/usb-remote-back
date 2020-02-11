"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const cors = require("cors");
const usb_1 = require("usb");
const http = require("http");
const sio = require("socket.io");
const settings = require("../config.json");
const app = express();
app.use(cors({ origin: settings.testorigin }));
const httpserver = http.createServer(app);
const io = sio(httpserver);
const port = settings.port || 5000;
app.get("/", (req, res) => {
    res.send(`<!DOCTYPE html>
  <html>
      <body>
          <h1>usb remote</h1>
          <ol>
              <li>/list - list devcies</li>
          </ol>
      </body>
  </html>`);
});
const getDevice = (device) => {
    device.open();
    const newDevice = {
        bus: device.busNumber,
        id: device.deviceDescriptor.idProduct,
        vendor: device.deviceDescriptor.idVendor
    };
    return new Promise((res, rej) => {
        device.getStringDescriptor(device.deviceDescriptor.iProduct, (e, buffer) => {
            var _a;
            newDevice.stringDescriptor = (_a = buffer) === null || _a === void 0 ? void 0 : _a.toString();
            res(newDevice);
        });
    });
};
app.get("/list", (req, res) => {
    const usb = usb_1.getDeviceList();
    const resualt = usb.map((v) => __awaiter(void 0, void 0, void 0, function* () { return yield getDevice(v); }));
    Promise.all(resualt).then(v => {
        res.send(v);
    });
});
let connectedSockets = [];
usb_1.on("attach", device => {
    connectedSockets = connectedSockets.filter(socket => socket.connected);
    connectedSockets.forEach(socket => {
        if (socket.connected) {
            getDevice(device).then(newDevice => {
                socket.emit("add", newDevice);
            });
        }
    });
});
usb_1.on("detach", device => {
    connectedSockets = connectedSockets.filter(socket => socket.connected);
    connectedSockets.forEach(socket => {
        if (socket.connected) {
            getDevice(device).then(removedDevice => {
                socket.emit("remove", removedDevice);
            });
        }
    });
});
io.on("connection", socket => {
    connectedSockets.push(socket);
});
httpserver.listen(port, () => {
    console.log(`starting http on port - ${port} `);
});
