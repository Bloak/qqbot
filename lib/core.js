"use strict";
const path = require("path");
const fs = require("fs");
const { createCanvas } = require('canvas');
const request = require('request');
const fetch = require('node-fetch');
//const compress_images = require('compress-images');
const images = require('images');
const seed = require('seed-random');
//const danmaku = require('../danmaku');
const mokou_cirno = require('../mokou_cirno');
const discreteSTG = require('../discreteSTG');
const two_spies = require('../two_spies');

const querystring = require("querystring");
const url = require("url");
const crypto = require("crypto");
const oicq = require("oicq");
const http = require("http");
const https = require("https");
const WebSocket = require("ws");
const api = require("./api");
const global_config = require("../config");
const default_config = {
    host:     "127.0.0.1",
    port:     5700,
    use_http: false,
    use_ws:   false,

    platform: 2,
    kickoff: false,
    ignore_self: false,

    access_token: "",
    secret: "",
    post_timeout: 30,
    post_message_format: "string",
    enable_heartbeat: false,
    heartbeat_interval: 15000,
    post_url: [],
    ws_reverse_url: [],
    ws_reverse_reconnect_interval: 3000,
}
const config = {};
let bot, account, dir, server, wss, online = false, websockets = new Set();

var GroupLock = true;
var adminQQ = 123456789;

function startup(arg) {
    account = arg;
    if (!global_config[account]) {
        console.log("未找到该账号的配置，请确认配置文件。");
        process.exit();
    }
    dir = path.join(process.mainModule.path, "data", account.toString());
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, {recursive: true, mode: 0o755});
    Object.assign(config, default_config, global_config[account]);
    if (global_config.debug)
        config.log_level = "debug";
    config.device_path = dir;
    if (config.enable_heartbeat && (config.use_ws || config.ws_reverse_url.length)) {
        setInterval(()=>{
            const json = JSON.stringify({
                self_id: account,
                time: parseInt(Date.now()/1000),
                post_type: "meta_event",
                meta_event_type: "heartbeat",
                interval: config.heartbeat_interval,
            })
            websockets.forEach((ws)=>{
                ws.send(json);
            });
            if (wss) {
                wss.clients.forEach((ws)=>{
                    ws.send(json);
                });
            }
        }, config.heartbeat_interval);
    }
    createBot();
    createServer();
    createReverseWS();
}

function inputPassword() {
    console.log("请输入密码：");
    process.stdin.once("data", (input)=>{
        input = input.toString().trim();
        const password = crypto.createHash("md5").update(input).digest();
        fs.writeFileSync(path.join(dir, "password"), password);
        bot.login(password);
    })
}

function createBot() {
    bot = oicq.createClient(account, config);
    api.setBot(bot);
    bot.on("system.login.captcha", (data)=>{
        const filepath = path.join(dir, `captcha.jpg`);
        fs.writeFileSync(filepath, data.image);
        bot.logger.info(`验证码已更新并保存到文件(${filepath})，请查看并输入: `);
        process.stdin.once("data", (input)=>{
            bot.captchaLogin(input);
        });
    });
    bot.on("system.login.slider", ()=>{
        process.stdin.once("data", input=>{
            bot.sliderLogin(input);
        });
    });
    bot.on("system.login.device", (data)=>{
        process.stdin.once("data", bot.login.bind(bot));
    });
    bot.on("system.login.error", (data)=>{
        if (data.message.includes("密码错误"))
            inputPassword();
        else
            bot.terminate();
    });

    bot.on("system.online", ()=>{
        online = true;
        dipatch({
            self_id: account,
            time: parseInt(Date.now()/1000),
            post_type: "meta_event",
            meta_event_type: "lifecycle",
            sub_type: "enable",
        });
        bot.sendGroupMsg(912835656, "hello world");
    });
    bot.on("system.offline", (data)=>{
        online = false;
        dipatch({
            self_id: account,
            time: parseInt(Date.now()/1000),
            post_type: "meta_event",
            meta_event_type: "lifecycle",
            sub_type: "disable",
        });
        if (data.sub_type === "network") {
            bot.logger.warn("网络断开，10秒后尝试重新连接。");
            setTimeout(createBot, 10000);
        }
    });

    // bot.on("request", dipatch);
    // bot.on("notice", dipatch);

    bot.on("notice.group.increase", (data)=>{
        if (!(data.user_id===data.self_id)){
            bot.sendGroupMsg(data.group_id, `欢迎${data.nickname}加入本群！`);
            if (data.group_id===938996650||data.group_id===872160087)//键山厨一群二群
            {
                var musicId = (Math.random()>0.5)?22636642:22636644;
                bot.sendGroupMsg(data.group_id, `[CQ:music,type=163,id=${musicId}]`);
            }
        }
        // 不再加群
        else {
            if (GroupLock) {
                bot.setGroupLeave(data.group_id);
            }
        }
    });

    bot.on("request.friend.add", (data)=>{
        bot.sendGroupMsg(239313171, `${data.user_id}请求加为好友`);
        //bot.setFriendAddRequest(data.flag, true);
        bot.sendGroupMsg(239313171, data.flag);
    });

    bot.on("request.group.invite", (data)=>{
        bot.sendGroupMsg(239313171, `${data.user_id}邀请你加入群${data.group_id}(${data.group_name})`);
        //bot.setGroupAddRequest(data.flag, true);
        bot.sendGroupMsg(239313171, data.flag);
    });

    //edit interactions here
    bot.on("message", (data)=>{
        // 监听
        if (data.message_type=="group") {
            //console.log(0);
            var listen_info = JSON.parse(fs.readFileSync('listen.json'));
            if (listen_info.input_group===data.group_id) {
                //console.log(1);
                var nickname = (data.sender.card)?data.sender.card:data.sender.nickname;
                bot.sendGroupMsg(listen_info.output_group, `${nickname}(${data.user_id})说：${data.raw_message}`);
            }
        }

        if (data.message_type=="group" && data.anonymous!==null) return;

        if (config.post_message_format === "string")
            data.message = data.raw_message;

        const action = data.message_type === "private" ? "sendPrivateMsg" : "sendGroupMsg";
        const id = data.message_type === "private" ? data.user_id : data.group_id;

        var reply = '';
        //黑名单屏蔽
        var globalBlacklistData = fs.readFileSync('blacklist.json');
        var globalBlacklist = JSON.parse(globalBlacklistData);
        if (!(globalBlacklist.includes(data.user_id))){
            //管理员功能
            if(data.user_id===adminQQ){
                if (data.message.slice(0,3)==='广播 '){
                    announce(bot,data.message.slice(3));
                }
                /*else if (data.message.slice(0,5)==='二群广播 '){
                    bot.sendGroupMsg(830658555,data.message.slice(5));
                }*/
                else if (data.message==='上锁'){
                    var rawData = fs.readFileSync('user_variables.json');
                    var userVariables = JSON.parse(rawData);
                    userVariables['lock'] = true;
                    var newData = JSON.stringify(userVariables);
                    fs.writeFileSync('user_variables.json',newData);
                    reply = '已上锁';
                }
                else if (data.message==='解锁'){
                    var rawData = fs.readFileSync('user_variables.json');
                    var userVariables = JSON.parse(rawData);
                    userVariables['lock'] = false;
                    var newData = JSON.stringify(userVariables);
                    fs.writeFileSync('user_variables.json',newData);
                    reply = '已解锁';
                }
                /*else if (data.message.slice(0,5)==='删除卡组 '){
                    var deckName = data.message.slice(5);
                    var rawData = fs.readFileSync('deck.json');
                    var decks = JSON.parse(rawData);
                    delete decks[deckName];
                    var newData = JSON.stringify(decks);
                    fs.writeFileSync('deck.json',newData);
                    reply = '删除成功';
                }
                else if (data.message.slice(0,5)==='删除评价 '){
                    var content = data.message.slice(5).split(' ');
                    var name = content[0];
                    var comment = content[1];
                    var rawData = fs.readFileSync('2047_cards.json');
                    var cards = JSON.parse(rawData);
                    if (name in cards){
                        if (!('评价' in cards[name])){
                            reply = '该卡牌没有评价';
                        }
                        else {
                            var success = remove(cards[name].评价, comment);
                            if (success){
                                var rawData2 = fs.readFileSync('card_comments.json');
                                var card_comments = JSON.parse(rawData2);
                                if (name in card_comments){
                                    remove(card_comments[name], comment);
                                }
                                
                                var newData = JSON.stringify(cards);
                                fs.writeFileSync('2047_cards.json',newData);

                                var newData2 = JSON.stringify(card_comments);
                                fs.writeFileSync('card_comments.json',newData2);

                                reply = '删除成功';
                            }
                            else {
                                reply = '未找到该评价';
                            }
                        }
                    }
                    else {
                        reply = '卡牌名称有误';
                    }
                }*/
                else if (data.message.slice(0,3)==='拉黑 '){
                    var qq = parseInt(data.message.slice(3));
                    var rawData = fs.readFileSync('blacklist.json');
                    var blacklist = JSON.parse(rawData);
                    if (!(blacklist.includes(qq))){
                        blacklist.push(qq);
                        var newData = JSON.stringify(blacklist);
                        fs.writeFileSync('blacklist.json',newData);
                        reply = '已拉黑用户'+qq.toString();
                    }
                    else {
                        reply = '该用户已经在黑名单里';
                    }
                }
                else if (data.message.slice(0,5)==='解除拉黑 '){
                    var qq = parseInt(data.message.slice(5));
                    var rawData = fs.readFileSync('blacklist.json');
                    var blacklist = JSON.parse(rawData);
                    if (blacklist.includes(qq)){
                        blacklist.splice(blacklist.indexOf(qq),1);
                        var newData = JSON.stringify(blacklist);
                        fs.writeFileSync('blacklist.json',newData);
                        reply = '已解除拉黑用户'+qq.toString();
                    }
                    else {
                        reply = '该用户不在黑名单里';
                    }
                }
                else if (data.message.slice(0,3)==='复读 '){
                    reply = data.message.slice(3);
                }
                /*else if (data.message==='unlock image'){
                    fs.writeFileSync('image_lock.txt', 'free');
                }*/
                else if (data.message.slice(0,3)==='退群 '){
                    var gid = parseInt(data.message.slice(3));
                    bot.setGroupLeave(gid);
                    reply = "已退群";
                }
                else if (data.message.slice(0,3)==='传话 '){
                    var content = data.message.slice(3);
                    var raw_gid = content.split(' ')[0];
                    var gid = parseInt(raw_gid);
                    var msg = content.slice(raw_gid.length+1);
                    bot.sendGroupMsg(gid, msg);
                }
                else if (data.message.slice(0,3)==='监听 '){
                    var input_group = parseInt(data.message.slice(3));
                    var output_group = data.group_id;
                    if (input_group!==output_group) {
                        var listen_info = {
                            "input_group": input_group,
                            "output_group": output_group
                        };
                        fs.writeFileSync('listen.json', JSON.stringify(listen_info));
                        reply = `开始监听${input_group}`;
                    }
                }
                else if (data.message==='停止监听') {
                    var listen_info = {"input_group":null, "output_group":null};
                    fs.writeFileSync('listen.json', JSON.stringify(listen_info));
                    reply = `已停止监听`;
                }
                else if (data.message==='群列表') {
                    var groupList = bot.gl;
                    reply = `群数量：${groupList.size}`;
                    for (var [key, value] of groupList) {
                        reply += `\n${value.group_name}(${value.group_id}) ${value.member_count}人`;
                    }
                }
                else if (data.message.slice(0,4)==='加好友 '){
                    var flag = data.message.slice(4);
                    bot.setFriendAddRequest(flag, true);
                }
                else if (data.message.slice(0,3)==='加群 '){
                    var flag = data.message.slice(3);
                    bot.setGroupAddRequest(flag, true);
                }
                else if (data.message.slice(0,8)==='execute '){
                    var command = data.message.slice(8);
                    var result = eval(command);
                    if (result !== undefined) {
                        reply = result;
                    }
                }
            }
            //白名单功能
            if (true){//(data.message_type==='private'||[239313171,863689056,571354212,736375227,701548657,954212429].includes(data.group_id)){
                if (['帮助','help','小助'].includes(data.message)){
                    reply = '发送“帮助+空格+功能名称”可查询其具体指令，如“帮助 摘苹果”\n————功能一览————\n基础功能：关于小助；更新日志；留言\n桌游辅助工具：骰子；拍手游戏工具；游戏规则\n单人游戏：24点，猜数字，猜密码，2047王权，简易能量，迷你战争，摘苹果，竹林冰火人，东方弹破\n多人游戏：柒，阿瓦隆，两个间谍\n画图功能：分形；函数；极坐标；求导；积分\n东方功能：随机东方图；随机东方音乐；东方钢琴谱\n其他功能：点歌，提醒睡觉小助手';
                }
                else if (data.message.includes('[CQ:at,qq='+data.self_id.toString())){
                    reply = "发送“帮助”查看所有功能";
                }
                else if (data.message==='帮助 关于小助'){
                    reply = '-出于兴趣写的机器人，功能比较杂\n-加好友、邀请入群请自便，可能需要验证\n-偶尔会群发广播，如果消息与本群无关勿见怪';
                }
                else if (data.message==='关于小助'){
                    reply = '你肯定没仔细看帮助的第一句话。功能名称!==指令名称，别问为什么';
                }
                else if (data.message==='帮助 骰子'){
                    reply = '.r掷一枚六面骰。.rdx:掷一枚x面骰。.rndx:掷n枚x面骰。';
                }
                /*else if (data.message==='帮助 复读'){
                    reply = '复读+空格+内容';
                }
                else if (data.message==='帮助 图片'){
                    reply = '图片+空格+网址';
                }
                else if (data.message==='帮助 表情'){
                    reply = '复读+空格+表情id';
                }*/
                /*else if (data.message==='帮助 赋值'){
                    reply = '此功能可用于同时出招或有隐藏信息的游戏。\n私聊"赋值 内容"为你的变量赋值。\n内容为空视为删除。\n群聊"查询 @某人"公布其变量的内容。\n"查询 self"公布自己的变量。';
                }*/
                /* else if (data.message==='帮助 牌库工具'){
                    reply = '创建牌库 源牌库名称。已录入的牌库：空牌库、扑克牌、猜牌\n抽牌：抽牌库顶的牌\n抽牌 私聊：如果牌库在群内创建而你不想暴露所抽的牌，请在该群内使用此指令\n弃牌 卡牌名称：将卡牌置入弃牌堆\n洗牌 卡牌名称：将卡牌洗入牌库\n洗混：将弃牌堆洗入牌库';
                }*/
                /*else if (data.message==='帮助 选老婆'){
                    reply = '老婆是谁:从2047生物中随机挑选你的老婆。离婚：抛弃她。';
                }
                else if (data.message==='帮助 随机抽卡'){
                    reply = '随机抽卡+空格+条件。\n抽多张卡：随机抽卡(n)+空格+条件\n条件参考"卡牌检索"';
                }*/
                else if (data.message==='帮助 游戏规则'){
                    reply = '输入"游戏规则"获得列表。输入"游戏规则 游戏名"查看规则';
                }
                /*else if (data.message==='帮助 小游戏'){
                    reply = '已有指令：柒；24点；猜数字；开始能量';
                }*/
                else if (data.message==='帮助 分形'){
                    reply = '分形 边长 半径 参数\n请确保边长>=3, 0<半径<=0.5, -1<参数<1';
                }
                else if (data.message==='帮助 函数'){
                    reply = '函数 方程(如y=x**2)';
                }
                else if (data.message==='帮助 极坐标'){
                    reply = '极坐标 定义域=x(可省略，默认值为30，即-30<T<30) 方程(如R=tan(T))';
                }
                else if (data.message==='帮助 求导'){
                    reply = '求导 方程(如y=x**2)';
                }
                else if (data.message==='帮助 积分'){
                    reply = '积分 方程(如y=x**2)。只能从0积到x，若需要不同的起始值，请修改原函数';
                }
                else if (data.message==='帮助 2047王权'){
                    reply = '私聊发送“王权”即可开始游戏。本游戏不支持群聊。';
                }
                else if (data.message==='帮助 随机东方图'){
                    reply = '发送“touhou”返回随机东方图。发送“touhou (tag)”返回带有给定标签的图，如“touhou reimu”。图库来自img.paulzzh.tech';
                }
                else if (data.message==='帮助 随机东方音乐'){
                    reply = '发送“touhouMusic”返回随机东方音乐（网易云链接）';
                }
                else if (data.message==='帮助 东方钢琴谱'){
                    reply = '发送“搜谱 文件名/关键词/角色名/改编者“。如”搜谱 th06_05“或”搜谱 上海红茶馆“或”搜谱 博丽灵梦“或“搜谱 marasy”\n------------\n整理一些优质的钢琴改编，顺便混入一些私货\n难度评级比较主观\n音频尽量选取墙内链接\n尚未完工，持续添加中';
                }
                else if (data.message==='帮助 阿瓦隆'){
                    reply = '此功能仅在954212429开放。在此群发送“阿瓦隆帮助”获得详细帮助';
                }
                else if (data.message==='帮助 两个间谍'){
                    reply = '发送“游戏规则 两个间谍”获得详细帮助';
                }
                else if (data.message==='帮助 猜数字'){
                    reply = '直接发送”猜数字“';
                }
                else if (data.message==='帮助 猜密码'){
                    reply = '发送”开始猜密码“。你会收到一条包含密码的字符串，而后你每每次给出一个字符串，我告诉你它是否包含密码。你最多有6次机会';
                }
                else if (data.message==='帮助 24点'){
                    reply = '直接发送”24点“。给出的数组保证有解，但没有解24点的功能';
                }
                else if (data.message==='帮助 柒'){
                    reply = '发送”柒“获得详细帮助';
                }
                else if (data.message==='帮助 留言'){
                    reply = '发送“留言 内容”即可将内容转达给我\n**私聊和at我可能收不到**';
                }
                else if (data.message==='帮助 更新日志'){
                    reply = '发送”更新日志“';
                }
                else if (data.message==='帮助 简易能量'){
                    reply = '发送“开始能量”';
                }
                else if (data.message==='帮助 点歌'){
                    reply = '发送“点歌 歌名”。曲库来自网易云音乐';
                }
                else if (data.message==='帮助 拍手游戏工具'){
                    reply = '群聊指令：加入拍手游戏；开始拍手游戏；退出拍手游戏；结束拍手游戏\n私聊指令：出招 xxx';
                }
                else if (data.message==='帮助 迷你战争'){
                    reply = '指令：开始迷你战争；结束迷你战争；进攻+空格+位置（如“进攻 a1”），字母为列数字为行\n查看规则请发送“游戏规则 迷你战争”';
                }
                else if (data.message==='帮助 摘苹果'){
                    reply = '几个学生问哲学家苏格拉底：“人生是什么？”苏格拉底把他们带到一片苹果树林。要求大家从树林的这头走到那头。每人挑选一只自己认为最大最好的苹果。不许走回头路，不许选择两次。\n指令：开始摘苹果；要；不要；摘苹果排行榜';
                }
                else if (data.message==='帮助 竹林冰火人'){
                    reply = '指令：开始竹林冰火人；撤退；重开；公布答案\n任务：让妹红🔥烤一些红薯🍠，让琪露诺🧊冻几只青蛙🐸。小心饥饿的幽幽子👻！\n操作：上/下/左/右。每次三人会朝同一方向移动。\n❌是空地，🌚是墙。';
                }
                else if (data.message==='帮助 东方弹破'){
                    reply = '发送“开始东方弹破”。详细规则发送“游戏规则 东方弹破”查看';
                }
                /*else if (data.message==='帮助 jrcp') {
                    reply = '发送“jrcp”，与一位幸运群友成为cp';
                }*/
                else if (data.message==='ping'){
                    reply = '嘭！';
                }
                else if (data.message==='帮助 提醒睡觉小助手'){
                    reply = '指令：睡觉；起床';
                }
                /*else if (data.message.slice(0,3)==='复读 '){
                    reply = data.message.slice(3);
                }
                else if (data.message.slice(0,3)==='图片 '){
                    reply = img(data.message.slice(3));
                }
                else if (data.message.slice(0,3)==='表情 '){
                    if (!isNaN(data.message.slice(3))){
                        reply = '[CQ:face,id='+data.message.slice(3)+']';
                    }
                }*/
                else if (data.message.slice(0,3)==='赋值 '){
                    if (data.message_type==='private'){
                        var rawData = fs.readFileSync('user_variables.json');
                        var userVariables = JSON.parse(rawData);
                        if (userVariables['lock']===false){
                            userVariables[data.user_id.toString()] = data.message.slice(3);
                            var newData = JSON.stringify(userVariables);
                            fs.writeFileSync('user_variables.json',newData);
                            reply = '修改成功';
                        }
                    }
                    else {
                        reply = '请私聊赋值';
                    }
                }
                else if (data.message.slice(0,3)==='查询 '){
                    if (data.message_type==='group'){
                        if (data.message.slice(3,13)==='[CQ:at,qq='){
                            var targetId = '';
                            for (var i=13;i<data.message.length;i++){
                                if (isNaN(data.message[i])){
                                    targetId = data.message.slice(13,i);
                                    break;
                                }
                            }
                            if (!isNaN(targetId)){
                                var rawData = fs.readFileSync('user_variables.json');
                                var userVariables = JSON.parse(rawData);
                                if (targetId in userVariables){
                                    reply = userVariables[targetId];
                                }
                            }
                        }
                        else if (data.message.slice(3,7)==='self'){
                            var rawData = fs.readFileSync('user_variables.json');
                            var userVariables = JSON.parse(rawData);
                            if (data.user_id.toString() in userVariables){
                                reply = userVariables[data.user_id.toString()];
                            }
                        }
                    }
                    else {
                        reply = '请在群内查询';
                    }
                }
                else if (data.message.slice(0,2)==='.r'){
                    if (data.message.length===2){
                        reply = dice(1,6);
                    }
                    else {
                        for (var i=2; i<data.message.length; i++){
                            if (data.message[i]==='d'){
                                var n = data.message.slice(2, i);
                                var max = data.message.slice(i+1);
                                if (n===''){
                                    n = 1;
                                }
                                else if (!isNaN(n)){
                                    n = parseInt(n);
                                }
                                if (!isNaN(max)){
                                    max = parseInt(max);
                                }
                                if (n <= 30 && n >= 1 && max <= 100 && max >= 1){
                                    reply = dice(n, max);
                                }
                                else {
                                    reply = '数值超出域值';
                                }
                            }
                        }
                    }
                }
                /*else if (data.message==='老婆是谁'){
                    var rawData = fs.readFileSync('2047_wives.json');
                    var wives = JSON.parse(rawData);
                    var wife = '';
                    if (data.user_id.toString() in wives){
                        wife = wives[data.user_id.toString()];
                    }
                    else {
                        var cardsRawData = fs.readFileSync('2047_cards.json');
                        var cards = JSON.parse(cardsRawData);
                        var creatures = [];
                        for (var name in cards){
                            if (cards[name].类别==='生物'){
                                creatures.push(name);
                            }
                        }
                        creatures.push('判官');
                        creatures.push('gogo');
                        creatures.push('跟风狗');
                        wife = creatures[random(0, creatures.length)];
                        wives[data.user_id.toString()] = wife;
                        var newData = JSON.stringify(wives);
                        fs.writeFileSync('2047_wives.json',newData);
                    }
                    var name = data.sender.card? data.sender.card: data.sender.nickname;
                    reply = `${name}的老婆是${wife}`;
                }
                else if (data.message==='离婚'){
                    var rawData = fs.readFileSync('2047_wives.json');
                    var wives = JSON.parse(rawData);
                    if (data.user_id.toString() in wives){
                        var name = data.sender.card? data.sender.card: data.sender.nickname;
                        reply = `${name}抛弃了${wives[data.user_id.toString()]}`;
                        delete wives[data.user_id.toString()];
                        var newData = JSON.stringify(wives);
                        fs.writeFileSync('2047_wives.json',newData);
                    }
                    else {
                        reply = '你还没有结婚';
                    }
                }
                else if (data.message.slice(0,5)==='随机抽卡 '){
                    var cardNames = search(data.message.slice(5));
                    reply = cardNames[random(0,cardNames.length)];
                }
                else if (data.message==='随机抽卡'){
                    var cardNames = search("名称{");
                    reply = cardNames[random(0,cardNames.length)];
                }
                else if (data.message.slice(0,5)==='随机抽卡('){
                    if('23456789'.includes(data.message[5])&&data.message[6]===')'&&data.message[7]===' '){
                        var n = parseInt(data.message[5]);
                        var cardNames = search(data.message.slice(8));
                        for (var i=1;i<=n;i++){
                            reply += cardNames[random(0,cardNames.length)] + ' ';
                        }
                    }
                }*/
                else if (data.message.slice(0,4)==='游戏规则'){
                    var games = ['秘密希特勒','俄罗斯轮盘','元素','十牌','国王大臣','攒钱','政变','柒','猜牌','疯狂年代','瘟疫棋','能量','骷髅','onitama','阿瓦隆','简易能量','迷你战争','东方弹破','两个间谍'];
                    if (data.message.length===4){
                        reply = '收录的游戏有：';
                        for (var i = 0; i<games.length;i++){
                            reply += '\n'+games[i];
                        }
                    }
                    else if (data.message[4]===' ' && games.includes(data.message.slice(5))){
                        reply = `[CQ:image,file=data/image/${data.message.slice(5)}.png]`;
                    }
                }
                else if (data.message==='24点'){
                    var rawDeck = [];
                    for (var i=1;i<=4;i++){
                        for (var j=1;j<=13;j++){
                            rawDeck.push(j.toString());
                        }
                    }
                    var deck = shuffle(rawDeck);
                    var cards = deck.slice(0,4);
                    while(solve(cards)===false){
                        deck = shuffle(rawDeck);
                        cards = deck.slice(0,4);
                    }
                    reply = cards.join(', ');
                }
                else if (data.message==='猜数字'){
                    var rawData = fs.readFileSync('guess_number.json');
                    var games = JSON.parse(rawData);
                    var qid = data.user_id.toString();

                    var digits = [];
                    for (var i=0;i<4;i++){
                        var digit = random(0,10);
                        while (digits.includes(digit)){
                            digit = random(0,10);
                        }
                        digits.push(digit);
                    }
                    var number = digits.join('');

                    games[qid] = number;
                    var newData = JSON.stringify(games);
                    fs.writeFileSync('guess_number.json',newData);
                    reply = '数字已刷新。游戏规则：猜测一个各位不重复的四位数（首位可以是0）abcd。发送“猜数字 abcd”。结果会以“xAyB”的形式呈现。A表示位置和数字都猜对的情况；B表示数字对但位置不对的情况。';
                }
                else if (data.message.length===8 && data.message.slice(0,4)==='猜数字 '){
                    var guess = data.message.slice(4);
                    var valid = true;
                    for (var i=0;i<4;i++){
                        if (isNaN(guess[i])){
                            valid = false;
                            reply = '请输入四位数字';
                            break;
                        }
                        for (var j=0;j<4;j++){
                            if (i!==j && guess[i]===guess[j]){
                                valid = false;
                                reply = '请输入不重复的数字';
                                break;
                            }
                        }
                        if (!valid){
                            break;
                        }
                    }
                    if (valid){
                        var rawData = fs.readFileSync('guess_number.json');
                        var games = JSON.parse(rawData);
                        var qid = data.user_id.toString();
                        if (qid in games) {
                            var answer = games[qid];
                            var strict_correct = 0;
                            var loose_correct = 0;
                            for (var i=0;i<4;i++){
                                if (guess[i]===answer[i]){
                                    strict_correct += 1;
                                }
                                else{
                                    for (var j=0;j<4;j++){
                                        if (j!==i && guess[i]===answer[j]){
                                            loose_correct += 1;
                                        }
                                    }
                                }
                            }
                            if (strict_correct===4){
                                reply = '恭喜你，猜对了！';
                            }
                            else {
                                reply = `${strict_correct}A${loose_correct}B`;
                            }
                        }
                        else {
                            reply = "发送”猜数字“开始游戏";
                        }
                    }
                }
                else if (data.message.slice(0,3)==='分形 '){
                    var width = 500;
                    var height = 500;

                    var canvas = createCanvas(width, height);
                    var context = canvas.getContext('2d');

                    context.fillStyle = '#ffffff';
                    context.fillRect(0, 0, width, height);
                    var parameters = data.message.slice(3).split(' ');
                    var size = parseInt(parameters[0]);
                    var radius = parseFloat(parameters[1])*width;
                    var parameter = parseFloat(parameters[2]);

                    var draw = (pos, color) => {
                        context.beginPath();
                        context.arc(pos[0], pos[1], 1, 0, 2 * Math.PI, false);
                        context.fillStyle = color;
                        context.fill();
                    }

                    var dots = [];

                    var initial = (n, r) => {
                        if (n<3||n>1000||r<0||r>5000) return false;
                        dots = [];
                        var i;
                        for (i = 0; i < n; i ++){
                            var angle = 2 * Math.PI / n;
                            dots[i] = [250 + r * Math.cos(Math.PI / 2 - i * angle), 250 - r * Math.sin(Math.PI / 2 - i * angle)]
                        }
                        dots[n] = [Math.random() * 500, Math.random() * 500];
                        for (i = 0; i <= n; i ++){
                            draw(dots[i], 'black');
                        }
                    }

                    var append_dot = (n, k) => {
                        if (n<3||n>1000||k<-1||k>1) return false;
                        var j;
                        var random_number;
                        for (j = n + 1; j < 100000; j ++){
                            random_number = Math.floor(Math.random() * n); // 随机取顶点之一
                            dots[j] = [dots[j - 1][0] * k + dots[random_number][0] * (1 - k), dots[j - 1][1] * k + dots[random_number][1] * (1 - k)]; // 生成点函数
                            draw(dots[j], 'black');
                        }
                    }

                    initial(size, radius);
                    append_dot(size, parameter);

                    var buffer = canvas.toBuffer('image/jpeg');
                    fs.writeFile('data/image/fractal.jpeg', buffer, function(err){if(err){console.log(err);} sendImage(bot, 'fractal.jpeg', data);})
                    //setTimeout(function(){sendImage(bot, 'fractal.png', data);},2000);
                }
                //柒开始
                else if (data.message==='柒'){
                    reply = '指令一览：\n【游戏规则 柒】查看规则\n【加入柒】加入房间，两人到齐自动开始\n【结束柒】程序没有胜负检测，请自行结束\n【a1】行动。a-g为列，1-7为行。一次发言只提一子；\n一回合操作完毕后发“过”；\n【悔棋】回到上一步的局面';
                }
                else if (data.message==='加入柒'){
                    var rawData = fs.readFileSync('sevn.json');
                    var gameRooms = JSON.parse(rawData);
                    if (data.group_id.toString() in gameRooms){
                        var game = gameRooms[data.group_id.toString()];
                    }
                    else {
                        gameRooms[data.group_id.toString()] = {"units":["🍀","😈","🌟","🌚","🔥","💨","💧"],"empty":"❌","scoreToken":"⭕","players":[],"board":[],"scores":{"🍀":0,"😈":0,"🌟":0,"🌚":0,"🔥":0,"💨":0,"💧":0}};
                        var game = gameRooms[data.group_id.toString()];
                    }
                    if (game.players.length>=2){
                        reply = '游戏已开始';
                    }
                    /*else if (game.players.includes(data.user_id)){
                        reply = '你已经在房间内';
                    }*/
                    else if (game.players.length==0){
                        game.players.push(data.user_id);
                        var newData = JSON.stringify(gameRooms);
                        fs.writeFileSync('sevn.json',newData);
                        reply = '加入成功，你是先手';
                    }
                    else {
                        game.players.push(data.user_id);
                        reply = '加入成功，你是后手\n游戏开始！\n';
                        var rawBoard = [];
                        for (var i=1;i<=7;i++){
                            rawBoard = rawBoard.concat(game.units);
                        }
                        var board = shuffle(rawBoard);
                        game.board = board;
                        reply += display(board);

                        var newData = JSON.stringify(gameRooms);
                        fs.writeFileSync('sevn.json',newData);
                    }
                }
                else if (data.message==='结束柒'){
                    var rawData = fs.readFileSync('sevn.json');
                    var gameRooms = JSON.parse(rawData);
                    if (data.group_id.toString() in gameRooms){
                        var game = gameRooms[data.group_id.toString()];
                        if (game.players.includes(data.user_id)){
                            game.board = [];
                            game.players = [];
                            for (var unit in game.scores){
                                game.scores[unit] = 0;
                            }

                            var newData = JSON.stringify(gameRooms);
                            fs.writeFileSync('sevn.json',newData);

                            reply = '游戏结束';
                        }
                        else {
                            reply = '旁观者不能结束游戏';
                        }
                    }
                    else {
                        reply = '本群没有正在进行的游戏！';
                    }
                }
                else if (data.message.length===2 && 'abcdefg'.includes(data.message[0]) && '1234567'.includes(data.message[1])){
                    var column = {'a':1,'b':2,'c':3,'d':4,'e':5,'f':6,'g':7}[data.message[0]];
                    var row = parseInt(data.message[1]);

                    var rawData = fs.readFileSync('sevn.json');
                    var gameRooms = JSON.parse(rawData);
                    if (data.group_id.toString() in gameRooms){
                        var game = gameRooms[data.group_id.toString()];
                        if (game.players.includes(data.user_id)){
                            var pos = (row-1)*7+column-1;
                            var pick = game.board[pos];
                            if (pick===game.empty){
                                reply = '此处没有棋子！';
                            }
                            else {
                                var cache = {"board":copyList(game.board),"scores":copyDict(game.scores)};
                                gameRooms[data.group_id.toString()+'cache'] = cache;

                                game.board[pos] = game.empty;
                                if (data.user_id===game.players[0]){
                                    game.scores[pick] += 1;
                                }
                                else{
                                    game.scores[pick] -= 1;
                                }
                                reply = display(game.board);
                                reply += '\n比分:';
                                for (var unit in game.scores){
                                    reply += '\n';
                                    if (game.scores[unit]>0){
                                        reply += unit.repeat(game.scores[unit]) + game.scoreToken.repeat(7-game.scores[unit]);
                                    }
                                    else if (game.scores[unit]<0){
                                        reply += game.scoreToken.repeat(7+game.scores[unit]) + unit.repeat(-game.scores[unit]);
                                    }
                                }
                                var newData = JSON.stringify(gameRooms);
                                fs.writeFileSync('sevn.json',newData);
                            }
                        }
                    }
                    else {
                        reply = '本群没有正在进行的游戏！';
                    }
                }
                else if (data.message==='悔棋'){
                    var rawData = fs.readFileSync('sevn.json');
                    var gameRooms = JSON.parse(rawData);
                    if (data.group_id.toString() in gameRooms && data.group_id.toString()+'cache' in gameRooms){
                        var game = gameRooms[data.group_id.toString()];
                        var cache = gameRooms[data.group_id.toString()+'cache'];
                        if (game.players.includes(data.user_id)){
                            game.board = copyList(cache.board);
                            game.scores = copyDict(cache.scores);
                            reply = display(game.board);
                            reply += '\n比分:';
                            for (var unit in game.scores){
                                reply += '\n';
                                if (game.scores[unit]>0){
                                    reply += unit.repeat(game.scores[unit]) + game.scoreToken.repeat(7-game.scores[unit]);
                                }
                                else if (game.scores[unit]<0){
                                    reply += game.scoreToken.repeat(7+game.scores[unit]) + unit.repeat(-game.scores[unit]);
                                }
                            }
                            var newData = JSON.stringify(gameRooms);
                            fs.writeFileSync('sevn.json',newData);
                        }
                    }
                    else {
                        reply = '本群没有正在进行的游戏！';
                    }
                }
                //柒结束
                else if (data.message.slice(0,3)==='函数 '){
                    var func = data.message.slice(3);
                    console.log(func);

                    var width = 500;
                    var height = 500;

                    var canvas = createCanvas(width, height);
                    var context = canvas.getContext('2d');

                    context.fillStyle = '#ffffff';
                    context.fillRect(0,0,500,500);

                    context.fillStyle = '#000000';
                    /*context.beginPath();
                    context.moveTo(0, 250);
                    context.lineTo(500, 250);
                    context.stroke();

                    context.beginPath();
                    context.moveTo(250, 0);
                    context.lineTo(250, 500);
                    context.stroke();

                    context.fillStyle = '#0000ff';*/

                    var drawFunc = function(input){
                        if (!(input.slice(0,2)==='y=')){
                            reply = '方程有误';
                            console.log(1);
                            return;
                        }
                        input = input.slice(2);
                        
                        var sin = Math.sin;
                        var cos = Math.cos;
                        var tan = Math.tan;
                        var abs = Math.abs;
                        var ln = Math.log;
                        var e = Math.E;
                        var pi = Math.PI;
                        var asin = Math.asin;
                        var acos = Math.acos;
                        var atan = Math.atan;
                        var sinh = Math.sinh;
                        var cosh = Math.cosh;
                        var tanh = Math.tanh;
                        var r = Math.random;
                        var floor = Math.floor;
                        for (var ch of input){
                            if (isNaN(ch)&&!('x()+-/*abcefhilnoprst'.includes(ch))){
                                reply = '方程有误';
                                console.log(2);
                                return;
                            }
                        }
                        for (var x=-5;x<5;x+=0.002){
                            try {var y = eval(input);} catch(err){console.log(3);reply = '方程有误';return;}
                            context.fillRect((x+5)*50,500-(y+5)*50,1,1);
                        }
                        var buffer = canvas.toBuffer('image/jpeg');
                        fs.writeFile('data/image/function.jpeg', buffer, function(err){
                            if(err){console.log(err);}
                            sendImage(bot, 'function.jpeg', data);
                        });
                        /*fs.writeFile('data/image/function.jpeg', buffer, function(err){
                            if(err){console.log(err);}
                            images('data/image/function.jpeg')
                                .size(200)
                                .save('data/image/function_cropped.jpeg');
                            sendImage(bot, 'function_cropped.jpeg', data);
                        });*/
                        //setTimeout(function(){sendImage(bot, 'function.png', data);},2000);
                    }

                    drawFunc(func);
                }
                else if (data.message.slice(0,4)==='极坐标 '){
                    var func = data.message.slice(4);

                    var width = 500;
                    var height = 500;

                    var canvas = createCanvas(width, height);
                    var context = canvas.getContext('2d');

                    context.fillStyle = '#ffffff';
                    context.fillRect(0,0,500,500);

                    context.fillStyle = '#000000';
                    /*context.beginPath();
                    context.moveTo(0, 250);
                    context.lineTo(500, 250);
                    context.stroke();

                    context.beginPath();
                    context.moveTo(250, 0);
                    context.lineTo(250, 500);
                    context.stroke();

                    context.fillStyle = '#0000ff';*/

                    var drawFunc = function(input){
                        var D = 30;
                        var elements = input.split(' ');
                        if (elements[0].slice(0,4)==='定义域='){
                            input = elements[1];
                            if (!isNaN(elements[0].slice(4))){
                                D = parseFloat(elements[0].slice(4));
                            }
                            else{
                                reply = '定义域有误';
                                return;
                            }
                        }
                        else {
                            input = elements[0];
                        }
                        
                        if ((!(input.slice(0,2)==='R='))&&(!(input.slice(0,2)==='T='))){
                            reply = '方程有误';
                            return;
                        }
                        
                        var sin = Math.sin;
                        var cos = Math.cos;
                        var tan = Math.tan;
                        var abs = Math.abs;
                        var ln = Math.log;
                        var e = Math.E;
                        var pi = Math.PI;
                        var asin = Math.asin;
                        var acos = Math.acos;
                        var atan = Math.atan;
                        var sinh = Math.sinh;
                        var cosh = Math.cosh;
                        var tanh = Math.tanh;
                        var r = Math.random;
                        var floor = Math.floor;

                        if (input[0]==='R'){
                        	input = input.slice(2);
                        	for (var ch of input){
                        	    if (isNaN(ch)&&!('T()+-/*abcefhilnoprst'.includes(ch))){
                        	        reply = '方程有误';
                        	        return;
                        	    }
                        	}
                        	for (var T=-D;T<D;T+=D/15000){
                        	    try {
                        	    	var R = eval(input);
                        	    	var x = R*cos(T);
                        	    	var y = R*sin(T);
                        	    } 
                        	    catch(err){
                        	    	console.log(err);
                        	    	reply = '方程有误';
                        	    	return;
                        	    }
                        	    context.fillRect((x+5)*50,500-(y+5)*50,1,1);
                        	}
                        }

                        if (input[0]==='T'){
                        	input = input.slice(2);
                        	for (var ch of input){
                        	    if (isNaN(ch)&&!('R()+-/*abcefhilnoprst'.includes(ch))){
                        	        reply = '方程有误';
                        	        return;
                        	    }
                        	}
                        	for (var R=-5*(2**0.5);R<5*(2**0.5);R+=0.002){
                        	    try {
                        	    	var T = eval(input);
                        	    	var x = R*cos(T);
                        	    	var y = R*sin(T);
                        	    } 
                        	    catch(err){
                        	    	console.log(err);
                        	    	reply = '方程有误';
                        	    	return;
                        	    }
                        	    context.fillRect((x+5)*50,500-(y+5)*50,1,1);
                        	}
                        }
                        
                        var buffer = canvas.toBuffer('image/jpeg');
                        fs.writeFile('data/image/polar.jpeg', buffer, function(err){if(err){console.log(err);} sendImage(bot, 'polar.jpeg', data);})
                        //setTimeout(function(){sendImage(bot, 'polar.png', data)},2000);
                    }

                    drawFunc(func);
                }
                /*else if (data.message.slice(0,5)==='创建牌库 '){
                    var deckName = data.message.slice(5);
                    var rawData = fs.readFileSync('draw_card.json');
                    var decks = JSON.parse(rawData);
                    if (deckName in decks.srcDecks){
                        var deck = copyList(decks.srcDecks[deckName]);
                        deck = shuffle(deck);
                        if (data.message_type==='private'){
                            decks[data.user_id.toString()+'p'] = {"deck":deck,"discard":[]};
                            reply = '已为你创建牌库。每个人同时只能存在一套牌库。';
                        }
                        else {
                            decks[data.group_id.toString()] = {"deck":deck,"discard":[]};
                            reply = '已在该群创建牌库。每个群同时只能存在一套牌库。';
                        }
                        var newData = JSON.stringify(decks);
                        fs.writeFileSync('draw_card.json',newData);
                    }
                    else {
                        reply = '未收录该牌库';
                    }
                }
                else if (data.message.slice(0,2)==='抽牌'&&data.group_id!==938996650){
                    var rawData = fs.readFileSync('draw_card.json');
                    var decks = JSON.parse(rawData);
                    if (data.message_type==='private' && (data.user_id.toString()+'p' in decks)){
                        var deck = decks[data.user_id.toString()+'p'].deck;
                        if (deck.length > 0){
                            var card = deck.pop();
                            reply = `你抽到了${card}`;
                            var newData = JSON.stringify(decks);
                            fs.writeFileSync('draw_card.json',newData);
                        }
                        else {
                            reply = '牌库空了';
                        }
                    }
                    else if (data.message_type==='group' && (data.group_id.toString() in decks)){
                        var deck = decks[data.group_id.toString()].deck;
                        if (deck.length > 0){
                            var card = deck.pop();
                            if (data.message.slice(2)===' 私聊'){
                                bot.sendPrivateMsg(data.user_id, `你抽到了${card}`);
                            }
                            else {
                                reply = `你抽到了${card}`;
                            }
                            var newData = JSON.stringify(decks);
                            fs.writeFileSync('draw_card.json',newData);
                        }
                        else {
                            reply = '牌库空了';
                        }
                    }
                    else {
                        reply = '未创建任何牌库';
                    }
                }
                else if (data.message.slice(0,3)==='弃牌 '){
                    var card = data.message.slice(3);
                    var rawData = fs.readFileSync('draw_card.json');
                    var decks = JSON.parse(rawData);
                    if (data.message_type==='private' && (data.user_id.toString()+'p' in decks)){
                        var discard = decks[data.user_id.toString()+'p'].discard;
                        discard.push(card);
                        reply = '已置入弃牌堆';
                        var newData = JSON.stringify(decks);
                        fs.writeFileSync('draw_card.json',newData);
                    }
                    else if (data.message_type==='group' && (data.group_id.toString() in decks)){
                        var discard = decks[data.group_id.toString()].discard;
                        discard.push(card);
                        reply = '已置入弃牌堆';
                        var newData = JSON.stringify(decks);
                        fs.writeFileSync('draw_card.json',newData);
                    }
                    else {
                        reply = '未创建任何牌库';
                    }
                }
                else if (data.message.slice(0,3)==='洗牌 '){
                    var card = data.message.slice(3);
                    var rawData = fs.readFileSync('draw_card.json');
                    var decks = JSON.parse(rawData);
                    if (data.message_type==='private' && (data.user_id.toString()+'p' in decks)){
                        var deck = decks[data.user_id.toString()+'p'].deck;
                        deck.push(card);
                        decks[data.user_id.toString()+'p'].deck = shuffle(deck);
                        reply = '已洗入牌库';
                        var newData = JSON.stringify(decks);
                        fs.writeFileSync('draw_card.json',newData);
                    }
                    else if (data.message_type==='group' && (data.group_id.toString() in decks)){
                        var deck = decks[data.group_id.toString()].deck;
                        deck.push(card);
                        decks[data.group_id.toString()].deck = shuffle(deck);
                        reply = '已洗入牌库';
                        var newData = JSON.stringify(decks);
                        fs.writeFileSync('draw_card.json',newData);
                    }
                    else {
                        reply = '未创建任何牌库';
                    }
                }
                else if (data.message==='洗混'){
                    var rawData = fs.readFileSync('draw_card.json');
                    var decks = JSON.parse(rawData);
                    if (data.message_type==='private' && (data.user_id.toString()+'p' in decks)){
                        var deck = decks[data.user_id.toString()+'p'].deck;
                        var discard = decks[data.user_id.toString()+'p'].discard;
                        deck = deck.concat(discard);
                        decks[data.user_id.toString()+'p'].deck = shuffle(deck);
                        decks[data.user_id.toString()+'p'].discard = [];
                        reply = '已洗混';
                        var newData = JSON.stringify(decks);
                        fs.writeFileSync('draw_card.json',newData);
                    }
                    else if (data.message_type==='group' && (data.group_id.toString() in decks)){
                        var deck = decks[data.group_id.toString()].deck;
                        var discard = decks[data.group_id.toString()].discard;
                        deck = deck.concat(discard);
                        decks[data.group_id.toString()].deck = shuffle(deck);
                        decks[data.group_id.toString()].discard = [];
                        reply = '已洗混';
                        var newData = JSON.stringify(decks);
                        fs.writeFileSync('draw_card.json',newData);
                    }
                    else {
                        reply = '未创建任何牌库';
                    }
                }*/
                /*else if (data.message==='爬塔沙盒'){
                    var rawData = fs.readFileSync('tower_games.json');
                    var games = JSON.parse(rawData);
                    var name = data.sender.card? data.sender.card: data.sender.nickname;
                    games[data.user_id.toString()] = {
                        "self":{
                            "name":name,
                            "a":20,
                            "p":10,
                            "h":100,
                            "maxH":100,
                            "equipments":{
                                "白手":[0,0]
                            },
                            "buff":[null,0],
                            "debuff":[null,0]
                        },
                        "enemy":{
                            "name":"陪练假人",
                            "a":20,
                            "p":10,
                            "h":100,
                            "maxH":100,
                            "equipments":{
                                "白手":[0,0]
                            },
                            "buff":[null,0],
                            "debuff":[null,0]
                        }
                    };
                    var newData = JSON.stringify(games);
                    fs.writeFileSync('tower_games.json',newData);
                    reply = `${name}对阵陪练假人`;
                }
                else if (data.message.slice(0,3)==='出招 '){
                    var rawData = fs.readFileSync('tower_games.json');
                    var games = JSON.parse(rawData);
                    var rawData2 = fs.readFileSync('equipments.json');
                    var equipments = JSON.parse(rawData2);
                    var skill = data.message.slice(3);
                    if (data.user_id.toString() in games){
                        var game = games[data.user_id.toString()];
                        if (skill in equipments && skill in game.self.equipments){
                            var damage = eval(equipments[skill].damage);
                            game.enemy.h -= damage;
                            reply = `你使用${skill}对敌方造成了${damage}点伤害！敌方剩余${game.enemy.h}点生命值`;
                            var enemySkill = Object.keys(game.enemy.equipments)[random(0,Object.keys(game.enemy.equipments).length)];
                            var enemyDamage = eval(equipments[skill].damage);
                            game.self.h -= enemyDamage;
                            reply += `\n敌人使用${enemySkill}对你造成了${enemyDamage}点伤害！你剩余${game.self.h}点生命值`;
                            if (game.self.h <= 0){
                                reply += `\n你被击败了。游戏结束`;
                                delete games[data.user_id.toString()];
                            }
                            else if (game.enemy.h <= 0){
                                reply += `\n你击败了${game.enemy.name}。游戏结束`;
                                delete games[data.user_id.toString()];
                            }
                            var newData = JSON.stringify(games);
                            fs.writeFileSync('tower_games.json',newData);
                        }
                        else {
                            reply = '你没有此装备！';
                        }
                    }
                    else {
                        reply = '你还没开始游戏！';
                    }
                }
                else if (data.message==='查看属性'){
                    var rawData = fs.readFileSync('tower_games.json');
                    var games = JSON.parse(rawData);
                    if (data.user_id.toString() in games){
                        var game = games[data.user_id.toString()];
                        reply = `你的属性：攻击力${game.self.a};潜能${game.self.p};生命值${game.self.h}\n你的装备:${Object.keys(game.self.equipments).join(', ')}\n敌方属性：攻击力${game.enemy.a};潜能${game.enemy.p};生命值${game.enemy.h}\n敌方装备:${Object.keys(game.enemy.equipments).join(', ')}`;
                    }
                    else {
                        reply = '你还没开始游戏！';
                    }
                }*/
                else if (data.message==='随机函数'){
                    reply = randomFunction();
                }
                /*else if (data.message==='两个间谍'){
                    reply = '两人游戏，回合制，轮流出招，每回合可进行两次行动\n回合开始时城市会提供情报点，用于使用部分行动\n行动一览：\n占领：控制所在城市，暴露自身\n移动：移动到相邻城市，隐藏自身\n等待：不动，隐藏自身\n刺杀：在所在城市执行刺杀，若对方在相同城市，你获胜\n定位：情报点-10；暴露对方\n深潜：情报点-20；直到你的下回合开始，你无法被暴露\n准备：情报点-40；你下回合行动次数+1\n刺杀报告：情报点-10；本局游戏中，敌方的刺杀会将其暴露\n快速侦查：情报点-40；本局游戏中，你移动到对方所在的城市后，将其暴露';
                }*/
                else if (data.message==='速度测试'){
                    reply = speedTest();
                }
                else if (data.message_type==='private' && data.message==='老虎机'){
                    reply = slotMachine();
                }
                else if (data.message_type==='private' && data.message.slice(0,6)==='老虎机测试 '){
                    var times = Math.min(parseInt(data.message.slice(6)),10**5);
                    var record = {};
                    for (var i=0;i<times;i++){
                        var result = slotTest().toString();
                        if (result in record){
                            record[result] += 1;
                        }
                        else {
                            record[result] = 1;
                        }
                    }
                    reply = `进行了${times}次测试！最高力量记录如下：`
                    for (var result in record){
                        reply += `\n${result}: ${record[result]}次`;
                    }
                }
                else if (data.message==='开始能量'){
                    var rawData = fs.readFileSync('energy.json');
                    var games = JSON.parse(rawData);
                    if (data.user_id.toString() in games){
                        reply = '游戏已经开始了！请直接发送招式。游戏规则请查阅“游戏规则 简易能量”';
                    }
                    else{
                        games[data.user_id.toString()] = [0,0];
                        reply = '对局开始。请直接发送招式。游戏规则请查阅“游戏规则 简易能量”';
                        var newData = JSON.stringify(games);
                        fs.writeFileSync('energy.json',newData);
                    }
                }
                else if (['能量','攻击','防御'].includes(data.message)){
                    var rawData = fs.readFileSync('energy.json');
                    var games = JSON.parse(rawData);
                    if (data.user_id.toString() in games){
                        var game = games[data.user_id.toString()];
                        //console.log(game);
                        var grandStrat = {
                            '[0,0]':[1,0,0],
                            '[0,1]':[0.6538868491936141,0,0.3461131508063859],
                            '[1,0]':[0.6538868491936141,0.3461131508063859,0],
                            '[1,1]':[0.3077736983872281,0.2215428817416113,0.4706834198711606],
                            '[1,2]':[0.2976268444679678,0.26465829006441965,0.4377148654676126],
                            '[2,1]':[0.2215428817416112,0.2491405381295494,0.5293165801288394],
                            '[2,2]':[0.1905073778718705,0.4047463110640647,0.4047463110640647],
                            '[0,2]':[1,0,0],
                            '[2,0]':[1,0,0]
                        };
                        var strat = grandStrat[JSON.stringify(game)];
                        //console.log(strat);
                        var r = Math.random();
                        //console.log(r);
                        var skill = null;
                        if (r<strat[0]){
                            skill = '能量';
                        }
                        else if (r<1-strat[2]){
                            skill = '攻击';
                        }
                        else{
                            skill = '防御';
                        }
                        var playerSkill = data.message;
                        if (game[1]===0 && playerSkill==='攻击'){
                            reply = '不能作弊哦';
                        }
                        else{
                            reply = `你使用了${playerSkill}\n我使用了${skill}\n`;
                            if (skill==='攻击'&&playerSkill==='能量'){
                                reply += '你输了';
                                delete games[data.user_id.toString()];
                            }
                            else if (skill==='能量'&&playerSkill==='攻击'){
                                reply += '你赢了';
                                delete games[data.user_id.toString()];
                            }
                            else{
                                if (skill==='攻击'){
                                    game[0] -= 1;
                                }
                                if (skill==='能量'){
                                    game[0] += 1;
                                }
                                if (playerSkill==='攻击'){
                                    game[1] -= 1;
                                }
                                if (playerSkill==='能量'){
                                    game[1] += 1;
                                }
                                reply += `能量比${game[1]}:${game[0]}`;
                                if (game[0]===3&&game[1]===3){
                                    reply += '\n平局';
                                    delete games[data.user_id.toString()];
                                }
                                else if (game[0]===3){
                                    reply += '\n你输了';
                                    delete games[data.user_id.toString()];
                                }
                                else if (game[1]===3){
                                    reply += '\n你赢了';
                                    delete games[data.user_id.toString()];
                                }
                            }
                            var newData = JSON.stringify(games);
                            fs.writeFileSync('energy.json',newData);
                        }
                    }
                }
                else if(data.message==='touhou'||data.message.slice(0,7)==='touhou '){
                    var rawData = fs.readFileSync('touhou_cd.json');
                    var cds = JSON.parse(rawData);
                    var qid = data.user_id.toString();
                    var access = true;
                    if (qid in cds) {
                        if ((Date.now()-cds[qid])<10000) {
                            access = false;
                        }
                        else {
                            cds[qid] = Date.now();
                        }
                    }
                    else {
                        cds[qid] = Date.now();
                    }
                    var newData = JSON.stringify(cds);
                    fs.writeFileSync('touhou_cd.json',newData);
                    if (access) {
                        var url;
                        if (data.message==='touhou'){
                            url = 'https://img.paulzzh.tech/touhou/random?type=json';
                        }
                        else{
                            var tag = data.message.slice(7);
                            url = 'https://img.paulzzh.tech/touhou/random?type=json&tag='+tag;
                        }
                        try{
                            fetch(url)
                                .then(res => res.json())
                                .catch((err) => {
                                    sendMsg(bot, "未找到含有该tag的图片", data);
                                })
                                .then(json => {
                                    var newUrl = 'https://img.paulzzh.tech/touhou/konachan/'+((json.jpegurl.slice(21,25)==='jpeg')?'jpeg/':'image/')+json.md5+'.jpg';
                                    //console.log(newUrl);
                                    //var source = json.source;
                                    download(newUrl,'data/image/touhou.jpeg',function(){
                                        // var msg = `来源：${source}\n链接：${newUrl}\n[CQ:image,file=data/image/touhou.jpeg]`;
                                        var msg = "[CQ:image,file=data/image/touhou.jpeg]";
                                        sendMsg(bot, msg, data);
                                    });
                                })
                                .catch((err) => {console.log(err)});
                        }
                        catch(err){
                            console.log(err);
                        }
                    }
                    
                }
                else if(data.message.slice(0,3)==='留言 '){
                    var content = data.message.slice(3);
                    var qid = data.user_id.toString();
                    if (data.message_type==="private") bot.sendGroupMsg(239313171,qid+'说:\n'+content);
                    else bot.sendGroupMsg(239313171,qid+'在'+data.group_id.toString()+'说:\n'+content);
                    reply = "已转达";
                }
                else if(data.message==='更新日志'){
                    var rawData = fs.readFileSync('log.json');
                    var logs = JSON.parse(rawData);
                    var log = '';
                    for (var i=1;i<=5;i++){
                        if(i<=logs.length){
                            log += logs[logs.length-i]+'\n\n';
                        }
                    }
                    log = log.slice(0,log.length-2);
                    reply = log;
                }
                else if(data.message.slice(0,3)==='点歌 '){
                    var name = data.message.slice(3);
                    var url = "https://cloud-music-api-f494k233x-mgod-monkey.vercel.app/search?keywords="+encodeURI(name);
                    try{
                        fetch(url)
                            .then(res => res.json())
                            .catch((err) => {
                                sendMsg(bot, '没找到这首歌...', data);
                            })
                            .then(json => {
                                var songs = json.result.songs;
                                var songId;
                                for (var i=0;i<songs.length;i++){
                                    if(songs[i].name===name){
                                        songId = songs[i].id;
                                        break;
                                    }
                                }
                                if(!songId){
                                    if(songs.length===0){
                                        sendMsg(bot, '没找到这首歌...', data);
                                    }
                                    else {
                                        songId = songs[0].id;
                                    }
                                }
                                //sendMsg(bot,`https://music.163.com/song?id=${songId}`,data);
                                sendMsg(bot,`[CQ:music,type=163,id=${songId}]`,data);
                            })
                            .catch((err) => {
                                console.log(err);
                                sendMsg(bot, '没找到这首歌...', data);
                            });
                    }
                    catch(err){
                        console.log(err);
                    }
                }
                else if(data.message==='touhouMusic'){
                    var rawData = fs.readFileSync('touhouMusic.json');
                    var music = JSON.parse(rawData);
                    var musicId = music[random(0,music.length)];
                    //reply = `https://music.163.com/song?id=${musicId}`;
                    reply = `[CQ:music,type=163,id=${musicId}]`;
                }
                else if (data.message==='开始猜密码'){
                    var rawData = fs.readFileSync('substring.json');
                    var games = JSON.parse(rawData);
                    if (data.user_id.toString() in games){
                        var game = games[data.user_id.toString()];
                        reply = `游戏已经开始了！请发送“猜密码 (你的猜测)”，我会告诉你答案是否在其中。你已猜测${game.guess}次`;
                    }
                    else{
                        var string = ''
                        for (var i=0;i<10;i++){
                            string += random(0,10).toString();
                        }
                        var index1 = random(0,10);
                        var index2 = random(0,9);
                        if(index2>=index1){
                            index2+=1;
                        }
                        else{
                            var temp = index1;
                            index1 = index2;
                            index2 = temp;
                        }
                        var key = string.slice(index1, index2);
                        games[data.user_id.toString()] = {"key":key,"guess":0};
                        reply = `对局开始。初始字符串是${string}\n请发送“猜密码 (你的猜测)”，我会告诉你答案是否在其中`;
                        var newData = JSON.stringify(games);
                        fs.writeFileSync('substring.json',newData);
                    }
                }
                else if(data.message.slice(0,4)==='猜密码 '){
                    var guess = data.message.slice(4);
                    var rawData = fs.readFileSync('substring.json');
                    var games = JSON.parse(rawData);
                    if (data.user_id.toString() in games){
                        var game = games[data.user_id.toString()];
                        game.guess += 1;
                        var answer;
                        if(guess===game.key){
                            reply = `恭喜你，猜对了！你猜了${game.guess}次`;
                            delete games[data.user_id.toString()];
                        }
                        else{
                            if(game.guess>=6){
                                reply = `你没有猜对。你的机会用完了，游戏结束。本局的密码是${game.key}`;
                                delete games[data.user_id.toString()];
                            }
                            else if(guess.includes(game.key)){
                                reply = `${guess}包含密码`;
                            }
                            else{
                                reply = `${guess}不包含密码`;
                            }
                        }
                        var newData = JSON.stringify(games);
                        fs.writeFileSync('substring.json',newData);
                    }
                    else{
                        reply = '你还没开始游戏！请发送“开始猜密码”';
                    }
                }
                else if(data.message_type==='group' && data.message==='加入拍手游戏'){
                    var rawData = fs.readFileSync('hcgames.json');
                    var games = JSON.parse(rawData);
                    if (data.user_id.toString() in games.players){
                        reply = `你已经加入了${games.players[data.user_id.toString()]}号房间！`;
                    }
                    else {
                        if (!(data.group_id.toString() in games.groups)){
                            games.groups[data.group_id.toString()] = {players:{},started:false};
                        }
                        var game = games.groups[data.group_id.toString()];
                        if (game.started){
                            reply = '加入失败。游戏已开始';
                        }
                        else {
                            game.players[data.user_id.toString()]={
                                nickname:(data.sender.card)?data.sender.card:data.sender.nickname,
                                moved:false,
                                skill:null
                            };
                            games.players[data.user_id.toString()] = data.group_id;
                            reply = `加入成功。房间现有${Object.keys(game.players).length}名玩家`;
                        }
                    }
                    var newData = JSON.stringify(games);
                    fs.writeFileSync('hcgames.json',newData);
                }
                else if(data.message_type==='group' && data.message==='开始拍手游戏'){
                    var rawData = fs.readFileSync('hcgames.json');
                    var games = JSON.parse(rawData);
                    if (!(data.group_id.toString() in games.groups)){
                        reply = '本群还没有创建房间！';
                    }
                    else if (!(data.user_id.toString() in games.groups[data.group_id.toString()].players)){
                        reply = '你尚未加入房间！';
                    }
                    else if (games.groups[data.group_id.toString()].started){
                        reply = '游戏已开始！';
                    }
                    else {
                        games.groups[data.group_id.toString()].started = true;
                        reply = '游戏开始！请私聊发送“出招 xxx”';
                    }
                    var newData = JSON.stringify(games);
                    fs.writeFileSync('hcgames.json',newData);
                }
                else if(data.message_type==='group' && data.message==='退出拍手游戏'){
                    var rawData = fs.readFileSync('hcgames.json');
                    var games = JSON.parse(rawData);
                    if (!(data.group_id.toString() in games.groups)){
                        reply = '本群还没有创建房间！';
                    }
                    else if (!(data.user_id.toString() in games.groups[data.group_id.toString()].players)){
                        reply = '你尚未加入房间！';
                    }
                    else {
                        reply = '退出成功';
                        delete games.groups[data.group_id.toString()].players[data.user_id.toString()];
                        if (Object.keys(games.groups[data.group_id.toString()].players).length<=1){
                            for (var player in games.groups[data.group_id.toString()].players){
                                delete games.players[player];
                            }
                            delete games.groups[data.group_id.toString()];
                            reply += '\n因人数不足，本群房间自动关闭';
                        }
                        delete games.players[data.user_id.toString()];
                    }
                    var newData = JSON.stringify(games);
                    fs.writeFileSync('hcgames.json',newData);
                }
                else if(data.message_type==='group' && data.message==='结束拍手游戏'){
                    var rawData = fs.readFileSync('hcgames.json');
                    var games = JSON.parse(rawData);
                    if (!(data.group_id.toString() in games.groups)){
                        reply = '本群还没有创建房间！';
                    }
                    else if (!(data.user_id.toString() in games.groups[data.group_id.toString()].players)){
                        reply = '房间内的玩家才能结束游戏！你不在房间内';
                    }
                    else {
                        for (var player in games.groups[data.group_id.toString()].players){
                            delete games.players[player];
                        }
                        delete games.groups[data.group_id.toString()];
                        reply = '游戏结束，房间解散';
                    }
                    var newData = JSON.stringify(games);
                    fs.writeFileSync('hcgames.json',newData);
                }
                else if(data.message_type==='private' && data.message.slice(0,3)==='出招 '){
                    var skill = data.message.slice(3);
                    var rawData = fs.readFileSync('hcgames.json');
                    var games = JSON.parse(rawData);
                    if (!(data.user_id.toString() in games.players)){
                        reply = '你还未加入任何游戏！';
                    }
                    else{
                        var roomID = games.players[data.user_id.toString()];
                        //var game = games.groups[roomID.toString()];
                        if (!games.groups[roomID.toString()].started){
                            reply = '游戏尚未开始';
                        }
                        else {
                            //var player = game.players[data.user_id.toString()];
                            if ((!games.groups[roomID.toString()].players[data.user_id.toString()].moved) && games.groups[roomID.toString()].players[data.user_id.toString()].skill===null){
                                games.groups[roomID.toString()].players[data.user_id.toString()].skill = skill;
                                games.groups[roomID.toString()].players[data.user_id.toString()].moved = true;
                                reply = '操作成功';
                                var needOperation = true;
                                for (var p in games.groups[roomID.toString()].players){
                                    if (!games.groups[roomID.toString()].players[p].moved){
                                        needOperation = false;
                                        break;
                                    }
                                }
                                //console.log(needOperation);
                                if (needOperation){
                                    var msg = '出招公布：';
                                    for (var p in games.groups[roomID.toString()].players){
                                        msg += `\n${games.groups[roomID.toString()].players[p].nickname}：${games.groups[roomID.toString()].players[p].skill}`;
                                    }
                                    bot.sendGroupMsg(roomID,msg);
                                    for (var p in games.groups[roomID.toString()].players){
                                        games.groups[roomID.toString()].players[p].skill = null;
                                        games.groups[roomID.toString()].players[p].moved = false;
                                    }
                                }
                                var newData = JSON.stringify(games);
                                fs.writeFileSync('hcgames.json',newData);
                            }
                            else{
                                reply = '你已经出过招了';
                            }
                        }
                    }
                }
                else if(data.message==='开始迷你战争'){
                    var rawData = fs.readFileSync('miniWar.json');
                    var games = JSON.parse(rawData);
                    if (data.user_id.toString() in games){
                        reply = '游戏已经开始！';
                    }
                    else {
                        games[data.user_id.toString()] = [];
                        var board = games[data.user_id.toString()];
                        for (var i=0;i<7;i++){
                            board.push([]);
                            for (var j=0;j<7;j++){
                                board[i].push('❌');
                            }
                        }
                        var starting_points = [];
                        for (var i=0;i<14;i++){
                            var point = random(0,49);
                            while (starting_points.includes(point)){
                                point = random(0,49);
                            }
                            starting_points.push(point);
                        }
                        var icons = ["🍀","😈","🌟","🌚","🔥","💨","💧"];
                        icons = icons.concat(icons);
                        for (var index in icons){
                            var point = starting_points[index];
                            var row = Math.floor(point/7);
                            var column = point%7;
                            board[row][column] = icons[index];
                        }
                        reply = '游戏开始。你扮演🍀';
                        for (var i=0;i<7;i++){
                            reply += '\n'+board[i].join('');
                        }
                        var newData = JSON.stringify(games);
                        fs.writeFileSync('miniWar.json',newData);
                    }
                }
                else if (data.message==='结束迷你战争'){
                    var rawData = fs.readFileSync('miniWar.json');
                    var games = JSON.parse(rawData);
                    if (data.user_id.toString() in games){
                        delete games[data.user_id.toString()];
                        reply = '已结束';
                        var newData = JSON.stringify(games);
                        fs.writeFileSync('miniWar.json',newData);
                    }
                    else {
                        reply = '你不在任何游戏中！';
                    }
                }
                else if (data.message.slice(0,3)==='进攻 '){
                    var rawData = fs.readFileSync('miniWar.json');
                    var games = JSON.parse(rawData);
                    if (data.user_id.toString() in games){
                        var board = games[data.user_id.toString()];
                        var row = parseInt(data.message[4])-1;
                        var column = {'a':0,'b':1,'c':2,'d':3,'e':4,'f':5,'g':6}[data.message[3]];
                        //检测能否进攻
                        if (board[row][column]==='🍀'){
                            reply = '你无法进攻你自己的领土';
                        }
                        else{
                            var canAttack = false;
                            if (row>=1 && board[row-1][column]==='🍀'){
                                canAttack = true;
                            }
                            if (row<=5 && board[row+1][column]==='🍀'){
                                canAttack = true;
                            }
                            if (column>=1 && board[row][column-1]==='🍀'){
                                canAttack = true;
                            }
                            if (column<=5 && board[row][column+1]==='🍀'){
                                canAttack = true;
                            }
                            if (canAttack){
                                var endGame = false;

                                const winDetect = function(icon){
                                    var unit = 0;
                                    for (var i=0;i<7;i++){
                                        for (var j=0;j<7;j++){
                                            if (board[i][j]===icon){
                                                unit += 1;
                                            }
                                        }
                                    }
                                    return (unit>=28);
                                }

                                const removeUnit = function(){
                                    var removeList = [];
                                    for (var i=0;i<7;i++){
                                        for (var j=0;j<7;j++){
                                            //console.log(i+' '+j);
                                            if (board[i][j]!=='❌'){
                                                var needRemoval = true;
                                                if (i>=1 && (board[i-1][j]===board[i][j] || board[i-1][j]==='❌')){
                                                    needRemoval = false;
                                                }
                                                if (i<=5 && (board[i+1][j]===board[i][j] || board[i+1][j]==='❌')){
                                                    needRemoval = false;
                                                }
                                                if (j>=1 && (board[i][j-1]===board[i][j] || board[i][j-1]==='❌')){
                                                    needRemoval = false;
                                                }
                                                if (j<=5 && (board[i][j+1]===board[i][j] || board[i][j+1]==='❌')){
                                                    needRemoval = false;
                                                }
                                                if (needRemoval){
                                                    //console.log('removed: '+i+' '+j);
                                                    removeList.push([i,j]);
                                                }
                                            }
                                        }
                                    }
                                    console.log(removeList);
                                    if (removeList.length===0){
                                        return;
                                    }
                                    for (var pos of removeList){
                                        board[pos[0]][pos[1]] = '❌';
                                    }
                                }

                                reply = '';
                                if (board[row][column]==='❌'){
                                    reply += `你占领了无人区${data.message.slice(3)}`;
                                    board[row][column] = '🍀'
                                }
                                else{
                                    var neighbors = 0;
                                    if (row>=1 && board[row-1][column]==='🍀'){
                                        neighbors+=1;
                                    }
                                    if (row<=5 && board[row+1][column]==='🍀'){
                                        neighbors+=1;
                                    }
                                    if (column>=1 && board[row][column-1]==='🍀'){
                                        neighbors+=1;
                                    }
                                    if (column<=5 && board[row][column+1]==='🍀'){
                                        neighbors+=1;
                                    }
                                    if (Math.random()>0.8-neighbors*0.2){
                                        reply += `成功占领${data.message.slice(3)}`;
                                        board[row][column] = '🍀'
                                    }
                                    else {
                                        reply += `进攻${data.message.slice(3)}失败`;
                                    }
                                }
                                if (winDetect('🍀')){
                                    reply += '\n你赢了';
                                    endGame = true;
                                }
                                else{
                                    removeUnit();
                                    //检测能否再次进攻
                                    var bonus = random(0,49);
                                    var r = Math.floor(bonus/7);
                                    var c = bonus%7;
                                    var canMove = true;
                                    if (board[r][c]!=='🍀'){
                                        canMove = false;
                                    }
                                    if (r>=1 && ["😈","🌟","🌚","🔥","💨","💧"].includes(board[r-1][c])){
                                        canMove = false;
                                    }
                                    if (r<=5 && ["😈","🌟","🌚","🔥","💨","💧"].includes(board[r+1][c])){
                                        canMove = false;
                                    }
                                    if (c>=1 && ["😈","🌟","🌚","🔥","💨","💧"].includes(board[r][c-1])){
                                        canMove = false;
                                    }
                                    if (c<=5 && ["😈","🌟","🌚","🔥","💨","💧"].includes(board[r][c+1])){
                                        canMove = false;
                                    }
                                    if (canMove){
                                        reply += '\n你可以再次进攻';
                                    }
                                    else{
                                        //电脑行动
                                        const miniWarMove = function(icon){
                                            console.log(icon+'开始行动');
                                            var targets = {1:[],2:[],3:[],4:[]};
                                            for (var i=0;i<7;i++){
                                                for (var j=0;j<7;j++){
                                                    //console.log(i+' '+j);
                                                    var priority = (board[i][j]!==icon&&board[i][j]!=='❌')*((i>=1 && board[i-1][j]===icon)+(i<=5 && board[i+1][j]===icon)+(j>=1 && board[i][j-1]===icon)+(j<=5 && board[i][j+1]===icon))+(board[i][j]==='❌')*((i>=1 && board[i-1][j]===icon)||(i<=5 && board[i+1][j]===icon)||(j>=1 && board[i][j-1]===icon)||(j<=5 && board[i][j+1]===icon))*2;
                                                    //console.log(couldBeTarget);
                                                    //console.log(targets);
                                                    if (priority){
                                                        targets[priority].push([i,j]);
                                                    }
                                                    //console.log(targets);
                                                }
                                            }
                                            for (var i=1;i<=4;i++){
                                                targets[i] = shuffle(targets[i]);
                                            }
                                            targets = targets[4].concat(targets[3]).concat(targets[2]).concat(targets[1]);
                                            //console.log(targets);
                                            if (targets.length===0){
                                                return;
                                            }
                                            var target = targets[0];
                                            console.log(target);
                                            if (board[target[0]][target[1]]==='❌'){
                                                board[target[0]][target[1]] = icon;
                                            }
                                            else {
                                                var neighbors = 0;
                                                if (row>=1 && board[row-1][column]===icon){
                                                    neighbors+=1;
                                                }
                                                if (row<=5 && board[row+1][column]===icon){
                                                    neighbors+=1;
                                                }
                                                if (column>=1 && board[row][column-1]===icon){
                                                    neighbors+=1;
                                                }
                                                if (column<=5 && board[row][column+1]===icon){
                                                    neighbors+=1;
                                                }
                                                if (Math.random()>0.8-neighbors*0.2){
                                                    board[target[0]][target[1]] = icon;
                                                }
                                            }
                                            console.log('invasion ends');
                                            if (winDetect(icon)){
                                                reply += `${icon}赢了`;
                                                endGame = true;
                                            }
                                            else {
                                                console.log('win detect ends');
                                                removeUnit();
                                                console.log('remove unit ends');
                                                //电脑的bonus
                                                var bonus = random(0,49);
                                                var r = Math.floor(bonus/7);
                                                var c = bonus%7;
                                                console.log(r+' '+c);
                                                var canMove = true;
                                                if (board[r][c]!==icon){
                                                    canMove = false;
                                                }
                                                if (r>=1 && ![icon,'❌'].includes(board[r-1][c])){
                                                    canMove = false;
                                                }
                                                if (r<=5 && ![icon,'❌'].includes(board[r+1][c])){
                                                    canMove = false;
                                                }
                                                if (c>=1 && ![icon,'❌'].includes(board[r][c-1])){
                                                    canMove = false;
                                                }
                                                if (c<=5 && ![icon,'❌'].includes(board[r][c+1])){
                                                    canMove = false;
                                                }
                                                console.log(canMove);
                                                if (canMove){
                                                    miniWarMove(icon);
                                                }
                                            }
                                        }

                                        //console.log('电脑开始行动');

                                        for (var icon of ["😈","🌟","🌚","🔥","💨","💧"]){
                                            miniWarMove(icon);
                                            //console.log(icon+'行动完毕');
                                        }
                                    }
                                }
                                for (var i=0;i<7;i++){
                                    reply += '\n'+board[i].join('');
                                }
                                if (endGame){
                                    delete games[data.user_id.toString()];
                                }
                                var newData = JSON.stringify(games);
                                fs.writeFileSync('miniWar.json',newData);
                            }
                            else{
                                reply = '你无法进攻与你不接壤的地区';
                            }
                        }
                    }
                    else{
                        reply = '你还没开始游戏！';
                    }
                }
                else if (data.message==='开始摘苹果'){
                    var rawData = fs.readFileSync('apple.json');
                    var games = JSON.parse(rawData);
                    if (data.user_id.toString() in games){
                        reply = '游戏已经开始！';
                    }
                    else {
                        var game = {};
                        game.sequence = shuffle([0,1,2,3,4,5,6,7,8,9]);
                        game.apples = [5,null,null,null,null,null,null,null,null,null];
                        game.index = 0;
                        reply = "第1个苹果大小为5，你要吗？";
                        games[data.user_id.toString()] = game;
                        var newData = JSON.stringify(games);
                        fs.writeFileSync('apple.json',newData);
                    }
                }
                else if (data.message==='不要'){
                    var rawData = fs.readFileSync('apple.json');
                    var games = JSON.parse(rawData);
                    if (data.user_id.toString() in games){
                        var game = games[data.user_id.toString()];
                        game.index += 1;
                        var floor = 0;
                        var ceiling = 10;
                        for (var i=0;i<game.index;i++){
                            if (game.sequence[i]<game.sequence[game.index]){
                                floor = Math.max(floor,game.apples[i]);
                            }
                            else if (game.sequence[i]>game.sequence[game.index]){
                                ceiling = Math.min(ceiling,game.apples[i]);
                            }
                        }
                        game.apples[game.index] = floor+Math.random()*(ceiling-floor);
                        if (game.index===9){
                            reply = `你不得不拿最后一个苹果。它是十个苹果里第${10-game.sequence[9]}大的。`;
                            var rawData2 = fs.readFileSync('apple_record.json');
                            var record = JSON.parse(rawData2);
                            if (data.user_id.toString() in record){
                                record[data.user_id.toString()].push(10-game.sequence[9]);
                            }
                            else {
                                record[data.user_id.toString()] = [10-game.sequence[9]];
                            }
                            var newData2 = JSON.stringify(record);
                            fs.writeFileSync('apple_record.json',newData2);
                            /*var total = 0;
                            var times = 0;
                            for (var score of record[data.user_id.toString()]){
                                total += score;
                                times += 1;
                            }
                            var average = total/times;
                            reply += `你的平均战绩是${average}`;*/
                            var total = 0;
                            var average = 0;
                            if (record[data.user_id.toString()].length >= 20){
                                for (var i=0; i<20; i++){
                                    total += record[data.user_id.toString()][i];
                                }
                                average = total/20;
                                for (var i=20; i<record[data.user_id.toString()].length; i++){
                                    average = (average*19+record[data.user_id.toString()][i])/20;
                                }
                            }
                            else {
                                for (var i=0; i<record[data.user_id.toString()].length; i++){
                                    total += record[data.user_id.toString()][i];
                                }
                                average = total/record[data.user_id.toString()].length;
                            }
                            reply += `你的分数是${average.toFixed(3)}`;
                            delete games[data.user_id.toString()];
                        }
                        else {
                            console.log(game);
                            reply = `第${game.index+1}个苹果大小为${game.apples[game.index].toFixed(5)}，你要吗？`;
                            games[data.user_id.toString()] = game;
                        }
                        var newData = JSON.stringify(games);
                        fs.writeFileSync('apple.json',newData);
                    }
                }
                else if (data.message==='要'){
                    var rawData = fs.readFileSync('apple.json');
                    var games = JSON.parse(rawData);
                    if (data.user_id.toString() in games){
                        var game = games[data.user_id.toString()];
                        reply = `这个苹果是十个里面第${10-game.sequence[game.index]}大的。`;
                        var rawData2 = fs.readFileSync('apple_record.json');
                        var record = JSON.parse(rawData2);
                        if (data.user_id.toString() in record){
                            record[data.user_id.toString()].push(10-game.sequence[game.index]);
                        }
                        else {
                            record[data.user_id.toString()] = [10-game.sequence[game.index]];
                        }
                        /*var total = 0;
                        var times = 0;
                        for (var score of record[data.user_id.toString()]){
                            total += score;
                            times += 1;
                        }
                        var average = total/times;*/
                        var total = 0;
                        var average = 0;
                        if (record[data.user_id.toString()].length >= 20){
                            for (var i=0; i<20; i++){
                                total += record[data.user_id.toString()][i];
                            }
                            average = total/20;
                            for (var i=20; i<record[data.user_id.toString()].length; i++){
                                average = (average*19+record[data.user_id.toString()][i])/20;
                            }
                        }
                        else {
                            for (var i=0; i<record[data.user_id.toString()].length; i++){
                                total += record[data.user_id.toString()][i];
                            }
                            average = total/record[data.user_id.toString()].length;
                        }
                        reply += `你的分数是${average.toFixed(3)}`;
                        var newData2 = JSON.stringify(record);
                        fs.writeFileSync('apple_record.json',newData2);
                        delete games[data.user_id.toString()];
                        var newData = JSON.stringify(games);
                        fs.writeFileSync('apple.json',newData);
                    }
                }
                else if (data.message==='摘苹果排行榜'){
                    var rawData = fs.readFileSync('apple_record.json');
                    var record = JSON.parse(rawData);
                    if ((data.user_id.toString() in record) && (record[data.user_id.toString()].length >= 20)){
                        var scores = [];
                        for (var qid in record){
                            /*var total = 0;
                            for (var score of record[qid]){
                                total += score;
                            }
                            var times = record[qid].length;
                            var average = total/times;
                            if (times >= 20){
                                scores.push([average, qid, times]);
                            }*/
                            var total = 0;
                            var average = 0;
                            if (record[qid].length >= 20){
                                for (var i=0; i<20; i++){
                                    total += record[qid][i];
                                }
                                average = total/20;
                                for (var i=20; i<record[qid].length; i++){
                                    average = (average*19+record[qid][i])/20;
                                }
                                scores.push([average, qid, record[qid].length]);
                            }
                        }
                        scores = scores.sort();
                        reply = '';
                        for (var i=0;i<3;i++){
                            reply += `${scores[i][1]}摘了${scores[i][2]}个苹果，得分${scores[i][0].toFixed(3)}，排名第${i+1}\n`;
                        }
                        var player_index;
                        for (var i=0;i<scores.length;i++){
                            if (scores[i][1]===data.user_id.toString()){
                                player_index = i;
                            }
                        }
                        if (player_index>=4){
                            reply += `\n${scores[player_index-1][1]}摘了${scores[player_index-1][2]}个苹果，得分${scores[player_index-1][0].toFixed(3)}，排名第${player_index}`;
                        }
                        reply += `\n你摘了${scores[player_index][2]}个苹果，得分${scores[player_index][0].toFixed(3)}，排名第${player_index+1}`;
                        if (player_index>=2 && player_index<scores.length-1){
                            reply += `\n${scores[player_index+1][1]}摘了${scores[player_index+1][2]}个苹果，得分${scores[player_index+1][0].toFixed(3)}，排名第${player_index+2}`;
                        }
                    }
                    else {
                        reply = '你需要摘至少20个苹果才能进入排行榜\n';
                        if (data.user_id.toString() in record){
                            reply += `你已摘了${record[data.user_id.toString()].length}个苹果`;
                        }
                        else {
                            reply += '你还没摘任何苹果';
                        }
                    }
                }
                else if (data.message.slice(0,3)==='求导 '){
                    var func = data.message.slice(3);
                    console.log(func);

                    var width = 500;
                    var height = 500;

                    var canvas = createCanvas(width, height);
                    var context = canvas.getContext('2d');

                    context.fillStyle = '#ffffff';
                    context.fillRect(0,0,500,500);

                    context.fillStyle = '#000000';
                    /*context.beginPath();
                    context.moveTo(0, 250);
                    context.lineTo(500, 250);
                    context.stroke();

                    context.beginPath();
                    context.moveTo(250, 0);
                    context.lineTo(250, 500);
                    context.stroke();

                    context.fillStyle = '#0000ff';*/

                    var drawFunc = function(input){
                        if (!(input.slice(0,2)==='y=')){
                            reply = '方程有误';
                            console.log(1);
                            return;
                        }
                        input = input.slice(2);
                        
                        var sin = Math.sin;
                        var cos = Math.cos;
                        var tan = Math.tan;
                        var abs = Math.abs;
                        var ln = Math.log;
                        var e = Math.E;
                        var pi = Math.PI;
                        var asin = Math.asin;
                        var acos = Math.acos;
                        var atan = Math.atan;
                        var sinh = Math.sinh;
                        var cosh = Math.cosh;
                        var tanh = Math.tanh;
                        var r = Math.random;
                        var floor = Math.floor;
                        for (var ch of input){
                            if (isNaN(ch)&&!('x()+-/*abcefhilnoprst'.includes(ch))){
                                reply = '方程有误';
                                console.log(2);
                                return;
                            }
                        }
                        var x = -5.002;
                        var y = 0;
                        while (x<5){
                            try {
                                y = eval(input);
                                var y1 = y;
                                x += 0.002;
                                y = eval(input);
                                var y2 = y;
                                y = (y2 - y1)/0.002;
                            } 
                            catch(err){
                                console.log(3);
                                reply = '方程有误';
                                return;
                            }
                            context.fillRect((x+5)*50,500-(y+5)*50,1,1);
                        }
                        var buffer = canvas.toBuffer('image/jpeg');
                        fs.writeFile('data/image/derivative.jpeg', buffer, function(err){
                            if(err){console.log(err);}
                            sendImage(bot, 'derivative.jpeg', data);
                        });
                    }

                    drawFunc(func);
                }
                else if (data.message.slice(0,3)==='积分 '){
                    var func = data.message.slice(3);
                    console.log(func);

                    var width = 500;
                    var height = 500;

                    var canvas = createCanvas(width, height);
                    var context = canvas.getContext('2d');

                    context.fillStyle = '#ffffff';
                    context.fillRect(0,0,500,500);

                    context.fillStyle = '#000000';
                    /*context.beginPath();
                    context.moveTo(0, 250);
                    context.lineTo(500, 250);
                    context.stroke();

                    context.beginPath();
                    context.moveTo(250, 0);
                    context.lineTo(250, 500);
                    context.stroke();

                    context.fillStyle = '#0000ff';*/

                    var drawFunc = function(input){
                        if (!(input.slice(0,2)==='y=')){
                            reply = '方程有误';
                            console.log(1);
                            return;
                        }
                        input = input.slice(2);
                        
                        var sin = Math.sin;
                        var cos = Math.cos;
                        var tan = Math.tan;
                        var abs = Math.abs;
                        var ln = Math.log;
                        var e = Math.E;
                        var pi = Math.PI;
                        var asin = Math.asin;
                        var acos = Math.acos;
                        var atan = Math.atan;
                        var sinh = Math.sinh;
                        var cosh = Math.cosh;
                        var tanh = Math.tanh;
                        var r = Math.random;
                        var floor = Math.floor;
                        for (var ch of input){
                            if (isNaN(ch)&&!('x()+-/*abcefhilnoprst'.includes(ch))){
                                reply = '方程有误';
                                console.log(2);
                                return;
                            }
                        }
                        context.fillRect(250,250,1,1); // (0,0)
                        var total = 0;
                        for (var x=0.002;x<5;x+=0.002){ // x>0
                            try {
                                var y = eval(input);
                                total += y*0.002;
                            } catch(err){
                                console.log(3);
                                reply = '方程有误';
                                return;
                            }
                            context.fillRect((x+5)*50,500-(total+5)*50,1,1);
                        }
                        total = 0;
                        for (var x=-0.002;x>-5;x-=0.002){ // x<0
                            try {
                                var y = eval(input);
                                total -= y*0.002;
                            } catch(err){
                                console.log(3);
                                reply = '方程有误';
                                return;
                            }
                            context.fillRect((x+5)*50,500-(total+5)*50,1,1);
                        }
                        var buffer = canvas.toBuffer('image/jpeg');
                        fs.writeFile('data/image/integral.jpeg', buffer, function(err){
                            if(err){console.log(err);}
                            sendImage(bot, 'integral.jpeg', data);
                        });
                    }

                    drawFunc(func);
                }
                else if (data.message==='睡觉'){
                    var rawData = fs.readFileSync('sleep.json');
                    var sleepTimes = JSON.parse(rawData);
                    if (data.user_id.toString() in sleepTimes){
                        reply = '睡觉玩手机是不好的哦';
                    }
                    else {
                        sleepTimes[data.user_id.toString()] = Date.now();
                        var newData = JSON.stringify(sleepTimes);
                        fs.writeFileSync('sleep.json',newData);
                        reply = '晚安';
                    }
                }
                else if (data.message==='起床'){
                    var rawData = fs.readFileSync('sleep.json');
                    var sleepTimes = JSON.parse(rawData);
                    if (data.user_id.toString() in sleepTimes){
                        var sleepTime = sleepTimes[data.user_id.toString()];
                        var duration = Date.now()-sleepTime;
                        var seconds = Math.floor(duration/1000);
                        var minutes = Math.floor(seconds/60);
                        seconds -= minutes * 60;
                        var hours = Math.floor(minutes/60);
                        minutes -= hours * 60;
                        reply = `你睡了${hours}小时${minutes}分钟${seconds}秒，真是美好的一觉呢`;
                        delete sleepTimes[data.user_id.toString()];
                        var newData = JSON.stringify(sleepTimes);
                        fs.writeFileSync('sleep.json',newData);
                    }
                    else {
                        reply = '你还没有睡觉！';
                    }
                }
                else if (data.message.slice(0,3)==='搜谱 '){
                    //var rawData = fs.readFileSync('touhou_arrange.json');
                    //var arranges = JSON.parse(rawData);

                    var url = "https://bloak.github.io/touhou_arrange.json";
                    fetch(url)
                        .then(res=>res.json()).catch(err=>{console.log(err);})
                        .then(json=>{
                            var arranges = json;
                            
                            var reply = "";

                            var result = null;

                            var keyword = data.message.slice(3);
                            if (keyword in arranges){
                                result = keyword;
                            }
                            else {
                                var valid_arranges = [];
                                for (var filename in arranges){
                                    var keywords = arranges[filename].keywords;
                                    for (var key of keywords){
                                        if (keyword.includes(key)){
                                            valid_arranges.push(filename);
                                            break;
                                        }
                                    }
                                    if (keyword.includes(arranges[filename].arrange)) {
                                        valid_arranges.push(filename);
                                    }
                                }
                                //console.log(valid_arranges);
                                if (valid_arranges.length===0){
                                    reply = '没有找到相关曲谱';
                                }
                                else {
                                    result = valid_arranges[random(0,valid_arranges.length)];
                                }
                            }

                            if (result){
                                reply = `曲名：${arranges[result].title}\n改编：${arranges[result].arrange}\n`;
                                if (arranges[result].transcribe) {
                                    reply += `制谱：${arranges[result].transcribe}\n`;
                                }
                                reply += `难度：${arranges[result].difficulty}${(arranges[result].difficulty==='?')?'':'★'}\n`;
                                reply += `pdf：https://bloak.github.io/arrange/${result}.pdf\n演奏：${arranges[result].audio}`;
                            }

                            sendMsg(bot,reply,data);
                        }).catch(err=>{console.log(err);})
                }
                else if (data.message==="开始竹林冰火人") {
                    var rawData = fs.readFileSync('mokou_cirno.json');
                    var games = JSON.parse(rawData);
                    var qid = data.user_id.toString();
                    var game = mokou_cirno.initialize();
                    games[qid] = game;
                    reply = `游戏开始！\n发送“上/下/左/右”进行移动\n`;
                    if (game.maxStep===null) {
                    	reply += '无步数限制\n';
                    }
                    else {
                    	reply += `步数：${game.step}/${game.maxStep}\n`;
                    }
                    reply += mokou_cirno.display(game.board);
                    var newData = JSON.stringify(games);
                    fs.writeFileSync('mokou_cirno.json',newData);
                }
                else if (["上","下","左","右"].includes(data.message)) {
                    var rawData = fs.readFileSync('mokou_cirno.json');
                    var games = JSON.parse(rawData);
                    var qid = data.user_id.toString();
                    if (qid in games && games[qid].fail===false) {
                        var game = games[qid];
                        mokou_cirno.move(game, {"上":1,"下":2,"左":3,"右":4}[data.message]);
                        if (game.fail) {
                            reply = "你失败了！"+game.fail+"\n"+mokou_cirno.display(game.board);
                        }
                        else if (game.success) {
                            reply = `你成功了！你总共移动了${game.step}步\n`+mokou_cirno.display(game.board);
                            delete games[qid];
                        }
                        else {
                            reply = `向${data.message}移动\n`;
                            if (game.maxStep===null) {
                            	reply += `步数：${game.step}\n`;
                            }
                            else {
                            	reply += `步数：${game.step}/${game.maxStep}\n`;
                            }
                            reply += mokou_cirno.display(game.board);
                        }
                        var newData = JSON.stringify(games);
                        fs.writeFileSync('mokou_cirno.json',newData);
                    }
                }
                else if (data.message==="重开") {
                    var rawData = fs.readFileSync('mokou_cirno.json');
                    var games = JSON.parse(rawData);
                    var qid = data.user_id.toString();
                    if (qid in games) {
                        var game = games[qid];
                        mokou_cirno.restart(game);
                        reply = `重新开始游戏！\n`;
                        if (game.maxStep===null) {
                        	reply += '无步数限制\n';
                        }
                        else {
                        	reply += `步数：${game.step}/${game.maxStep}\n`;
                        }
                        reply += mokou_cirno.display(game.board);
                        var newData = JSON.stringify(games);
                        fs.writeFileSync('mokou_cirno.json',newData);
                    }
                }
                else if (data.message==="撤退") {
                    var rawData = fs.readFileSync('mokou_cirno.json');
                    var games = JSON.parse(rawData);
                    var qid = data.user_id.toString();
                    if (qid in games) {
                        var game = games[qid];
                        mokou_cirno.back(game);
                        reply = "你回到了上一步\n"
                        if (game.maxStep===null) {
                        	reply += `步数：${game.step}\n`;
                        }
                        else {
                        	reply += `步数：${game.step}/${game.maxStep}\n`;
                        }
                        reply += mokou_cirno.display(game.board);
                        var newData = JSON.stringify(games);
                        fs.writeFileSync('mokou_cirno.json',newData);
                    }
                }
                else if (data.message==="公布答案") {
                    var rawData = fs.readFileSync('mokou_cirno.json');
                    var games = JSON.parse(rawData);
                    var qid = data.user_id.toString();
                    if (qid in games) {
                        var game = games[qid];
                        if (game.solution===null) {
                        	reply = '本关卡9步以内无解';
                        }
                        else {
                        	reply = game.solution;
                        }
                    }
                }
                // 离散stg
                else if (data.message==="开始东方弹破") {
                    var rawData = fs.readFileSync('discreteSTG.json');
                    var games = JSON.parse(rawData);
                    var qid = data.user_id.toString();
                    if (qid in games) {
                        reply = "你已经在游戏中！";
                    }
                    else {
                        games[qid] = {}; // placeholder
                        reply = "请选择角色\n";
                        for (var i=0; i<discreteSTG.characters.length; ++i) {
                            reply += `${i+1}.${discreteSTG.characters[i].name}\n`;
                        }
                        reply += "输入 / + 数字";
                        var newData = JSON.stringify(games);
                        fs.writeFileSync('discreteSTG.json', newData);

                        /*games[qid] = discreteSTG.initialize();
                        reply = "游戏开始\n" + discreteSTG.display(games[qid]);
                        var newData = JSON.stringify(games);
                        fs.writeFileSync('discreteSTG.json', newData);*/
                    }
                }
                else if (data.message==="结束东方弹破") {
                    var rawData = fs.readFileSync('discreteSTG.json');
                    var games = JSON.parse(rawData);
                    var qid = data.user_id.toString();
                    if (qid in games) {
                        delete games[qid];
                        reply = "游戏结束";
                        var newData = JSON.stringify(games);
                        fs.writeFileSync('discreteSTG.json', newData);
                    }
                    else {
                        reply = "你还没开始游戏！";
                    }
                }
                // 离散stg的指令标识
                else if (data.message[0]==='/') {
                    var rawData = fs.readFileSync('discreteSTG.json');
                    var games = JSON.parse(rawData);
                    var qid = data.user_id.toString();
                    if (qid in games) {
                        if (!isNaN(data.message.slice(1))) {
                            var num = parseInt(data.message.slice(1))-1;
                            if (num>=0 && num<discreteSTG.characters.length /*&& !games[qid]*/) {
                                games[qid] = discreteSTG.initialize(num);
                                reply = "游戏开始\n" + discreteSTG.display(games[qid]);
                            }
                        }
                        else {
                            reply = discreteSTG.operate(games[qid], data.message.slice(1));
                            if (reply.includes("你输了")) {
                                // 抓取游戏数据
                                var character = games[qid].player.abbr;
                                var turn = games[qid].turn;
                                var bullets = games[qid].player.bullets;
                                delete games[qid];
                                // 打开记录文档
                                var rawData2 = fs.readFileSync('stg_ranking.json');
                                var records = JSON.parse(rawData2);
                                if (!(qid in records)) { // 新建玩家档案
                                    records[qid] = {"nickname":"","turn":{},"bullets":{}};
                                }
                                var record = records[qid];
                                record.nickname = data.sender.nickname; // 更新昵称
                                if (!(character in record.turn)) { // 新建角色档案
                                    record.turn[character] = turn;
                                    record.bullets[character] = bullets;
                                }
                                else { // 覆盖旧数据
                                    if (turn > record.turn[character]) record.turn[character] = turn;
                                    if (bullets > record.bullets[character]) record.bullets[character] = bullets;
                                }
                                // 保存
                                var newData2 = JSON.stringify(records);
                                fs.writeFileSync('stg_ranking.json', newData2);
                            }
                        }
                        var newData = JSON.stringify(games);
                        fs.writeFileSync('discreteSTG.json', newData);
                    }
                }
                else if (data.message === '查看技能') {
                    //console.log('start');
                    var rawData = fs.readFileSync('discreteSTG.json');
                    var games = JSON.parse(rawData);
                    var qid = data.user_id.toString();
                    if (qid in games) {
                        if (games[qid]) {
                            reply = discreteSTG.show_skills(games[qid].player);
                        }
                    }
                }
                else if (data.message === '东方弹破生存榜') {
                    // read only
                    var rawData = fs.readFileSync('stg_ranking.json');
                    var records = JSON.parse(rawData);
                    // object to array (of numbers of turns)
                    var arr = [];
                    for (var qid in records) {
                        for (var character in records[qid].turn) {
                            arr.push([records[qid].nickname, character, records[qid].turn[character]]);
                        }
                    }
                    // sort
                    arr.sort((a,b)=>(b[2]-a[2]));
                    // show top 10
                    reply = "";
                    for (var i=0; i<Math.min(10,arr.length); ++i) {
                        reply += `${i+1}. ${arr[i][0]} ${arr[i][1]} ${arr[i][2]}回合\n`;
                    }
                }
                else if (data.message === '东方弹破消弹榜') {
                    // read only
                    var rawData = fs.readFileSync('stg_ranking.json');
                    var records = JSON.parse(rawData);
                    // object to array (of numbers of bullets)
                    var arr = [];
                    for (var qid in records) {
                        for (var character in records[qid].bullets) {
                            arr.push([records[qid].nickname, character, records[qid].bullets[character]]);
                        }
                    }
                    // sort
                    arr.sort((a,b)=>(b[2]-a[2]));
                    // show top 10
                    reply = "";
                    for (var i=0; i<Math.min(10,arr.length); ++i) {
                        reply += `${i+1}. ${arr[i][0]} ${arr[i][1]} 消弹数${arr[i][2]}\n`;
                    }
                }
                // jrcp
                else if (data.message_type==="group" && data.message === "jrcp" && data.group_id !== 173179026) {
                    var qq = data.user_id.toString();
                    bot.getGroupMemberList(data.group_id)
                    .then((d)=>{
                        //console.log(d);
                        var qqarr = Array.from(d.data.keys());
                        //console.log(qqarr);
                        var botqq = data.self_id.toString();
                        if (qqarr.length%2==1 && qq===botqq) {
                            sendMsg(bot, "机器人没有cp", data);
                        }
                        else{
                            if (qqarr.length%2==1) qqarr.splice(qqarr.indexOf(parseInt(botqq)),1);
                            var sd = groupSeed(data.group_id);
                            seedShuffleArray(qqarr,sd);
                            //console.log(qqarr);
                            var i = qqarr.indexOf(parseInt(qq));
                            var cp = (i % 2 == 0) ? qqarr[i + 1] : qqarr[i - 1];
                            var cp_name = (d.data.get(cp).card)?d.data.get(cp).card:d.data.get(cp).nickname;
                            //console.log(cp);
                            var url = "http://q1.qlogo.cn/g?b=qq&s=640&nk="+cp.toString();
                            download(url,'data/image/qqhead.jpg',function(){
                                var result = `${at(qq)} 今天的cp是：${cp_name}\n[CQ:image,file=data/image/qqhead.jpg]`;
                                sendMsg(bot, result, data);
                            });
                            //var result = `${at(qq)} 今天的cp是：${at(cp, true)}\n${img("http://q1.qlogo.cn/g?b=qq&amp;s=640&amp;nk="+cp.toString())}`;
                            //sendMsg(bot, result, data);
                        }
                    }).catch((err)=>{console.log(err);});
                }
            //阿瓦隆
            if (data.group_id===954212429){
                if (data.message==='阿瓦隆帮助'){
                    reply = '局外指令：注册(+空格+昵称)。\n房间指令：加入阿瓦隆；退出阿瓦隆；开始阿瓦隆；结束阿瓦隆。\n投票指令：（群内）开始投票(+空格+车队，车队用空格隔开。如“开始投票 1 2 3”)；（私聊）投票 支持；投票 反对。\n任务指令：（私聊）不破坏；破坏。\n组队、投票等信息：查看记录';
                }
                else if (data.message.slice(0,3)==='注册 '){
                    var newName = data.message.slice(3);
                    var rawData = fs.readFileSync('avalon_register.json');
                    var register = JSON.parse(rawData);
                    register[data.user_id.toString()] = newName;
                    var newData = JSON.stringify(register);
                    fs.writeFileSync('avalon_register.json',newData);
                    reply = '注册成功';
                }
                else if (data.message==="加入阿瓦隆"){
                    var rawData = fs.readFileSync('avalon.json');
                    var game = JSON.parse(rawData);
                    if (game.started){
                        reply = '游戏已开始';
                    }
                    else {
                        if (data.user_id.toString() in game.players){
                            reply = '你已经在房间内';
                        }
                        else {
                            game.players[data.user_id.toString()] = null;
                            var newData = JSON.stringify(game);
                            fs.writeFileSync('avalon.json',newData);
                            reply = '加入成功'
                        }
                    }
                }
                else if (data.message==="退出阿瓦隆"){
                    var rawData = fs.readFileSync('avalon.json');
                    var game = JSON.parse(rawData);
                    if (game.started){
                        reply = '游戏已开始';
                    }
                    else {
                        if (data.user_id.toString() in game.players){
                            delete game.players[data.user_id.toString()];
                            var newData = JSON.stringify(game);
                            fs.writeFileSync('avalon.json',newData);
                            reply = '退出成功';
                        }
                        else {
                            reply = '你还未加入房间'
                        }
                    }
                }
                else if (data.message==="开始阿瓦隆"){
                    var rawData = fs.readFileSync('avalon.json');
                    var game = JSON.parse(rawData);
                    if (game.started){
                        reply = '游戏已开始';
                    }
                    else {
                        game.started = true;
                        game.log = '游戏记录：';
                        var allRoles = [null,null,null,null,null,['梅林','派西维尔','莫甘娜','刺客','亚瑟的忠臣'],['梅林','派西维尔','莫甘娜','刺客','亚瑟的忠臣','亚瑟的忠臣'],['梅林','派西维尔','莫甘娜','刺客','亚瑟的忠臣','亚瑟的忠臣','奥伯伦'],['梅林','派西维尔','莫甘娜','刺客','亚瑟的忠臣','亚瑟的忠臣','亚瑟的忠臣','莫德雷德的爪牙'],['梅林','派西维尔','莫甘娜','刺客','亚瑟的忠臣','亚瑟的忠臣','亚瑟的忠臣','亚瑟的忠臣','莫德雷德'],['梅林','派西维尔','莫甘娜','刺客','亚瑟的忠臣','亚瑟的忠臣','亚瑟的忠臣','亚瑟的忠臣','莫德雷德','奥伯伦']];
                        var num = Object.keys(game.players).length;
                        if (5<=num && num<=10){
                            var roles = shuffle(allRoles[num]);
                            var i = 0;
                            for (var player in game.players){
                                game.players[player] = [i+1,roles[i]];
                                i+=1;
                            }
                            var newData = JSON.stringify(game);
                            fs.writeFileSync('avalon.json',newData);

                            for (var player in game.players){
                                var qq = parseInt(player);
                                var player_id = game.players[player][0];
                                var role = game.players[player][1];
                                var privateMsg = `你是${player_id}号。你的身份是${role}`;
                                if (role==='梅林'){
                                    privateMsg += '\n红方成员有：';
                                    for (var p in game.players){
                                        if (['莫甘娜','刺客','奥伯伦','莫德雷德的爪牙'].includes(game.players[p][1])){
                                            privateMsg += `${game.players[p][0]}号 `;
                                        }
                                    }
                                }
                                else if (['莫甘娜','刺客','莫德雷德','莫德雷德的爪牙'].includes(role)){
                                    privateMsg += '\n红方成员有：';
                                    for (var p in game.players){
                                        if (['莫甘娜','刺客','莫德雷德','莫德雷德的爪牙'].includes(game.players[p][1])){
                                            privateMsg += `${game.players[p][0]}号 `;
                                        }
                                    }
                                }
                                if (role==='派西维尔'){
                                    privateMsg += '\n你看见了：';
                                    for (var p in game.players){
                                        if (['莫甘娜','梅林'].includes(game.players[p][1])){
                                            privateMsg += `${game.players[p][0]}号 `;
                                        }
                                    }
                                }
                                bot.sendPrivateMsg(qq, privateMsg);
                            }

                            reply = '身份已分配';

                            var registerRawData = fs.readFileSync('avalon_register.json');
                            var register = JSON.parse(registerRawData);
                            var i = 1;
                            for (var player in game.players){
                                if (player in register){
                                    reply += `\n${i}号：${register[player]}`;
                                }
                                else {
                                    reply += `\n${i}号：${player}`;
                                }
                                i += 1;
                            }

                            var startNumber = random(1,Object.keys(game.players).length+1);
                            reply += `\n${startNumber}号玩家担任第一轮队长`;
                        }
                        else {
                            reply = '请确保游戏人数为5-10';
                        }
                    }
                }
                else if (data.message==='结束阿瓦隆'){
                    var rawData = fs.readFileSync('avalon.json');
                    var game = JSON.parse(rawData);
                    if (game.started){
                        game.started = false;
                        reply = '游戏结束。本局身份如下：';
                        for (var player in game.players){
                            reply += `\n${game.players[player][0]}号：${game.players[player][1]}`;
                        }
                        game.players = {};
                        game.task.started = false;
                        game.task.members = {};
                        game.vote.started = false;
                        game.vote.members = {};
                        game.vote.team = [];
                        var newData = JSON.stringify(game);
                        fs.writeFileSync('avalon.json',newData);
                    }
                    else {
                        reply = '游戏尚未开始';
                    }
                }
                else if (data.message.slice(0,5)==='开始投票 '){
                    var rawTeamInfo = data.message.slice(5);
                    var teamIds = rawTeamInfo.split(' ');
                    
                    var rawData = fs.readFileSync('avalon.json');
                    var game = JSON.parse(rawData);
                    if (game.vote.started){
                        reply = `投票已开始`;
                    }
                    else {
                        game.vote.started = true;
                        for (var player in game.players){
                            game.vote.members[player] = null;
                        }
                        for (var i=0;i<teamIds.length;i++){
                            var idNumber = parseInt(teamIds[i]);
                            var qqNumber = Object.keys(game.players)[idNumber-1].toString();
                            game.vote.team.push(qqNumber);
                        }
                        var leaderId = game.players[data.user_id.toString()][0];
                        game.log += `\n${leaderId}号组队${rawTeamInfo},`;
                        var newData = JSON.stringify(game);
                        fs.writeFileSync('avalon.json',newData);
                        reply = `队伍为${rawTeamInfo}。请所有玩家私聊我投票。输入”投票 支持“或”投票 反对“。`;
                    }
                }
                else if (data.message==='查看记录'){
                    var rawData = fs.readFileSync('avalon.json');
                    var game = JSON.parse(rawData);
                    reply = game.log;
                }
            }
            //阿瓦隆私聊功能
            if (data.message_type==='private'){
                if (data.message.slice(0,3)==='投票 '){
                    var rawData = fs.readFileSync('avalon.json');
                    var game = JSON.parse(rawData);
                    if (game.vote.started===true && (data.user_id.toString() in game.vote.members) && (game.vote.members[data.user_id.toString()]===null)){
                        var content = data.message.slice(3);
                        if (content==='支持'||content==='反对'){
                            game.vote.members[data.user_id.toString()] = content;
                            reply = '投票成功';
                            var voteEnd = true;
                            for (var player in game.vote.members){
                                if (game.vote.members[player]===null){
                                    voteEnd = false;
                                    break;
                                }
                            }
                            if (voteEnd){
                                var groupMsg = '投票结果：';
                                var supporters = '支持：';
                                var opposers = '反对：';
                                var supporterCount = 0;
                                var opposerCount = 0;
                                for (var player in game.players){
                                    if (game.vote.members[player]==='支持'){
                                        supporters += `${game.players[player][0]}号,`;
                                        supporterCount += 1;
                                    }
                                    else {
                                        opposers += `${game.players[player][0]}号,`;
                                        opposerCount += 1;
                                    }
                                }
                                groupMsg += '\n'+supporters+'\n'+opposers;
                                game.log += '\n'+supporters+'\n'+opposers;
                                if (supporterCount>opposerCount){
                                    groupMsg += '\n投票通过，请队员执行任务。私聊“破坏”或“不破坏”';
                                    game.task.started = true;
                                    for (var i=0;i<game.vote.team.length;i++){
                                        game.task.members[game.vote.team[i]] = null;
                                    }
                                    game.log += '\n投票通过。';
                                }
                                else {
                                    groupMsg += '\n投票未通过';
                                    game.log += '\n投票未通过';
                                }
                                bot.sendGroupMsg(954212429, groupMsg);
                                game.vote.started = false;
                                game.vote.members = {};
                                game.vote.team = [];
                            }
                            var newData = JSON.stringify(game);
                            fs.writeFileSync('avalon.json',newData);
                        }
                        else {
                            reply = '请输入正确指令';
                        }
                    }
                    else {
                        reply = "你不在游戏中，或者投票尚未开始，或你已经投过票了";
                    }
                }
                else if (data.message==='不破坏'){
                    var rawData = fs.readFileSync('avalon.json');
                    var game = JSON.parse(rawData);
                    if (game.task.started===true && (data.user_id.toString() in game.task.members) && (game.task.members[data.user_id.toString()]===null)){
                        game.task.members[data.user_id.toString()] = 0;
                        reply = '操作成功';
                        var taskEnd = true;
                        for (var player in game.task.members){
                            if (game.task.members[player]===null){
                                taskEnd = false;
                                break;
                            }
                        }
                        if (taskEnd){
                            var taskResult = 0;
                            for (var player in game.task.members){
                                taskResult += game.task.members[player];
                            }
                            var groupMsg = `任务结束，${taskResult}人出坏票。`;
                            game.log += `${taskResult}人出坏票`;
                            bot.sendGroupMsg(954212429, groupMsg);
                            game.task.started = false;
                            game.task.members = {};
                        }
                        var newData = JSON.stringify(game);
                        fs.writeFileSync('avalon.json',newData);
                    }
                    else {
                        reply = "你不在车上，或者任务尚未开始，或你已经操作过了";
                    }
                }
                else if (data.message==='破坏'){
                    var rawData = fs.readFileSync('avalon.json');
                    var game = JSON.parse(rawData);
                    if (game.task.started===true && (data.user_id.toString() in game.task.members) && (game.task.members[data.user_id.toString()]===null)){
                        game.task.members[data.user_id.toString()] = 1;
                        reply = '操作成功';
                        var taskEnd = true;
                        for (var player in game.task.members){
                            if (game.task.members[player]===null){
                                taskEnd = false;
                                break;
                            }
                        }
                        if (taskEnd){
                            var taskResult = 0;
                            for (var player in game.task.members){
                                taskResult += game.task.members[player];
                            }
                            var groupMsg = `任务结束，${taskResult}人出坏票。`;
                            bot.sendGroupMsg(954212429, groupMsg);
                            game.task.started = false;
                            game.task.members = {};
                        }
                        var newData = JSON.stringify(game);
                        fs.writeFileSync('avalon.json',newData);
                    }
                    else {
                        reply = "你不在车上，或者任务尚未开始，或你已经操作过了";
                    }
                }
            }
            //2047卡牌评价
            /*if (data.group_id===863689056){
                if (data.message==='帮助 评价卡牌'){
                    reply = '评价卡牌 卡牌名称 你的评价';
                }
                if (data.message.slice(0,5)==='评价卡牌 '){
                    var content = data.message.slice(5).split(' ');
                    var name = content[0];
                    var comment = content[1];
                    var rawData = fs.readFileSync('2047_cards.json');
                    var cards = JSON.parse(rawData);
                    if (name in cards){
                        if (!('评价' in cards[name])){
                            cards[name].评价 = [comment];
                        }
                        else {
                            cards[name].评价.push(comment);
                        }
                        reply = '评价成功';

                        var rawData2 = fs.readFileSync('card_comments.json');
                        var card_comments = JSON.parse(rawData2);
                        if (name in card_comments){
                            card_comments[name].push(comment);
                        }
                        else {
                            card_comments[name] = [comment];
                        }

                        var newData = JSON.stringify(cards);
                        fs.writeFileSync('2047_cards.json',newData);

                        var newData2 = JSON.stringify(card_comments);
                        fs.writeFileSync('card_comments.json',newData2);
                    }
                    else {
                        reply = '卡牌名称有误';
                    }
                }
            }*/
            //2047王权
            if (data.message_type==='private'){
                if (data.message==='王权'){
                    reply = '现在是2047年。联邦已经统一全球，但局势暗流涌动。你作为联邦总统，需要对全人类的未来负责。输入“开始王权”开始游戏。输入“是”或“否”应答事件。\n注意：如果机器人未回复你的消息，可能是被企鹅风控了，此时请发送“重复”。';
                }
                if (data.message==='开始王权'){
                    var rawData = fs.readFileSync('reignGames.json');
                    var games = JSON.parse(rawData);
                    games[data.user_id.toString()] = {
                        "player":{
                            "econ":5,
                            "army":5,
                            "popu":5,
                            "tech":1,
                            "robot":1,
                            "empire":1,
                            "hive":1,
                            "debuff":false,
                            "maxEcon":10,
                            "maxArmy":10,
                            "maxPopu":10,
                            "minEcon":0,
                            "minArmy":0,
                            "minPopu":0
                        },
                        "deck":shuffle(['1','2','3','4','5','6','7','8','9','11']),
                        "event":null,
                        "time":0,
                        "record":{
                            "maxTech":1,
                            "robot":false,
                            "empire":false,
                            "hive":false
                        }
                    };
                    var rawData2 = fs.readFileSync('reignData.json');
                    var cards = JSON.parse(rawData2);
                    var eventId = games[data.user_id.toString()].deck.pop();
                    games[data.user_id.toString()].event = eventId;
                    reply = cards[eventId].description;
                    var newData = JSON.stringify(games);
                    fs.writeFileSync('reignGames.json',newData);
                }
                if (data.message==='是'||data.message==='否'){
                    var rawData = fs.readFileSync('reignGames.json');
                    var games = JSON.parse(rawData);
                    if (!(data.user_id.toString() in games)){
                        reply = '你还没开始游戏！';
                    }
                    else {
                        var game = games[data.user_id.toString()];
                        var player = game.player;
                        var deck = game.deck;
                        var eventId = game.event;
                        var rawData2 = fs.readFileSync('reignData.json');
                        var cards = JSON.parse(rawData2);
                        var event = cards[eventId];
                        var record = game.record;
                        game.time += 1;
                        if (data.message==='是'){
                            eval(event.agree);
                        }
                        else {
                            eval(event.disagree);
                        }
                        if (player.debuff===true){
                            var r = random(0,3);
                            var properties = ['econ','popu','army'];
                            player[properties[r]]-=1;
                        }
                        player.robot = Math.max(player.robot,0);
                        player.empire = Math.max(player.empire,0);
                        player.hive = Math.max(player.hive,0);
                        reply = `经济：${player.minEcon}/${player.econ}/${player.maxEcon}，军力：${player.minArmy}/${player.army}/${player.maxArmy}，民意：${player.minPopu}/${player.popu}/${player.maxPopu}，科技：${player.tech}`;
                        if (record.robot){
                            reply += `，智械：${player.robot}/5`;
                        }
                        if (record.empire){
                            reply += `，帝国：${player.empire}/5`;
                        }
                        if (record.hive){
                            reply += `，蜂巢：${player.hive}/5`;
                        }
                        reply += '\n';
                        if (player.debuff){
                            reply += '⚠️能源危机\n';
                        }
                        var time = game.time;
                        if (player.econ>=player.maxEcon){
                            reply += `当资本凌驾于法律，你无计可施。你被自杀了。\n你在任${time}个月`;
                            delete games[data.user_id.toString()];
                        }
                        else if (player.econ<=player.minEcon){
                            reply += `泡沫终有破灭的一天。这次不是一个国家的灭亡，而是全人类的灾难。\n你在任${time}个月`;
                            delete games[data.user_id.toString()];
                        }
                        else if (player.popu>=player.maxPopu){
                            reply += `你的辞职宣告了联邦的解体。\n你在任${time}个月`;
                            delete games[data.user_id.toString()];
                        }
                        else if (player.popu<=player.minPopu){
                            reply += `你在一次视察中被暴民炸死。\n你在任${time}个月`;
                            delete games[data.user_id.toString()];
                        }
                        else if (player.army>=player.maxArmy){
                            reply += `你没能握住军权。你知道这样的下场是什么。\n你在任${time}个月`;
                            delete games[data.user_id.toString()];
                        }
                        else if (player.army<=player.minArmy){
                            reply += `一伙马戏团演员闯入了你的办公室，将你乱枪打死。\n你在任${time}个月`
                            delete games[data.user_id.toString()];
                        }
                        else if (eventId === '10' && player.popu <= 5){
                            reply += `这次你没能获得足够的选票。可能这就是维护民主的代价。\n你在任${time}个月`;
                            delete games[data.user_id.toString()];
                        }
                        else if (player.robot >= 5){
                            reply += `救世主已经降临，人类主权国家已经没有存在的必要。\n你在任${time}个月`;
                            delete games[data.user_id.toString()];
                        }
                        else if (player.empire >= 5){
                            reply += `帝国对首都发动了进攻，好在你及时逃离了。\n你在任${time}个月`;
                            delete games[data.user_id.toString()];
                        }
                        else if (player.hive >= 5){
                            reply += `蜂巢的影响力渗透到了全球各地，美丽新世界就要来了。\n你在任${time}个月`;
                            delete games[data.user_id.toString()];
                        }
                        else {
                            var newEventId = deck.pop();
                            games[data.user_id.toString()].event = newEventId;
                            reply += cards[newEventId].description;
                        }
                        var newData = JSON.stringify(games);
                        fs.writeFileSync('reignGames.json',newData);
                        if (!(data.user_id.toString() in games)){
                            var rawData3 = fs.readFileSync('reignRank.json');
                            var ranks = JSON.parse(rawData3);
                            if (data.user_id.toString() in ranks){
                                ranks[data.user_id.toString()] = Math.max(ranks[data.user_id.toString()],time);
                            }
                            else{
                                ranks[data.user_id.toString()]=time;
                            }
                            var newData2 = JSON.stringify(ranks);
                            fs.writeFileSync('reignRank.json',newData2);
                            var highest = 0;
                            var highestPlayer = null;
                            for (player in ranks){
                                if (ranks[player]>highest){
                                    highestPlayer = player;
                                    highest = ranks[player];
                                }
                            }
                            reply += `\n你的最高记录是${ranks[data.user_id.toString()]}个月;\n全玩家最高纪录是${highestPlayer}的${highest}个月`;
                        }
                    }
                }
            }
            // two spies
            if (data.message_type==='private') {
                if (data.message==="加入两个间谍") {
                    var rawData = fs.readFileSync('two_spies.json');
                    var rooms = JSON.parse(rawData);
                    // rooms template: {"games":{1:{<game>}, 2:{<game>}, ...}, "players":{<qid1>:<room#>, <qid2>:<room#>, ...}, "waiting": <qid> or null}
                    // when creating a new game, search for the smallest empty room number.
                    // game template: {"room_id":#, players":[<qid1>, <qid2>], ...} players can contain only one player (if waiting)
                    var qid = data.user_id.toString();
                    if (qid in rooms.players) {
                        reply = "你已经加入游戏！";
                    }
                    else {
                        if (rooms.waiting===null) {
                            // create a half-empty room
                            rooms.waiting = qid;
                            var room_id = 1;
                            while (true) {
                                if (rooms.games[room_id]) room_id += 1;
                                else {
                                    rooms.games[room_id] = {
                                        "room_id": room_id,
                                        "players": [qid]
                                    };
                                    break;
                                }
                            }
                            rooms.players[qid] = room_id;
                            reply = "加入成功，请等待对手";
                        }
                        else {
                            // fill a half-empty room and start game
                            var opponent_id = rooms.waiting;
                            rooms.waiting = null;
                            var room_id = rooms.players[opponent_id];
                            rooms.players[qid] = room_id;
                            var game = rooms.games[room_id];
                            game.players.push(qid);
                            two_spies.initialize(game);
                            // inform the player's side
                            if (game.players[0]===qid) {
                                sendMsg(bot,`游戏开始。你的对手是${opponent_id}。你是先手（红方）`,data);
                                bot.sendPrivateMsg(parseInt(opponent_id), `游戏开始。你的对手是${qid}。你是后手（蓝方）`);
                            }
                            else {
                                sendMsg(bot,`游戏开始。你的对手是${opponent_id}。你是后手（蓝方）`,data);
                                bot.sendPrivateMsg(parseInt(opponent_id), `游戏开始。你的对手是${qid}。你是先手（红方）`);
                            }
                            two_spies.display(game, qid).then((msg)=>{sendMsg(bot,msg,data);});
                            two_spies.display(game, opponent_id).then((msg)=>{bot.sendPrivateMsg(parseInt(opponent_id), msg);});
                            //sendMsg(bot, two_spies.display(game, qid), data);
                            //bot.sendPrivateMsg(parseInt(opponent_id), two_spies.display(game, opponent_id));
                        }
                        var newData = JSON.stringify(rooms);
                        fs.writeFileSync('two_spies.json',newData);
                    }
                }
                else if (data.message==="结束两个间谍") {
                    var rawData = fs.readFileSync('two_spies.json');
                    var rooms = JSON.parse(rawData);
                    var qid = data.user_id.toString();
                    if (qid in rooms.players) {
                        var room_id = rooms.players[qid];
                        if (rooms.games[room_id].players.length===2) {
                            var opponent_id = (rooms.games[room_id].players[0]===qid)?rooms.games[room_id].players[1]:rooms.games[room_id].players[0];
                            delete rooms.players[opponent_id];
                            bot.sendPrivateMsg(parseInt(opponent_id),`你的对手提前结束了游戏`);
                        }
                        else rooms.waiting = null;
                        delete rooms.games[room_id];
                        delete rooms.players[qid];
                        reply = "已结束";

                        var newData = JSON.stringify(rooms);
                        fs.writeFileSync('two_spies.json',newData);
                    }
                    else {
                        reply = "你不在任何游戏中！";
                    }
                }
                else if (data.message[0]===">") {
                    var rawData = fs.readFileSync('two_spies.json');
                    var rooms = JSON.parse(rawData);
                    var qid = data.user_id.toString();
                    if (qid in rooms.players) {
                        var room_id = rooms.players[qid];
                        var game = rooms.games[room_id];
                        if (game.players.length===2) {
                            var opponent_id = (game.players[0]===qid)?game.players[1]:game.players[0];
                            var success = two_spies.operate(game, data.message.slice(1), qid);
                            if (success) {
                                two_spies.display(game, qid).then((msg)=>{sendMsg(bot,msg,data);});
                                two_spies.display(game, opponent_id).then((msg)=>{bot.sendPrivateMsg(parseInt(opponent_id), msg);});
                                //sendMsg(bot, two_spies.display(game, qid), data);
                                //bot.sendPrivateMsg(parseInt(opponent_id), two_spies.display(game, opponent_id));
                            }
                            // end-game scenario
                            if (game.winner===0) {
                                sendMsg(bot,"红方胜利",data);
                                bot.sendPrivateMsg(parseInt(opponent_id), "红方胜利");
                                delete rooms.games[room_id];
                                delete rooms.players[qid];
                                delete rooms.players[opponent_id];
                            }
                            else if (game.winner===1) {
                                sendMsg(bot,"蓝方胜利",data);
                                bot.sendPrivateMsg(parseInt(opponent_id), "蓝方胜利");
                                delete rooms.games[room_id];
                                delete rooms.players[qid];
                                delete rooms.players[opponent_id];
                            }
                            var newData = JSON.stringify(rooms);
                            fs.writeFileSync('two_spies.json',newData);
                        }
                    }
                }
            }
            //replyLog
            if (data.message_type==='private'){
                var rawData = fs.readFileSync('replyLog.json');
                var logs = JSON.parse(rawData);
                if (data.message==='重复'){
                    reply = (logs[data.user_id.toString()])?logs[data.user_id.toString()]:'';
                }
                else if (reply){
                    logs[data.user_id.toString()]=reply;
                    var newData = JSON.stringify(logs);
                    fs.writeFileSync('replyLog.json',newData);
                }
            }
            // list message test
            if (data.user_id===adminQQ && data.message==="draw circle") {
                var canvas = createCanvas(500,500);
                var context = canvas.getContext('2d');
                context.fillStyle = 'white';
                context.fillRect(0,0,500,500)
                context.beginPath();
                context.arc(250, 250, 100, 0, 2 * Math.PI, false);
                context.fillStyle = 'black';
                context.fill();
                reply = [
                    {
                        type:"image",
                        data:{
                            file:canvas.toBuffer('image/jpeg')
                        }
                    }
                ];
            }

            bot[action](id, reply);
        }
        
        dipatch(data);
    });

    const filepath = path.join(dir, "password");
    if (fs.existsSync(filepath)) {
        bot.login(fs.readFileSync(filepath));
    } else {
        inputPassword();
    }
}

function dipatch(event) {
    const json = JSON.stringify(event);
    const options = {
        method: 'POST',
        timeout: config.post_timeout,
        headers: {
            'Content-Type': 'application/json',
            "X-Self-ID": account.toString()
        }
    }
    if (config.secret) {
        options.headers["X-Signature"] = crypto.createHmac("sha1", config.secret.toString()).update(json).digest("hex");
    }
    for (let url of config.post_url) {
        const protocol = url.startsWith("https") ? https: http;
        try {
            const req = protocol.request(url, options, (res)=>{
                bot.logger.debug(`post上报事件到${url}: ` + json);
                onHttpRes(event, res);
            }).on("error", ()=>{});
            req.end(json);
        } catch (e) {}
    }
    if (wss) {
        wss.clients.forEach((ws)=>{
            bot.logger.debug(`正向ws上报事件: ` + json);
            ws.send(json);
        });
    }
    websockets.forEach((ws)=>{
        bot.logger.debug(`反向ws上报事件: ` + json);
        ws.send(json);
    });
}

function createServer() {
    if (!config.use_http && !config.use_ws)
        return;
    server = http.createServer(async(req, res)=>{
        if (config.access_token) {
            if (!req.headers["authorization"])
                return res.writeHead(401).end();
            if (!req.headers["authorization"].includes(config.access_token))
                return res.writeHead(403).end();
        }
        if (req.method === "GET") {
            bot.logger.debug(`收到GET请求: ` + req.url);
            const qop = url.parse(req.url);
            let query = querystring.parse(qop.query);
            try {
                const ret = await api.apply({
                    action: qop.pathname.replace("/", ""),
                    params: query
                });
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(ret);
            } catch (e) {
                res.writeHead(404).end();
            }
        } else if (req.method === "POST") {
            onHttpReq(req, res);
        }
    });
    if (config.use_ws) {
        wss = new WebSocket.Server({server});
        wss.on("connection", (ws, req)=>{
            ws.on("error", (data)=>{});
            if (config.access_token) {
                if (!req.headers["authorization"])
                    return ws.close(1401);
                if (!req.headers["authorization"].includes(config.access_token))
                    return ws.close(1403);
            }
            ws.on("message", (data)=>{
                onWSMessage(ws, data);
            });
        });
    }
    try {
        server.listen(config.port, config.host, ()=>{
            bot.logger.info(`开启http服务器成功，监听${server.address().address}:${server.address().port}`);
        });
    } catch (e) {
        bot.logger.error(e);
        process.exit(0);
    }
}
function createReverseWS() {
    const headers = {
        "X-Self-ID": account.toString(),
        "X-Client-Role": "Universal",
    };
    if (config.access_token)
        headers.Authorization = "Bearer " + config.access_token;
    for (let url of config.ws_reverse_url) {
        createWSClient(url, headers);
    }
}
function createWSClient(url, headers) {
    try {
        const ws = new WebSocket(url, {headers});
        websockets.add(ws);
        ws.on("open", ()=>{
            bot.logger.info(`反向ws连接(${url})连接成功。`)
        });
        ws.on("message", (data)=>{
            onWSMessage(ws, data);
        });
        ws.on("error", ()=>{});
        ws.on("close", ()=>{
            bot.logger.error(`反向ws连接(${url})被关闭，将在${config.ws_reverse_reconnect_interval}毫秒后尝试连接。`)
            websockets.delete(ws);
            setTimeout(()=>{
                createWSClient(url, headers);
            }, config.ws_reverse_reconnect_interval)
        })
    } catch (e) {}
}

async function onHttpRes(event, res) {
    let data = [];
    res.on("data", (chunk)=>data.push(chunk));
    res.on("end", async()=>{
        if (!online) return;
        data = Buffer.concat(data).toString();
        try {
            data = JSON.parse(data);
            api.quickOperate(event, data);
        } catch (e) {}
    })
}
function onHttpReq(req, res) {
    let data = [];
    req.on("data", (chunk)=>data.push(chunk));
    req.on("end", async()=>{
        try {
            if (!online) {
                var ret = JSON.stringify({
                    retcode: 104, status: "failed"
                });
            } else {
                data = Buffer.concat(data).toString();
                bot.logger.debug(`收到POST请求: ` + data);
                data = JSON.parse(data);
                var ret = await api.apply(data);
            }
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(ret);
        } catch (e) {
            if (e instanceof api.NotFoundError)
                res.writeHead(404).end();
            else
                res.writeHead(400).end();
        }
    })
}
async function onWSMessage(ws, data) {
    bot.logger.debug(`收到ws消息: ` + data);
    if (!online) {
        return ws.send(JSON.stringify({
            retcode: 104, status: "failed"
        }));
    }
    try {
        data = JSON.parse(data);
        if (data.action === ".handle_quick_operation") {
            api.handleQuickOperation(data);
            var ret = JSON.stringify({
                retcode: 1,
                status: "async",
                data: null
            });
        } else {
            var ret = await api.apply(data);
        }
        ws.send(ret);
    } catch (e) {
        if (e instanceof api.NotFoundError)
            var retcode = 1404;
        else
            var retcode = 1400;
        ws.send(JSON.stringify({
            retcode: retcode,
            status: "failed",
            data: null,
            echo: data.echo
        }));
    }
}

//global functions
function copyList(lst){
    return lst.slice(0, lst.length);
}
function copyDict(dict){
    var newDict = {};
    for (var index in dict){
        newDict[index] = dict[index];
    }
    return newDict;
}
function remove(lst, val){
    for (var i in lst){
        if (lst[i]===val){
            lst.splice(i, 1);
            return true;
        }
    }
    return false;
}

function img(url){
    return `[CQ:image,cache=0,file=${encodeURI(url)}]`;
}

/*function download(uri, filename, callback){
    request.head(uri, function(err, res, body){
        try{
            console.log('content-type:', res.headers['content-type']);
            console.log('content-length:', res.headers['content-length']);

            request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
        }
        catch(err){
            console.log(err);
        }
    });
}*/

async function download(url, filename, callback){
    var response = await fetch(url);
    var buffer = await response.buffer();
    fs.writeFile(filename, buffer, callback);
}

/*function download(url, filename, callback){
    https.get(url, function(res){
        var data = new Buffer();
        res.on('data',(chunk)=>{data+=chunk;});
        res.on('end',()=>{
            fs.writeFile(filename, data, callback);
        });
    })
}*/

/*async function fetchJSON(url){
    var response = await fetch(url);
    var result = await response.json();
    console.log(result);
    return result;
}*/

function random(a, b){
    return Math.floor(Math.random()*(b-a)+a);
}

function dice(n, max){
    var result = '';
    for (var i = 0;i < n;i++){
        var number = random(1, max+1);
        result += number.toString()+' ';
    }
    return result;
}

function announce(bot, content){
    var groups = Array.from(bot.gl.keys());
    for (var group of groups){
        bot.sendGroupMsg(group, "消息广播：\n"+content);
    }

    //bot.sendGroupMsg(863689056,content);//云牌群
    //bot.sendGroupMsg(571354212,content);//桌游群
    //bot.sendGroupMsg(954212429,content);//阿瓦隆群
    //bot.sendGroupMsg(826931018,content);//2047四群
    //bot.sendGroupMsg(697128223,content);//2047一群
    //bot.sendGroupMsg(830658555,content);//2047二群
}

function shuffle(list){
    var result = [];
    var len = list.length;
    for (var i=0;i<len;i++){
        var index = random(0, list.length)
        result.push(list[index]);
        list = list.slice(0,index).concat(list.slice(index+1));
    }
    return result;
}

function add(deck, card){
    deck.splice(random(0,deck.length),0,card);
}

function display(board_lst){
    var result = '';
    for (var i=0;i<49;i++){
        result += board_lst[i];
        if (i%7===6){
            result += '\n';
        }
    }
    result = result.slice(0,result.length-1);
    return result;
}

function sendMsg(bot, msg, data){
    if (data.message_type==='private'){
        bot.sendPrivateMsg(data.user_id, msg);
    }
    else {
        bot.sendGroupMsg(data.group_id, msg);
    }
}

function sendImage(bot, fileName, data){
    var msg = `[CQ:image,file=data/image/${fileName}]`;
    sendMsg(bot, msg, data);
}

function solve(cards){
    if(cards.length===1){
        return (cards[0]>23.999&&cards[0]<24.001)?true:false;
    }
    else {
        for(var i=0;i<cards.length;i++){
            for(var j=0;j<cards.length;j++){
                if(i!==j){
                    for(var k=0;k<4;k++){
                        var newNum = eval(`(${cards[i]})${'+-*/'[k]}(${cards[j]})`);
                        var result = solve(cards.slice(0,Math.min(i,j)).concat(cards.slice(Math.min(i,j)+1,Math.max(i,j))).concat(cards.slice(Math.max(i,j)+1)).concat([newNum]));
                        if(result===true){
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }
}
function search(message){
    message += '#';
    var rawData = fs.readFileSync('2047_cards.json');
    var cards = JSON.parse(rawData);
    var temp = ['','',''];
    var s = 0;
    for (var i=0;i<message.length;i++){
        if (!('#=!<>{'.includes(message[i]))){
            temp[s] += message[i];
        }
        else if ('=!<>{'.includes(message[i])){
            temp[1] = message[i];
            s = 2;
        }
        else {
            for (var name in cards){
                if (temp[0] in cards[name]){
                    if (temp[1]==='='){
                        if (cards[name][temp[0]]===temp[2]){
                            //pass test
                        }
                        else {
                            delete cards[name];
                        }
                    }
                    else if (temp[1]==='!'){
                        if (cards[name][temp[0]]!==temp[2]){
                            //pass test
                        }
                        else {
                            delete cards[name];
                        }
                    }
                    else if (temp[1]==='<'){
                        if (!(isNaN(cards[name][temp[0]]))&&!(isNaN(temp[2]))&&(parseInt(cards[name][temp[0]])<parseInt(temp[2]))){
                            //pass test
                        }
                        else {
                            delete cards[name];
                        }
                    }
                    else if (temp[1]==='>'){
                        if (!(isNaN(cards[name][temp[0]]))&&!(isNaN(temp[2]))&&(parseInt(cards[name][temp[0]])>parseInt(temp[2]))){
                            //pass test
                        }
                        else {
                            delete cards[name];
                        }
                    }
                    else if (temp[1]==='{'){
                        if (cards[name][temp[0]].includes(temp[2])){
                            //pass test
                        }
                        else {
                            delete cards[name];
                        }
                    }
                }
                else {
                    delete cards[name];
                }
            }
            temp = ['','',''];
            s = 0
        }
    }
    var cardNames = Object.keys(cards);
    return cardNames;
}
function randomFunction(){
    var funcs = ['sin','cos','tan','abs','abs','abs','',''];
    var signs = ['+','-','*','/'];
    var left = 'y';
    var right = 'x';
    var s = 5;
    while (s>0){
        left = funcs[random(0,funcs.length)] + '(' + left + ')' + ((Math.random()<0.5)?signs[random(0,signs.length)] + (random(1,31)/10).toString():(signs[random(0,signs.length)] + 'xy'[random(0,2)]));
        right = funcs[random(0,funcs.length)] + '(' + right + ')' + ((Math.random()<0.5)?signs[random(0,signs.length)] + (random(1,31)/10).toString():(signs[random(0,signs.length)] + 'xy'[random(0,2)]));
        s -= Math.random();
    }
    return '画图' + left + '=' + right;
}
function speedTest(){
    var start = Date.now();
    var count = 10**7;
    while(--count){
        Math.random();
    }
    return "生成一千万次随机数需要"+(Date.now()-start)+"ms";
}
function slotMachine(){
    var result = '';
    var strength = 6;
    while(strength > 4){
        strength -= 4;
        var increment = random(1,7);
        strength += increment;
        result += `你使用了老虎机的技能！获得+${increment}，力量变为了${strength}\n`;
    }
    result += '你无法再摇动老虎机了！';
    return result;
}
function slotTest(){
    var max = 6;
    var strength = 6;
    while(strength > 4){
        strength -= 4;
        var increment = random(1,7);
        strength += increment;
        if (strength > max){
            max = strength;
        }
    }
    return max;
}
function hideQQ(qid) {
    return qid.slice(0,3) + '*'.repeat(qid.length-6) + qid.slice(qid.length-3);
}
function groupSeed(group_id) {
    return Math.abs(0xffffffffffffffff%group_id^0xffffffffffffffff%((Date.now()+28800000)/864/10**5|0));
}
function seedShuffleArray(arr, sd, copy=false) {
    const random = seed(sd);
    if (copy) arr = Array.from(arr);
    for (var i = arr.length; i > 1;) {
        var r = (random() * i--) | 0;
        [arr[r], arr[i]] = [arr[i], arr[r]];
    }
    return arr;
}
function at(q, dummy=false) {
    return `[CQ:at,qq=${q},dummy=${dummy?true:false}]`;
}
//

module.exports = startup;
