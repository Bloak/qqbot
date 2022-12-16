//public
function initialize() {
	var board = [];
	for (var i=0; i<7; i++) {
		board.push([]);
		for (var j=0; j<7; j++) {
			if (Math.random()<0.25){
				board[i].push("🌚");
			}
			else {
				board[i].push("❌");
			}
		}
	}
	var ints = shuffleArray(range(49));
	setValue(board, int2Coord(ints[0]), "🔥");
	setValue(board, int2Coord(ints[1]), "🧊");
	setValue(board, int2Coord(ints[2]), "👻");
	
	var trail = {
		"🔥":[getPosition(board, "🔥")],
		"🧊":[getPosition(board, "🧊")],
		"👻":[getPosition(board, "👻")]
	};

	var newBoard = JSON.parse(JSON.stringify(board));
	var times = 100;
	for (var i=0; i<times; i++) {
		var direction = draw(["上","下","左","右"]);
		moveLineAll(newBoard, direction, trail);
	}
	//console.log(trail);
	for (var unit in trail) {
		if (trail[unit].length<=8) {
			[board, trail] = initialize();
			break;
		}
	}

	if (trail["🔥"].length>8&&trail["🧊"].length>8&&trail["👻"].length>8&&!decorated(board)) {
		setValue(board, trail["🔥"][trail["🔥"].length-1], "🍠");
		trail["🔥"].pop();
		trail["🔥"].splice(0,1);
		trail["🔥"] = shuffleArray(trail["🔥"]);
		setValue(board, trail["🔥"][0], "🍠");
		setValue(board, trail["🔥"][1], "🍠");

		setValue(board, trail["🧊"][trail["🧊"].length-1], "🐸");
		trail["🧊"].pop();
		trail["🧊"].splice(0,1);
		trail["🧊"] = shuffleArray(trail["🧊"]);
		setValue(board, trail["🧊"][0], "🐸");
		setValue(board, trail["🧊"][1], "🐸");

		//console.log(display(board));
	}

	return [board, trail];
}

function display(board) {
	var result = "";
	for (var row=0; row<board.length; row++) {
		for (var column=0; column<board[row].length; column++) {
			result += board[row][column];
		}
		result += "\n";
	}
	result = result.slice(0,result.length-1);
	return result;
}

module.exports = {
	"initialize": initialize,
	"display": display
};

//test
function main() {
	initialize();
}

main();

//private
function getPosition(board, unit) {
	for (var row=0; row<board.length; row++) {
		for (var column=0; column<board[row].length; column++) {
			if (board[row][column]==unit) {
				return [row, column];
			}
		}
	}
	return null;
}

function getPositions(board) {
	return {
		"🔥":getPosition(board, "🔥"),
		"🧊":getPosition(board, "🧊"),
		"👻":getPosition(board, "👻")
	};
}

function positionOccupied(trail, unit, pos) {
	for (var otherUnit in trail) { // includes the unit itself
		var singleTrail = trail[otherUnit];
		for (var otherPos of singleTrail) {
			if (otherPos[0]===pos[0] && otherPos[1]===pos[1]) {
				return true;
			}
		}
	}
	return false;
}

function moveUnit(board, unit, direction, trail) {
	var pos = getPosition(board, unit);
	var row = pos[0];
	var column = pos[1];
	var newPos;
	var target;
	if (direction==="上") {
		newPos = [row-1, column];
	}
	else if (direction==="下") {
		newPos = [row+1, column];
	}
	else if (direction==="左") {
		newPos = [row, column-1];
	}
	else if (direction==="右") {
		newPos = [row, column+1];
	}
	target = getValue(board, newPos);
	if (target && (target==="❌")) {
		switchValue(board, pos, newPos);
		if (!positionOccupied(trail, unit, newPos)) {
			trail[unit].push(newPos);
		}
		return true;
	}
	else {
		return false;
	}
}

function moveUnitAll(board, direction, trail) {
	var fire = moveUnit(board, "🔥", direction, trail);
	var ice = moveUnit(board, "🧊", direction, trail);
	var ghost = moveUnit(board, "👻", direction, trail);
	return fire||ice||ghost;
}

function moveLineAll(board, direction, trail) {
	while (moveUnitAll(board, direction, trail)) {}
}

function int2Coord(index) {
	var column = index%7;
	var row = (index-column)/7;
	return [row, column];
}

function random(a, b) {
	return Math.floor(Math.random()*(b-a)+a);
}

function draw(arr) {
	return arr[random(0,arr.length)];
}

function range(n,m,d=1){
if(d==0) return undefined;
var arr = [];
if(m==undefined){ for(var i=0;i<n;i+=d){arr.push(i);} return arr;}
else
if(m!=undefined&&m>=n){
if(d<0){ return [];}
for(var i=n;i<m;i+=d){arr.push(i);} return arr;
}else if(m!=undefined&&m<=n){
if(d>0){ return [];}
for(var i=n;i>m;i+=d){arr.push(i);} return arr;
}
return undefined;
}

function shuffleArray(arr, copy=false) {
if (copy) arr = Array.from(arr);
for (var i = arr.length; i > 1;) {
var r = (Math.random() * i--) | 0;
[arr[r], arr[i]] = [arr[i], arr[r]];
}
return arr;
}

function getValue(board, coord) {
	if (coord[0] in board) {
		if (coord[1] in board[coord[0]]) {
			return board[coord[0]][coord[1]];
		}
	}
	return false;
}

function setValue(board, coord, value) {
	board[coord[0]][coord[1]] = value;
}

function switchValue(board, coord1, coord2) {
	var temp = getValue(board, coord1);
	setValue(board, coord1, getValue(board, coord2));
	setValue(board, coord2, temp);
}

function decorated(board) {
	for (var row=0; row<board.length; row++) {
		if (board[row].includes("🍠")) {
			return true;
		}
	}
	return false;
}
