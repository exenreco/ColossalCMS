import { hashPassword } from "./password-auth.mjs";
if (!process.stdin.isTTY) {
  console.error(
    "Run in an interactive terminal. Passwords must not be passed on the command line.",
  );
  process.exitCode = 1;
} else {
  process.stdout.write("New password (input hidden): ");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let password = "";
  process.stdin.on("data", async (bytes) => {
    for (const char of bytes.toString()) {
      if (char === "\u0003") {
        process.stdin.setRawMode(false);
        process.exit(1);
      }
      if (char === "\r" || char === "\n") {
        process.stdin.pause();
        process.stdin.setRawMode(false);
        process.stdout.write("\n");
        try {
          console.log(await hashPassword(password));
        } catch (e) {
          console.error(e.message);
          process.exitCode = 1;
        }
        password = "";
        return;
      }
      if (char === "\u007f" || char === "\b") password = password.slice(0, -1);
      else if (char >= " ") password += char;
    }
  });
}
