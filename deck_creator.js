const fs = require('fs');

var rawData = fs.readFileSync('draw_card.json');
var decks = JSON.parse(rawData);

var deck = [];
var ranks = ['黑桃','红桃','草花','方块'];
var numbers = ['A','2','3','4','5','6','7','8'];
for (var i in ranks){
	var rank = ranks[i];
	for (var j in numbers){
		var number = numbers[j];
		deck.push(rank+number);
	}
}

decks.srcDecks['猜牌'] = deck;

var newData = JSON.stringify(decks);
fs.writeFileSync('draw_card.json',newData);