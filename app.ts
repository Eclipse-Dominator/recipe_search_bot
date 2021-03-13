import Telegraf from "telegraf";
import { TelegrafContext } from "telegraf/typings/context";
import fs from "fs";
import { promisify } from "util";
import { MiddlewareFn } from "telegraf/typings/composer";
import { Message } from "telegraf/typings/telegram-types";
import { OpenCC } from "opencc";

const t2s = new OpenCC("t2s.json");
type Next = () => void | Promise<void>;

interface save_data {
  userList: number[];
}

const readdir = promisify(fs.readdir);

const TOKEN: string = "telegram token"; // not recommended but private projects
const rootDir: string = "/mnt/hdd/饮食文化/";
const bot: Telegraf<TelegrafContext> = new Telegraf(TOKEN);

const sendMessage = async (
  id: number,
  message: string
): Promise<Message | false> => {
  try {
    return await bot.telegram.sendMessage(id, message);
  } catch (error) {
    return false;
  }
};

var data: save_data = JSON.parse(
  fs.readFileSync("./data.json", {
    encoding: "utf8",
    flag: "r+",
  })
);

var bufferQueue: string[] = [];
var counter: number = 0;
var runningQueue: boolean = false;
var printQueue = async (id: number) => {
  runningQueue = true;
  while (bufferQueue.length) {
    await sendMessage(id, `结果${++counter}：${bufferQueue.shift()}`);
  }
  runningQueue = false;
};

async function saveFile() {
  console.log("saving file");
  let save_data: string = JSON.stringify(data, null, 1);
  await fs.promises
    .writeFile("data.json", save_data)
    .catch((e) => console.log(e));
}

async function searchFile(
  id: number,
  dir: string,
  name: string,
  hide_root: boolean
): Promise<string | false> {
  try {
    name = name.toUpperCase();
    let filename_list: string[] = await readdir(`${rootDir}${dir}`);
    for (let filename of filename_list) {
      if (/^\./.test(filename)) continue; //removes files starting with .
      if ((await t2s.convertPromise(filename.toUpperCase())).includes(name)) {
        if (hide_root) {
          bufferQueue.push(`${dir}${filename}`);
        } else bufferQueue.push(`${rootDir}${dir}${filename}`);
        if (!runningQueue) printQueue(id);
      }
      searchFile(id, `${dir}${filename}/`, name, hide_root);
    }
  } catch (error) {
    // error reading dir or not dir at all
    return false;
  }

  return false;
}

const userFilter: MiddlewareFn<TelegrafContext> = async (
  ctx: TelegrafContext,
  next: Next
) => {
  if (ctx.chat) {
    let id: number = ctx.chat.id;
    console.log(id);
    if (data.userList.includes(id)) return next();
  } else return;
};

bot.command("add", userFilter, async (ctx) => {
  if (!ctx.message?.text) return;
  let id: number = parseInt(ctx.message.text.split(" ")[1]);
  if (id && !data.userList.includes(id) && !isNaN(id)) {
    data.userList.push(id);
    await saveFile();
    return await ctx.reply("添加成功！");
  } else {
    return await ctx.reply("添加失败！");
  }
});

bot.on("message", userFilter, async (ctx) => {
  await ctx.reply("搜索中...");
  counter = 0;
  bufferQueue = [];
  await searchFile(
    ctx.chat?.id as number,
    "/",
    ctx.message?.text as string,
    true
  );
});

bot.launch();
