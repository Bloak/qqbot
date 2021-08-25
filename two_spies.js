const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

const WIDTH = 600;
const HEIGHT = 600;

// struct city
function createCity(pos, is_big) {
	var city = {};
	city.pos = pos; // pixel position [x, y]
	city.is_big = is_big; // Big cities generates 4 intels/turn, small ones only generates 1
	city.starter = null; // null or 0 (for first player) or 1 (for second player)
	city.owner = null; // who controls the city
	city.locked = false; // if locked, forbids entry, urges exit
	city.bonus = null; // null or number (for intel) or "action" (for extra action)
	city.links = []; // contains indices of linked cities
	return city;
}

// struct board is simply an array of cities
// sequence of cities matters (lock from last to first)
function createBoard(cityArray) { // cityArray component template: {pos:[x,y], is_big:bool}
	var board = [];
	for (var city of cityArray) {
		board.push(createCity(city.pos, city.is_big));
	}
	return board;
}

// called in initialize()
// sourceBoard -> board conversion. assign starting cities
function generateBoard(sourceBoard) {
	var board = JSON.parse(JSON.stringify(sourceBoard.board));
	var starter = sourceBoard.starters[random(0,sourceBoard.starters.length)];
	for (var side = 0; side<=1; ++side) {
		board[starter[side]].starter = side;
		board[starter[side]].owner = side;
	}
	return board;
}

// link two cities with indices i and j within a board
function linkCities(board, i, j) {
	board[i].links.push(j);
	board[j].links.push(i);
}

function addLinks(board, links) {
	for (var link of links) {
		linkCities(board, link[0], link[1]);
	}
}

function addBonus(board, i) {
	if (board[i].bonus===null) board[i].bonus = 10;
	else if (board[i].bonus===30) board[i].bonus = "action";
	else if (board[i].bonus!=="action") board[i].bonus += 10;
}

// board database
/*var test_board = [];
test_board.push(createCity([300,300], true, null));
test_board.push(createCity([100,300], false, 0));
test_board.push(createCity([400,200], false, 1));
linkCities(test_board, 0, 1);
linkCities(test_board, 0, 2);*/

// sourceBoard template: {"board":board, starters:[[i,j],[i,j],...]}
var sourceBoards = [];
// board #0 roundabout
sourceBoards.push({
	"board":createBoard([
			{"pos":[300,200],"is_big":true},
			{"pos":[200,400],"is_big":true},
			{"pos":[300,400],"is_big":false},
			{"pos":[200,200],"is_big":false},
			{"pos":[400,300],"is_big":false},
			{"pos":[100,300],"is_big":false},
			{"pos":[100,200],"is_big":true},
			{"pos":[200,500],"is_big":false},
			{"pos":[400,100],"is_big":false},
			{"pos":[300,500],"is_big":false},
			{"pos":[500,200],"is_big":false}
		]),
	starters:[[8,5],[4,3],[10,7],[5,2],[10,5],[5,3]]
});
addLinks(sourceBoards[0].board, [[0,1],[0,2],[0,3],[0,4],[0,8],[0,10],[1,2],[1,5],[1,7],[2,4],[2,7],[2,9],[3,6],[3,8],[4,10],[5,6],[5,7],[7,9],[8,10]]);

// board #1 central
sourceBoards.push({
	"board":createBoard([
			{"pos":[200,400],"is_big":true},
			{"pos":[200,300],"is_big":false},
			{"pos":[300,200],"is_big":false},
			{"pos":[400,200],"is_big":true},
			{"pos":[400,300],"is_big":false},
			{"pos":[100,400],"is_big":false},
			{"pos":[300,400],"is_big":false},
			{"pos":[400,100],"is_big":false},
			{"pos":[100,300],"is_big":false},
			{"pos":[500,200],"is_big":false},
			{"pos":[200,500],"is_big":false}
		]),
	"starters":[[9,1],[6,1],[9,2],[8,7],[8,10],[8,4]]
});
addLinks(sourceBoards[1].board, [[0,1],[0,3],[0,5],[0,6],[0,10],[1,2],[1,5],[1,8],[2,3],[2,7],[3,4],[3,7],[3,9],[4,6],[4,9],[5,8],[5,10],[6,10],[7,9]]);

// board #2 choke
sourceBoards.push({
	"board":createBoard([
			{"pos":[300,300],"is_big":true},
			{"pos":[400,300],"is_big":false},
			{"pos":[400,400],"is_big":false},
			{"pos":[200,200],"is_big":false},
			{"pos":[200,300],"is_big":false},
			{"pos":[200,400],"is_big":false},
			{"pos":[400,200],"is_big":false},
			{"pos":[100,300],"is_big":false},
			{"pos":[500,300],"is_big":false},
			{"pos":[500,200],"is_big":false},
			{"pos":[100,400],"is_big":false},
			{"pos":[200,500],"is_big":false},
			{"pos":[500,400],"is_big":false}
		]),
	"starters":[[9,2],[8,6],[7,6],[4,2],[9,3],[10,2]]
});
addLinks(sourceBoards[2].board, [[0,1],[0,2],[0,3],[0,5],[0,6],[1,2],[1,6],[1,8],[2,12],[3,4],[3,7],[4,5],[4,7],[4,10],[5,10],[5,11],[6,9],[7,10],[8,9],[8,12],[10,11]]);

// board #3 bridges
sourceBoards.push({
	"board":createBoard([
			{"pos":[300,200],"is_big":true},
			{"pos":[300,400],"is_big":true},
			{"pos":[200,300],"is_big":true},
			{"pos":[400,300],"is_big":true},
			{"pos":[500,300],"is_big":false},
			{"pos":[100,300],"is_big":false},
			{"pos":[500,200],"is_big":false},
			{"pos":[100,400],"is_big":false},
			{"pos":[100,200],"is_big":false},
			{"pos":[400,100],"is_big":false},
			{"pos":[500,400],"is_big":false},
			{"pos":[200,500],"is_big":false}
		]),
	"starters":[[11,8],[9,4],[6,7],[11,5],[9,5],[9,8]]
});
addLinks(sourceBoards[3].board, [[0,2],[0,3],[0,6],[0,9],[1,2],[1,3],[1,7],[1,11],[2,5],[2,7],[2,8],[3,4],[3,6],[3,10],[4,6],[4,10],[5,7],[5,8],[6,9],[7,11]]);

// board #4 mobiius
sourceBoards.push({
	"board":createBoard([
			{"pos":[300,200],"is_big":false},
			{"pos":[200,200],"is_big":false},
			{"pos":[400,200],"is_big":false},
			{"pos":[400,400],"is_big":false},
			{"pos":[200,400],"is_big":false},
			{"pos":[200,300],"is_big":false},
			{"pos":[300,500],"is_big":false},
			{"pos":[100,300],"is_big":false},
			{"pos":[500,300],"is_big":false},
			{"pos":[500,200],"is_big":false},
			{"pos":[500,100],"is_big":true},
			{"pos":[100,100],"is_big":true}
		]),
	"starters":[[4,1],[3,7],[5,2],[3,1],[1,2],[3,9]]
});
addLinks(sourceBoards[4].board, [[0,1],[0,2],[0,3],[0,4],[1,5],[1,11],[2,3],[2,8],[2,9],[2,10],[3,6],[3,8],[4,5],[4,6],[4,7],[5,7],[5,11],[7,11],[8,9],[9,10],[10,11]]);

// board #5 cluster
sourceBoards.push({
	"board":createBoard([
			{"pos":[300,200],"is_big":false},
			{"pos":[200,400],"is_big":true},
			{"pos":[300,400],"is_big":false},
			{"pos":[400,400],"is_big":false},
			{"pos":[400,200],"is_big":false},
			{"pos":[200,200],"is_big":false},
			{"pos":[200,300],"is_big":true},
			{"pos":[500,300],"is_big":false},
			{"pos":[400,500],"is_big":false},
			{"pos":[200,500],"is_big":false},
			{"pos":[100,400],"is_big":true},
			{"pos":[100,300],"is_big":false},
			{"pos":[300,100],"is_big":false}
		]),
	"starters":[[8,4],[3,5],[8,12],[0,2],[8,3],[5,2]]
});
addLinks(sourceBoards[5].board, [[0,1],[0,3],[0,4],[0,5],[0,12],[1,2],[1,6],[1,9],[1,10],[2,3],[2,8],[2,9],[3,4],[3,7],[4,7],[4,12],[5,6],[5,11],[5,12],[6,10],[6,11],[7,8],[8,9],[9,10],[10,11]]);

// board #6 Saint Peter's Cross
sourceBoards.push({
	"board":createBoard([
			{"pos":[300,300],"is_big":true},
			{"pos":[300,200],"is_big":true},
			{"pos":[400,200],"is_big":true},
			{"pos":[400,300],"is_big":true},
			{"pos":[200,400],"is_big":false},
			{"pos":[200,200],"is_big":false},
			{"pos":[500,200],"is_big":false},
			{"pos":[500,400],"is_big":false},
			{"pos":[300,400],"is_big":false},
			{"pos":[500,100],"is_big":false},
			{"pos":[100,300],"is_big":false},
			{"pos":[300,100],"is_big":false},
			{"pos":[300,500],"is_big":false},
			{"pos":[100,400],"is_big":false}
		]),
	"starters":[[10,7],[11,7],[9,4],[11,10],[11,13],[5,7]]
});
addLinks(sourceBoards[6].board, [[0,1],[0,2],[0,3],[0,4],[0,10],[0,13],[1,2],[1,3],[1,5],[1,11],[2,3],[2,6],[2,9],[3,7],[4,8],[4,12],[4,13],[5,10],[5,11],[6,7],[6,9],[7,8],[7,12],[8,12],[9,11],[10,13]]);

// board #7 all roads lead to Berlin
sourceBoards.push({
	"board":createBoard([
			{"pos":[300,300],"is_big":true},
			{"pos":[400,300],"is_big":true},
			{"pos":[200,400],"is_big":true},
			{"pos":[300,500],"is_big":false},
			{"pos":[400,400],"is_big":false},
			{"pos":[400,200],"is_big":false},
			{"pos":[200,200],"is_big":false},
			{"pos":[100,300],"is_big":false},
			{"pos":[300,100],"is_big":false},
			{"pos":[100,400],"is_big":false},
			{"pos":[400,500],"is_big":false},
			{"pos":[500,300],"is_big":false},
			{"pos":[200,500],"is_big":false}
		]),
	"starters":[[6,3],[7,3],[8,4],[8,3],[9,8],[7,4]]
});
addLinks(sourceBoards[7].board, [[0,1],[0,2],[0,3],[0,4],[0,6],[0,7],[0,8],[1,4],[1,5],[1,11],[2,3],[2,9],[2,12],[3,10],[3,12],[4,10],[4,11],[5,8],[5,11],[6,7],[6,8],[7,9],[9,12]]);

// board #8 Viennese
sourceBoards.push({
	"board":createBoard([
			{"pos":[300,300],"is_big":true},
			{"pos":[400,400],"is_big":false},
			{"pos":[400,300],"is_big":false},
			{"pos":[200,400],"is_big":false},
			{"pos":[100,100],"is_big":true},
			{"pos":[100,300],"is_big":false},
			{"pos":[200,500],"is_big":false},
			{"pos":[400,100],"is_big":false},
			{"pos":[500,500],"is_big":false},
			{"pos":[100,400],"is_big":false},
			{"pos":[500,200],"is_big":false}
		]),
	"starters":[[8,5],[6,5],[3,7],[1,7],[5,7],[6,2]]
});
addLinks(sourceBoards[8].board, [[0,1],[0,3],[0,4],[0,7],[1,2],[1,3],[1,8],[1,10],[2,7],[2,10],[3,5],[3,6],[3,9],[4,5],[4,7],[5,9],[6,8],[6,9],[7,10],[8,10]]);

// board #9 distant treasure
sourceBoards.push({
	"board":createBoard([
			{"pos":[300,300],"is_big":false},
			{"pos":[200,200],"is_big":false},
			{"pos":[200,400],"is_big":false},
			{"pos":[100,300],"is_big":false},
			{"pos":[400,200],"is_big":false},
			{"pos":[100,500],"is_big":false},
			{"pos":[500,500],"is_big":true},
			{"pos":[500,100],"is_big":true},
			{"pos":[100,100],"is_big":false},
			{"pos":[200,100],"is_big":false},
			{"pos":[200,500],"is_big":false}
		]),
	"starters":[[2,4],[8,5],[10,4],[9,5],[9,3],[5,1]]
});
addLinks(sourceBoards[9].board, [[0,1],[0,2],[0,4],[0,6],[1,3],[1,4],[1,9],[2,3],[2,5],[2,10],[3,5],[3,8],[4,7],[5,10],[6,10],[8,9]]);

// struct spy
function createSpy(is_first, location) {
	var spy = {};
	spy.action = (is_first)?2:0;
	spy.intel = (is_first)?1:10;
	spy.location = location; // index of city
	// temporary status
	spy.cover = false;
	spy.deep_cover = false;
	spy.prep = 0;
	// permanent unlocks
	spy.strike_reports = false;
	spy.encryption = false;
	spy.rapid_recon = false;

	spy.skill = null; // current skill used, for notifying opponent
	return spy;
}

// initialize an empty game
// parameter: {"room_id":#, players":[<qid1>, <qid2>]}
function initialize(game) {
	// determine first and second player
	if (Math.random()<0.5) game.players = [game.players[1],game.players[0]];
	// globals
	game.turn = 0; // determine whose turn by game.turn%2
	game.winner = null;
	game.last_operate = null;
	// board
	var board_num = random(0, sourceBoards.length);
	game.board = generateBoard(sourceBoards[board_num]);
	game.board_num = board_num;
	// spies
	var starters = [null, null];
	for (var i=0; i<game.board.length; ++i) {
		if (game.board[i].starter === 0) starters[0] = i;
		if (game.board[i].starter === 1) starters[1] = i;
	}
	game.spies = [createSpy(true, starters[0]), createSpy(false, starters[1])];
}

// drawing functions
function clear(canvas) {
	var context = canvas.getContext('2d');
	context.fillStyle = '#feffd0'; // light yellow
    context.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawSingleConnection(canvas, board, i, j) {
	var [xi, yi] = board[i].pos;
	var [xj, yj] = board[j].pos
	var context = canvas.getContext('2d');
	context.strokeStyle = '#000000';
	if (board[i].locked || board[j].locked) context.strokeStyle = '#888888';
	context.lineWidth = 3;
	context.beginPath();
	context.moveTo(xi, yi);
	context.lineTo(xj, yj);
	context.stroke();
}

function drawMultipleConnections(canvas, board, i) {
	var city = board[i];
	for (var j of city.links) drawSingleConnection(canvas, board, i, j);
}

function drawAllConnections(canvas, board) {
	for (var i=0; i<board.length; ++i) drawMultipleConnections(canvas, board, i);
}

function drawCity(canvas, board, i) {
	var context = canvas.getContext('2d');

	// parameters
	var city = board[i];
	var [xi, yi] = city.pos;
	var radius = (city.is_big)?25:15;
	var color = 'black';
	if (city.owner===0) color = 'red';
	else if (city.owner===1) color = 'blue';
	if (city.locked) {
		color = '#888888';
		if (city.owner===0) color = '#ff8888';
		else if (city.owner===1) color = '#8888ff';
	}

	// draw circle
	context.beginPath();
	context.arc(xi, yi, radius, 0, 2 * Math.PI, false);
	context.fillStyle = '#ffffff';
	context.fill();
	context.lineWidth = 5;
	context.strokeStyle = color;
	context.stroke();

	// draw city index (top left)
	context.font = '20px serif';
	context.fillStyle = '#000000';
	var distance = (city.is_big)?35:25;
	context.fillText(i.toString(), xi-distance, yi-distance);

	// draw bonus (at center)
	context.font = '20px serif';
	context.fillStyle = '#000000';
	if (city.bonus!==null && city.bonus!=='action') {
		context.fillText(city.bonus.toString(), xi-10, yi+8);
	}
	else if (city.bonus==='action') {
		// draw a lightning icon
		context.strokeStyle = 'black';
		context.lineWidth = 3;

		context.beginPath();
		context.moveTo(xi, yi-10);
		context.lineTo(xi-3, yi);
		context.stroke();

		//context.beginPath();
		context.moveTo(xi-3, yi);
		context.lineTo(xi+3, yi);
		context.stroke();

		//context.beginPath();
		context.moveTo(xi+3, yi);
		context.lineTo(xi, yi+10);
		context.stroke();
	}
}

// side = 0 or 1; drawer = 0 or 1
function drawSpy(canvas, game, side, drawer) {
	var context = canvas.getContext('2d');

	var spy = game.spies[side];
	var [x, y] = game.board[spy.location].pos;
	var color = (side===0)?'red':'blue';
	var radius = (side===0)?10:7; // avoid overlapping

	// visible detect
	var visible = true;
	if (spy.cover && side!==drawer) visible = false;

	if (visible) {
		context.beginPath();
		context.arc(x, y, radius, 0, 2 * Math.PI, false);
		context.fillStyle = color;
		context.fill();
	}
}

function drawTwoSpies(canvas, game, drawer) {
	drawSpy(canvas, game, 0, drawer);
	drawSpy(canvas, game, 1, drawer);
}

function drawAllCity(canvas, board) {
	for (var i=0; i<board.length; ++i) drawCity(canvas, board, i);
}

// qq should be string
async function display(game, qq) {
	// determine which side
	var side = game.players.indexOf(qq);
	// drawing
	var canvas = createCanvas(WIDTH,HEIGHT);
	// background
	try {
		var background = await loadImage(`data/image/map${game.board_num}.png`);
		var context = canvas.getContext('2d');
		context.drawImage(background, 0, 0);
	} catch(err) {
		clear(canvas);
	}
	drawAllConnections(canvas, game.board);
	drawAllCity(canvas, game.board);
	drawTwoSpies(canvas, game, side);
	// save the image
	var buffer = canvas.toBuffer('image/png');

	/*await fs.promises.writeFile(`data/image/two_spies_${game.room_id}_${side}.jpeg`, buffer);
	var image = `[CQ:image,file=data/image/two_spies_${game.room_id}_${side}.jpeg]`;*/

	// text info
	var msg = "";
	msg += `第${game.turn}回合\n`;

	msg += `intel：${game.spies[side].intel}:${(game.spies[1-side].encryption)?'?':game.spies[1-side].intel}\n`;

	if (game.last_operate===side) msg += `你使用了${game.spies[side].skill}\n`;
	if (game.last_operate===1-side) {
		msg += `你的对手使用了`;
		var skill = game.spies[1-side].skill;
		var skill_display = "";
		if (['wait', 'move'].includes(skill)) skill_display = 'move';
		else if (['strike', 'control'].includes(skill)) skill_display = skill;
		else if (game.spies[1-side].encryption) skill_display = (skill==="encryption")?skill:'?';
		else skill_display = skill;
		msg += skill_display + '\n';
	}

	if (game.turn%2===side) msg += `你还有${game.spies[side].action}点行动力\n`;
	else msg += `你的对手还有${game.spies[1-side].action}点行动力\n`;

	return [
		{
			"type": "text",
			"data": {"text": msg}
		},
		{
			"type": "image",
			"data": {"file": buffer}
		}
	];
}

// return success or not
function operate(game, command, qq) {
	// determine which side
	var side = game.players.indexOf(qq);
	var spy = game.spies[side];

	var success = operate_helper(game, command, side);
	if (success) {
		spy.action -= 1;
		spy.skill = (command.includes('move'))?"move":command;
		game.last_operate = side;
		if (spy.action === 0 && game.winner===null) {
			endTurn(game);
		}
	}
	return success;
}

// return success or not
function operate_helper(game, command, side) {
	if (game.turn%2!==side) return false;
	if (game.winner!==null) return false;

	// if inside a locked city and has only 1 action left, one must move out
	if (game.board[game.spies[side].location].locked && game.spies[side].action===1) {
		if (!(command.slice(0,5)==="move ")) return false;
		return move(game, side, command.slice(5));
	}

	if (['wait','strike','control','locate','go deep','prep','strike reports','encryption','rapid recon'].includes(command)) {
		return skills[command](game, side); // success or not
	}
	else if (command.slice(0,5)==="move ") {
		var destination = command.slice(5);
		return move(game, side, destination); // note: destination is a string
	}
	else return false;
}

// skill functions
function wait(game, side) {
	game.spies[side].cover = true; // gain cover
	inEnemyCityDetect(game, side);
	return true;
}

function move(game, side, destination) {
	if (isNaN(destination)) return false;
	var i = parseInt(destination);
	var board = game.board;
	if (i < 0 || i >= board.length) return false;
	var spy = game.spies[side];
	var city = board[spy.location];
	if (board[i].locked) return false;
	if (city.links.includes(i)) { // two cities are connected
		spy.location = i;
		spy.cover = true; // gain cover
		inEnemyCityDetect(game, side);
		if (spy.rapid_recon && game.spies[1-side].location===i) breakCover(game.spies[1-side]); // break opponent's cover by rapid recon
		return true;
	}
	else return false;
}

function strike(game, side) {
	var i = game.spies[side].location;
	if (game.spies[1-side].location===i) { // strike successful
		game.winner = side;
		game.spies[0].cover = false;
		game.spies[1].cover = false;
	}
	if (game.spies[1-side].strike_reports) breakCover(game.spies[side]); // lose cover against strike reports
	return true;
}

function control(game, side) {
	var i = game.spies[side].location;
	if (game.board[i].owner!==side) game.board[i].owner = side;
	else return false;
	game.spies[side].cover = false; // lose cover (ignore deep cover)
	return true;
}

function locate(game, side) {
	var spy = game.spies[side];
	if (spy.intel<10) return false;
	if (game.spies[1-side].deep_cover===false && game.spies[1-side].cover===false) return false;
	spy.intel -= 10;
	if (game.spies[1-side].deep_cover===false) breakCover(game.spies[1-side]); // fail against deep cover
	return true;
}

function go_deep(game, side) {
	var spy = game.spies[side];
	if (spy.deep_cover) return false;
	if (spy.intel<20) return false;
	spy.intel -= 20;
	spy.deep_cover = true;
	return true;
}

function prep(game, side) {
	var spy = game.spies[side];
	if (spy.intel<40) return false;
	spy.intel -= 40;
	spy.prep += 1;
	return true;
}

function strike_reports(game, side) {
	var spy = game.spies[side];
	if (spy.strike_reports) return false;
	if (spy.intel<10) return false;
	spy.intel -= 10;
	spy.strike_reports = true;
	return true;
}

function encryption(game, side) {
	var spy = game.spies[side];
	if (spy.encryption) return false;
	if (spy.intel<25) return false;
	spy.intel -= 25;
	spy.encryption = true;
	return true;
}

function rapid_recon(game, side) {
	var spy = game.spies[side];
	if (spy.rapid_recon) return false;
	if (spy.intel<40) return false;
	spy.intel -= 40;
	spy.rapid_recon = true;
	return true;
}

const skills = {
	"wait": wait,
	"move": move,
	"strike": strike,
	"control": control,
	"locate": locate,
	"go deep": go_deep,
	"prep": prep,
	"strike reports": strike_reports,
	"encryption": encryption,
	"rapid recon": rapid_recon
};

function endTurn(game) {
	game.turn += 1;
	var new_side = game.turn%2;
	var new_spy = game.spies[new_side];
	// assign actions
	new_spy.action = 2 + new_spy.prep;
	new_spy.prep = 0;
	// add intel
	addIntel(game, new_side);
	// break deep cover
	new_spy.deep_cover = false;
	inEnemyCityDetect(game, new_side);
	// break both spies' cover if they meet
	if (game.spies[0].location===game.spies[1].location) {
		breakCover(game.spies[0]);
		breakCover(game.spies[1]);
	}
	// spy of this turn collects bonus
	var city = game.board[new_spy.location];
	if ([10,20,30].includes(city.bonus)){
		new_spy.intel += city.bonus;
		city.bonus = null;
		breakCover(new_spy);
	}
	else if (city.bonus==="action") {
		new_spy.action += 1;
		city.bonus = null;
		breakCover(new_spy);
	}
	// generate bonus
	for (var i=0; i<game.board.length; ++i) {
		if (game.board[i].locked===false && game.spies[0].location!==i && game.spies[1].location!==i) {
			var p = (game.board[i].bonus===null)?0.05:0.2;
			if (Math.random()<p) addBonus(game.board, i);
		}
	}
	// lockdown
	if (game.turn >= 10 && game.turn%5 === 0) {
		for (var i=game.board.length-1; i>=1; --i) {
			if (game.board[i].locked===false) {
				game.board[i].locked = true;
				break;
			}
		}
	}
}

// auxilliary functions
function breakCover(spy) {
	if (spy.deep_cover) return;
	spy.cover = false;
}

function addIntel(game, side) {
	var spy = game.spies[side];
	for (var city of game.board) {
		if (city.owner===side) spy.intel += (city.is_big)?4:1;
	}
}

function controlCity(game, side, i) {
	game.board[i].owner = side;
}

// lose cover if in enemy city
function inEnemyCityDetect(game, side) {
	var spy = game.spies[side];
	if (game.board[spy.location].owner===1-side) {
		breakCover(spy);
	}
}

module.exports = {
	"initialize": initialize,
	"display": display,
	"operate": operate
};

function random(a,b) {
	return Math.floor(Math.random()*(b-a)+a);
}