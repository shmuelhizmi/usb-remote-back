import * as express from "express";
import * as cors from "cors";
import { getDeviceList, on as usbOn, Device } from "usb";
import * as http from "http";
import * as sio from "socket.io";
interface settings {
  port: number;
  testorigin: string;
}

interface device {
  bus: number;
  id: number;
  vendor: number;
  stringDescriptor?: string;
}
const settings: settings = require("../config.json");

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

const getDevice: (device: Device) => Promise<device> = (device: Device) => {
  device.open();
  const newDevice: device = {
    bus: device.busNumber,
    id: device.deviceDescriptor.idProduct,
    vendor: device.deviceDescriptor.idVendor
  };
  return new Promise((res, rej) => {
    device.getStringDescriptor(
      device.deviceDescriptor.iProduct,
      (e, buffer) => {
        newDevice.stringDescriptor = buffer?.toString();
        res(newDevice);
      }
    );
  });
};

app.get("/list", (req, res) => {
  const usb = getDeviceList();
  const resualt: Promise<device>[] = usb.map(async v => await getDevice(v));
  Promise.all(resualt).then(v => {
    res.send(v);
  });
});

let connectedSockets: sio.Socket[] = [];

usbOn("attach", device => {
  connectedSockets = connectedSockets.filter(socket => socket.connected);
  connectedSockets.forEach(socket => {
    if (socket.connected) {
      getDevice(device).then(newDevice => {
        socket.emit("add", newDevice);
      });
    }
  });
});

usbOn("detach", device => {
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
