const { Writable } = require("node:stream");
const readline = require("node:readline");

const { hashPassword } = require("../auth");

let muted = false;
const output = new Writable({
  write(chunk, _encoding, callback) {
    if (!muted) {
      process.stdout.write(chunk);
    }
    callback();
  },
});

const prompt = readline.createInterface({
  input: process.stdin,
  output,
  terminal: true,
});

muted = true;
process.stdout.write("Enter a password (12+ characters): ");
prompt.question("", (password) => {
  muted = false;
  process.stdout.write("\n");
  prompt.close();

  try {
    process.stdout.write(`${hashPassword(password)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
});
