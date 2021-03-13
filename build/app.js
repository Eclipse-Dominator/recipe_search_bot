"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const telegraf_1 = __importDefault(require("telegraf"));
const fs_1 = __importDefault(require("fs"));
const util_1 = require("util");
const readdir = util_1.promisify(fs_1.default.readdir);
const TOKEN = "1354062396:AAFR9FERLTFv4NPNg4am8Vp8ZMgR7uw-Mc8";
const rootDir = "D:/Actual_Productivity/Recipes";
const bot = new telegraf_1.default(TOKEN);
const sendMessage = (id, message) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        return yield bot.telegram.sendMessage(id, message);
    }
    catch (error) {
        return false;
    }
});
var data = JSON.parse(fs_1.default.readFileSync("./data.json", {
    encoding: "utf8",
    flag: "r+",
}));
function saveFile() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("saving file");
        let save_data = JSON.stringify(data, null, 1);
        yield fs_1.default.promises
            .writeFile("data.json", save_data)
            .catch((e) => console.log(e));
    });
}
function searchFile(id, dir, name, hide_root) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let filename_list = yield readdir(`${rootDir}${dir}`);
            for (let filename of filename_list) {
                if (/^\./.test(filename))
                    continue; //removes files starting with .
                if (filename.includes(name)) {
                    if (hide_root) {
                        sendMessage(id, `结果：/${dir}${filename}`);
                    }
                    else
                        sendMessage(id, ` 结果：/${rootDir}${dir}${filename}`);
                }
                searchFile(id, `${dir}${filename}/`, name, hide_root);
            }
        }
        catch (error) {
            // error reading dir or not dir at all
            return false;
        }
        return false;
    });
}
const userFilter = (ctx, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (ctx.chat) {
        let id = ctx.chat.id;
        console.log(id);
        if (data.userList.includes(id))
            return next();
    }
    else
        return;
});
bot.command("add", userFilter, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!((_a = ctx.message) === null || _a === void 0 ? void 0 : _a.text))
        return;
    let id = parseInt(ctx.message.text.split(" ")[1]);
    if (id && !data.userList.includes(id) && !isNaN(id)) {
        data.userList.push(id);
        yield saveFile();
        return yield ctx.reply("添加成功！");
    }
    else {
        return yield ctx.reply("添加失败！");
    }
}));
bot.on("message", userFilter, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c;
    yield ctx.reply("搜索中...");
    yield searchFile((_b = ctx.chat) === null || _b === void 0 ? void 0 : _b.id, "/", (_c = ctx.message) === null || _c === void 0 ? void 0 : _c.text, true);
}));
bot.launch();
