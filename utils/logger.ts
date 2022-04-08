import chalk from 'chalk';

export function divider() {
  console.log('--------------------------------------------------------------------------------')
}

export function pad(pad: number = 30, ...args: any) {
  let output: string[] = []
  args.forEach((arg: any, i: number) => {
    output.push(arg.toString().padEnd(pad))
  });
  console.log(...output)
}

export enum Level {
  Log = "log",
  Info = "info",
  Error = "error",
  Warn = "warn"
}

export function out(value: any, level: Level = Level.Log) {
  switch (level) {
    case Level.Log: {
      console.log(value)
      break;
    }
    case Level.Error: {
      console.error(chalk.red(value))
      break;
    }
    case Level.Warn: {
      console.warn(chalk.yellow(value))
      break;
    }
    case Level.Info: {
      console.info(chalk.cyan(value))
      break;
    }
    default: {
      console.log(value)
      break;
    }
  }
}