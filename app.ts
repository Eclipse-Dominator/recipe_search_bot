import Telegraf from "telegraf";
import { TelegrafContext } from "telegraf/typings/context";
import fs from "fs";
import { MiddlewareFn } from "telegraf/typings/composer";
import {
  ExtraReplyMessage,
  InputFile,
  Message,
} from "telegraf/typings/telegram-types";
import { OpenCC } from "opencc";
import { Data, fileQ, Next, save_data, user } from "./interface";
import { spawn } from "child_process";
import express from "express";
import { Server } from "http";

const t2s = new OpenCC("t2s.json");
const pyData: string = "./dirList.data";
const TOKEN: string = "telegramToken"; // not recommended but private projects
const rootDir: string = "/mnt/hdd/饮食文化/";
function refreshFiles(id: number) {
  const python = spawn("python3", ["ListFile.py", rootDir]);
  python.on("close", (code) => {
    sendMessage(id, "Files Updated");
  });
}

const fileQueue: fileQ = {};

class fileDownloadServer {
  private app = express();
  private server: Server | false = false;
  private serverTimeOut: NodeJS.Timeout | false = false;
  constructor() {
    this.app.get("/:key", (req, res) => {
      let dir: string = fileQueue[req.params.key];
      if (dir) {
        res.download(fileQueue[req.params.key]);
      } else {
        res.send("文件已不存在！");
      }
    });
  }
  filedir(dir: string): string | false {
    if (!fs.existsSync(dir)) return false;
    let id = Date.now().toString();
    fileQueue[id] = dir;
    console.log(fileQueue);
    this.start_server(3);
    setTimeout(() => {
      delete fileQueue[id];
    }, 3 * 60000);
    return `http://192.168.1.1:59678/${id}`;
  }

  private start_server(minutes: number) {
    if (this.serverTimeOut) clearTimeout(this.serverTimeOut);
    else {
      this.server = this.app.listen(59678, "192.168.86.22");
    }
    this.serverTimeOut = setTimeout(() => {
      if (this.server) this.server.close();
      this.server = false;
      this.serverTimeOut = false;
    }, minutes * 60000);
  }
}

class User {
  id: number;
  searchData: Data[] = [];
  searchBool: boolean = false;
  filterBool: boolean = false;
  constructor(id: number) {
    this.id = id;
  }
}

let userList: user[] = [];
let fDS = new fileDownloadServer();

let data: save_data = JSON.parse(
  fs.readFileSync("./data.json", {
    encoding: "utf8",
    flag: "r+",
  })
);

for (let id of data.userList) {
  userList.push(new User(id));
}

const bot: Telegraf<TelegrafContext> = new Telegraf(TOKEN);

let files: Data[];

fs.readFile(pyData, "utf8", (err, data) => {
  if (err) {
    console.log(err);
  } else {
    files = JSON.parse(data);
  }
});

const sendMessage = async (
  id: number,
  message: string,
  markupObj: ExtraReplyMessage["reply_markup"] = { remove_keyboard: true }
): Promise<undefined | false> => {
  let charLength: number = 4096;
  try {
    if (message.length >= charLength) {
      let index_to_cut: number = message
        .substr(0, charLength)
        .search(/(\n).*$/);
      await bot.telegram.sendMessage(id, message.substr(0, index_to_cut));
      await sendMessage(id, message.substr(index_to_cut), markupObj);
    } else {
      await bot.telegram.sendMessage(id, message, { reply_markup: markupObj });
    }
  } catch (error) {
    return false;
  }
};

async function saveFile() {
  console.log("saving file");
  let save_data: string = JSON.stringify(data, null, 1);
  await fs.promises
    .writeFile("data.json", save_data)
    .catch((e) => console.log(e));
}

async function sendFile(id: number, path: string): Promise<boolean> {
  try {
    sendMessage(id, fDS.filedir(path) || "文件加载失败！");
    return true;
  } catch (e) {
    console.log(e);
    return false;
  }
}

async function uploadFile(id: number, path: string): Promise<boolean> {
  try {
    await bot.telegram.sendDocument(id, { source: path });
    return true;
  } catch (e) {
    console.log(e);
    return false;
  }
}

async function searchFiles(searchString: string): Promise<Data[]> {
  searchString = searchString.toUpperCase();
  let result: Data[] = [];
  for (let file of files) {
    let filename = file[1];
    if (
      (await t2s.convertPromise(filename.toUpperCase())).includes(searchString)
    ) {
      result.push(file);
    }
  }
  return result;
}

const userFilter: MiddlewareFn<TelegrafContext> = async (
  ctx: TelegrafContext,
  next: Next
) => {
  if (ctx.chat) {
    let id: number = ctx.chat.id;
    let userObject: user | undefined = userList.find((x) => x.id == id);
    if (userObject) {
      //@ts-ignore
      ctx.state.user = userObject;
      return next();
    }
  } else return;
};

bot.command("add", userFilter, async (ctx) => {
  if (!ctx.message?.text) return;
  let id: number = parseInt(ctx.message.text.split(" ")[1]); // /add id
  if (id && !data.userList.includes(id) && !isNaN(id)) {
    data.userList.push(id);
    userList.push(new User(id));
    await saveFile();
    return await ctx.reply("添加成功！");
  } else {
    return await ctx.reply("添加失败！");
  }
});

bot.command("search", userFilter, async (ctx) => {
  if (!ctx.message?.text) return;
  let userObj: user;
  //@ts-ignore
  userObj = ctx.state.user;
  userObj.searchBool = true;
  userObj.filterBool = false;
  userObj.searchData = [];

  await ctx.reply("请输入要搜索的内容！");
});

bot.command("update", userFilter, async (ctx) => {
  await ctx.reply("更新文件目录...");
  refreshFiles(ctx.chat?.id ?? 0);
});

bot.on("callback_query", userFilter, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    let userObj: user;
    //@ts-ignore
    userObj = ctx.state.user;
    if (ctx.callbackQuery?.data) {
      let [command, data] = ctx.callbackQuery.data.split(":");
      switch (command) {
        case "download_file":
          try {
            if (
              !(await sendFile(
                userObj.id,
                userObj.searchData[parseInt(data)][0]
              ))
            ) {
              throw "Error";
            } else {
              ctx.editMessageReplyMarkup();
            }
          } catch {
            await sendMessage(userObj.id, "上传文件失败！");
            return;
          }
          break;
        case "upload_file":
          try {
            if (
              !(await uploadFile(
                userObj.id,
                userObj.searchData[parseInt(data)][0]
              ))
            ) {
              throw "Error";
            } else {
              ctx.editMessageReplyMarkup();
            }
          } catch {
            await sendMessage(userObj.id, "上传文件失败！");
            return;
          }
      }
    }
    await ctx.answerCbQuery();
  } catch (e) {}
});

bot.command("select", userFilter, async (ctx) => {
  let userObj: user;
  //@ts-ignore
  userObj = ctx.state.user;
  if (userObj.searchData.length) {
    await ctx.reply("请输入您要查看的编号");
    userObj.filterBool = true;
  }
});

bot.on("message", userFilter, async (ctx) => {
  let userObj: user;
  //@ts-ignore
  userObj = ctx.state.user;
  let msg: string = ctx.message?.text ?? "";
  if (userObj.searchBool) {
    userObj.searchBool = false;
    if (msg) {
      await bot.telegram.sendChatAction(userObj.id, "typing");
      userObj.searchData = await searchFiles(msg);
      if (userObj.searchData.length == 0) {
        await ctx.reply("未找到相关的文件！");
        return;
      }
      let replymsg = "";
      for (let index in userObj.searchData) {
        replymsg += `${index}. ${userObj.searchData[index][1]}\n`;
      }
      await sendMessage(userObj.id as number, replymsg);
      await ctx.reply("请输入您要查看的编号");
      userObj.filterBool = true;
    }
  } else if (userObj.filterBool) {
    userObj.filterBool = false;
    if (msg) {
      try {
        let index = parseInt(msg.trim());
        console.log(userObj.searchData[index]);
        await sendMessage(userObj.id, userObj.searchData[index][0], {
          inline_keyboard: [
            [
              { text: "下载文件", callback_data: `download_file:${index}` },
              {
                text: "上传文件（不安全）",
                callback_data: `upload_file:${index}`,
              },
            ],
          ],
        });
      } catch (e) {
        console.log(e);
        await ctx.reply("无效编号,请重新输入编号");
        userObj.filterBool = true;
      }
    }
  }
});

bot.launch();
