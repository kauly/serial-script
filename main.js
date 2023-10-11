const { SerialPort } = require("serialport");

const aboutCmds = [
  {
    label: "version",
    payload: [0x56, 0x45, 0x52, 0x53, 0x49, 0x4f, 0x4e, 0x3f],
  },
  {
    label: "status",
    payload: [0x53, 0x54, 0x41, 0x54, 0x55, 0x53, 0x3f],
  },
];

const getPack = (count, chunk) =>
  Buffer.from([0x3a, 0x3a, 0x03, count, 0x01, 0x00, chunk.length, ...chunk]);

const packet = Buffer.from([
  0x3a, 0x3a, 0x03, 0x00, 0x01, 0x00, 0x03,

  0x42, 0x41, 0x55, 0x44, 0x3f,
]);

// Create a port
const port = new SerialPort(
  {
    path: "/dev/ttyUSB0",
    baudRate: 115200,
    dataBits: 8,
    stopBits: 1,
    parity: "none",
  },
  () => {
    port.write(packet, () => {
      console.log("Message sent");
    });
  }
);
/* const packet = Buffer.from([
  0x3a,
  0x3a,
  0x00, // id
  0x00, // id
  0x0e, // payload len
  0x6f, // action code
  0x6c, // payload = olhaopassarinho
  0x68,
  0x61,
  0x6f,
  0x70,
  0x61,
  0x73,
  0x73,
  0x61,
  0x72,
  0x69,
  0x6e,
  0x68,
  0x6f,
]); */

// Open errors will be emitted as an error event
port.on("error", function (err) {
  console.log("Error: ", err.message);
});

port.on("data", (d) => {
  console.log("🚀 ~ file: main.js:49 ~ d:", d);
});
