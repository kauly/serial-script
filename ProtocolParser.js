import { Transform } from "stream";
import { EventEmitter } from "events";

export const aboutCmds = [
  {
    label: "version",
    payload: [0x56, 0x45, 0x52, 0x53, 0x49, 0x4f, 0x4e, 0x3f],
    parser: parseAbout,
  },
  {
    label: "status",
    payload: [0x53, 0x54, 0x41, 0x54, 0x55, 0x53, 0x3f],
    parser: parseStatus,
  },
];

export const pipe =
  (...fns) =>
  (x) =>
    fns.reduce((v, f) => f(v), x);

/**
 *
 * @param {Buffer} chunk
 * @returns {Object} A object ready to use into the UI
 */
function genCmd(chunk) {
  return {
    header: chunk.slice(0, 7),
    len: chunk[6],
    payload: chunk.slice(7),
  };
}

/**
 * This function receives a chunk to check the payload size.
 * @param {Buffer} chunk
 * @returns {Boolean} True with the payload size is equal to the size informed by the header.
 */
function isComplete(chunk) {
  const len = chunk[6];
  const paylen = chunk.slice(7).length;
  return len === paylen;
}

function hasPrev(prev) {
  return prev.length;
}

/**
 * This func receives chunks from the serialport and release when the packages are complete
 * @param {Stream} instance
 * @returns {Buffer} Return a buffer with the complete package
 */
export async function* chunksToPack(instance) {
  let prev = [];
  for await (const chunk of instance) {
    let pack = chunk;
    if (hasPrev(prev)) {
      pack = Buffer.from([...prev, ...chunk]);
      prev = [];
    }
    if (isComplete(pack)) {
      yield pack;
    } else {
      prev = pack;
    }
  }
}

/**
 * This function receives the hole package and transform this
 * @param {Buffer} packStream
 * @param {Function} action
 */
export async function packToCmd(packStream, action) {
  for await (const pack of packStream) {
    const cmd = genCmd(pack);
    action(cmd);
  }
}

/**
 * Return the package that will be sended to the tracker
 * @param {number} count
 * @param {Buffer} chunk
 * @returns {Buffer}
 */
const getPack = (count, chunk) =>
  Buffer.from([0x3a, 0x3a, 0x03, count, 0x01, 0x00, chunk.length, ...chunk]);

/**
 * A Transform stream responsible to send data to the tracker
 * @returns {Buffer}
 */
export const OutputParser = function () {
  let count = 0;
  const out = new Transform({
    transform(chunk, enc, cb) {
      const bf = getPack(count, chunk);
      this.push(bf);
      count++;
      cb();
    },
  });
  return out;
};

/**
 * This function receives an array of commands payloads, forward to the tracker
 * and return all responses also in a array.
 */
export function COMEmitter() {
  const _Emitter = new EventEmitter();
  const _writer = OutputParser();
  let _outputInfo = [];
  let _output = [];
  let _input = [];
  let _type = "normal";
  let _sp = null;
  let _cb = null;
  let _updateBaud = null;

  const _reader = function (data) {
    const curInfo = _outputInfo.shift();
    const out = {
      label: curInfo.label,
      parsed: curInfo.parser(data.payload),
    };
    _output.push(out);
    _type === "pingPong" && _cb(out, false);
    _input.length === 0 ? _Emitter.emit("finish") : _Emitter.emit("continue");
  };

  this.setInstance = function (inst, updater) {
    _sp = inst;
    _updateBaud = updater;
    _writer.pipe(inst);
    packToCmd(chunksToPack(inst), _reader);
  };

  this.startCom = function (data, cb, type = "normal") {
    _cb = cb;
    _input = [...data];
    _outputInfo = [...data];
    _output = [];
    _type = type;
    _Emitter.emit("start");
  };

  this._shift = function () {
    const cur = _input.shift();
    const payload = Buffer.from(cur.payload);
    _writer.write(payload);
    if (cur.label === "velocidade porta serial") {
      const strPayload = payload.toString();
      const isConfig = strPayload.includes("#");
      if (isConfig) {
        setTimeout(() => {
          const baud = strPayload.slice(5, -1);
          _sp.update(
            {
              baudRate: parseInt(baud * 100),
            },
            (err) => {
              err && console.error("Error on update baud", err);
              _reader({ payload: "SET BAUD OK" });
              _updateBaud(parseInt(baud * 100));
            }
          );
        }, 3000);
      }
    }
  };

  this._finished = function () {
    _cb(_output, true);
  };

  _Emitter.on("start", this._shift);
  _Emitter.on("continue", this._shift);
  _Emitter.on("finish", this._finished);
}
