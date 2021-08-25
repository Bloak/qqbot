
// generates a game object to be assigned to games[qid]
// num = index of character
function initialize(num) {
	var board = [];
	for (var i=0; i<7; ++i) {
		board.push([]);
		for (var j=0; j<7; ++j) {
			board[i].push(null);
		}
	}

	var player = {
		"num": num,
		"name": characters[num].name,
		"abbr": characters[num].abbr,
		"pos": [3,3],
		"hp": 3,
		"bullets": 0,
		"skills": JSON.parse(JSON.stringify(characters[num].skills)),
		"status": characters[num].status,
		"momentum": null
	};

	setUnit(board, player.pos, "player");

	if (player.name==="魂魄妖梦") {
		setUnit(board, [player.pos[0],player.pos[1]+1], "half_ghost");
	}

	var game = {
		"board": board,
		"player": player,
		"turn": 0
	};

	// 开局召唤5个幽灵
	/*for (var i=0; i<5; ++i) {
		summonBullet(game,"bullet");
	}*/
	for (var i=0; i<5; ++i) {
		summonBullet(game, "ghost");
	}

	//console.log(player.skills["q"]);

	return game;
}

function display(game) {
	var board = game.board;
	var result = `第${game.turn + 1}回合\n消弹数：${game.player.bullets}\n残机：${game.player.hp}\n`;
	result += "技能cd：";
	for (var key of ['q','w','e']) {
		result += key + ":" + game.player.skills[key].cd + " ";
	}
	result += '\n';
	if (characters[game.player.num].status_display(game.player.status)) result += characters[game.player.num].status_display(game.player.status)+'\n';
	for (var row=0; row<board.length; ++row) {
		for (var column=0; column<board[row].length; ++column) {
			if (board[row][column] === null) {
				result += "❌";
			}
			else if (board[row][column] === "player") {
				if (game.player.name==="琪露诺") result += "🧊";
				else result += "😊";
			}
			else if (board[row][column] === "bullet") {
				result += "🌀";
			}
			else if (board[row][column] === "ghost") {
				result += "👻";
			}
			else if (board[row][column] === "flower") {
				result += "🌼";
			}
			else if (board[row][column] === "shanghai") {
				result += "🛡️";
			}
			else if (board[row][column] === "hourai") {
				result += "💣";
			}
			else if (board[row][column] === "half_ghost") {
				result += "⚪";
			}
			else if (board[row][column] === "sun") {
				result += "☀️";
			}
		}
		result += "\n";
	}
	result = result.slice(0,result.length-1);
	return result;
}

function operate(game, command) {
	console.log("指令："+command);
	if (command === "过") {
		if (endTurn(game)) {console.log('continue');return display(game);}
		else {console.log('end');return "你输了\n" + display(game);}
	}
	else if (['上','下','左','右'].includes(command)) {
		var success = move(game, command);
		if (success) {
			game.player.momentum = command;
			if (endTurn(game)) return display(game);
			else return "你输了\n" + display(game);
		}
		else {
			return "操作失败，请重新操作";
		}
	}
	else if (['q','w','e'].includes(command[0])) {
		var skill = skills[game.player.skills[command[0]].name];
		if (game.player.skills[command[0]].cd > 0) return "";
		if (skill.arguments.length === 0) {
			if (command.length === 1) {
				game.player.skills[command[0]].cd = skill.cd;
				skill.effect(game);
				if (endTurn(game)) return `你使用了${skill.name}\n`+display(game);
				else return `你使用了${skill.name}\n`+"你输了\n" + display(game);
			}
			else return "";
		}
		else if (skill.arguments.length === 1) {
			// 八云紫/灵乌路空的二段技能判定
			if ((skill.name==="有限与无限的交错"&&game.player.status[1]!==null)||(skill.name==="幻想狂想穴"&&game.player.status[2]!==null)||(skill.name==="地底太阳"&&game.player.status[0][0]==='e')) {
				//console.log(command);
				if (command.length === 1) {
					game.player.skills[command[0]].cd = skill.cd;
					console.log('start');
					skill.effect(game);
					console.log('end');
					if (endTurn(game)) return `你使用了${skill.name}\n`+display(game);
					else return `你使用了${skill.name}\n`+"你输了\n" + display(game);
				}
				else return "";
			}
			// 正常判定
			else if (command.length >= 3 && command[1] === " ") {
				if (skill.arguments[0] === "direction") {
					if (['上','下','左','右'].includes(command.slice(2))) {
						game.player.skills[command[0]].cd = skill.cd;
						skill.effect(game, command.slice(2));
						if (endTurn(game)) return `你使用了${skill.name}\n`+display(game);
						else return `你使用了${skill.name}\n`+"你输了\n" + display(game);
					}
					else return "";
				}
				else if (skill.arguments[0] === "positive_int") {
					if (!(isNaN(command.slice(2)))) {
						var num = parseInt(command.slice(2));
						if (num>0) {
							game.player.skills[command[0]].cd = skill.cd;
							skill.effect(game, num);
							if (endTurn(game)) return `你使用了${skill.name}\n`+display(game);
							else return `你使用了${skill.name}\n`+"你输了\n" + display(game);
						}
						else return "";
					}
					else return "";
				}
				else if (skill.arguments[0] === "position") {
					if (!(isNaN(command[2])) && !(isNaN(command[4])) && ['_','.'].includes(command[3])) {
						var row = parseInt(command[2])-1;
						var column = parseInt(command[4])-1;
						var condition = row>=0 && row<game.board.length && column>=0 && column<game.board[0].length;
						if (skill.name==="幻想乡的开花") condition = row>=1 && row<game.board.length-1 && column>=1 && column<game.board[0].length-1;
						if (condition) {
							game.player.skills[command[0]].cd = skill.cd;
							skill.effect(game, [row, column]);
							if (endTurn(game)) return `你使用了${skill.name}\n`+display(game);
							else return `你使用了${skill.name}\n`+"你输了\n" + display(game);
						}
						else return "";
					}
					else return "";
				}
			}
			else return "";
		}
	}
	else {
		return "";
	}
}

// character database
// "cd" means initial cooldown
var characters = [
	{
		"name": "博丽灵梦",
		"abbr": "灵梦",
		"skills": {
			"q": {"name": "封魔针", "cd": 0},
			"w": {"name": "梦想封印·散", "cd": 0},
			"e": {"name": "梦想天生", "cd": 0}
		},
		"status": null, // 梦想天生状态
		"status_display": (status)=>{
			if (status==="梦想天生") {
				return "☯️梦想天生☯️";
			}
			else return "";
		}
	},
	{
		"name": "雾雨魔理沙",
		"abbr": "魔理沙",
		"skills": {
			"q": {"name": "极限火花", "cd": 0},
			"w": {"name": "小行星带", "cd": 0},
			"e": {"name": "太阳仪", "cd": 0}
		},
		"status": [0, false], // 消弹计数器, 免疫弹幕攻击
		"status_display": (status)=>{
			return "";
		}
	},
	{
		"name": "西行寺幽幽子",
		"abbr": "幽幽子",
		"skills": {
			"q": {"name": "华胥的永眠", "cd": 8},
			"w": {"name": "樱之结界", "cd": 0},
			"e": {"name": "暴食", "cd": 0}
		},
		"status": null, // 樱之结界阻止弹幕生成
		"status_display": (status)=>{
			return "";
		}
	},
	{
		"name": "琪露诺",
		"abbr": "琪露诺",
		"skills": {
			"q": {"name": "完美冰晶", "cd": 1},
			"w": {"name": "仲夏的雪人", "cd": 0},
			"e": {"name": "冷冻激光", "cd": 0}
		},
		"status": 1, // 完美冰晶数值
		"status_display": (status)=>{
			return "完美冰晶数值："+status.toString();
		}
	},
	{
		"name": "十六夜咲夜",
		"abbr": "咲夜",
		"skills": {
			"q": {"name": "银色利刃", "cd": 0},
			"w": {"name": "消失", "cd": 0},
			"e": {"name": "私人领域", "cd": 0}
		},
		"status": null, // 消失阻止弹幕生成
		"status_display": (status)=>{
			return "";
		}
	},
	{
		"name": "八云紫",
		"abbr": "紫",
		"skills": {
			"q": {"name": "枕石嫩流", "cd": 0},
			"w": {"name": "有限与无限的交错", "cd": 0},
			"e": {"name": "幻想狂想穴", "cd": 0}
		},
		"status": [null,null,null], // 分别对应三个技能
		"status_display": (status)=>{
			var display_q = ''; 
			var display_w = ''; 
			var display_e = '';
			if (status[0]!==null) {
				display_q = `q吸收弹幕：`;
				for (var item of status[0]) {
					if (item===null) display_q += "❌";
					else if (item==="bullet") display_q += "🌀";
					else if (item==="ghost") display_q += "👻";
				}
				display_q += ' ';
			}
			if (status[1]!==null) {
				display_w = `w坐标：${status[1][0]+1}_${status[1][1]+1} `;
			}
			if (status[2]!==null) {
				display_e = `e坐标：${status[2][0]+1}_${status[2][1]+1}`;
			}
			return display_q + display_w + display_e;
		}
	},
	{
		"name": "风见幽香",
		"abbr": "幽香",
		"skills": {
			"q": {"name": "老旧的阳伞", "cd": 0},
			"w": {"name": "魔炮", "cd": 0},
			"e": {"name": "幻想乡的开花", "cd": 0}
		},
		"status": ["上",null,0], // 伞的朝向,花的坐标,伞的消弹计数
		"status_display": (status)=>{
			return `伞的方向：${status[0]} 魔炮宽度：${1+status[2]-status[2]%2}`;
		}
	},
	{
		"name": "爱丽丝",
		"abbr": "爱丽丝",
		"skills": {
			"q": {"name": "上海人形", "cd": 0},
			"w": {"name": "蓬莱人形", "cd": 0},
			"e": {"name": "小小军势", "cd": 0}
		},
		"status": {}, // 上海人偶血量，key=JSON.stringify(坐标)
		"status_display": (status)=>{
			return "";
		}
	},
	{
		"name": "魂魄妖梦",
		"abbr": "妖梦",
		"skills": {
			"q": {"name": "三魂七魄", "cd": 0},
			"w": {"name": "二刀流", "cd": 0},
			"e": {"name": "六道怪奇", "cd": 0}
		},
		"status": "右", // 半灵方向
		"status_display": (status)=>{
			return "";
		}
	},
	{
		"name": "灵乌路空",
		"abbr": "阿空",
		"skills": {
			"q": {"name": "熔解", "cd": 0},
			"w": {"name": "爆火陨落", "cd": 0},
			"e": {"name": "地底太阳", "cd": 0}
		},
		"status": [[null, null], [null, 0], [null, 0, false]], // 上一个使用的技能+本回合使用的技能，q的方向和本回合是否使用(0/1)，e的坐标和半径(1+)和是否在回合结束时end channel
		"status_display": (status)=>{
			return "";
		}
	}
];

function show_skills(player) {
	//console.log('start');
	var reply = player.name;
	for (var key in player.skills) {
		//console.log(key);
	    var skill_name = player.skills[key].name;
	    //console.log(skill_name);
	    reply += `\n${key}(${skill_name}): ${skills[skill_name].description} cd:${skills[skill_name].cd}`;
	}
	return reply;
}

module.exports = {
	"initialize": initialize,
	"display": display,
	"operate": operate,
	"characters": characters,
	"show_skills": show_skills
};

function move(game, direction) {
	var pos = game.player.pos;
	// 妖梦和麻薯的移动
	if (game.player.name==="魂魄妖梦") {
		if (game.player.status==="右") {
			var pos_left = pos;
			var pos_right = [pos[0],pos[1]+1];
		}
		else {
			var pos_left = [pos[0],pos[1]-1];
			var pos_right = pos;
		}
		if (direction === "上") {
			if (pos[0] === 0 || getUnit(game.board, [pos_left[0]-1, pos_left[1]]) !== null || getUnit(game.board, [pos_right[0]-1, pos_right[1]]) !== null) {
				return false;
			}
			else {
				switchUnit(game.board, pos_left, [pos_left[0]-1, pos_left[1]]);
				switchUnit(game.board, pos_right, [pos_right[0]-1, pos_right[1]]);
				game.player.pos[0] -= 1;
				return true;
			}
		}
		else if (direction === "下") {
			if (pos[0] === game.board.length-1 || getUnit(game.board, [pos_left[0]+1, pos_left[1]]) !== null || getUnit(game.board, [pos_right[0]+1, pos_right[1]]) !== null) {
				return false;
			}
			else {
				switchUnit(game.board, pos_left, [pos_left[0]+1, pos_left[1]]);
				switchUnit(game.board, pos_right, [pos_right[0]+1, pos_right[1]]);
				game.player.pos[0] += 1;
				return true;
			}
		}
		else if (direction === "左") {
			if (pos_left[1] === 0 || getUnit(game.board, [pos_left[0], pos_left[1]-1]) !== null) {
				return false;
			}
			else {
				switchUnit(game.board, pos_left, [pos_left[0], pos_left[1]-1]);
				switchUnit(game.board, pos_right, [pos_right[0], pos_right[1]-1]);
				game.player.pos[1] -= 1;
				return true;
			}
		}
		else if (direction === "右") {
			if (pos_right[1] === game.board[0].length-1 || getUnit(game.board, [pos_right[0], pos_right[1]+1]) !== null) {
				return false;
			}
			else {
				switchUnit(game.board, pos_right, [pos_right[0], pos_right[1]+1]);
				switchUnit(game.board, pos_left, [pos_left[0], pos_left[1]+1]);
				game.player.pos[1] += 1;
				return true;
			}
		}
	}
	// 正常移动
	else {
		if (direction === "上") {
			if (pos[0] === 0 || getUnit(game.board, [pos[0]-1, pos[1]]) !== null) {
				return false;
			}
			else {
				switchUnit(game.board, pos, [pos[0]-1, pos[1]]);
				game.player.pos[0] -= 1;
				return true;
			}
		}
		else if (direction === "下") {
			if (pos[0] === game.board.length-1 || getUnit(game.board, [pos[0]+1, pos[1]]) !== null) {
				return false;
			}
			else {
				switchUnit(game.board, pos, [pos[0]+1, pos[1]]);
				game.player.pos[0] += 1;
				return true;
			}
		}
		else if (direction === "左") {
			if (pos[1] === 0 && game.player.name==="八云紫" && getUnit(game.board, [pos[0], game.board[0].length-1]) === null) {
				switchUnit(game.board, pos, [pos[0],game.board[0].length-1]);
				game.player.pos[1] = game.board[0].length-1;
				return true;
			}
			else if (pos[1] === 0 || getUnit(game.board, [pos[0], pos[1]-1]) !== null) {
				return false;
			}
			else {
				switchUnit(game.board, pos, [pos[0], pos[1]-1]);
				game.player.pos[1] -= 1;
				return true;
			}
		}
		else if (direction === "右") {
			if (pos[1] === game.board[0].length-1 && game.player.name==="八云紫" && getUnit(game.board, [pos[0], 0]) === null) {
				switchUnit(game.board, pos, [pos[0],0]);
				game.player.pos[1] = 0;
				return true;
			}
			else if (pos[1] === game.board[0].length-1 || getUnit(game.board, [pos[0], pos[1]+1]) !== null) {
				return false;
			}
			else {
				switchUnit(game.board, pos, [pos[0], pos[1]+1]);
				game.player.pos[1] += 1;
				return true;
			}
		}
		else return false;
	}
}

// returns if game continues
function endTurn(game) {
	game.turn += 1;
	// 幽香q消弹
	if (game.player.name==="风见幽香") {
		var dir = game.player.status[0];
		var [row, column] = game.player.pos;
		var target = null;
		if (dir==="上"&&row>0) target = [row-1,column];
		else if (dir==="下"&&row<game.board.length-1) target = [row+1,column];
		else if (dir==="左"&&column>0) target = [row,column-1];
		else if (dir==="右"&&column<game.board[0].length-1) target = [row,column+1];
		if (target!==null && ['bullet','ghost'].includes(getUnit(game.board, target))) {
			destroy(game, target);
			game.player.status[2] += 1;
		}
	}
	// 上海人偶承伤
	if (game.player.name==="爱丽丝") {
		for (var key in game.player.status) {
			var pos = JSON.parse(key);
			var hit = false;
			for (var neighbor of getNeighbors(game, pos)) {
				if (['bullet','ghost','hourai'].includes(getUnit(game.board, neighbor))) {
					setUnit(game.board, neighbor, null);
					hit = true;
				}
			}
			if (hit) game.player.status[key] -= 1;
			if (game.player.status[key]===0) {
				delete game.player.status[key];
				setUnit(game.board, pos, null);
			}
		}
	}
	// 半灵消弹
	if (game.player.name==="魂魄妖梦") {
		if (game.player.status==="右") var pos = [game.player.pos[0],game.player.pos[1]+1];
		else var pos = [game.player.pos[0],game.player.pos[1]-1];
		for (var neighbor of getNeighbors(game, pos)) {
			destroy(game, neighbor);
		}
	}

	if (attackPlayer(game)) { // if hit, skip summoning bullets
		game.player.hp -= 1;
		if (game.player.name==="博丽灵梦") {
			game.player.status = "梦想天生";
		}
	}
	else {
		if (game.player.name==="西行寺幽幽子" && game.player.status==="immune") {game.player.status=null;}
		else if (game.player.name==="十六夜咲夜" && game.player.status==="skip") {game.player.status=null;}
		else {grandSummon(game);}
	}

	if (game.player.name==="灵乌路空") {
		if (game.player.status[0][0] !== game.player.status[0][1]) {
			if (game.player.status[0][0]==='w') {
				game.player.skills['w'].cd = 2;
			}
			else if (game.player.status[0][0]==='e') {
				game.player.skills['e'].cd = 3;
				game.player.status[2][2] = true;
			}
		}
		if (game.player.status[1][1]===1) {
			var dir = game.player.status[1][0];
			var targets = direction_line(game, dir);
			for (var target of targets) {
				destroy(game, target);
			}
			game.player.status[1][0] = null;
			game.player.status[1][1] = 0;	
		}
		game.player.status[0][0] = game.player.status[0][1];
		game.player.status[0][1] = null;

		if (game.player.status[2][2]===true) {
			for (var row=0; row<game.board.length; ++row) {
				for (var column=0; column<game.board[row].length; ++column) {
					if (getUnit(game.board, [row, column])==="sun") {
						setUnit(game.board, [row, column], null);
					}
				}
			}
			game.player.status[2][0] = null;
			game.player.status[2][1] = 0;
			game.player.status[2][2] = false;
			game.player.skills['e'].cd = 3;
		}
	}

	cd_refresh(game.player);

	game.player.momentum = null;

	if (game.player.name==="雾雨魔理沙") game.player.status[1] = false;

	if (game.player.hp <= 0) return false;
	else return true;
}

// returns if player get hit
function attackPlayer(game) {
	var pos = game.player.pos;
	// 幽香的伞
	/*if (game.player.name==="风见幽香") {
		var dir = game.player.status[0];
		if (dir==="上"&&pos[0]>0&&['bullet','ghost'].includes(getUnit(game.board,[pos[0]-1,pos[1]]))) setUnit(game.board,[pos[0]-1,pos[1]], null);
		else if (dir==="下"&&pos[0]<game.board.length-1&&['bullet','ghost'].includes(getUnit(game.board,[pos[0]+1,pos[1]]))) setUnit(game.board,[pos[0]+1,pos[1]], null);
		else if (dir==="左"&&pos[1]>0&&['bullet','ghost'].includes(getUnit(game.board,[pos[0],pos[1]-1]))) setUnit(game.board,[pos[0],pos[1]-1], null);
		else if (dir==="右"&&pos[1]<game.board[0].length-1&&['bullet','ghost'].includes(getUnit(game.board,[pos[0],pos[1]+1]))) setUnit(game.board,[pos[0],pos[1]+1], null);
	}*/


	// bullet/ghost hit
	var hit = false;
	var neighbors = [];
	if (pos[0]>0) neighbors.push([pos[0]-1, pos[1]]);
	if (pos[0]<game.board.length-1) neighbors.push([pos[0]+1, pos[1]]);
	if (pos[1]>0) neighbors.push([pos[0], pos[1]-1]);
	if (pos[1]<game.board[0].length-1) neighbors.push([pos[0], pos[1]+1]);
	//console.log(neighbors);
	for (var neighbor of neighbors) {
		if (["bullet", "ghost","hourai"].includes(getUnit(game.board, neighbor))) {
			var type = getUnit(game.board, neighbor);
			setUnit(game.board, neighbor, null);
			var graze = false;
			if (game.player.momentum === "上" && neighbor[0]===pos[0]-1) graze = true;
			else if (game.player.momentum === "下" && neighbor[0]===pos[0]+1) graze = true;
			else if (game.player.momentum === "左" && neighbor[1]===pos[1]-1) graze = true;
			else if (game.player.momentum === "右" && neighbor[1]===pos[1]+1) graze = true;
			if (!graze) {
				if (game.player.name==="西行寺幽幽子" && type==="ghost") {}
				else hit = true;
			}
			else {
				increment_bullets(game);increment_bullets(game);
				if (game.player.name==="博丽灵梦") game.player.status = "梦想天生";
			}
		}
	}

	// ghost move
	var ghosts = [];
	for (var row=0; row<game.board.length; ++row) {
		for (var column=0; column<game.board[0].length; ++column) {
			if (game.board[row][column] === "ghost") {
				ghosts.push([row, column]);
			}
		}
	}
	for (var [row, column] of ghosts) {
		var destinations = [[row, column]];
		if (row>0 && game.board[row-1][column] === null) destinations.push([row-1, column]);
		if (row<game.board.length-1 && game.board[row+1][column] === null) destinations.push([row+1, column]);
		if (column>0 && game.board[row][column-1] === null) destinations.push([row, column-1]);
		if (column<game.board[0].length-1 && game.board[row][column+1] === null) destinations.push([row, column+1]);
		//console.log(destinations);
		var destination = randomone(destinations);
		switchUnit(game.board, [row, column], destination);
	}

	if (game.player.name==="雾雨魔理沙" && game.player.status[1]===true) {
		hit = false;
	}

	return hit;
}

// type="bullet" or "ghost"
function summonBullet(game,type) {
	var emptyUnits = [];
	for (var row=0; row<game.board.length; ++row) {
		for (var column=0; column<game.board[row].length; ++column) {
			if (game.board[row][column]===null) emptyUnits.push([row, column]);
		}
	}
	if (emptyUnits.length===0) return false;
	var target = randomone(emptyUnits);
	setUnit(game.board, target, type);
	return false;
}

function grandSummon(game) {
	for (var i=0; i<game.turn/15; i+=1) {
		summonBullet(game, "bullet");
		summonBullet(game, "bullet");
		summonBullet(game, "ghost");
	}
	return false;
}

// remove bullet / explode ghost
function destroy(game, pos) {
	if (pos[0]>=0 && pos[0]<game.board.length && pos[1]>=0 && pos[1]<game.board[0].length) {
		if (getUnit(game.board, pos) === "bullet") {
			setUnit(game.board, pos, null);
			increment_bullets(game);
		}
		else if (getUnit(game.board, pos) === "ghost") {
			setUnit(game.board, pos, null);
			increment_bullets(game);
			destroy(game, [pos[0]-1,pos[1]]);
			destroy(game, [pos[0]+1,pos[1]]);
			destroy(game, [pos[0],pos[1]-1]);
			destroy(game, [pos[0],pos[1]+1]);
		}
		else if (getUnit(game.board, pos) === "hourai") {
			console.log("hourai destroyed");
			setUnit(game.board, pos, null);
			increment_bullets(game);
			for (var row=pos[0]-1; row<=pos[0]+1; ++row) {
				for (var column=pos[1]-1; column<=pos[1]+1; ++column) {
					destroy(game, [row, column]);
				}
			}
		}
	}
}

// dealing with specific characters
function increment_bullets(game) {
	game.player.bullets += 1;
	if (game.player.name === "雾雨魔理沙") {
		game.player.status[0] += 1;
		if (game.player.status[0]===10) {
			skills["太阳仪"].effect(game);
			game.player.status[0] = 0;
		}
	}
}

function cd_refresh(player) {
	for (var key in player.skills) {
		if (player.skills[key].cd > 0) player.skills[key].cd -= 1;
	}
}

function getUnit(board, pos) {
	return board[pos[0]][pos[1]];
}

function setUnit(board, pos, newValue) {
	board[pos[0]][pos[1]] = newValue;
}

function switchUnit(board, pos1, pos2) {
	[board[pos1[0]][pos1[1]],board[pos2[0]][pos2[1]]] = [board[pos2[0]][pos2[1]],board[pos1[0]][pos1[1]]];
}

function randomone(){
	if(arguments.length == 0) return undefined;
	if(arguments.length == 1) return  arguments[0][Math.floor(Math.random()*arguments[0].length)];
	return arguments[Math.floor(Math.random()*arguments.length)];
}

function random(a, b) {
	return Math.floor(Math.random()*(b-a)+a);
}

function shuffleArray(arr, copy=false) {
	if (copy) arr = Array.from(arr);
	for (var i = arr.length; i > 1;) {
		var r = (Math.random() * i--) | 0;
		[arr[r], arr[i]] = [arr[i], arr[r]];
	}
	return arr;
}

// discrete distance
function distance(pos1, pos2) {
	return Math.abs(pos1[0]-pos2[0]) + Math.abs(pos1[1]-pos2[1]);
}

// continual distance (rounded to integer)
function c_distance(pos1, pos2) {
	var d_square = (pos1[0]-pos2[0])**2 + (pos1[1]-pos2[1])**2
	return Math.round(Math.sqrt(d_square));
}

// 玩家朝某个方向的一条射线。返回array<position>
// direction包括左上、左下、右上、右下
function direction_line(game,direction) {
	var [row, column] = game.player.pos;
	var result = [];
	if (direction==="上") {
		while (row>0) {
			row -= 1;
			result.push([row, column]);
		}
	}
	else if (direction==="下") {
		while (row<game.board.length-1) {
			row += 1;
			result.push([row, column]);
		}
	}
	else if (direction==="左") {
		while (column>0) {
			column -= 1;
			result.push([row, column]);
		}
	}
	else if (direction==="右") {
		while (column<game.board[0].length-1) {
			column += 1;
			result.push([row, column]);
		}
	}
	else if (direction==="左上") {
		while (row>0 && column>0) {
			row -= 1;
			column -= 1;
			result.push([row, column]);
		}
	}
	else if (direction==="左下") {
		while (row<game.board.length-1 && column>0) {
			row += 1;
			column -= 1;
			result.push([row, column]);
		}
	}
	else if (direction==="右上") {
		while (row>0 && column<game.board[0].length-1) {
			row -= 1;
			column += 1;
			result.push([row, column]);
		}
	}
	else if (direction==="右下") {
		while (row<game.board.length-1 && column<game.board[0].length-1) {
			row += 1;
			column += 1;
			result.push([row, column]);
		}
	}
	return result;
}

function getNeighbors(game, pos=null) {
	if (pos===null) {
		var [row,column] = game.player.pos;
	}
	else var [row,column] = pos;
	var board = game.board;

	var targets = [];
	if (row>0) targets.push([row-1,column]);
	if (row<board.length-1) targets.push([row+1,column]);
	if (column>0) targets.push([row,column-1]);
	if (column<board[0].length) targets.push([row,column+1]);
	return targets;
}

// skill database
var skills = {
	"null": {
		"name": "null",
		"cd": 0,
		"arguments": [],
		"description": "什么也不做",
		"effect": (game)=>{}
	},
	"封魔针": {
		"name": "封魔针",
		"cd": 2,
		"arguments": ["direction"],
		"description": "消去指定方向上的前两个弹（参数：方向）",
		"effect": (game, direction)=>{
			var pos = game.player.pos;
			var [row, column] = pos;
			var target;

			for (var i=0; i<2; ++i) {
				if (direction === "上") {
					while (row > 0) {
						row-=1;
						if (["bullet","ghost"].includes(getUnit(game.board, [row, column]))) {
							target = [row, column];
							break;
						}
					}
				}
				else if (direction === "下") {
					while (row < game.board.length-1) {
						row+=1;
						if (["bullet","ghost"].includes(getUnit(game.board, [row, column]))) {
							target = [row, column];
							break;
						}
					}
				}
				else if (direction === "左") {
					while (column > 0) {
						column-=1;
						if (["bullet","ghost"].includes(getUnit(game.board, [row, column]))) {
							target = [row, column];
							break;
						}
					}
				}
				else if (direction === "右") {
					while (column < game.board[0].length-1) {
						console.log('1');
						column+=1;
						if (["bullet","ghost"].includes(getUnit(game.board, [row, column]))) {
							target = [row, column];
							break;
						}
					}
				}
				if (game.player.status === "梦想天生") {
					setUnit(game.board, target, "ghost");
					game.player.status = null;
				}
				destroy(game, target);
			}
			
		}
	},
	"梦想封印·散": {
		"name": "梦想封印·散",
		"cd": 4,
		"arguments": [],
		"description": "消去距离最近的三个弹",
		"effect": (game)=>{
			var pos = game.player.pos;
			var board = game.board;
			for (var i=0; i<3; ++i) {
				var target = null;
				var min_d = 100;
				for (var row=0; row<board.length; ++row) {
					for (var column=0; column<board[row].length; ++column) {
						if (["bullet", "ghost"].includes(getUnit(board, [row,column]))) {
							var d = distance(pos, [row,column]);
							if (d < min_d) {
								target = [row,column];
								min_d = d;
							}
						}
					}
				}
				if (game.player.status === "梦想天生" && target!==null) setUnit(board, target, "ghost");
				if (target!==null) destroy(game, target);
			}
			if (game.player.status === "梦想天生") {
				game.player.status = null;
			}
		}
	},
	"梦想天生": {
		"name": "梦想天生",
		"cd": 7,
		"arguments": [],
		"description": "3*3范围消弹。使下一个技能附带爆炸，受击或擦弹会自动提供此状态",
		"effect": (game)=>{
			var pos = game.player.pos;
			var [row, column] = pos;
			var board = game.board;
			var targets = [];
			for (var row=Math.max(0,pos[0]-1); row<=Math.min(board.length-1,pos[0]+1); ++row) {
				for (var column=Math.max(0,pos[1]-1); column<=Math.min(board[row].length-1,pos[1]+1); ++column) {
					targets.push([row, column]);
				}
			}

			if (game.player.status === "梦想天生") {
				for (var pos of targets) {
					if (getUnit(board, pos)==="bullet") setUnit(board, pos, "ghost");
				}
			}
			for (var pos of targets) {
				destroy(game, pos);
			}
			game.player.status = "梦想天生";
		}
	},
	"极限火花": {
		"name": "极限火花",
		"cd": 10,
		"arguments": ["direction"],
		"description": "向指定方向发射宽为3的激光（参数：方向）",
		"effect": (game, direction)=>{
			var pos = game.player.pos;
			var board = game.board;
			if (direction==="上") {
				for (var row=0; row<pos[0]; ++row) {
					for (var column=Math.max(0,pos[1]-1); column<=Math.min(board[row].length-1,pos[1]+1); ++column) {
						destroy(game, [row,column]);
					}
				}
			}
			else if (direction==="下") {
				for (var row=board.length-1; row>pos[0]; --row) {
					for (var column=Math.max(0,pos[1]-1); column<=Math.min(board[row].length-1,pos[1]+1); ++column) {
						destroy(game, [row,column]);
					}
				}
			}
			else if (direction==="左") {
				for (var row=Math.max(0,pos[0]-1); row<=Math.min(board.length-1,pos[0]+1); ++row) {
					for (var column=0; column<pos[1]; ++column) {
						destroy(game, [row,column]);
					}
				}
			}
			else if (direction==="右") {
				for (var row=Math.max(0,pos[0]-1); row<=Math.min(board.length-1,pos[0]+1); ++row) {
					for (var column=board[row].length-1; column>pos[1]; --column) {
						destroy(game, [row,column]);
					}
				}
			}
		}
	},
	"小行星带": {
		"name": "小行星带",
		"cd": 7,
		"arguments": ["positive_int"],
		"description": "消除指定半径圆周上的弹（参数：整数）",
		"effect": (game,radius)=>{
			//console.log(radius);
			var pos = game.player.pos;
			var board = game.board;
			for (var row=0; row<board.length; ++row) {
				for (var column=0; column<board[row].length; ++column) {
					//console.log([row, column]);
					//console.log(c_distance([row, column], pos));
					if (c_distance([row, column], pos)===radius) destroy(game, [row,column]);
				}
			}
		}
	},
	"太阳仪": {
		"name": "太阳仪",
		"cd": 5,
		"arguments": [],
		"description": "所有技能cd-2，消去距离最近的一个弹幕。每消弹10个自动触发",
		"effect": (game)=>{
			game.player.skills["q"].cd = Math.max(0, game.player.skills["q"].cd - 2);
			game.player.skills["w"].cd = Math.max(0, game.player.skills["w"].cd - 2);
			game.player.skills["e"].cd = Math.max(0, game.player.skills["e"].cd - 2);
			//game.player.status[1] = true;
			var target = null;
			var min_d = 100;
			for (var r=0; r<game.board.length; ++r) {
				for (var c=0; c<game.board[r].length; ++c) {
					if (['bullet','ghost'].includes(getUnit(game.board, [r,c]))) {
						var d = distance([r,c], game.player.pos);
						if (d < min_d) {
							target = [r,c];
							min_d = d;
						}
					}
				}
			}
			if (target!==null) destroy(game, target);
		}
	},
	"华胥的永眠": {
		"name": "华胥的永眠",
		"cd": 9,
		"arguments": [],
		"description": "向八个方向各发射一只幽灵并引爆。被动：免疫幽灵的攻击",
		"effect": (game)=>{
			for (var direction of ['上','下','左','右','左上','左下','右上','右下']) {
				var line = direction_line(game, direction);
				console.log(line);
				if (line.length>0 && getUnit(game.board, line[0])===null) {
					for (var i=0; i<line.length; ++i) {
						if (getUnit(game.board, line[i])!==null) {
							setUnit(game.board, line[i-1], "ghost");
							destroy(game, line[i-1]);
							break;
						}
						if (i===line.length-1) {
							setUnit(game.board, line[i], "ghost");
							destroy(game, line[i]);
						}
					}
				}
			}
		}
	},
	"樱之结界": {
		"name": "樱之结界",
		"cd": 2,
		"arguments": [],
		"description": "残机-1，3*3范围消弹",
		"effect": (game)=>{
			var pos = game.player.pos;
			var board = game.board;

			game.player.hp -= 1;
			for (var row=Math.max(0,pos[0]-1); row<=Math.min(board.length-1,pos[0]+1); ++row) {
				for (var column=Math.max(0,pos[1]-1); column<=Math.min(board[row].length-1,pos[1]+1); ++column) {
					destroy(game, [row, column]);
				}
			}

			game.player.status = "immune";
		}
	},
	"暴食": {
		"name": "暴食",
		"cd": 5,
		"arguments": ["direction"],
		"description": "向一个方向移动。消掉目标位置的弹并恢复一个残机（参数：方向）",
		"effect": (game, direction)=>{
			var line = direction_line(game, direction);
			if (line.length>0 && ["bullet","ghost"].includes(getUnit(game.board, line[0]))) {
				destroy(game, line[0]);
				game.player.hp = Math.min(3, game.player.hp+1);
			}
			if (line.length>0) move(game, direction);
			game.player.momentum = direction;
		}
	},
	"完美冰晶": {
		"name": "完美冰晶",
		"cd": 2,
		"arguments": [],
		"description": "在随机1个位置消弹，并使此数字永久+1",
		"effect": (game)=>{
			var num = game.player.status;
			var all_units = [];
			for (var i=0; i<game.board.length; ++i) {
				for (var j=0; j<game.board[i].length; ++j) {
					all_units.push([i,j]);
				}
			}
			all_units = shuffleArray(all_units);
			for (var i=0; i<num; ++i) {
				destroy(game, all_units[i]);
			}
			game.player.status = Math.min(49,game.player.status+1);
		}
	},
	"仲夏的雪人": {
		"name": "仲夏的雪人",
		"cd": 4,
		"arguments": ["direction"],
		"description": "向指定方向推雪球，消弹则继续推，到达空地爆炸（参数：方向）",
		"effect": (game, direction)=>{
			var line = direction_line(game, direction);
			if (line.length>0) {
				for (var i=0; i<line.length; ++i) {
					if (getUnit(game.board, line[i])===null) {
						move(game, direction);
						var targets = getNeighbors(game);
						for (var target of targets) { 
							destroy(game, target); 
						}
						break;
					}
					else {
						destroy(game, line[i]);
						move(game, direction);
					}
				}
			}
		}
	},
	"冷冻激光": {
		"name": "冷冻激光",
		"cd": 3,
		"arguments": ["direction"],
		"description": "分别消去指定方向和其两侧斜向的第一个弹（参数：方向）",
		"effect": (game, direction)=>{
			var directions = [direction];
			if (direction==="上") {directions.push("左上");directions.push("右上");}
			else if (direction==="下") {directions.push("左下");directions.push("右下");}
			else if (direction==="左") {directions.push("左上");directions.push("左下");}
			else if (direction==="右") {directions.push("右上");directions.push("右下");}

			for (var dir of directions) {
				var line = direction_line(game, dir);
				if (line.length>0) {
					for (var i=0; i<line.length; ++i) {
						if (getUnit(game.board, line[i])!==null) {
							destroy(game, line[i]);
							break;
						}
					}
				}
			}
		}
	},
	"银色利刃": {
		"name": "银色利刃",
		"cd": 2,
		"arguments": ["position"],
		"description": "在距离不超过2的指定位置消弹。如果消弹量达到2，cd-1（参数：坐标）",
		"effect": (game, position)=>{
			var initial_bullets = game.player.bullets;

			if (distance(game.player.pos, position)<=2) destroy(game, position);

			var new_bullets = game.player.bullets - initial_bullets;
			if (new_bullets >= 2) {
				game.player.skills['q'].cd -= 1;
			}
		}
	},
	"消失": {
		"name": "消失",
		"cd": 3,
		"arguments": ["position"],
		"description": "移动到距离不超过2的指定位置。本回合不生成弹幕（参数：坐标）",
		"effect": (game, position)=>{
			if (distance(game.player.pos, position)<=2) {
				if (position[0]===game.player.pos[0]) {
					if (position[1]>game.player.pos[1]) game.player.momentum = "右";
					else if (position[1]<game.player.pos[1]) game.player.momentum = "左";
				}
				else if (position[1]===game.player.pos[1]) {
					if (position[0]>game.player.pos[0]) game.player.momentum = "下";
					else if (position[0]<game.player.pos[0]) game.player.momentum = "上";
				}

				if (getUnit(game.board, position)===null) {
					switchUnit(game.board, game.player.pos, position);
					game.player.pos = position;
				}
				game.player.status = "skip";
			}
		}
	},
	"私人领域": {
		"name": "私人领域",
		"cd": 5,
		"arguments": [],
		"description": "消去周围的弹，每消一个回合数+1",
		"effect": (game)=>{
			var targets = getNeighbors(game);
			for (target of targets) {
				if (["bullet","ghost"].includes(getUnit(game.board, target))) {
					game.turn += 1;
				}
			}
			for (target of targets) {
				if (["bullet","ghost"].includes(getUnit(game.board, target))) {
					destroy(game, target);
				}
			}
		}
	},
	"枕石嫩流": {
		"name": "枕石嫩流",
		"cd": 2,
		"arguments": ["direction"],
		"description": "将指定方向前方横向三格的弹幕收入隙间，下次使用改为发射它们并与场地弹幕反应抵消（参数：方向）",
		"effect": (game,direction)=>{
			var [row, column] = game.player.pos;
			var board = game.board;
			var height = board.length;
			var width = board[0].length;
			if (game.player.status[0]===null) {
				if (direction==="上") {
					if (row===0) return;
					game.player.status[0] = [];
					for (var c of [(column-1+width)%width, column, (column+1+width)%width]) {
						game.player.status[0].push(getUnit(board, [row-1, c]));
						setUnit(board, [row-1, c], null);
					}
				}
				else if (direction==="下") {
					if (row===height-1) return;
					game.player.status[0] = [];
					for (var c of [(column+1+width)%width, column, (column-1+width)%width]) {
						game.player.status[0].push(getUnit(board, [row+1, c]));
						setUnit(board, [row+1, c], null);
					}
				}
				else if (direction==="左") {
					game.player.status[0] = [];

					if (row<height-1) {
						game.player.status[0].push(getUnit(board, [row+1, (column-1+width)%width]));
						setUnit(board, [row+1, (column-1+width)%width], null);
					}
					else game.player.status[0].push(null);

					game.player.status[0].push(getUnit(board, [row, (column-1+width)%width]));
					setUnit(board, [row, (column-1+width)%width], null);

					if (row>0) {
						game.player.status[0].push(getUnit(board, [row-1, (column-1+width)%width]));
						setUnit(board, [row-1, (column-1+width)%width], null);
					}
					else game.player.status[0].push(null);
				}
				else if (direction==="右") {
					if (column===width-1) return;
					game.player.status[0] = [];

					if (row>0) {
						game.player.status[0].push(getUnit(board, [row-1, (column+1+width)%width]));
						setUnit(board, [row-1, (column+1+width)%width], null);
					}
					else game.player.status[0].push(null);

					game.player.status[0].push(getUnit(board, [row, (column+1+width)%width]));
					setUnit(board, [row, (column+1+width)%width], null);

					if (row<height-1) {
						game.player.status[0].push(getUnit(board, [row+1, (column+1+width)%width]));
						setUnit(board, [row+1, (column+1+width)%width], null);
					}
					else game.player.status[0].push(null);
				}
			}
			else {
				/*if (row===0) {
					game.player.status[0] = null;
					return;
				}
				else {
					var i=0;
					for (var c of [(column-1+width)%width, column, (column+1+width)%width]) {
						if (game.player.status[0][i]!==null) {
							if (getUnit(board, [row-1, c])===null) setUnit(board, [row-1, c], game.player.status[0][i]);
							else {
								destroy(game, [row-1, c]);
								setUnit(board, [row-1, c], game.player.status[0][i]);
								destroy(game, [row-1, c]);
							}
						}
						++i;
					}
					game.player.status[0] = null;
				}*/
				var targets = [];
				if (direction==="上") {
					if (row===0) targets = [null, null, null];
					else {
						for (var c of [(column-1+width)%width, column, (column+1+width)%width]) {
							targets.push([row-1, c]);
						}
					}
				}
				else if (direction==="下") {
					if (row===height-1) targets = [null, null, null];
					else {
						for (var c of [(column+1+width)%width, column, (column-1+width)%width]) {
							targets.push([row+1, c]);
						}
					}
				}
				else if (direction==="左") {
					if (row<height-1) {
						targets.push([row+1, (column-1+width)%width]);
					}
					else targets.push(null);

					targets.push([row, (column-1+width)%width]);

					if (row>0) {
						targets.push([row-1, (column-1+width)%width]);
					}
					else targets.push(null);
				}
				else if (direction==="右") {
					if (row>0) {
						targets.push([row-1, (column+1+width)%width]);
					}
					else targets.push(null);

					targets.push([row, (column+1+width)%width]);

					if (row<height-1) {
						targets.push([row+1, (column+1+width)%width]);
					}
					else targets.push(null);
				}
				for (var i=0; i<3; ++i) {
					if (targets[i]!==null) {
						if (game.player.status[0][i]!==null) {
							if (getUnit(board, targets[i])===null) setUnit(board, targets[i], game.player.status[0][i]);
							else {
								destroy(game, targets[i]);
								setUnit(board, targets[i], game.player.status[0][i]);
								destroy(game, targets[i]);
							}
						}
					}
				}
				game.player.status[0] = null;
			}
		}
	},
	"有限与无限的交错": {
		"name": "有限与无限的交错",
		"cd": 3,
		"arguments": ["position"],
		"description": "消去指定位置的弹，下次使用改为消去其所在行与列（参数：第一次坐标，第二次无）",
		"effect": (game, position=null)=>{
			if (game.player.status[1]===null) {
				destroy(game, position);
				game.player.status[1] = position;
			}
			else {
				var [row, column] = game.player.status[1];
				for (var c=0; c<game.board[0].length; ++c) {
					destroy(game, [row, c]);
				}
				for (var r=0; r<game.board.length; ++r) {
					destroy(game, [r, column]);
				}
				game.player.status[1] = null;
			}
		}
	},
	"幻想狂想穴": {
		"name": "幻想狂想穴",
		"cd": 2,
		"arguments": ["position"],
		"description": "在指定位置生成隙间，下次使用改为传送至隙间并在3*3范围消弹（参数：第一次坐标，第二次无）。被动：可以穿越左右边界",
		"effect": (game, position=null)=>{
			if (game.player.status[2]===null) {
				game.player.status[2] = position;
			}
			else {
				var pos = game.player.status[2];
				destroy(game, pos);
				switchUnit(game.board, game.player.pos, pos);
				game.player.pos = pos;
				/*for (var target of getNeighbors(game)) {
					destroy(game, target);
				}*/
				var height = game.board.length;
				var width = game.board[0].length;
				for (var row=Math.max(0,pos[0]-1); row<=Math.min(height-1, pos[0]+1); ++row) {
					for (var column=pos[1]-1; column<=pos[1]+1; ++column) {
						destroy(game, [row, (column+width)%width]);
					}
				}
				game.player.status[2] = null;
			}
		}
	},
	"老旧的阳伞": {
		"name": "老旧的阳伞",
		"cd": 0,
		"arguments": ["direction"],
		"description": "更改伞的朝向（参数：方向）。被动：回合结束时，伞会消去前方一格的弹幕",
		"effect": (game, direction)=>{
			game.player.status[0] = direction;
		}
	},
	"魔炮": {
		"name": "魔炮",
		"cd": 5,
		"arguments": [],
		"description": "向伞的方向发射激光。伞每消2次弹会使激光宽度+2",
		"effect": (game)=>{
			var dir = game.player.status[0];
			var pos = game.player.pos;
			var board = game.board;
			var extend = (game.player.status[2] - game.player.status[2]%2)/2; // 激光向一侧的宽度延伸
			if (dir==="上") {
				for (var row=0; row<pos[0]; ++row) {
					for (var column=Math.max(0,pos[1]-extend); column<=Math.min(board[row].length-1,pos[1]+extend); ++column) {
						destroy(game, [row,column]);
					}
				}
			}
			else if (dir==="下") {
				for (var row=board.length-1; row>pos[0]; --row) {
					for (var column=Math.max(0,pos[1]-extend); column<=Math.min(board[row].length-1,pos[1]+extend); ++column) {
						destroy(game, [row,column]);
					}
				}
			}
			else if (dir==="左") {
				for (var row=Math.max(0,pos[0]-extend); row<=Math.min(board.length-1,pos[0]+extend); ++row) {
					for (var column=0; column<pos[1]; ++column) {
						destroy(game, [row,column]);
					}
				}
			}
			else if (dir==="右") {
				for (var row=Math.max(0,pos[0]-extend); row<=Math.min(board.length-1,pos[0]+extend); ++row) {
					for (var column=board[row].length-1; column>pos[1]; --column) {
						destroy(game, [row,column]);
					}
				}
			}
			game.player.status[2] = game.player.status[2]%2;
		}
	},
	"幻想乡的开花": {
		"name": "幻想乡的开花",
		"cd": 4,
		"arguments": ["position"],
		"description": "在空地上开一朵花并消去其周围的弹，或将一个弹幕变成一朵花并返还2点cd（参数：坐标，不能在边界）。花同时只能存在一朵。花的消失会引发爆炸，消去周围的弹",
		"effect": (game,position)=>{
			console.log(position);
			var board = game.board;
			if (position[0]===0 || position[0]===board.length-1 || position[1]===0 || position[1]===board[0].length-1) return;
			if (getUnit(board, position)===null) {
				setUnit(board, position, "flower");
				if (game.player.status[1]) { 
					setUnit(board, game.player.status[1], null);
					console.log(getNeighbors(game, game.player.status[1]));
					for (var neighbor of getNeighbors(game, game.player.status[1])) {
						destroy(game, neighbor);
					}
				}
				game.player.status[1] = position;
				var [row,column] = position;
				var targets = [];
				if (row>0) targets.push([row-1,column]);
				if (row<board.length-1) targets.push([row+1,column]);
				if (column>0) targets.push([row,column-1]);
				if (column<board[0].length) targets.push([row,column+1]);
				for (var target of targets) destroy(game, target);
			}
			else if (['bullet','ghost'].includes(getUnit(board, position))) {
				setUnit(board, position, "flower");
				if (game.player.status[1]) { 
					setUnit(board, game.player.status[1], null);
					for (var neighbor of getNeighbors(game, game.player.status[1])) {
						destroy(game, neighbor);
					}
				}
				game.player.status[1] = position;
				game.player.skills['e'].cd -= 2;
			}
		}
	},
	"上海人形": {
		"name": "上海人形",
		"cd": 3,
		"arguments": ["position"],
		"description": "在空地召唤一个上海人偶🛡️，可承受两次攻击（参数：坐标）",
		"effect": (game, position)=>{
			if (getUnit(game.board, position)===null) {
				setUnit(game.board, position, "shanghai");
				game.player.status[JSON.stringify(position)] = 2;
			}
		}
	},
	"蓬莱人形": {
		"name": "蓬莱人形",
		"cd": 2,
		"arguments": ["position"],
		"description": "在空地召唤一个蓬莱人偶💣，其视为弹幕，爆炸范围3*3（参数：坐标）",
		"effect": (game, position)=>{
			if (getUnit(game.board, position)===null) setUnit(game.board, position, "hourai");
		}
	},
	"小小军势": {
		"name": "小小军势",
		"cd": 2,
		"arguments": ["direction"],
		"description": "所有人偶向指定方向发射激光",
		"effect": (game, direction)=>{
			var dolls = []; 
			for (var key in game.player.status) {
				dolls.push(JSON.parse(key));
			} // 上海
			for (var row=0; row<game.board.length; ++row) {
				for (var column=0; column<game.board[0].length; ++column) {
					if (getUnit(game.board, [row, column])==="hourai") {
						dolls.push([row, column]);
					}
				}
			} // 蓬莱
			console.log(dolls);
			for (var doll of dolls) {
				if (direction==="上") {
					for (var row=doll[0]-1; row>=0; --row) {
						destroy(game, [row, doll[1]]);
					}
				}
				else if (direction==="下") {
					for (var row=doll[0]+1; row<game.board.length; ++row) {
						destroy(game, [row, doll[1]]);
					}
				}
				else if (direction==="左") {
					for (var column=doll[1]-1; column>=0; --column) {
						destroy(game, [doll[0], column]);
					}
				}
				else if (direction==="右") {
					for (var column=doll[1]+1; column<game.board[0].length; ++column) {
						destroy(game, [doll[0], column]);
					}
				}
			}
		}
	},
	"三魂七魄": {
		"name": "三魂七魄",
		"cd": 2,
		"arguments": [],
		"description": "交换妖梦与半灵⚪的位置。被动：回合结束时，半灵会消去周围的弹幕",
		"effect": (game)=>{
			var pos = game.player.pos;
			if (game.player.status==="右") {
				switchUnit(game.board, pos, [pos[0],pos[1]+1]);
				game.player.pos[1] += 1;
				game.player.status = "左";
				game.player.momentum = "右";
			}
			else {
				switchUnit(game.board, pos, [pos[0],pos[1]-1]);
				game.player.pos[1] -= 1;
				game.player.status = "右";
				game.player.momentum = "左";
			}
		}
	},
	"二刀流": {
		"name": "二刀流",
		"cd": 3,
		"arguments": ["direction"],
		"description": "消去指定方向前方横向三格的弹幕。如果消弹量达到3，再消去距离妖梦最近的一个弹幕（参数：方向）",
		"effect": (game, direction)=>{
			var [row, column] = game.player.pos;
			var initial_bullets = game.player.bullets;

			// 楼观剑
			var targets = [];
			if (direction==="上"&&row>0) {
				targets.push([row-1,column]);
				if (column>0) targets.push([row-1,column-1]);
				if (column<game.board[0].length-1) targets.push([row-1,column+1]);
			}
			else if (direction==="下"&&row<game.board.length-1) {
				targets.push([row+1,column]);
				if (column>0) targets.push([row+1,column-1]);
				if (column<game.board[0].length-1) targets.push([row+1,column+1]);
			}
			else if (direction==="左"&&column>0) {
				targets.push([row,column-1]);
				if (row>0) targets.push([row-1,column-1]);
				if (row<game.board.length-1) targets.push([row+1,column-1]);
			}
			else if (direction==="右"&&column<game.board[0].length-1) {
				targets.push([row,column+1]);
				if (row>0) targets.push([row-1,column+1]);
				if (row<game.board.length-1) targets.push([row+1,column+1]);
			}
			for (var target of targets) {
				destroy(game, target);
			}

			// 白楼剑
			var new_bullets = game.player.bullets - initial_bullets;
			if (new_bullets >= 3) {
				console.log('start');
				var target = null;
				var min_d = 100;
				for (var r=0; r<game.board.length; ++r) {
					for (var c=0; c<game.board[r].length; ++c) {
						if (['bullet','ghost'].includes(getUnit(game.board, [r,c]))) {
							var d = distance([r,c], [row,column]);
							if (d < min_d) {
								target = [r,c];
								min_d = d;
							}
						}
					}
				}
				//console.log(target);
				if (target!==null) destroy(game, target);
			}
		}
	},
	"六道怪奇": {
		"name": "六道怪奇",
		"cd": 3,
		"arguments": [],
		"description": "消去距离半灵最近的一个幽灵。如果消弹量达到3，cd-1",
		"effect": (game)=>{
			var initial_bullets = game.player.bullets;

			if (game.player.status==="右") var pos = [game.player.pos[0],game.player.pos[1]+1];
			else var pos = [game.player.pos[0],game.player.pos[1]-1];

			var board = game.board;

			var target = null;
			var min_d = 100;
			for (var row=0; row<board.length; ++row) {
				for (var column=0; column<board[row].length; ++column) {
					if (getUnit(board, [row,column])==="ghost") {
						var d = distance(pos, [row,column]);
						if (d < min_d) {
							target = [row,column];
							min_d = d;
						}
					}
				}
			}
			if (target!==null) destroy(game, target);

			var new_bullets = game.player.bullets - initial_bullets;
			if (new_bullets >= 3) {
				game.player.skills['e'].cd -= 1;
			}
		}
	},
	"熔解": {
		"name": "熔解",
		"cd": 1,
		"arguments": ["direction"],
		"description": "下个回合开始时向指定方向发射激光（参数：方向）",
		"effect": (game, direction)=>{
			game.player.status[0][1] = 'q';
			game.player.status[1][0] = direction;
			game.player.status[1][1] = 1;
			/*if (game.player.status[0][0]==="q") {
				if (game.player.status[1][1]===1) {
					var dir = game.player.status[1][0];
					var targets = direction_line(game, dir);
					for (var target of targets) {
						destroy(game, target);
					}
					game.player.status[1][0] = null;
					game.player.status[1][1] = 0;
				}
				else {
					var targets = direction_line(game, direction);
					if (distance(targets[0],game.player.pos)===1) destroy(game, targets[0]);
					game.player.status[1][0] = direction;
					game.player.status[1][1] = 1;
				}
			}
			else {
				var targets = direction_line(game, direction);
				if (distance(targets[0],game.player.pos)===1) destroy(game, targets[0]);

				game.player.status[1][0] = direction;
				game.player.status[1][1] = 1;
			}*/
		}
	},
	"爆火陨落": {
		"name": "爆火陨落",
		"cd": 2,
		"arguments": [],
		"description": "持续蓄力。在随机位置3*3范围消弹",
		"effect": (game)=>{
			game.player.status[0][1] = 'w';
			var row = random(1,6);
			var column = random(1,6);
			for (var r=row-1; r<=row+1; ++r) {
				for (var c=column-1; c<=column+1; ++c) {
					destroy(game, [r, c]);
				}
			}
			game.player.skills['w'].cd = 1;
		}
	},
	"地底太阳": {
		"name": "地底太阳",
		"cd": 3,
		"arguments": ["position"],
		"description": "在指定位置制造一个半径为1的太阳。持续蓄力以增加其半径（参数：第一次坐标，第二次无）",
		"effect": (game, position=null)=>{
			if (position!==null && getUnit(game.board, position)==="player") return;

			game.player.status[0][1] = 'e';

			if (game.player.status[0][0]==="e") {
				console.log(1);
				for (var row=0; row<game.board.length; ++row) {
					for (var column=0; column<game.board[row].length; ++column) {
						if (c_distance(game.player.status[2][0], [row, column])===game.player.status[2][1]) {
							console.log([row, column]);
							if (getUnit(game.board, [row, column])==="player") {
								game.player.hp -= 1;
								game.player.status[2][2] = true;
							}
							else {
								destroy(game, [row, column]);
								setUnit(game.board, [row, column], "sun");
							}
						}
					}
				}
				game.player.status[2][1] += 1;
			}
			else {
				destroy(game, position);
				setUnit(game.board, position, "sun");
				game.player.status[2][0] = position;
				game.player.status[2][1] = 1;
			}
			game.player.skills['e'].cd = 1;
		}
	}
};

