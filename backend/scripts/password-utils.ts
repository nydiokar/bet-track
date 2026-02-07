import readline from "node:readline";

export const readSecret = async (label: string): Promise<string> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  }) as readline.Interface & {
    stdoutMuted?: boolean;
    _writeToOutput?: (str: string) => void;
    output: NodeJS.WriteStream;
  };

  rl.stdoutMuted = true;
  rl._writeToOutput = function _writeToOutput(str: string) {
    if (rl.stdoutMuted) {
      rl.output.write("*");
      return;
    }
    rl.output.write(str);
  };

  const value = await new Promise<string>((resolve) => {
    rl.question(`${label}: `, (answer) => resolve(answer));
  });

  rl.stdoutMuted = false;
  rl.close();
  process.stdout.write("\n");
  return value;
};

export const normalizePassword = (value: string): string => value.normalize("NFKC").trim();