// logger.ts
export async function logToFile(title: string, message: string) {
  try {
    // await Bun.write(`./logs/${title}-${new Date().toISOString()}`, message);
  } catch {
    console.log(`[${title}] ${message}`);
  }
}

export async function logToFileDump(title: string, _value: unknown) {
  try {
    // await Bun.write(`./logs/${title}-${new Date().toISOString()}`, JSON.stringify(_value, null, 2));
  } catch {
    console.log(`[${title}] dump`);
  }
}
