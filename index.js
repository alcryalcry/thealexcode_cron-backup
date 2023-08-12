import fs from 'fs';
import { Client } from 'node-scp';
import { CronJob } from 'cron';
import dotenv from 'dotenv-flow';
dotenv.config();

const events = [
  'banner',
  'ready',
  'tcp connection',
  'x11',
  'keyboard-interactive',
  'change password',
  'error',
  'end',
  'close',
  'timeout',
  'connect',
  'greeting',
  'handshake',
  'hostkeys',
  'unix connection',
];

const logMessage = (message, logtype = 'log') => {
  const date = new Intl.DateTimeFormat('ru-RU', {
    timeStyle: 'medium',
    dateStyle: 'short',
    timeZone: 'Europe/Moscow',
  });
  console[logtype](`[${date.format()}]: ${message}`);
};

logMessage('STARTED')

const connectServerAndCopyBackups = async function () {
  let client;

  try {
    client = await Client({
      host: process.env.SERVER_HOST,
      username: process.env.SERVER_USERNAME,
      privateKey: fs.readFileSync('./.ssh/key'),
    });

    logMessage('CONNECTED');

    events.forEach((key) => {
      client.on(key, () => {
        logMessage(key.toUpperCase());
      });
    });

    const result = await client.list(process.env.SERVER_PATH_BACKUP_FOLDERS);
    const backupFolders = result.reduce((acc, curr) => {
      if (
        curr &&
        curr.name.match(new RegExp(process.env.SERVER_FILTER_BACKUP_FOLDERS))
      ) {
        acc.push(curr.name);
      }
      return acc;
    }, []);

    await Promise.all(backupFolders.map(folderPath => client.downloadDir(
      `${process.env.SERVER_PATH_BACKUP_FOLDERS}/${folderPath}`,
      `./backups/${folderPath}`
      ))
    )
    logMessage(`SUCCESS_COPIED_BACKUPS \n  ${JSON.stringify(backupFolders)}`);
  } catch (e) {
    logMessage(e, 'error');
  } finally {
    client && client.close(); // remember to close connection after you finish
  }
};

const job = new CronJob(
  process.env.CRONJOB_SCHEDULE,
  connectServerAndCopyBackups,
  null,
  false,
  process.env.CRONJOB_TIMEZONE
);
job.start();
