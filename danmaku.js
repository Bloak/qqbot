var characters = {
	"博丽灵梦":{
		"梦想封印":{
			"params":{
				"count": 1,
				"constraints":[
					(player, enemy, paramStr)=>{
						var posArr = posStr2Arr(paramStr);
						if (!posArr) {return false;}
						return distance(player.pos, posArr)<=2;
					}
				] // a bool function for each parameter
			},
			// main stages of settle
			"preMove": function(player, enemy, params){},
			"move": function(player, enemy, params){},
			"postMove": function(player, enemy, params){
				player.targets = [params[0]];
			},
			"damage": function(player, enemy, params){
				// 只有单目标时能这样写
				if (posInverse(enemy.pos).toString() === player.targets[0].toString()) {
					dealDamage(player, enemy, 4);
				}
				else {
					if (player.targets[0][1]<posInverse(enemy.pos)[1]) {
						player.pos = player.targets[0];
					}
				}
			},
			// max cooldown
			"cd": 5
		}
	},
	"雾雨魔理沙":{}
}

const generic_skills = {
	"空过":{
		"params":{
			"count": 0,
			"constraints": []
		},
		"preMove": function(player, enemy, params){},
		"move": function(player, enemy, params){},
		"postMove": function(player, enemy, params){},
		"damage": function(player, enemy, params){},
		"cd": 0
	},
	"移动":{
		"params":{
			"count": 1,
			"constraints": [
				(player, enemy, paramStr)=>{
					var posArr = posStr2Arr(paramStr);
					if (!posArr) {return false;}
					return distance(player.pos, posArr)==1;
				}
			]
		},
		"preMove": function(player, enemy, params){},
		"move": function(player, enemy, params){
			player.pos = [params[0]];
		},
		"postMove": function(player, enemy, params){},
		"damage": function(player, enemy, params){},
		"cd": 0
	},
	"普攻":{
		"params":{
			"count": 0,
			"constraints": []
		},
		"preMove": function(player, enemy, params){},
		"move": function(player, enemy, params){},
		"postMove": function(player, enemy, params){
			player.targets = [player.pos[0],player.pos[1]-1];
		},
		"damage": function(player, enemy, params){
			if (posInverse(enemy.pos).toString() === player.targets[0].toString()) {
				dealDamage(player, enemy, 1);
			}
		},
		"cd": 0
	}
}

// add generic skills to every character if not already specified
for (var character in characters) {
	for (var skill in generic_skills) {
		if (!(skill in characters[character])) {
			characters[character][skill] = generic_skills[skill];
		}
	}
}

// main function here
function settle(p1, p2){
	var p1_skill = characters[p1.character][p1.play[0]];
	var p1_params = p1.play[1];
	var p2_skill = characters[p2.character][p2.play[0]];
	var p2_params = p2.play[1];

	// add cd
	p1.cards[p1.play[0]] = p1_skill.cd;
	p2.cards[p2.play[0]] = p2_skill.cd;

	// main stages
	p1_skill.preMove(p1, p2, p1_params);
	p2_skill.preMove(p2, p1, p2_params);
	p1_skill.move(p1, p2, p1_params);
	p2_skill.move(p2, p1, p2_params);
	p1_skill.postMove(p1, p2, p1_params);
	p2_skill.postMove(p2, p1, p2_params);
	p1_skill.damage(p1, p2, p1_params);
	p2_skill.damage(p2, p1, p2_params);

	// end turn
	// all card cd -1
	for (card in p1.cards) {
		if (p1.cards[card] >= 1){
			p1.cards[card] -= 1;
		}
	}
	for (card in p2.cards) {
		if (p2.cards[card] >= 1){
			p2.cards[card] -= 1;
		}
	}
	// all status -1
	for (status in p1.status) {
		p1.status[status] -= 1;
		if (p1.status[status] <= 0) {
			delete p1.status[status];
		}
	}
	for (status in p2.status) {
		p2.status[status] -= 1;
		if (p2.status[status] <= 0) {
			delete p2.status[status];
		}
	}
	// death test
	if (p1.hp<=0) {
		p1.dead = true;
	}
	if (p2.hp<=0) {
		p2.dead = true;
	}

	// 清空攻击目标、清空出招、游戏结束判定在core内执行。需要先给双方display。
}

// settles all effects related to dealing/taking damage. excludes death verification
function dealDamage(player, enemy, value){
	if (enemy.status.avoid) {
		return;
	}
	enemy.hp -= value;
}

// returns false if not convertable
function posStr2Arr(posStr){
	if (posStr.length!==2){
		return false;
	}
	if (!('abcde'.includes(posStr[0]) && '12345'.includes(posStr[1]))){
		return false;
	}
	var result = [null, null];
	result[0] = {'a':0,'b':1,'c':2,'d':3,'e':4}[posStr[0]];
	result[1] = parseInt(posStr[1])-1;
	return result;
}

// takes two position arrays and calculate distance
function distance(pos1, pos2){
	return Math.abs(pos1[0]-pos2[0])+Math.abs(pos1[1]-pos2[1]);
}

// rotational inverse
function posInverse(posArr){
	return [4-posArr[0], 4-posArr[1]];
}

// takes the input string and the "params" property(object) of the skill. determines if input is valid
// considerations: skill cd, param constraints
function certify(player, enemy, input){

}

// decomposes the input string into "params" array. elements could be position array or integer
// called after the input is certified
function decompose(input){}

// returns a string to be sent to player
function display(player, enemy){}

// assignment a character to each player. add basic properties
function initialize(p1, p2){
	var characters_list = Object.keys(characters);
	for(var p of [p1, p2]) {
		p.pos = [2,4];
		p.play = null;
		p.hp = 5;
		p.status = {};
		p.targets = [];
		p.character = draw(characters_list); // 随机角色，双方不会重复
		p.cards = {};
		for (card in characters[p.character]) { // 符卡名称，包括基础技能
			p.cards[card] = 0; // cd，初始为0
		}
	}
}

// 辅助函数：随机抽取
function random(a,b) {
	return Math.floor(Math.random()*(b-a)+a);
}

function remove(array, index) {
	if (index<0 || index >= array.length) {
		return;
	}
	for (var i=index; i<array.length-1; i++) {
		array[i] = array[i+1];
	}
	array.pop();
}

function draw(deck) {
	var index = random(0, deck.length);
	var result = deck[index];
	remove(deck, index);
	return result;
}

// 清空攻击目标和出招。在回合结束阶段display之后调用
function clear(p){
	p.play = null;
	p.targets = [];
}

var app = {
	"settle": settle,
	"certify": certify,
	"decompose": decompose,
	"display": display,
	"initialize": initialize,
	"clear": clear
};

module.exports = app;

// test code
/*var p1 = {
	"opponent_id": "123456789",
	"character": "博丽灵梦",
	"pos": [2,4],
	"cards": {
		"空过": 0,
		"移动": 0,
		"普攻": 0,
		"梦想天生": 0
	},
	"play": null,
	"status": {},
	"targets": [],
	"hp": 5
};

var p2 = {
	"opponent_id": "1234567890",
	"character": "博丽灵梦",
	"pos": [2,4],
	"cards": {
		"空过": 0,
		"移动": 0,
		"普攻": 0,
		"梦想天生": 0
	},
	"play": null,
	"status": {},
	"targets": [],
	"hp": 5
};

p1.play = ["移动", [[2,3]]];
p2.play = ["普攻", []];

settle(p1, p2);
console.log(p1, p2);*/

var game = {
	"123": {"opponent_id": "321"},
	"321": {"opponent_id": "123"}
};
initialize(game["123"], game["321"]);
console.log(game);
