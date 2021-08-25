const mapGenerator = require("./mokou_cirno_map_generator");

//public
function initialize() {
	var board = mapGenerator.initialize()[0];
	var game = {
		"board": board,
		"step": 0,
		"fail": false,
		"success": false,
		"history": []
	};
	var solution = solve(game);
	if (solution===null) {
		game.solution = null;
		game.maxStep = null;
	}
	else {
		game.maxStep = solution.length;
		game.solution = '';
		for (var direction of solution) {
			game.solution += [null,'上','下','左','右'][direction];
		}
	}
	game.initialBoard = JSON.parse(JSON.stringify(board));
	game.history = [];
	return game;
}

function display(board) {
	return mapGenerator.display(board);
}

function move(game, direction) {
	game.history.push(direction);
	while (moveUnitAll(game, direction)) {}
	game.step += 1;
	if (game.fail===false && getPosition(game.board, "🍠")===null && getPosition(game.board, "🐸")===null) {
		game.success = true;
	}
	else if (game.step === game.maxStep) {
		game.fail = "幽幽子👻由于太过饥饿将你吃掉了";
	}
}

function back(game) {
	if (game.step===0) return false;
	var history = game.history;
	restart(game);
	for (var i=0; i<history.length-1; ++i) {
		move(game, history[i]);
	}
}

function restart(game) {
	game.board = JSON.parse(JSON.stringify(game.initialBoard));
	game.step = 0;
	game.history = [];
	game.fail = false;
}

module.exports = {
	"initialize": initialize,
	"display": display,
	"move": move,
	"restart": restart,
	"back": back
};

//test
function main() {
	var game = initialize();
	console.log(game);
}

//main();

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

function moveUnit(game, unit, direction) {
	//console.log(unit);
	var pos = getPosition(game.board, unit);
	var row = pos[0];
	var column = pos[1];
	var newPos;
	var target;
	if (direction===1) {
		newPos = [row-1, column];
	}
	else if (direction===2) {
		newPos = [row+1, column];
	}
	else if (direction===3) {
		newPos = [row, column-1];
	}
	else if (direction===4) {
		newPos = [row, column+1];
	}
	target = getValue(game.board, newPos);
	if (!target) {
		return false;
	}
	if (target==="❌") {
		switchValue(game.board, pos, newPos);
		return true;
	}
	else if (unit==="🔥"&&target==="🍠") {
		setValue(game.board, newPos, "🔥");
		setValue(game.board, pos, "❌");
		return true;
	}
	else if (unit==="🧊"&&target==="🐸") {
		setValue(game.board, newPos, "🧊");
		setValue(game.board, pos, "❌");
		return true;
	}
	else if (unit==="🔥"&&target==="🐸") {
		game.fail = "妹红🔥把青蛙🐸烤熟了";
		return false;
	}
	else if (unit==="👻"&&target==="🐸") {
		game.fail = "幽幽子👻吃掉了青蛙🐸";
		return false;
	}
	else if (unit==="🧊"&&target==="🍠") {
		game.fail = "琪露诺🧊把红薯🍠冻成冰块了";
		return false;
	}
	else if (unit==="👻"&&target==="🍠") {
		game.fail = "幽幽子👻吃掉了红薯🍠";
		return false;
	}
	else {
		return false;
	}
}

function moveUnitAll(game, direction) {
	var fire = moveUnit(game, "🔥", direction);
	var ice = moveUnit(game, "🧊", direction);
	var ghost = moveUnit(game, "👻", direction);
	return fire||ice||ghost;
}

function solve(game, max=9, min=0) {
	var solution = [];
	var result = {"solution": null};
	for (var totalStep=min; totalStep<=max; ++totalStep) {
		if (solvable(game, solution, result, totalStep)) return result.solution;
	}
	return null;
}

function solvable(game, partOfSolution, result, totalStep) {
	if (result.solution!==null) return false;
	if (partOfSolution.length === totalStep) {
		if (testSolution(game, partOfSolution)) {
			result.solution = partOfSolution;
			return true;
		}
		else return false;
	}
	var nextGeneration = [];
	for (var direction of [1,2,3,4]) {
		if (partOfSolution.length===0 || partOfSolution[partOfSolution.length-1]!==direction) {
			nextGeneration.push(partOfSolution.concat([direction]));
		}
	}
	for (var nextSolution of nextGeneration) {
		if (solvable(game, nextSolution, result, totalStep)) return true;
	}
	return false;
}

function testSolution(game, solution) {
	var gameCopy = JSON.parse(JSON.stringify(game));
	for (var direction of solution) {
		move(gameCopy, direction);
		if (gameCopy.success) return true;
		else if (gameCopy.fail) return false;
	}
	return false;
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